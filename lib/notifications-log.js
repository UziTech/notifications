/** @babel */

/** @jsx etch.dom */

import {Emitter, CompositeDisposable, Disposable} from "atom";
import NotificationsLogItem from "./notifications-log-item";
import etch from "etch";

class NotificationsLogLi {
	constructor(props) {
		this.element = props.item.element;
	}

	update() {
		// do nothing
	}
}

const typeIcons = {
	fatal: "bug",
	error: "flame",
	warning: "alert",
	info: "info",
	success: "check",
};

export default class NotificationsLog {
	constructor(notifications, typesHidden = null) {
		this.state = {
			typesHidden: {
				...Object.keys(typeIcons).reduce((o, t) => (o[t] = false, o), {}),
				...typesHidden,
			},
			logItems: notifications.map(notification => new NotificationsLogItem({
				notification,
				onClick: () => this.emitter.emit("item-clicked", notification),
			})),
		};
		this.emitter = new Emitter();
		this.subscriptions = new CompositeDisposable(
			atom.notifications.onDidClearNotifications(() => this.clearLogItems()),
			new Disposable(() => this.clearLogItems()),
		);

		etch.initialize(this);
		for (const ref in this.refs) {
			if (ref.startsWith("type-")) {
				const button = this.refs[ref];
				this.subscriptions.add(atom.tooltips.add(button, {title: `Toggle ${button.dataset.type} notifications`}));
			}
		}
		this.subscriptions.add(atom.tooltips.add(this.refs.clear, {title: "Clear notifications"}));
		this.subscriptions.add(new Disposable(() => this.element.remove()));
	}

	render() {
		const types = Object.keys(typeIcons);
		return (
			<div className="notifications-log">
				<header>
					{
						types.map(type => {
							const icon = typeIcons[type];
							return (
								<button
									ref={`type-${type}`}
									key={type}
									className={`notification-type btn icon icon-${icon} ${type} ${this.state.typesHidden[type] ? "" : "show-type"}`}
									attributes={{"data-type": type}}
									on={{click: e => this.toggleType(e.target.dataset.type)}}
								></button>
							);
						})
					}
					<button
						ref="clear"
						className="notifications-clear-log btn icon icon-dash"
						on={{click: () => atom.commands.dispatch(atom.views.getView(atom.workspace), "notifications-plus:clear-log")}}
					></button>
				</header>
				<ul className={`notifications-log-items ${types.filter(t => this.state.typesHidden[t]).map(t => `hide-${t}`)}`}>
					{this.state.logItems.map((item, i) => (
						<NotificationsLogLi item={item} key={i}/>
					)).reverse()}
				</ul>
			</div>
		);
	}

	update() {
		return etch.update(this);
	}

	destroy() {
		this.subscriptions.dispose();
		this.emitter.emit("did-destroy");
		return etch.destroy(this);
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
			typesHidden: this.state.typesHidden,
			deserializer: "notifications-plus/NotificationsLog",
		};
	}

	toggleType(type, force) {
		this.state.typesHidden[type] = typeof force === "boolean" ? force : !this.state.typesHidden[type];
		return this.update();
	}

	addNotification(notification) {
		this.state.logItems.push(new NotificationsLogItem({
			notification,
			onClick: () => this.emitter.emit("item-clicked", notification),
		}));
		return this.update();
	}

	onItemClick(callback) {
		return this.emitter.on("item-clicked", callback);
	}

	onDidDestroy(callback) {
		return this.emitter.on("did-destroy", callback);
	}

	clearLogItems() {
		for (const logItem of this.state.logItems) {
			logItem.destroy();
		}
		this.state.logItems = [];
		return this.update();
	}
}
