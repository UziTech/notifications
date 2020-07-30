/** @babel */

import {Emitter, CompositeDisposable, Disposable} from "atom";
import moment from "moment";

export default class NotificationsLogItem {

	constructor(notification) {
		this.notification = notification;
		const notificationView = atom.views.getView(this.notification);
		this.emitter = new Emitter();
		this.subscriptions = new CompositeDisposable();
		this.render(notificationView);
		this.subscriptions.add(notificationView.onChange(() => this.onNotificationChange(notificationView)));
		this.timestampInterval = setInterval(this.updateTimestamp.bind(this), 60 * 1000);
		this.subscriptions.add(new Disposable(() => clearInterval(this.timestampInterval)));
		this.notification.moment = moment(this.notification.getTimestamp());
		this.subscriptions.add(atom.tooltips.add(this.timestamp, {title: this.notification.moment.format("ll LTS")}));
		this.subscriptions.add(new Disposable(() => this.element.remove()));
		this.updateTimestamp();
	}

	render(notificationView) {
		this.timestamp = document.createElement("div");
		this.timestamp.classList.add("timestamp");

		this.element = document.createElement("li");
		this.element.classList.add("notifications-log-item", this.notification.getType());
		this.element.appendChild(this.renderNotification(notificationView));
		this.element.appendChild(this.timestamp);
		this.element.addEventListener("click", e => {
			if (!e.target.closest(".btn-toolbar a, .btn-toolbar button")) {
				this.emitter.emit("click");
			}
		});

		this.element.getRenderPromise = () => notificationView.getRenderPromise();
	}

	renderNotification(view) {
		const message = document.createElement("div");
		message.classList.add("message");
		message.innerHTML = view.element.querySelector(".content > .message").innerHTML;

		const buttons = document.createElement("div");
		buttons.classList.add("btn-toolbar");
		const nButtons = view.element.querySelector(".content > .meta > .btn-toolbar");
		if (nButtons) {
			for (const button of nButtons.children) {
				const logButton = button.cloneNode(true);
				logButton.originalButton = button;
				logButton.addEventListener("click", function (e) {
					const newEvent = new MouseEvent("click", e);
					return e.target.originalButton.dispatchEvent(newEvent);
				});
				for (const tooltip of atom.tooltips.findTooltips(button)) {
					this.subscriptions.add(atom.tooltips.add(logButton, tooltip.options));
				}
				buttons.appendChild(logButton);
			}
		}

		const nElement = document.createElement("div");
		nElement.classList.add("notifications-log-notification", "icon", `icon-${this.notification.getIcon()}`, this.notification.getType());
		nElement.appendChild(message);
		nElement.appendChild(buttons);
		return nElement;
	}

	onNotificationChange(view) {
		const notificationElement = this.element.querySelector(".notifications-log-notification");
		if (notificationElement) {
			this.element.replaceChild(this.renderNotification(view), notificationElement);
		}
	}

	getElement() {
		return this.element;
	}

	destroy() {
		this.subscriptions.dispose();
		this.emitter.emit("did-destroy");
	}

	onClick(callback) {
		return this.emitter.on("click", callback);
	}

	onDidDestroy(callback) {
		return this.emitter.on("did-destroy", callback);
	}

	updateTimestamp() {
		this.timestamp.textContent = this.notification.moment.fromNow();
	}
}
