/** @babel */

/** @jsx etch.dom */

import etch from "etch";

export default class StatusBarManager {
	constructor(statusBar, duplicateTimeDelay) {
		let count = 0;
		let lastNotification = null;
		for (const notification of atom.notifications.getNotifications()) {
			if (lastNotification) {
				// do not show duplicates unless some amount of time has passed
				const timeSpan = notification.getTimestamp() - lastNotification.getTimestamp();
				if (!(timeSpan < duplicateTimeDelay) || !notification.isEqual(lastNotification)) {
					count++;
				}
			} else {
				count++;
			}

			lastNotification = notification;
		}
		this.state = {
			count,
			lastType: lastNotification ? lastNotification.getType() : "",
			newNotification: !!lastNotification,
		};
		etch.initialize(this);
		this.updateTooltip();

		this.tile = statusBar.addRightTile({
			item: this.element,
			priority: 10,
		});
	}

	updateTooltip() {
		if (this.tootip) {
			this.tooltip.dispose();
		}
		const s = this.state.count === 1 ? "" : "s";
		this.tooltip = atom.tooltips.add(this.element, {title: `${this.state.count} notification${s}`});
	}

	changeState(state) {
		if (!state || typeof state !== "object") {
			return false;
		}
		let hasChanged = false;
		for (const prop in this.state) {
			if (prop in state && this.state[prop] !== state[prop]) {
				hasChanged = true;
				this.state[prop] = state[prop];
			}
		}
		return hasChanged;
	}

	async update(state) {
		if (!this.changeState(state)) {
			return this.updatePromise;
		}
		this.updatePromise = etch.update(this);
		await this.updatePromise;
		this.updateTooltip();
	}

	render() {
		return (
			<a className="notifications-count inline-block" attributes={{"last-type": this.state.lastType}} on={{click: this.onClick}}>
				<span className="notifications-count-badge">
					<div ref="number" className={`notifications-count-number${this.state.newNotification ? " new-notification" : ""}`} on={{animationend: this.onAnimationEnd}}>
						{this.state.count}
					</div>
				</span>
			</a>
		);
	}

	onClick() {
		return atom.commands.dispatch(this.element, "notifications-plus:toggle-log");
	}

	onAnimationEnd(e) {
		if (e.animationName === "new-notification") {
			this.update({
				newNotification: false,
			});
		}
	}

	destroy() {
		if (this.tile) {
			this.tile.destroy();
		}
		this.tile = null;
		if (this.tooltip) {
			this.tooltip.dispose();
		}
		this.tooltip = null;
		return etch.destroy(this);
	}

	addNotification(notification) {
		return this.update({
			count: this.state.count + 1,
			lastType: notification.getType(),
			newNotification: true,
		});
	}

	clear() {
		return this.update({
			count: 0,
			lastType: "",
		});
	}
}
