/** @babel */

import {Emitter, CompositeDisposable, Disposable} from "atom";
import NotificationsLogItem from "./notifications-log-item";

const typeIcons = {
	fatal: "bug",
	error: "flame",
	warning: "alert",
	info: "info",
	success: "check",
};

export default class NotificationsLog {
	constructor(duplicateTimeDelay, typesHidden = null) {
		this.duplicateTimeDelay = duplicateTimeDelay;
		this.typesHidden = {
			fatal: false,
			error: false,
			warning: false,
			info: false,
			success: false,
			...typesHidden,
		};
		this.logItems = [];
		this.emitter = new Emitter();
		this.subscriptions = new CompositeDisposable(
			atom.notifications.onDidClearNotifications(() => this.clearLogItems()),
			new Disposable(() => this.clearLogItems()),
		);
		this.render();
	}

	render() {
		this.element = document.createElement("div");
		this.element.classList.add("notifications-log");

		const header = document.createElement("header");
		this.element.appendChild(header);

		this.list = document.createElement("ul");
		this.list.classList.add("notifications-log-items");
		this.element.appendChild(this.list);

		for (const type in typeIcons) {
			const icon = typeIcons[type];
			const button = document.createElement("button");
			button.classList.add("notification-type", "btn", "icon", `icon-${icon}`, type);
			button.classList.toggle("show-type", !this.typesHidden[type]);
			this.list.classList.toggle(`hide-${type}`, this.typesHidden[type]);
			button.dataset.type = type;
			button.addEventListener("click", e => this.toggleType(e.target.dataset.type));
			this.subscriptions.add(atom.tooltips.add(button, {title: `Toggle ${type} notifications`}));
			header.appendChild(button);
		}


		const button = document.createElement("button");
		button.classList.add("notifications-clear-log", "btn", "icon", "icon-dash");
		button.addEventListener("click", () => {
			atom.commands.dispatch(atom.views.getView(atom.workspace), "notifications-plus:clear-log");
		});
		this.subscriptions.add(atom.tooltips.add(button, {title: "Clear notifications"}));
		header.appendChild(button);

		let lastNotification = null;
		for (const notification of atom.notifications.getNotifications()) {
			if (lastNotification) {
				// do not show duplicates unless some amount of time has passed
				const timeSpan = notification.getTimestamp() - lastNotification.getTimestamp();
				if (!(timeSpan < this.duplicateTimeDelay) || !notification.isEqual(lastNotification)) {
					this.addNotification(notification);
				}
			} else {
				this.addNotification(notification);
			}

			lastNotification = notification;
		}

		this.subscriptions.add(new Disposable(() => this.element.remove()));
	}

	destroy() {
		this.subscriptions.dispose();
		this.emitter.emit("did-destroy");
	}

	getElement() {
		return this.element;
	}

	getURI() {
		return "atom://notifications-plus/log";
	}

	getTitle() {
		return "Log";
	}

	getLongTitle() {
		return "Notifications Log";
	}

	getIconName() {
		return "alert";
	}

	getDefaultLocation() {
		return "bottom";
	}

	getAllowedLocations() {
		return ["left", "right", "bottom"];
	}

	serialize() {
		return {
			typesHidden: this.typesHidden,
			deserializer: "notifications-plus/NotificationsLog",
		};
	}

	toggleType(type, force) {
		const button = this.element.querySelector(`.notification-type.${type}`);
		const hide = !button.classList.toggle("show-type", force);
		this.list.classList.toggle(`hide-${type}`, hide);
		this.typesHidden[type] = hide;
	}

	addNotification(notification) {
		const logItem = new NotificationsLogItem(notification);
		logItem.onClick(() => this.emitter.emit("item-clicked", notification));
		this.logItems.push(logItem);
		this.list.insertBefore(logItem.getElement(), this.list.firstChild);
	}

	onItemClick(callback) {
		return this.emitter.on("item-clicked", callback);
	}

	onDidDestroy(callback) {
		return this.emitter.on("did-destroy", callback);
	}

	clearLogItems() {
		for (const logItem of this.logItems) {
			logItem.destroy();
		}
		this.logItems = [];
	}
}
