module.exports = class StatusBarManager {
	constructor(statusBar, duplicateTimeDelay) {
		this.count = 0;
		this.duplicateTimeDelay = duplicateTimeDelay;
		this.onClick = this.onClick.bind(this);
		this.onAnimationEnd = this.onAnimationEnd.bind(this);
		this.render();
		this.tile = statusBar.addRightTile({
			item: this.element,
			priority: 10
		});
	}

	render() {
		this.number = document.createElement("div");
		this.number.classList.add("notifications-count-number");
		this.number.textContent = this.count;
		this.number.addEventListener("animationend", this.onAnimationEnd);

		this.element = document.createElement("a");
		this.element.classList.add("notifications-count", "inline-block");
		this.tooltip = atom.tooltips.add(this.element, {title: "0 notifications"});
		const span = document.createElement("span");
		span.classList.add("notifications-count-badge");
		span.appendChild(this.number);
		this.element.appendChild(span);
		this.element.addEventListener("click", this.onClick);


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
	}

	onClick() {
		return atom.commands.dispatch(this.element, "notifications-plus:toggle-log");
	}

	onAnimationEnd(e) {
		if (e.animationName === "new-notification") {
			this.number.classList.remove("new-notification");
		}
	}

	destroy() {
		this.number.removeEventListener("animationend", this.onAnimationEnd);
		this.element.removeEventListener("click", this.onClick);
		this.tile.destroy();
		this.tile = null;
		this.tooltip.dispose();
		this.tooltip = null;
	}

	addNotification(notification) {
		this.count++;
		const s = this.count === 1 ? "" : "s";
		this.tooltip.dispose();
		this.tooltip = atom.tooltips.add(this.element, {title: `${this.count} notification${s}`});
		this.element.setAttribute("last-type", notification.getType());
		this.number.textContent = this.count;
		this.number.classList.add("new-notification");
	}

	clear() {
		this.count = 0;
		this.number.textContent = this.count;
		this.element.removeAttribute("last-type");
		this.tooltip.dispose();
		this.tooltip = atom.tooltips.add(this.element, {title: "0 notifications"});
	}
};
