/** @babel */

import {Notification} from "atom";
import NotificationElement from "../lib/notification-element";
import NotificationIssue from "../lib/notification-issue";
import NotificationsLog from "../lib/notifications-log";
import UserUtilities from "../lib/user-utilities";
import {generateFakeFetchResponses, generateException} from "./helper";

describe("Notifications Log", () => {
	let workspaceElement = null;

	beforeEach(async () => {
		workspaceElement = atom.views.getView(atom.workspace);
		atom.notifications.clear();

		await atom.packages.activatePackage("notifications-plus");

		await atom.workspace.open(NotificationsLog.prototype.getURI());
	});

	describe("when the package is activated", () => {
		it("attaches an .notifications-log element to the dom", () => {
			expect(workspaceElement.querySelector(".notifications-log")).toExist();
		});
	});

	describe("when there are notifications before activation", () => {
		beforeEach(async () => {
			await atom.packages.deactivatePackage("notifications-plus");
		});

		it("displays all notifications", async () => {
			const warning = new Notification("warning", "Un-displayed warning");
			const error = new Notification("error", "Displayed error");
			error.setDisplayed(true);

			atom.notifications.addNotification(error);
			atom.notifications.addNotification(warning);

			await atom.packages.activatePackage("notifications-plus");

			await atom.workspace.open(NotificationsLog.prototype.getURI());

			const notificationsLogContainer = workspaceElement.querySelector(".notifications-log-items");
			let notification = notificationsLogContainer.querySelector(".notifications-log-notification.warning");
			expect(notification).toExist();
			notification = notificationsLogContainer.querySelector(".notifications-log-notification.error");
			expect(notification).toExist();
		});
	});

	describe("when notifications are added to atom.notifications", () => {
		let notificationsLogContainer = null;

		beforeEach(() => {
			const enableInitNotification = atom.notifications.addSuccess("A message to trigger initialization", {dismissable: true});
			enableInitNotification.dismiss();

			jasmine.clock().tick(NotificationElement.prototype.visibilityDuration);

			jasmine.clock().tick(NotificationElement.prototype.animationDuration);

			notificationsLogContainer = workspaceElement.querySelector(".notifications-log-items");
			jasmine.attachToDOM(workspaceElement);

			generateFakeFetchResponses();
		});

		it("adds an .notifications-log-item element to the container with a class corresponding to the type", async () => {
			atom.notifications.addSuccess("A message");
			let notification = notificationsLogContainer.querySelector(".notifications-log-item.success");
			expect(notificationsLogContainer.childNodes).toHaveLength(2);
			expect(notification.querySelector(".message").textContent.trim()).toBe("A message");
			expect(notification.querySelector(".btn-toolbar")).toBeEmpty();

			atom.notifications.addInfo("A message");
			expect(notificationsLogContainer.childNodes).toHaveLength(3);
			expect(notificationsLogContainer.querySelector(".notifications-log-item.info")).toExist();

			atom.notifications.addWarning("A message");
			expect(notificationsLogContainer.childNodes).toHaveLength(4);
			expect(notificationsLogContainer.querySelector(".notifications-log-item.warning")).toExist();

			atom.notifications.addError("A message");
			expect(notificationsLogContainer.childNodes).toHaveLength(5);
			expect(notificationsLogContainer.querySelector(".notifications-log-item.error")).toExist();

			atom.notifications.addFatalError("A message");
			notification = notificationsLogContainer.querySelector(".notifications-log-item.fatal");
			await notification.getRenderPromise();
			expect(notificationsLogContainer.childNodes).toHaveLength(6);
			expect(notification).toExist();
			expect(notification.querySelector(".btn-toolbar")).not.toBeEmpty();
		});

		describe("when the `buttons` options is used", () => {
			it("displays the buttons in the .btn-toolbar element", () => {
				const clicked = [];
				atom.notifications.addSuccess("A message", {
					buttons: [{
						text: "Button One",
						className: "btn-one",
						onDidClick() {
							clicked.push("one");
						},
					}, {
						text: "Button Two",
						className: "btn-two",
						onDidClick() {
							clicked.push("two");
						},
					}],
				});

				const notification = notificationsLogContainer.querySelector(".notifications-log-item.success");
				expect(notification.querySelector(".btn-toolbar")).not.toBeEmpty();

				const btnOne = notification.querySelector(".btn-one");
				const btnTwo = notification.querySelector(".btn-two");

				expect(btnOne).toHaveClass("btn-success");
				expect(btnOne.textContent).toBe("Button One");
				expect(btnTwo).toHaveClass("btn-success");
				expect(btnTwo.textContent).toBe("Button Two");

				btnTwo.click();
				btnOne.click();

				expect(clicked).toEqual(["two", "one"]);
			});
		});

		describe("when an exception is thrown", () => {
			let fatalError = null;

			describe("when the there is an error searching for the issue", () => {
				beforeEach(async () => {
					spyOn(atom, "inDevMode").and.returnValue(false);
					generateFakeFetchResponses({issuesErrorResponse: "403"});
					generateException();
					fatalError = notificationsLogContainer.querySelector(".notifications-log-item.fatal");
					await fatalError.getRenderPromise();
				});

				it("asks the user to create an issue", () => {
					const button = fatalError.querySelector(".btn");
					const copyReport = fatalError.querySelector(".btn-copy-report");
					expect(button).toExist();
					expect(button.textContent).toContain("Create issue");
					expect(copyReport).toExist();
				});
			});

			describe("when the package is out of date", () => {
				beforeEach(async () => {
					const installedVersion = "0.9.0";
					spyOn(UserUtilities, "getPackageVersion").and.callFake(() => installedVersion);
					spyOn(atom, "inDevMode").and.returnValue(false);
					generateFakeFetchResponses({
						packageResponse: {
							repository: {url: "https://github.com/someguy/somepackage"},
							releases: {latest: "0.10.0"},
						},
					});
					spyOn(NotificationIssue.prototype, "getPackageName").and.callFake(async () => "somepackage");
					spyOn(NotificationIssue.prototype, "getRepoUrl").and.callFake(async () => "https://github.com/someguy/somepackage");
					generateException();
					fatalError = notificationsLogContainer.querySelector(".notifications-log-item.fatal");
					await fatalError.getRenderPromise();
				});

				it("asks the user to update their packages", () => {
					const button = fatalError.querySelector(".btn");

					expect(button.textContent).toContain("Check for package updates");
					expect(button.getAttribute("href")).toBe("#");
				});
			});

			describe("when the error has been reported", () => {
				beforeEach(async () => {
					spyOn(atom, "inDevMode").and.returnValue(false);
					generateFakeFetchResponses({issuesResponse: {
						items: [
							{
								title: "ReferenceError: a is not defined in $ATOM_HOME/somewhere",
								html_url: "http://url.com/ok",
								state: "open",
							},
						],
					}});
					generateException();
					fatalError = notificationsLogContainer.querySelector(".notifications-log-item.fatal");
					await fatalError.getRenderPromise();
				});

				it("shows the user a view issue button", () => {
					const button = fatalError.querySelector(".btn");
					expect(button.textContent).toContain("View Issue");
					expect(button.getAttribute("href")).toBe("http://url.com/ok");
				});
			});
		});

		describe("when a log item is clicked", () => {
			let [notification, notificationView, logItem] = [];

			describe("when the notification is not dismissed", () => describe("when the notification is not dismissable", () => {

				beforeEach(() => {
					notification = atom.notifications.addInfo("A message");
					notificationView = atom.views.getView(notification);
					logItem = notificationsLogContainer.querySelector(".notifications-log-item.info");
				});

				it("makes the notification dismissable", () => {
					logItem.click();
					expect(notificationView.element.classList.contains("has-close")).toBe(true);
					expect(notification.isDismissable()).toBe(true);


					jasmine.clock().tick(NotificationElement.prototype.visibilityDuration);

					jasmine.clock().tick(NotificationElement.prototype.animationDuration);
					expect(notificationView.element).toBeVisible();
				});
			}));

			describe("when the notification is dismissed", () => {

				beforeEach(() => {
					notification = atom.notifications.addInfo("A message", {dismissable: true});
					notificationView = atom.views.getView(notification);
					logItem = notificationsLogContainer.querySelector(".notifications-log-item.info");
					notification.dismiss();

					jasmine.clock().tick(NotificationElement.prototype.animationDuration);
				});

				it("displays the notification", () => {
					let didDisplay = false;
					notification.onDidDisplay(() => didDisplay = true);
					logItem.click();

					expect(didDisplay).toBe(true);
					expect(notification.dismissed).toBe(false);
					expect(notificationView.element).toBeVisible();
				});

				describe("when the notification is dismissed again", () => {
					it("emits did-dismiss", () => {
						let didDismiss = false;
						notification.onDidDismiss(() => didDismiss = true);
						logItem.click();

						notification.dismiss();

						jasmine.clock().tick(NotificationElement.prototype.animationDuration);

						expect(didDismiss).toBe(true);
						expect(notification.dismissed).toBe(true);
						expect(notificationView.element).not.toBeVisible();
					});
				});
			});
		});
	});

	describe("when notifications are cleared", () => {

		beforeEach(() => {
			const clearButton = workspaceElement.querySelector(".notifications-log .notifications-clear-log");
			atom.notifications.addInfo("A message", {dismissable: true});
			atom.notifications.addInfo("non-dismissable");
			clearButton.click();
		});

		it("clears the notifications", () => {
			expect(atom.notifications.getNotifications()).toHaveLength(0);
			const notifications = workspaceElement.querySelector("atom-notifications");

			jasmine.clock().tick(NotificationElement.prototype.animationDuration);
			expect(notifications.children).toHaveLength(0);
			const logItems = workspaceElement.querySelector(".notifications-log-items");
			expect(logItems.children).toHaveLength(0);
		});
	});

	describe("the dock pane", () => {
		let notificationsLogPane = null;

		beforeEach(() => notificationsLogPane = atom.workspace.paneForURI(NotificationsLog.prototype.getURI()));

		describe("when notifications-plus:toggle-log is dispatched", () => {
			it("toggles the pane URI", () => {
				spyOn(atom.workspace, "toggle");

				atom.commands.dispatch(workspaceElement, "notifications-plus:toggle-log");
				expect(atom.workspace.toggle).toHaveBeenCalledWith(NotificationsLog.prototype.getURI());
			});

			describe("when the pane is destroyed", () => {

				beforeEach(() => notificationsLogPane.destroyItems());

				it("opens the pane", async () => {
					let [notificationsLog] = [];

					notificationsLog = await atom.workspace.toggle(NotificationsLog.prototype.getURI());

					expect(notificationsLog).toBeDefined();
				});

				describe("when notifications are displayed", () => {

					beforeEach(() => atom.notifications.addSuccess("success"));

					it("lists all notifications", async () => {
						await atom.workspace.toggle(NotificationsLog.prototype.getURI());

						const notificationsLogContainer = workspaceElement.querySelector(".notifications-log-items");
						expect(notificationsLogContainer.childNodes).toHaveLength(1);
					});
				});
			});

			describe("when the pane is hidden", () => {

				beforeEach(() => {
					atom.workspace.hide(NotificationsLog.prototype.getURI());
				});

				it("opens the pane", async () => {
					let [notificationsLog] = [];

					notificationsLog = await atom.workspace.toggle(NotificationsLog.prototype.getURI());

					expect(notificationsLog).toBeDefined();
				});
			});

			describe("when the pane is open", () => {

				beforeEach(async () => {
					await atom.workspace.open(NotificationsLog.prototype.getURI());
				});

				it("closes the pane", async () => {
					let notificationsLog = null;

					notificationsLog = await atom.workspace.toggle(NotificationsLog.prototype.getURI());

					expect(notificationsLog).toBeUndefined();
				});
			});
		});
	});
});
