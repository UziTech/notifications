/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let StatusBarManager;
module.exports =
(StatusBarManager = (function () {
	StatusBarManager = class StatusBarManager {
		static initClass() {
			this.prototype.count = 0;
		}

		constructor(statusBar, duplicateTimeDelay) {
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
			return (() => {
				const result = [];
				for (const notification of Array.from(atom.notifications.getNotifications())) {
					if (lastNotification != null) {
						// do not show duplicates unless some amount of time has passed
						const timeSpan = notification.getTimestamp() - lastNotification.getTimestamp();
						if (!(timeSpan < this.duplicateTimeDelay) || !notification.isEqual(lastNotification)) {
							this.addNotification(notification);
						}
					} else {
						this.addNotification(notification);
					}

					result.push(lastNotification = notification);
				}
				return result;
			})();
		}

		onClick() {
			return atom.commands.dispatch(this.element, "notifications-plus:toggle-log"); 
		}

		onAnimationEnd(e) {
			if (e.animationName === "new-notification") {
				return this.number.classList.remove("new-notification"); 
			} 
		}

		destroy() {
			this.number.removeEventListener("animationend", this.onAnimationEnd);
			this.element.removeEventListener("click", this.onClick);
			this.tile.destroy();
			this.tile = null;
			this.tooltip.dispose();
			return this.tooltip = null;
		}

		addNotification(notification) {
			this.count++;
			const s = this.count === 1 ? "" : "s";
			this.tooltip.dispose();
			this.tooltip = atom.tooltips.add(this.element, {title: `${this.count} notification${s}`});
			this.element.setAttribute("last-type", notification.getType());
			this.number.textContent = this.count;
			return this.number.classList.add("new-notification");
		}

		clear() {
			this.count = 0;
			this.number.textContent = this.count;
			this.element.removeAttribute("last-type");
			this.tooltip.dispose();
			return this.tooltip = atom.tooltips.add(this.element, {title: "0 notifications"});
		}
	};
	StatusBarManager.initClass();
	return StatusBarManager;
})());
