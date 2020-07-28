const createDOMPurify = require("dompurify");
const fs = require("fs-plus");
const marked = require("marked");
const {shell} = require("electron");
const {Emitter} = require("atom");

const NotificationIssue = require("./notification-issue");
const TemplateHelper = require("./template-helper");
const UserUtilities = require("./user-utilities");

let DOMPurify = null;

const NotificationTemplate = `\
<div class="content">
  <div class="message item"></div>
  <div class="detail item">
    <div class="detail-content"></div>
    <a href="#" class="stack-toggle"></a>
    <div class="stack-container"></div>
  </div>
  <div class="meta item"></div>
</div>
<div class="close icon icon-x"></div>
<div class="close-all btn btn-error">Close All</div>\
`;

const FatalMetaNotificationTemplate = `\
<div class="description fatal-notification"></div>
<div class="btn-toolbar">
  <a href="#" class="btn-issue btn btn-error"></a>
  <a href="#" class="btn-copy-report icon icon-clippy" title="Copy error report to clipboard"></a>
  <a href="#" class="hidden btn-open-settings icon icon-gear" title="Open package settings"></a>
</div>\
`;

const MetaNotificationTemplate = "\
<div class=\"description\"></div>\
";

const ButtonListTemplate = "\
<div class=\"btn-toolbar\"></div>\
";

const ButtonTemplate = "\
<a href=\"#\" class=\"btn\"></a>\
";

function addSplitLinesToContainer(container, content) {
	if (typeof content !== "string") {
		// eslint-disable-next-line no-param-reassign
		content = content.toString();
	}
	for (const line of content.split("\n")) {
		const div = document.createElement("div");
		div.classList.add("line");
		div.textContent = line;
		container.appendChild(div);
	}
}

class NotificationElement {
	constructor(model, visibilityDuration) {
		this.model = model;
		this.visibilityDuration = visibilityDuration;
		this.emitter = new Emitter();
		this.fatalTemplate = TemplateHelper.create(FatalMetaNotificationTemplate);
		this.metaTemplate = TemplateHelper.create(MetaNotificationTemplate);
		this.buttonListTemplate = TemplateHelper.create(ButtonListTemplate);
		this.buttonTemplate = TemplateHelper.create(ButtonTemplate);

		const timeout = this.model.getOptions().timeout;
		this.visibilityDuration = timeout ? timeout : this.visibilityDuration;

		this.element = document.createElement("atom-notification");
		if (this.model.getType() === "fatal") {
			this.issue = new NotificationIssue(this.model);
		}
		this.renderPromise = this.render().catch(e => {
			// eslint-disable-next-line no-console
			console.error(e.message);
			// eslint-disable-next-line no-console
			console.error(e.stack);
		});

		this.model.onDidDismiss(() => this.removeNotification());

		this.handleElementClick = this.handleElementClick.bind(this);
		this.handleElementMouseEnter = this.handleElementMouseEnter.bind(this);
		this.handleElementMouseLeave = this.handleElementMouseLeave.bind(this);
		if (!this.model.isDismissable() || atom.config.get("notifications-plus.alwaysDismiss")) {
			this.autohide();
			this.element.addEventListener("click", this.handleElementClick);
			this.element.addEventListener("mouseenter", this.handleElementMouseEnter);
			this.element.addEventListener("mouseleave", this.handleElementMouseLeave);
		}

		this.element.issue = this.issue;
		this.element.getRenderPromise = this.getRenderPromise.bind(this);
	}

	getModel() {
		return this.model;
	}

	getRenderPromise() {
		return this.renderPromise;
	}

	async render() {
		this.element.classList.add(`${this.model.getType()}`);
		this.element.classList.add("icon", `icon-${this.model.getIcon()}`, "native-key-bindings");

		const detail = this.model.getDetail();
		if (detail) {
			this.element.classList.add("has-detail");
		}
		if (this.model.isDismissable()) {
			this.element.classList.add("has-close");
		}
		if (detail && this.model.getOptions().stack) {
			this.element.classList.add("has-stack");
		}

		this.element.setAttribute("tabindex", "-1");

		this.element.innerHTML = NotificationTemplate;

		const options = this.model.getOptions();

		const notificationContainer = this.element.querySelector(".message");

		if (DOMPurify === null) {
			DOMPurify = createDOMPurify();
		}
		notificationContainer.innerHTML = DOMPurify.sanitize(marked(this.model.getMessage()));

		if (detail) {
			addSplitLinesToContainer(this.element.querySelector(".detail-content"), detail);

			if (options.stack) {
				const stackToggle = this.element.querySelector(".stack-toggle");
				const stackContainer = this.element.querySelector(".stack-container");

				addSplitLinesToContainer(stackContainer, options.stack);

				stackToggle.addEventListener("click", e => this.handleStackTraceToggleClick(e, stackContainer));
				this.handleStackTraceToggleClick({currentTarget: stackToggle}, stackContainer);
			}
		}

		if (options.description) {
			this.element.classList.add("has-description");
			const metaContainer = this.element.querySelector(".meta");
			metaContainer.appendChild(TemplateHelper.render(this.metaTemplate));
			const description = this.element.querySelector(".description");
			description.innerHTML = marked(options.description);
		}

		if (options.buttons && (options.buttons.length > 0)) {
			this.element.classList.add("has-buttons");
			const metaContainer = this.element.querySelector(".meta");
			metaContainer.appendChild(TemplateHelper.render(this.buttonListTemplate));
			const toolbar = this.element.querySelector(".btn-toolbar");
			let buttonClass = this.model.getType();
			if (buttonClass === "fatal") {
				buttonClass = "error";
			}
			buttonClass = `btn-${buttonClass}`;
			options.buttons.forEach(button => {
				toolbar.appendChild(TemplateHelper.render(this.buttonTemplate));
				const buttonEl = toolbar.childNodes[toolbar.childNodes.length - 1];
				buttonEl.textContent = button.text;
				buttonEl.classList.add(buttonClass);
				if (button.className) {
					buttonEl.classList.add(...button.className.split(" "));
				}
				if (button.onDidClick) {
					buttonEl.addEventListener("click", e => {
						button.onDidClick.call(this, e);
					});
				}
			});
		}

		const closeButton = this.element.querySelector(".close");
		closeButton.addEventListener("click", () => this.handleRemoveNotificationClick());

		const closeAllButton = this.element.querySelector(".close-all");
		closeAllButton.classList.add(this.getButtonClass());
		closeAllButton.addEventListener("click", () => this.handleRemoveAllNotificationsClick());

		if (this.model.getType() === "fatal") {
			return this.renderFatalError();
		}

	}

	async renderFatalError() {
		const repoUrl = await this.issue.getRepoUrl();
		const packageName = await this.issue.getPackageName();

		const fatalContainer = this.element.querySelector(".meta");
		fatalContainer.appendChild(TemplateHelper.render(this.fatalTemplate));
		const fatalNotification = this.element.querySelector(".fatal-notification");

		const issueButton = fatalContainer.querySelector(".btn-issue");

		const copyReportButton = fatalContainer.querySelector(".btn-copy-report");
		atom.tooltips.add(copyReportButton, {title: copyReportButton.getAttribute("title")});
		copyReportButton.addEventListener("click", e => {
			e.preventDefault();
			this.issue.getIssueBody().then(issueBody => atom.clipboard.write(issueBody));
		});

		const openSettingsButton = fatalContainer.querySelector(".btn-open-settings");
		atom.tooltips.add(openSettingsButton, {title: openSettingsButton.getAttribute("title")});
		openSettingsButton.addEventListener("click", e => {
			e.preventDefault();
			atom.workspace.open(`atom://config/packages/${packageName}`);
		});

		if (packageName && repoUrl) {
			fatalNotification.innerHTML = `The error was thrown from the <a href="${repoUrl}">${packageName} package</a>. `;
			openSettingsButton.classList.remove("hidden");
		} else if (packageName) {
			issueButton.remove();
			fatalNotification.textContent = `The error was thrown from the ${packageName} package. `;
			openSettingsButton.classList.remove("hidden");
		} else {
			fatalNotification.textContent = "This is likely a bug in Atom. ";
			openSettingsButton.remove();
		}


		// We only show the create issue button if it's clearly in atom core or in a package with a repo url
		if (issueButton.parentNode) {
			const checkForIssues = async () => {
				if (packageName && repoUrl) {
					issueButton.textContent = `Create issue on the ${packageName} package`;
				} else {
					issueButton.textContent = "Create issue on atom/atom";
				}

				const promises = [];
				promises.push(this.issue.findSimilarIssues());
				promises.push(UserUtilities.checkAtomUpToDate());
				if (packageName) {
					promises.push(UserUtilities.checkPackageUpToDate(packageName));
				}

				const allData = await Promise.all(promises);

				const [issues, atomCheck, packageCheck] = allData;

				if (issues && (issues.open || issues.closed)) {
					const issue = issues.open || issues.closed;
					issueButton.setAttribute("href", issue.html_url);
					issueButton.textContent = "View Issue";
					fatalNotification.innerHTML += " This issue has already been reported.";
				} else if (packageCheck && !packageCheck.upToDate && !packageCheck.isCore) {
					issueButton.setAttribute("href", "#");
					issueButton.textContent = "Check for package updates";
					issueButton.addEventListener("click", e => {
						e.preventDefault();
						const command = "settings-view:check-for-package-updates";
						atom.commands.dispatch(atom.views.getView(atom.workspace), command);
					});

					fatalNotification.innerHTML += `\
<code>${packageName}</code> is out of date: ${packageCheck.installedVersion} installed;
${packageCheck.latestVersion} latest.
Upgrading to the latest version may fix this issue.\
`;
				} else if (packageCheck && !packageCheck.upToDate && packageCheck.isCore) {
					issueButton.remove();

					fatalNotification.innerHTML += `\
<br><br>
Locally installed core Atom package <code>${packageName}</code> is out of date: ${packageCheck.installedVersion} installed locally;
${packageCheck.versionShippedWithAtom} included with the version of Atom you're running.
Removing the locally installed version may fix this issue.\
`;
					const pkg = atom.packages.getLoadedPackage(packageName);
					if (pkg) {
						const isLink = await new Promise(resolve => {
							fs.isSymbolicLink(pkg.path, resolve);
						});
						if (isLink) {
							fatalNotification.innerHTML += `<br><br>Use: <code>apm unlink ${pkg.path}</code>`;
						}
					}
				} else if (atomCheck && !atomCheck.upToDate) {
					issueButton.remove();

					fatalNotification.innerHTML += `\
Atom is out of date: ${atomCheck.installedVersion} installed;
${atomCheck.latestVersion} latest.
Upgrading to the <a href='https://github.com/atom/atom/releases/tag/v${atomCheck.latestVersion}'>latest version</a> may fix this issue.\
`;
				} else {
					fatalNotification.innerHTML += " You can help by creating an issue. Please explain what actions triggered this error.";
					issueButton.addEventListener("click", async e => {
						e.preventDefault();
						issueButton.classList.add("opening");
						const issueUrl = await this.issue.getIssueUrlForSystem();
						shell.openExternal(issueUrl);
						issueButton.classList.remove("opening");
					});
				}

				this.emitter.emit("change");
			};

			const checkFatalIssues = atom.config.get("notifications-plus.checkFatalIssues");
			const telemetryConsent = atom.config.get("core.telemetryConsent");
			const getIssues = (checkFatalIssues === "yes") ||
        ((checkFatalIssues === "telemetry") && (telemetryConsent !== "no"));

			if (getIssues) {
				return checkForIssues();
			}
			issueButton.textContent = "Check reported issues";
			issueButton.addEventListener("click", e => {
				e.preventDefault();
				this.renderPromise = checkForIssues();
			}, {once: true});
		}
	}

	onChange(callback) {
		return this.emitter.on("change", callback);
	}

	makeDismissable() {
		if (!this.model.isDismissable()) {
			clearTimeout(this.autohideTimeout);
			this.model.options.dismissable = true;
			this.model.dismissed = false;
			this.element.classList.add("has-close");
			this.element.classList.remove("mouse-over");
			this.element.removeEventListener("click", this.handleElementClick);
			this.element.removeEventListener("mouseenter", this.handleElementMouseEnter);
			this.element.removeEventListener("mouseleave", this.handleElementMouseLeave);
		}
	}

	removeNotification() {
		if (!this.element.classList.contains("remove")) {
			this.element.classList.add("remove");
			this.removeNotificationAfterTimeout();
		}
	}

	handleElementClick() {
		this.makeDismissable();
	}

	handleElementMouseEnter() {
		this.element.classList.add("mouse-over");
	}

	handleElementMouseLeave() {
		this.element.classList.remove("mouse-over");
	}

	handleRemoveNotificationClick() {
		this.removeNotification();
		this.model.dismiss();
	}

	handleRemoveAllNotificationsClick() {
		const notifications = atom.notifications.getNotifications();
		for (const notification of notifications) {
			atom.views.getView(notification).removeNotification();
			if (notification.isDismissable() && !notification.isDismissed()) {
				notification.dismiss();
			}
		}
	}

	handleStackTraceToggleClick(e, container) {
		if (typeof e.preventDefault === "function") {
			e.preventDefault();
		}
		if (container.style.display === "none") {
			e.currentTarget.innerHTML = "<span class=\"icon icon-dash\"></span>Hide Stack Trace";
			container.style.display = "block";
		} else {
			e.currentTarget.innerHTML = "<span class=\"icon icon-plus\"></span>Show Stack Trace";
			container.style.display = "none";
		}
	}

	autohide() {
		this.autohideTimeout = setTimeout(() => {
			if (this.element.classList.contains("mouse-over")) {
				this.makeDismissable();
			} else {
				this.removeNotification();
			}
		}
		, this.visibilityDuration);
	}

	removeNotificationAfterTimeout() {
		if (this.element === document.activeElement) {
			atom.workspace.getActivePane().activate();
		}

		// keep in sync with CSS animation
		setTimeout(() => {
			this.element.remove();
		}, this.animationDuration);
	}

	getButtonClass() {
		const type = `btn-${this.model.getType()}`;
		return (type === "btn-fatal" ? "btn-error" : type);
	}
}

NotificationElement.prototype.animationDuration = 360;
NotificationElement.prototype.visibilityDuration = 5000;
NotificationElement.prototype.autohideTimeout = null;

module.exports = NotificationElement;
