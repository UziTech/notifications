/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const {Notification} = require("atom");
const {generateFakeFetchResponses, generateException} = require("./helper");

describe("Notifications Count", function () {
	let [workspaceElement, statusBarManager, notificationsCountContainer] = Array.from([]);

	beforeEach(function () {
		workspaceElement = atom.views.getView(atom.workspace);
		atom.notifications.clear();

		waitsForPromise(() => Promise.all([
			atom.packages.activatePackage("notifications-plus"),
			atom.packages.activatePackage("status-bar")
		]));

		return runs(function () {
			({
				statusBarManager
			} = atom.packages.getActivePackage("notifications-plus").mainModule);
			return notificationsCountContainer = workspaceElement.querySelector(".notifications-count");
		});
	});

	describe("when the package is activated", () => it("attaches an .notifications-count element to the dom", function () {
		expect(statusBarManager.count).toBe(0);
		return expect(notificationsCountContainer).toExist();
	}));

	describe("when there are notifications before activation", function () {
		beforeEach(() => waitsForPromise(() => // Wrapped in Promise.resolve so this test continues to work on earlier versions of Atom
			Promise.resolve(atom.packages.deactivatePackage("notifications-plus"))));

		return it("displays counts notifications", function () {
			const warning = new Notification("warning", "Un-displayed warning");
			const error = new Notification("error", "Displayed error");
			error.setDisplayed(true);

			atom.notifications.addNotification(error);
			atom.notifications.addNotification(warning);

			waitsForPromise(() => atom.packages.activatePackage("notifications-plus"));

			return runs(function () {
				({
					statusBarManager
				} = atom.packages.getActivePackage("notifications-plus").mainModule);
				notificationsCountContainer = workspaceElement.querySelector(".notifications-count");
				expect(statusBarManager.count).toBe(2);
				return expect(parseInt(notificationsCountContainer.textContent, 10)).toBe(2);
			});
		});
	});

	describe("when notifications are added to atom.notifications", function () {
		beforeEach(() => generateFakeFetchResponses());

		it("will add the new-notification class for as long as the animation", function () {
			const notificationsCountNumber = notificationsCountContainer.firstChild.firstChild;
			expect(notificationsCountNumber).not.toHaveClass("new-notification");
			atom.notifications.addInfo("A message");
			expect(notificationsCountNumber).toHaveClass("new-notification");

			const animationend = new AnimationEvent("animationend", {animationName: "new-notification"});
			notificationsCountNumber.dispatchEvent(animationend);
			return expect(notificationsCountNumber).not.toHaveClass("new-notification");
		});

		return it("changes the .notifications-count element last-type attribute corresponding to the type", function () {
			atom.notifications.addSuccess("A message");
			expect(notificationsCountContainer.getAttribute("last-type")).toBe("success");

			atom.notifications.addInfo("A message");
			expect(notificationsCountContainer.getAttribute("last-type")).toBe("info");

			atom.notifications.addWarning("A message");
			expect(notificationsCountContainer.getAttribute("last-type")).toBe("warning");

			atom.notifications.addError("A message");
			expect(notificationsCountContainer.getAttribute("last-type")).toBe("error");

			atom.notifications.addFatalError("A message");
			return expect(notificationsCountContainer.getAttribute("last-type")).toBe("fatal");
		});
	});

	return describe("when the element is clicked", function () {
		beforeEach(function () {
			spyOn(atom.commands, "dispatch");
			return notificationsCountContainer.click();
		});

		return it("will dispatch notifications-plus:toggle-log", () => expect(atom.commands.dispatch).toHaveBeenCalledWith(notificationsCountContainer, "notifications-plus:toggle-log"));
	});
});
