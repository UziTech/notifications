const {Notification, CompositeDisposable} = require("atom");
const fs = require("fs-plus");
const NotificationElement = require("./notification-element");
const NotificationsLog = require("./notifications-log");
const StatusBarManager = require("./status-bar-manager");
const config = require("./config");

let StackTraceParser = null;
function isCoreOrPackageStackTrace(stack) {
	if (!StackTraceParser) {
		StackTraceParser = require("stacktrace-parser");
	}
	for (const {file} of StackTraceParser.parse(stack)) {
		if ((file === "<embedded>") || fs.isAbsolute(file)) {
			return true;
		}
	}
	return false;
}

const Notifications = {
	isInitialized: false,
	subscriptions: null,
	duplicateTimeDelay: 500,
	lastNotification: null,
	statusBarManager: null,
	allowPopups: null,
	config,

	activate() {
		const CommandLogger = require("./command-logger");
		CommandLogger.start();
		this.subscriptions = new CompositeDisposable();

		this.disableNotificationsPackage();

		for (const notification of atom.notifications.getNotifications()) {
			this.addNotificationView(notification);
		}
		this.subscriptions.add(atom.notifications.onDidAddNotification(notification => this.addNotificationView(notification)));

		this.subscriptions.add(atom.onWillThrowError(function ({message, url, line, originalError, preventDefault}) {
			let notificationMessage = message;
			let match;
			if (originalError.name === "BufferedProcessError") {
				notificationMessage = notificationMessage.replace("Uncaught BufferedProcessError: ", "");
				atom.notifications.addError(notificationMessage, {dismissable: true});

			} else if ((originalError.code === "ENOENT") && !/\/atom/i.test(notificationMessage) && (match = /spawn (.+) ENOENT/.exec(notificationMessage))) {
				notificationMessage = `\
'${match[1]}' could not be spawned.
Is it installed and on your path?
If so please open an issue on the package spawning the process.\
`;
				atom.notifications.addError(notificationMessage, {dismissable: true});

			} else if (!atom.inDevMode() || atom.config.get("notifications-plus.showErrorsInDevMode")) {
				preventDefault();

				// Ignore errors with no paths in them since they are impossible to trace
				if (!originalError.stack || isCoreOrPackageStackTrace(originalError.stack)) {
					const options = {
						detail: `${url}:${line}`,
						stack: originalError.stack,
						dismissable: true
					};
					atom.notifications.addFatalError(notificationMessage, options);
				}
			}
		}));

		this.subscriptions.add(atom.commands.add("atom-workspace", "core:cancel", () => {
			for (const notification of atom.notifications.getNotifications()) {
				notification.dismiss();
			}
		}));

		this.subscriptions.add(atom.config.observe("notifications-plus.defaultTimeout", value => {
			this.visibilityDuration = value;
		}));
		this.subscriptions.add(atom.config.observe("notifications-plus.allowPopups", value => {
			this.allowPopups = value;
		}));

		if (atom.inDevMode()) {
			this.subscriptions.add(atom.commands.add("atom-workspace", "notifications-plus:trigger-error", function () {
				try {
					// eslint-disable-next-line no-undef, no-unused-expressions
					abc + 2;
				} catch (error) {
					const options = {
						detail: error.stack.split("\n")[1],
						stack: error.stack,
						dismissable: true
					};
					atom.notifications.addFatalError(`Uncaught ${error.stack.split("\n")[0]}`, options);
				}
			})
			);
		}

		if (this.notificationsLog) {
			this.addNotificationsLogSubscriptions();
		}
		this.subscriptions.add(atom.workspace.addOpener(uri => {
			if (uri === NotificationsLog.prototype.getURI()) {
				return this.createLog();
			}
		}));
		this.subscriptions.add(atom.commands.add("atom-workspace", "notifications-plus:toggle-log", () => atom.workspace.toggle(NotificationsLog.prototype.getURI())));
		this.subscriptions.add(atom.commands.add("atom-workspace", "notifications-plus:clear-log", () => {
			for (const notification of atom.notifications.getNotifications()) {
				notification.options.dismissable = true;
				notification.dismissed = false;
				notification.dismiss();
			}
			atom.notifications.clear();
			if (this.statusBarManager) {
				this.statusBarManager.clear();
			}
		}));
	},

	deactivate() {
		this.subscriptions.dispose();
		if (this.notificationsElement) {
			this.notificationsElement.remove();
		}
		if (this.notificationsPanel) {
			this.notificationsPanel.destroy();
		}
		if (this.notificationsLog) {
			this.notificationsLog.destroy();
		}
		if (this.statusBarManager) {
			this.statusBarManager.destroy();
		}

		this.subscriptions = null;
		this.notificationsElement = null;
		this.notificationsPanel = null;
		this.statusBarManager = null;

		this.isInitialized = false;
	},

	initializeIfNotInitialized() {
		if (this.isInitialized) {
			return;
		}

		this.subscriptions.add(atom.views.addViewProvider(Notification, model => {
			return new NotificationElement(model, this.visibilityDuration);
		}));

		this.notificationsElement = document.createElement("atom-notifications");
		atom.views.getView(atom.workspace).appendChild(this.notificationsElement);

		this.isInitialized = true;
	},

	createLog(state) {
		this.notificationsLog = new NotificationsLog(this.duplicateTimeDelay, state ? state.typesHidden : null);
		if (this.subscriptions) {
			this.addNotificationsLogSubscriptions();
		}
		return this.notificationsLog;
	},

	addNotificationsLogSubscriptions() {
		this.subscriptions.add(this.notificationsLog.onDidDestroy(() => {
			this.notificationsLog = null;
		}));
		this.subscriptions.add(this.notificationsLog.onItemClick(notification => {
			const view = atom.views.getView(notification);
			view.makeDismissable();

			if (view.element.classList.contains("remove")) {
				view.element.classList.remove("remove");
				this.notificationsElement.appendChild(view.element);
				notification.dismissed = false;
				notification.setDisplayed(true);
			}
		})
		);
	},

	addNotificationView(notification) {
		let popupAllowed;
		if (!notification) {
			return;
		}
		this.initializeIfNotInitialized();
		if (notification.wasDisplayed()) {
			return;
		}

		let showNotification = false;
		if (this.lastNotification) {
			// do not show duplicates unless some amount of time has passed
			const timeSpan = notification.getTimestamp() - this.lastNotification.getTimestamp();
			if (!(timeSpan < this.duplicateTimeDelay) || !notification.isEqual(this.lastNotification)) {
				showNotification = true;
			}
		} else {
			showNotification = true;
		}

		if (showNotification) {
			const view = atom.views.getView(notification);

			switch (this.allowPopups) {
				case "None":
					popupAllowed = false;
					break;
				case "Errors":
					popupAllowed = ["fatal", "error"].includes(notification.getType());
					break;
				case "Dismissable":
					popupAllowed = notification.isDismissable();
					break;
				default:
					popupAllowed = true;
			}

			if (popupAllowed) {
				this.notificationsElement.appendChild(view.element);
			} else {
				view.element.classList.add("remove");
				view.makeDismissable();
				notification.dismiss();
			}
			if (this.notificationsLog) {
				this.notificationsLog.addNotification(notification);
			}
			if (this.statusBarManager) {
				this.statusBarManager.addNotification(notification);
			}
		}

		if (showNotification && popupAllowed) {
			notification.setDisplayed(true);
		}
		this.lastNotification = notification;
	},

	statusBarService(statusBar) {
		this.statusBarManager = new StatusBarManager(statusBar, this.duplicateTimeDelay);
	},

	disableNotificationsPackage() {
		this.subscriptions.add(atom.config.observe("core.disabledPackages", function (disabledPackages) {
			if (!disabledPackages.includes("notification")) {
				// eslint-disable-next-line no-console
				console.warn("Notifications package must be disabled for Notifications-Plus to work");
				const notificationsPackage = atom.packages.disablePackage("notifications");
				if (notificationsPackage && notificationsPackage.mainModule) {
					notificationsPackage.mainModule.isInitialized = true;
					notificationsPackage.mainModule.notificationsElement = document.createElement("div");
				}
			}
		})
		);
	}
};

module.exports = Notifications;
