/** @babel */

import {Notification} from "atom";
import {generateFakeFetchResponses} from "./helper";

describe("Notifications Count", () => {
	let workspaceElement, statusBarManager, notificationsCountContainer;

	beforeEach(async () => {
		workspaceElement = atom.views.getView(atom.workspace);
		atom.notifications.clear();

		await Promise.all([
			atom.packages.activatePackage("notifications-plus"),
			atom.packages.activatePackage("status-bar"),
		]);

		({
			statusBarManager,
		} = atom.packages.getActivePackage("notifications-plus").mainModule);
		notificationsCountContainer = workspaceElement.querySelector(".notifications-count");
	});

	describe("when the package is activated", () => {
		it("attaches an .notifications-count element to the dom", () => {
			expect(statusBarManager.state.count).toBe(0);
			expect(notificationsCountContainer).toExist();
		});
	});

	describe("when there are notifications before activation", () => {
		beforeEach(async () => {
			await atom.packages.deactivatePackage("notifications-plus");
		});

		it("displays counts notifications", async () => {
			const warning = new Notification("warning", "Un-displayed warning");
			const error = new Notification("error", "Displayed error");
			error.setDisplayed(true);

			atom.notifications.addNotification(error);
			atom.notifications.addNotification(warning);

			await atom.packages.activatePackage("notifications-plus");

			({
				statusBarManager,
			} = atom.packages.getActivePackage("notifications-plus").mainModule);
			notificationsCountContainer = workspaceElement.querySelector(".notifications-count");
			expect(statusBarManager.state.count).toBe(2);
			expect(parseInt(notificationsCountContainer.textContent, 10)).toBe(2);
		});
	});

	describe("when notifications are added to atom.notifications", () => {
		beforeEach(() => {
			generateFakeFetchResponses();
		});

		it("will add the new-notification class for as long as the animation", async () => {
			const notificationsCountNumber = notificationsCountContainer.firstChild.firstChild;
			expect(notificationsCountNumber).not.toHaveClass("new-notification");
			atom.notifications.addInfo("A message");
			await statusBarManager.update();
			expect(notificationsCountNumber).toHaveClass("new-notification");

			const animationend = new AnimationEvent("animationend", {animationName: "new-notification"});
			notificationsCountNumber.dispatchEvent(animationend);
			await statusBarManager.update();
			expect(notificationsCountNumber).not.toHaveClass("new-notification");
		});

		it("changes the .notifications-count element last-type attribute corresponding to the type", async () => {
			atom.notifications.addSuccess("A message");
			await statusBarManager.update();
			expect(notificationsCountContainer.getAttribute("last-type")).toBe("success");

			atom.notifications.addInfo("A message");
			await statusBarManager.update();
			expect(notificationsCountContainer.getAttribute("last-type")).toBe("info");

			atom.notifications.addWarning("A message");
			await statusBarManager.update();
			expect(notificationsCountContainer.getAttribute("last-type")).toBe("warning");

			atom.notifications.addError("A message");
			await statusBarManager.update();
			expect(notificationsCountContainer.getAttribute("last-type")).toBe("error");

			atom.notifications.addFatalError("A message");
			await statusBarManager.update();
			expect(notificationsCountContainer.getAttribute("last-type")).toBe("fatal");
		});
	});

	describe("when the element is clicked", () => {
		beforeEach(() => {
			spyOn(atom.commands, "dispatch");
			notificationsCountContainer.click();
		});

		it("will dispatch notifications-plus:toggle-log", () => expect(atom.commands.dispatch).toHaveBeenCalledWith(notificationsCountContainer, "notifications-plus:toggle-log"));
	});
});
