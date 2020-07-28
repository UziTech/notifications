const fs = require("fs-plus");
const path = require("path");
const temp = require("temp").track();
const {Notification} = require("atom");
const NotificationElement = require("../lib/notification-element");
const NotificationIssue = require("../lib/notification-issue");
const {generateFakeFetchResponses, generateException} = require("./helper");

/* eslint-disable no-sync */
describe("Notifications", () => {
	let [workspaceElement, activationPromise] = [];

	beforeEach(async () => {
		workspaceElement = atom.views.getView(atom.workspace);
		atom.notifications.clear();
		activationPromise = atom.packages.activatePackage("notifications-plus");

		await activationPromise;
	});

	describe("when there are notifications before activation", () => {
		beforeEach(async () => {
			await atom.packages.deactivatePackage("notifications-plus");

			const warning = new Notification("warning", "Un-displayed warning");
			const error = new Notification("error", "Displayed error");
			error.setDisplayed(true);

			atom.notifications.addNotification(error);
			atom.notifications.addNotification(warning);

			await atom.packages.activatePackage("notifications-plus");
		});

		it("displays all non displayed notifications", () => {
			const notificationContainer = workspaceElement.querySelector("atom-notifications");
			let notification = notificationContainer.querySelector("atom-notification.warning");
			expect(notification).toExist();
			notification = notificationContainer.querySelector("atom-notification.error");
			expect(notification).not.toExist();
		});
	});

	describe("when notifications are added to atom.notifications", () => {
		let notificationContainer = null;
		beforeEach(() => {
			const enableInitNotification = atom.notifications.addSuccess("A message to trigger initialization", {dismissable: true});
			enableInitNotification.dismiss();
			jasmine.clock().tick(NotificationElement.prototype.visibilityDuration);
			jasmine.clock().tick(NotificationElement.prototype.animationDuration);

			notificationContainer = workspaceElement.querySelector("atom-notifications");
			jasmine.attachToDOM(workspaceElement);

			generateFakeFetchResponses();
		});

		it("adds an atom-notification element to the container with a class corresponding to the type", () => {
			expect(notificationContainer.childNodes.length).toBe(0);

			atom.notifications.addSuccess("A message");
			const notification = notificationContainer.querySelector("atom-notification.success");
			expect(notificationContainer.childNodes.length).toBe(1);
			expect(notification).toHaveClass("success");
			expect(notification.querySelector(".message").textContent.trim()).toBe("A message");
			expect(notification.querySelector(".meta")).not.toBeVisible();

			atom.notifications.addInfo("A message");
			expect(notificationContainer.childNodes.length).toBe(2);
			expect(notificationContainer.querySelector("atom-notification.info")).toExist();

			atom.notifications.addWarning("A message");
			expect(notificationContainer.childNodes.length).toBe(3);
			expect(notificationContainer.querySelector("atom-notification.warning")).toExist();

			atom.notifications.addError("A message");
			expect(notificationContainer.childNodes.length).toBe(4);
			expect(notificationContainer.querySelector("atom-notification.error")).toExist();

			atom.notifications.addFatalError("A message");
			expect(notificationContainer.childNodes.length).toBe(5);
			expect(notificationContainer.querySelector("atom-notification.fatal")).toExist();
		});

		it("displays notification with a detail when a detail is specified", () => {
			atom.notifications.addInfo("A message", {detail: "Some detail"});
			let notification = notificationContainer.childNodes[0];
			expect(notification.querySelector(".detail").textContent).toContain("Some detail");

			atom.notifications.addInfo("A message", {detail: null});
			notification = notificationContainer.childNodes[1];
			expect(notification.querySelector(".detail")).not.toBeVisible();

			atom.notifications.addInfo("A message", {detail: 1});
			notification = notificationContainer.childNodes[2];
			expect(notification.querySelector(".detail").textContent).toContain("1");

			atom.notifications.addInfo("A message", {detail: {something: "ok"}});
			notification = notificationContainer.childNodes[3];
			expect(notification.querySelector(".detail").textContent).toContain("Object");

			atom.notifications.addInfo("A message", {detail: ["cats", "ok"]});
			notification = notificationContainer.childNodes[4];
			expect(notification.querySelector(".detail").textContent).toContain("cats,ok");
		});

		it("does not add the has-stack class if a stack is provided without any detail", () => {
			atom.notifications.addInfo("A message", {stack: "Some stack"});
			const notificationElement = notificationContainer.querySelector("atom-notification.info");
			expect(notificationElement).not.toHaveClass("has-stack");
		});

		it("renders the message as sanitized markdown", () => {
			atom.notifications.addInfo("test <b>html</b> <iframe>but sanitized</iframe>");
			const notification = notificationContainer.childNodes[0];
			const html = notification.querySelector(".message").innerHTML;
			expect(html).toContain("test <b>html</b> ");
			expect(html).not.toContain("<iframe");
		});


		describe("when a dismissable notification is added", () => {
			it("auto removes when alwaysDismiss is true", () => {
				atom.config.set("notifications-plus.alwaysDismiss", true);
				atom.notifications.addSuccess("A message", {dismissable: true});
				const notification = notificationContainer.querySelector("atom-notification.success");
				const closeButton = notification.querySelector(".close");

				expect(closeButton).toBeVisible();
				expect(notification).not.toHaveClass("remove");

				jasmine.clock().tick(NotificationElement.prototype.visibilityDuration);
				expect(notification).toHaveClass("remove");
				expect(notificationContainer.childNodes.length).toBe(1);

				jasmine.clock().tick(NotificationElement.prototype.animationDuration);
				expect(notificationContainer.childNodes.length).toBe(0);
			});

			it("is removed when Notification::dismiss() is called", () => {
				const notification = atom.notifications.addSuccess("A message", {dismissable: true});
				const notificationElement = notificationContainer.querySelector("atom-notification.success");

				expect(notificationContainer.childNodes.length).toBe(1);

				notification.dismiss();

				jasmine.clock().tick(NotificationElement.prototype.visibilityDuration);
				expect(notificationElement).toHaveClass("remove");

				jasmine.clock().tick(NotificationElement.prototype.animationDuration);
				expect(notificationContainer.childNodes.length).toBe(0);
			});

			it("is removed when the close icon is clicked", async () => {
				jasmine.attachToDOM(workspaceElement);

				await atom.workspace.open();

				atom.notifications.addSuccess("A message", {dismissable: true});
				const notificationElement = notificationContainer.querySelector("atom-notification.success");

				expect(notificationContainer.childNodes.length).toBe(1);

				notificationElement.focus();
				notificationElement.querySelector(".close.icon").click();

				jasmine.clock().tick(NotificationElement.prototype.visibilityDuration);
				expect(notificationElement).toHaveClass("remove");

				jasmine.clock().tick(NotificationElement.prototype.animationDuration);
				expect(notificationContainer.childNodes.length).toBe(0);
			});

			it("is removed when core:cancel is triggered", () => {
				atom.notifications.addSuccess("A message", {dismissable: true});
				const notificationElement = notificationContainer.querySelector("atom-notification.success");

				expect(notificationContainer.childNodes.length).toBe(1);

				atom.commands.dispatch(workspaceElement, "core:cancel");

				jasmine.clock().tick(NotificationElement.prototype.visibilityDuration * 3);
				expect(notificationElement).toHaveClass("remove");

				jasmine.clock().tick(NotificationElement.prototype.animationDuration * 3);
				expect(notificationContainer.childNodes.length).toBe(0);
			});

			it("focuses the active pane only if the dismissed notification has focus", async () => {
				jasmine.attachToDOM(workspaceElement);

				await atom.workspace.open();

				const notification1 = atom.notifications.addSuccess("First message", {dismissable: true});
				atom.notifications.addError("Second message", {dismissable: true});
				const notificationElement2 = notificationContainer.querySelector("atom-notification.error");

				expect(notificationContainer.childNodes.length).toBe(2);

				notificationElement2.focus();

				notification1.dismiss();

				jasmine.clock().tick(NotificationElement.prototype.visibilityDuration);
				jasmine.clock().tick(NotificationElement.prototype.animationDuration);
				expect(notificationContainer.childNodes.length).toBe(1);
				expect(notificationElement2).toHaveFocus();

				notificationElement2.querySelector(".close.icon").click();

				jasmine.clock().tick(NotificationElement.prototype.visibilityDuration);
				jasmine.clock().tick(NotificationElement.prototype.animationDuration);
				expect(notificationContainer.childNodes.length).toBe(0);
				expect(atom.views.getView(atom.workspace.getActiveTextEditor())).toHaveFocus();
			});
		});

		describe("when an autoclose notification is added", () => {
			let [notification, closeButton, model] = [];

			beforeEach(() => {
				model = atom.notifications.addSuccess("A message");
				notification = notificationContainer.querySelector("atom-notification.success");
				closeButton = notification.querySelector(".close");
			});

			it("closes and removes the message after a given amount of time", () => {
				expect(closeButton).not.toBeVisible();
				expect(notification).not.toHaveClass("remove");

				jasmine.clock().tick(NotificationElement.prototype.visibilityDuration);
				expect(notification).toHaveClass("remove");
				expect(notificationContainer.childNodes.length).toBe(1);

				jasmine.clock().tick(NotificationElement.prototype.animationDuration);
				expect(notificationContainer.childNodes.length).toBe(0);
			});

			describe("when the notification is clicked", () => {
				beforeEach(() => notification.click());

				it("makes the notification dismissable", () => {
					expect(closeButton).toBeVisible();
					expect(notification).toHaveClass("has-close");

					jasmine.clock().tick(NotificationElement.prototype.visibilityDuration);
					expect(notification).not.toHaveClass("remove");
				});

				it("removes the notification when dismissed", () => {
					model.dismiss();
					expect(notification).toHaveClass("remove");
				});
			});

			describe("when the mouse is hovering over the notification", () => {
				beforeEach(() => {
					const event = new MouseEvent("mouseenter");
					notification.dispatchEvent(event);
				});

				it("shows the close button", () => expect(closeButton).toBeVisible());

				it("makes the notification dismissable if hovering past close timeout", () => {
					jasmine.clock().tick(NotificationElement.prototype.visibilityDuration);
					expect(closeButton).toBeVisible();
					expect(notification).toHaveClass("has-close");
					expect(notification).not.toHaveClass("remove");
				});

				describe("when the mouse leaves before the close timeout", () => beforeEach(() => {
					const event = new MouseEvent("mouseleave");
					notification.dispatchEvent(event);

					it("dismisses the notification after the close timeout", () => {
						expect(closeButton).not.toBeVisible();
						jasmine.clock().tick(NotificationElement.prototype.visibilityDuration);
						expect(notification).toHaveClass("remove");
					});
				}));
			});
		});

		describe("when the default timeout setting is changed", () => {
			let [notification] = [];

			beforeEach(() => {
				atom.config.set("notifications-plus.defaultTimeout", 1000);
				atom.notifications.addSuccess("A message");
				notification = notificationContainer.querySelector("atom-notification.success");
			});

			it("uses the setting value for the autoclose timeout", () => {
				expect(notification).not.toHaveClass("remove");
				jasmine.clock().tick(1000);
				expect(notification).toHaveClass("remove");
			});

			describe("when the 'timeout' option is used", () => {

				beforeEach(() => {
					atom.notifications.addInfo("A message", {timeout: 10000});
					notification = notificationContainer.querySelector("atom-notification.info");
				});

				it("uses the 'timeout' value for the autoclose timeout", () => {
					expect(notification).not.toHaveClass("remove");
					jasmine.clock().tick(NotificationElement.prototype.visibilityDuration);
					expect(notification).not.toHaveClass("remove");
					jasmine.clock().tick(10000 - NotificationElement.prototype.visibilityDuration);
					expect(notification).toHaveClass("remove");
				});
			});
		});

		describe("when the `description` option is used", () => {
			it("displays the description text in the .description element", () => {
				atom.notifications.addSuccess("A message", {description: "This is [a link](http://atom.io)"});
				const notification = notificationContainer.querySelector("atom-notification.success");
				expect(notification).toHaveClass("has-description");
				expect(notification.querySelector(".meta")).toBeVisible();
				expect(notification.querySelector(".description").textContent.trim()).toBe("This is a link");
				expect(notification.querySelector(".description a").href).toBe("http://atom.io/");
			});
		});

		describe("when the `buttons` options is used", () => {
			it("displays the buttons in the .description element", () => {
				const clicked = [];
				atom.notifications.addSuccess("A message", {
					buttons: [{
						text: "Button One",
						className: "btn-one",
						onDidClick() {
							clicked.push("one");
						}
					}, {
						text: "Button Two",
						className: "btn-two",
						onDidClick() {
							clicked.push("two");
						}
					}]
				});

				const notification = notificationContainer.querySelector("atom-notification.success");
				expect(notification).toHaveClass("has-buttons");
				expect(notification.querySelector(".meta")).toBeVisible();

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
			let fatalError, issueBody, issueTitle;
			[notificationContainer, fatalError, issueTitle, issueBody] = [];
			describe("when the editor is in dev mode", () => {
				beforeEach(() => {
					spyOn(atom, "inDevMode").and.returnValue(true);
					generateException();
					notificationContainer = workspaceElement.querySelector("atom-notifications");
					fatalError = notificationContainer.querySelector("atom-notification.fatal");
				});

				it("does not display a notification", () => {
					expect(notificationContainer.childNodes.length).toBe(0);
					expect(fatalError).toBe(null);
				});
			});

			describe("when the exception has no core or package paths in the stack trace", () => {
				it("does not display a notification", async () => {
					atom.notifications.clear();
					spyOn(atom, "inDevMode").and.returnValue(false);
					spyOn(console, "error");
					let handler;
					const promise = new Promise(resolve => {
						handler = resolve;
					});
					atom.onWillThrowError(handler);

					// Fake an unhandled error with a call stack located outside of the source
					// of Atom or an Atom package
					fs.readFile(__dirname, () => {
						const err = new Error();
						err.stack = "FakeError: foo is not bar\n    at blah.fakeFunc (directory/fakefile.js:1:25)";
						throw err;
					});

					await promise;

					expect(atom.notifications.getNotifications().length).toBe(0);
				});
			});

			describe("when the message contains a newline", () => {
				it("removes the newline when generating the issue title", async () => {
					const message = "Uncaught Error: Cannot read property 'object' of undefined\nTypeError: Cannot read property 'object' of undefined";
					atom.notifications.addFatalError(message);
					notificationContainer = workspaceElement.querySelector("atom-notifications");
					fatalError = notificationContainer.querySelector("atom-notification.fatal");

					await fatalError.getRenderPromise();
					issueTitle = fatalError.issue.getIssueTitle();
					expect(issueTitle).not.toContain("\n");
					expect(issueTitle).toBe("Uncaught Error: Cannot read property 'object' of undefinedTypeError: Cannot read property 'objec...");
				});
			});

			describe("when the message contains continguous newlines", () => {
				it("removes the newlines when generating the issue title", async () => {
					const message = "Uncaught Error: Cannot do the thing\n\nSuper sorry about this";
					atom.notifications.addFatalError(message);
					notificationContainer = workspaceElement.querySelector("atom-notifications");
					fatalError = notificationContainer.querySelector("atom-notification.fatal");

					await fatalError.getRenderPromise();
					issueTitle = fatalError.issue.getIssueTitle();
					expect(issueTitle).toBe("Uncaught Error: Cannot do the thingSuper sorry about this");
				});
			});

			describe("when there are multiple packages in the stack trace", () => {
				beforeEach(() => {
					const stack = `\
TypeError: undefined is not a function
  at Object.module.exports.Pane.promptToSaveItem [as defaultSavePrompt] (/Applications/Atom.app/Contents/Resources/app/src/pane.js:490:23)
  at Pane.promptToSaveItem (/Users/someguy/.atom/packages/save-session/lib/save-prompt.coffee:21:15)
  at Pane.module.exports.Pane.destroyItem (/Applications/Atom.app/Contents/Resources/app/src/pane.js:442:18)
  at HTMLDivElement.<anonymous> (/Applications/Atom.app/Contents/Resources/app/node_modules/tabs/lib/tab-bar-view.js:174:22)
  at space-pen-ul.jQuery.event.dispatch (/Applications/Atom.app/Contents/Resources/app/node_modules/archive-view/node_modules/atom-space-pen-views/node_modules/space-pen/vendor/jquery.js:4676:9)
  at space-pen-ul.elemData.handle (/Applications/Atom.app/Contents/Resources/app/node_modules/archive-view/node_modules/atom-space-pen-views/node_modules/space-pen/vendor/jquery.js:4360:46)\
`;
					const detail = "ok";

					atom.notifications.addFatalError("TypeError: undefined", {detail, stack});
					notificationContainer = workspaceElement.querySelector("atom-notifications");
					fatalError = notificationContainer.querySelector("atom-notification.fatal");

					spyOn(fatalError.issue, "getRealPath").and.callFake(async p => p);
					spyOn(fatalError.issue, "getPackagePathsByPackageName").and.callFake(() => ({
						"save-session": "/Users/someguy/.atom/packages/save-session",
						"tabs": "/Applications/Atom.app/Contents/Resources/app/node_modules/tabs"
					}));
				});

				it("chooses the first package in the trace", async () => {
					expect(await fatalError.issue.getPackageName()).toBe("save-session");
				});
			});

			describe("when an exception is thrown from a package", () => {
				beforeEach(() => {
					issueTitle = null;
					issueBody = null;
					spyOn(atom, "inDevMode").and.returnValue(false);
					generateFakeFetchResponses();
					generateException();
					notificationContainer = workspaceElement.querySelector("atom-notifications");
					fatalError = notificationContainer.querySelector("atom-notification.fatal");
				});

				it("displays a fatal error with the package name in the error", async () => {
					await fatalError.getRenderPromise();

					issueTitle = fatalError.issue.getIssueTitle();
					issueBody = await fatalError.issue.getIssueBody();

					expect(notificationContainer.childNodes.length).toBe(1);
					expect(fatalError).toHaveClass("has-close");
					expect(fatalError.innerHTML).toContain("ReferenceError: a is not defined");
					expect(fatalError.innerHTML).toContain("<a href=\"https://github.com/UziTech/notifications\">notifications-plus package</a>");
					expect(await fatalError.issue.getPackageName()).toBe("notifications-plus");

					const button = fatalError.querySelector(".btn");
					expect(button.textContent).toContain("Create issue on the notifications-plus package");
					const buttonCopyReport = fatalError.querySelector(".btn-copy-report");
					expect(buttonCopyReport).toExist();
					const buttonOpenSettings = fatalError.querySelector(".btn-open-settings");
					expect(buttonOpenSettings).toExist();

					expect(issueTitle).toContain("$ATOM_HOME");
					expect(issueTitle).not.toContain(process.env.ATOM_HOME);
					expect(issueBody).toMatch(/Atom\*\*: [0-9].[0-9]+.[0-9]+/ig);
					expect(issueBody).not.toMatch(/Unknown/ig);
					expect(issueBody).toContain("ReferenceError: a is not defined");
					expect(issueBody).toContain("Thrown From**: [notifications-plus](https://github.com/UziTech/notifications) package ");
					expect(issueBody).toContain("### Non-Core Packages");
				});

				// FIXME: this doesnt work on the test server. `apm ls` is not working for some reason.
				// expect(issueBody).toContain 'notifications '

				it("standardizes platform separators on #win32", async () => {
					await fatalError.getRenderPromise();
					issueTitle = fatalError.issue.getIssueTitle();

					expect(issueTitle).toContain(path.posix.sep);
					expect(issueTitle).not.toContain(path.win32.sep);
				});
			});

			describe("when an exception contains the user's home directory", () => {
				beforeEach(() => {
					issueTitle = null;
					spyOn(atom, "inDevMode").and.returnValue(false);
					generateFakeFetchResponses();

					// Create a custom error message that contains the user profile but not ATOM_HOME
					try {
						// eslint-disable-next-line no-undef, no-unused-expressions
						a + 1;
					} catch (e) {
						const home = process.platform === "win32" ? process.env.USERPROFILE : process.env.HOME;
						const errMsg = `${e.toString()} in ${home}${path.sep}somewhere`;
						window.onerror.call(window, errMsg, "/dev/null", 2, 3, e);
					}

					notificationContainer = workspaceElement.querySelector("atom-notifications");
					fatalError = notificationContainer.querySelector("atom-notification.fatal");
				});

				it("replaces the directory with a ~", async () => {
					await fatalError.getRenderPromise();
					issueTitle = fatalError.issue.getIssueTitle();

					expect(issueTitle).toContain("~");
					if (process.platform === "win32") {
						expect(issueTitle).not.toContain(process.env.USERPROFILE);
					}
					expect(issueTitle).not.toContain(process.env.HOME);
				});
			});

			describe("when an exception is thrown from a linked package", () => {
				beforeEach(() => {
					spyOn(atom, "inDevMode").and.returnValue(false);
					generateFakeFetchResponses();

					const packagesDir = path.join(temp.mkdirSync("atom-packages-"), ".atom", "packages");
					atom.packages.packageDirPaths.push(packagesDir);
					const packageDir = path.join(packagesDir, "..", "..", "github", "linked-package");
					fs.makeTreeSync(path.dirname(path.join(packagesDir, "linked-package")));
					fs.symlinkSync(packageDir, path.join(packagesDir, "linked-package"), "junction");
					fs.writeFileSync(path.join(packageDir, "package.json"), `\
{
  "name": "linked-package",
  "version": "1.0.0",
  "repository": "https://github.com/UziTech/notifications"
}\
`
					);
					atom.packages.enablePackage("linked-package");

					const stack = `\
ReferenceError: path is not defined
  at Object.module.exports.LinkedPackage.wow (${path.join(fs.realpathSync(packageDir), "linked-package.coffee")}:29:15)
  at atom-workspace.subscriptions.add.atom.commands.add.linked-package:wow (${path.join(packageDir, "linked-package.coffee")}:18:102)
  at CommandRegistry.module.exports.CommandRegistry.handleCommandEvent (/Applications/Atom.app/Contents/Resources/app/src/command-registry.js:238:29)
  at /Applications/Atom.app/Contents/Resources/app/src/command-registry.js:3:61
  at CommandPaletteView.module.exports.CommandPaletteView.confirmed (/Applications/Atom.app/Contents/Resources/app/node_modules/command-palette/lib/command-palette-view.js:159:32)\
`;
					const detail = `At ${path.join(packageDir, "linked-package.coffee")}:41`;
					const message = "Uncaught ReferenceError: path is not defined";
					atom.notifications.addFatalError(message, {stack, detail, dismissable: true});
					notificationContainer = workspaceElement.querySelector("atom-notifications");
					fatalError = notificationContainer.querySelector("atom-notification.fatal");
				});

				it("displays a fatal error with the package name in the error", async () => {
					await fatalError.getRenderPromise();

					expect(notificationContainer.childNodes.length).toBe(1);
					expect(fatalError).toHaveClass("has-close");
					expect(fatalError.innerHTML).toContain("Uncaught ReferenceError: path is not defined");
					expect(fatalError.innerHTML).toContain("<a href=\"https://github.com/UziTech/notifications\">linked-package package</a>");
					expect(await fatalError.issue.getPackageName()).toBe("linked-package");
				});
			});

			describe("when an exception is thrown from an unloaded package", () => {
				beforeEach(() => {
					spyOn(atom, "inDevMode").and.returnValue(false);

					generateFakeFetchResponses();

					const packagesDir = temp.mkdirSync("atom-packages-");
					atom.packages.packageDirPaths.push(path.join(packagesDir, ".atom", "packages"));
					const packageDir = path.join(packagesDir, ".atom", "packages", "unloaded");
					fs.writeFileSync(path.join(packageDir, "package.json"), `\
{
  "name": "unloaded",
  "version": "1.0.0",
  "repository": "https://github.com/UziTech/notifications"
}\
`
					);

					const stack = `Error\n  at ${path.join(packageDir, "index.js")}:1:1`;
					const detail = "ReferenceError: unloaded error";
					const message = "Error";
					atom.notifications.addFatalError(message, {stack, detail, dismissable: true});
					notificationContainer = workspaceElement.querySelector("atom-notifications");
					fatalError = notificationContainer.querySelector("atom-notification.fatal");
				});

				it("displays a fatal error with the package name in the error", async () => {
					await fatalError.getRenderPromise();

					expect(notificationContainer.childNodes.length).toBe(1);
					expect(fatalError).toHaveClass("has-close");
					expect(fatalError.innerHTML).toContain("ReferenceError: unloaded error");
					expect(fatalError.innerHTML).toContain("<a href=\"https://github.com/UziTech/notifications\">unloaded package</a>");
					expect(await fatalError.issue.getPackageName()).toBe("unloaded");
				});
			});

			describe("when an exception is thrown from a package trying to load", () => {
				beforeEach(() => {
					spyOn(atom, "inDevMode").and.returnValue(false);
					generateFakeFetchResponses();

					const packagesDir = temp.mkdirSync("atom-packages-");
					atom.packages.packageDirPaths.push(path.join(packagesDir, ".atom", "packages"));
					const packageDir = path.join(packagesDir, ".atom", "packages", "broken-load");
					fs.writeFileSync(path.join(packageDir, "package.json"), `\
{
  "name": "broken-load",
  "version": "1.0.0",
  "repository": "https://github.com/UziTech/notifications"
}\
`
					);

					const stack = "TypeError: Cannot read property 'prototype' of undefined\n  at __extends (<anonymous>:1:1)\n  at Object.defineProperty.value [as .coffee] (/Applications/Atom.app/Contents/Resources/app.asar/src/compile-cache.js:169:21)";
					const detail = "TypeError: Cannot read property 'prototype' of undefined";
					const message = "Failed to load the broken-load package";
					atom.notifications.addFatalError(message, {stack, detail, packageName: "broken-load", dismissable: true});
					notificationContainer = workspaceElement.querySelector("atom-notifications");
					fatalError = notificationContainer.querySelector("atom-notification.fatal");
				});

				it("displays a fatal error with the package name in the error", async () => {
					await fatalError.getRenderPromise();

					expect(notificationContainer.childNodes.length).toBe(1);
					expect(fatalError).toHaveClass("has-close");
					expect(fatalError.innerHTML).toContain("TypeError: Cannot read property 'prototype' of undefined");
					expect(fatalError.innerHTML).toContain("<a href=\"https://github.com/UziTech/notifications\">broken-load package</a>");
					expect(await fatalError.issue.getPackageName()).toBe("broken-load");
				});
			});

			describe("when an exception is thrown from a package trying to load a grammar", () => {
				beforeEach(() => {
					spyOn(atom, "inDevMode").and.returnValue(false);
					generateFakeFetchResponses();

					const packagesDir = temp.mkdirSync("atom-packages-");
					atom.packages.packageDirPaths.push(path.join(packagesDir, ".atom", "packages"));
					const packageDir = path.join(packagesDir, ".atom", "packages", "language-broken-grammar");
					fs.writeFileSync(path.join(packageDir, "package.json"), `\
{
  "name": "language-broken-grammar",
  "version": "1.0.0",
  "repository": "https://github.com/UziTech/notifications"
}\
`
					);

					const stack = `\
Unexpected string
  at nodeTransforms.Literal (/usr/share/atom/resources/app/node_modules/season/node_modules/cson-parser/lib/parse.js:100:15)
  at ${path.join("packageDir", "grammars", "broken-grammar.cson")}:1:1\
`;
					const detail = `\
At Syntax error on line 241, column 18: evalmachine.<anonymous>:1
"#\\{" "end": "\\}"
       ^^^^^
Unexpected string in ${path.join("packageDir", "grammars", "broken-grammar.cson")}

SyntaxError: Syntax error on line 241, column 18: evalmachine.<anonymous>:1
"#\\{" "end": "\\}"
       ^^^^^\
`;
					const message = "Failed to load a language-broken-grammar package grammar";
					atom.notifications.addFatalError(message, {stack, detail, packageName: "language-broken-grammar", dismissable: true});
					notificationContainer = workspaceElement.querySelector("atom-notifications");
					fatalError = notificationContainer.querySelector("atom-notification.fatal");
				});

				it("displays a fatal error with the package name in the error", async () => {
					await fatalError.getRenderPromise();

					expect(notificationContainer.childNodes.length).toBe(1);
					expect(fatalError).toHaveClass("has-close");
					expect(fatalError.innerHTML).toContain("Failed to load a language-broken-grammar package grammar");
					expect(fatalError.innerHTML).toContain("<a href=\"https://github.com/UziTech/notifications\">language-broken-grammar package</a>");
					expect(await fatalError.issue.getPackageName()).toBe("language-broken-grammar");
				});
			});

			describe("when an exception is thrown from a package trying to activate", () => {
				beforeEach(() => {
					spyOn(atom, "inDevMode").and.returnValue(false);
					generateFakeFetchResponses();

					const packagesDir = temp.mkdirSync("atom-packages-");
					atom.packages.packageDirPaths.push(path.join(packagesDir, ".atom", "packages"));
					const packageDir = path.join(packagesDir, ".atom", "packages", "broken-activation");
					fs.writeFileSync(path.join(packageDir, "package.json"), `\
{
  "name": "broken-activation",
  "version": "1.0.0",
  "repository": "https://github.com/UziTech/notifications"
}\
`
					);

					const stack = "TypeError: Cannot read property 'command' of undefined\n  at Object.module.exports.activate (<anonymous>:7:23)\n  at Package.module.exports.Package.activateNow (/Applications/Atom.app/Contents/Resources/app.asar/src/package.js:232:19)";
					const detail = "TypeError: Cannot read property 'command' of undefined";
					const message = "Failed to activate the broken-activation package";
					atom.notifications.addFatalError(message, {stack, detail, packageName: "broken-activation", dismissable: true});
					notificationContainer = workspaceElement.querySelector("atom-notifications");
					fatalError = notificationContainer.querySelector("atom-notification.fatal");
				});

				it("displays a fatal error with the package name in the error", async () => {
					await fatalError.getRenderPromise();

					expect(notificationContainer.childNodes.length).toBe(1);
					expect(fatalError).toHaveClass("has-close");
					expect(fatalError.innerHTML).toContain("TypeError: Cannot read property 'command' of undefined");
					expect(fatalError.innerHTML).toContain("<a href=\"https://github.com/UziTech/notifications\">broken-activation package</a>");
					expect(await fatalError.issue.getPackageName()).toBe("broken-activation");
				});
			});

			describe("when an exception is thrown from a package without a trace, but with a URL", () => {
				beforeEach(() => {
					issueBody = null;
					spyOn(atom, "inDevMode").and.returnValue(false);
					generateFakeFetchResponses();
					try {
						// eslint-disable-next-line no-undef, no-unused-expressions
						a + 1;
					} catch (e) {
						// Pull the file path from the stack
						const filePath = e.stack.split("\n")[1].match(/\((.+?):\d+/)[1];
						let undef;
						window.onerror.call(window, e.toString(), filePath, 2, 3, {message: e.toString(), stack: undef});
					}

					notificationContainer = workspaceElement.querySelector("atom-notifications");
					fatalError = notificationContainer.querySelector("atom-notification.fatal");
				});

				it("detects the package name from the URL", async () => {
					await fatalError.getRenderPromise();

					expect(fatalError.innerHTML).toContain("ReferenceError: a is not defined");
					expect(fatalError.innerHTML).toContain("<a href=\"https://github.com/UziTech/notifications\">notifications-plus package</a>");
					expect(await fatalError.issue.getPackageName()).toBe("notifications-plus");
				});
			});

			describe("when an exception is thrown from core", () => {
				beforeEach(async () => {
					atom.commands.dispatch(workspaceElement, "some-package:a-command");
					atom.commands.dispatch(workspaceElement, "some-package:a-command");
					atom.commands.dispatch(workspaceElement, "some-package:a-command");
					spyOn(atom, "inDevMode").and.returnValue(false);
					generateFakeFetchResponses();
					try {
						// eslint-disable-next-line no-undef, no-unused-expressions
						a + 1;
					} catch (e) {
						// Mung the stack so it looks like its from core
						e.stack = e.stack.replace(new RegExp(__filename, "g"), "<embedded>").replace(/notifications/g, "core");
						window.onerror.call(window, e.toString(), "/dev/null", 2, 3, e);
					}

					notificationContainer = workspaceElement.querySelector("atom-notifications");
					fatalError = notificationContainer.querySelector("atom-notification.fatal");
					await fatalError.getRenderPromise();
					issueBody = await fatalError.issue.getIssueBody();
				});

				it("displays a fatal error with the package name in the error", async () => {
					expect(notificationContainer.childNodes.length).toBe(1);
					expect(fatalError).toExist();
					expect(fatalError).toHaveClass("has-close");
					expect(fatalError.innerHTML).toContain("ReferenceError: a is not defined");
					expect(fatalError.innerHTML).toContain("bug in Atom");
					expect(await fatalError.issue.getPackageName()).toBeUndefined();

					const button = fatalError.querySelector(".btn");
					expect(button.textContent).toContain("Create issue on atom/atom");
					const buttonCopyReport = fatalError.querySelector(".btn-copy-report");
					expect(buttonCopyReport).toExist();
					const buttonOpenSettings = fatalError.querySelector(".btn-open-settings");
					expect(buttonOpenSettings).not.toExist();

					expect(issueBody).toContain("ReferenceError: a is not defined");
					expect(issueBody).toContain("**Thrown From**: Atom Core");
				});

				it("contains the commands that the user run in the issue body", () => expect(issueBody).toContain("some-package:a-command"));

				it("allows the user to toggle the stack trace", () => {
					const stackToggle = fatalError.querySelector(".stack-toggle");
					const stackContainer = fatalError.querySelector(".stack-container");
					expect(stackToggle).toExist();
					expect(stackContainer.style.display).toBe("none");

					stackToggle.click();
					expect(stackContainer.style.display).toBe("block");

					stackToggle.click();
					expect(stackContainer.style.display).toBe("none");
				});
			});

			describe("when the there is an error searching for the issue", () => {
				beforeEach(async () => {
					spyOn(atom, "inDevMode").and.returnValue(false);
					generateFakeFetchResponses({issuesErrorResponse: "403"});
					generateException();
					fatalError = notificationContainer.querySelector("atom-notification.fatal");
					await fatalError.getRenderPromise();
					issueBody = fatalError.issue.issueBody;
				});

				it("asks the user to create an issue", () => {
					const button = fatalError.querySelector(".btn");
					const fatalNotification = fatalError.querySelector(".fatal-notification");
					expect(button.textContent).toContain("Create issue");
					expect(fatalNotification.textContent).toContain("You can help by creating an issue");
				});
			});

			describe("when the error has not been reported", () => {
				beforeEach(() => spyOn(atom, "inDevMode").and.returnValue(false));

				describe("when the message is longer than 100 characters", () => {
					const message = "Uncaught Error: Cannot find module 'dialog'Error: Cannot find module 'dialog' at Function.Module._resolveFilename (module.js:351:15) at Function.Module._load (module.js:293:25) at Module.require (module.js:380:17) at EventEmitter.<anonymous> (/Applications/Atom.app/Contents/Resources/atom/browser/lib/rpc-server.js:128:79) at EventEmitter.emit (events.js:119:17) at EventEmitter.<anonymous> (/Applications/Atom.app/Contents/Resources/atom/browser/api/lib/web-contents.js:99:23) at EventEmitter.emit (events.js:119:17)";
					const expectedIssueTitle = "Uncaught Error: Cannot find module 'dialog'Error: Cannot find module 'dialog' at Function.Module....";

					beforeEach(() => {
						generateFakeFetchResponses();
						try {
							// eslint-disable-next-line no-undef, no-unused-expressions
							a + 1;
						} catch (e) {
							e.code = "Error";
							e.message = message;
							window.onerror.call(window, e.message, "abc", 2, 3, e);
						}
					});

					it("truncates the issue title to 100 characters", async () => {
						fatalError = notificationContainer.querySelector("atom-notification.fatal");

						await fatalError.getRenderPromise();

						const button = fatalError.querySelector(".btn");
						expect(button.textContent).toContain("Create issue");
						expect(fatalError.issue.getIssueTitle()).toBe(expectedIssueTitle);
					});
				});
			});

			describe("when the package is out of date", () => {
				beforeEach(() => {
					const installedVersion = "0.9.0";
					const UserUtilities = require("../lib/user-utilities");
					spyOn(UserUtilities, "getPackageVersion").and.callFake(() => installedVersion);
					spyOn(atom, "inDevMode").and.returnValue(false);
				});

				describe("when the package is a non-core package", () => {
					beforeEach(async () => {
						generateFakeFetchResponses({
							packageResponse: {
								repository: {url: "https://github.com/someguy/somepackage"},
								releases: {latest: "0.10.0"}
							}
						});
						spyOn(NotificationIssue.prototype, "getPackageName").and.callFake(async () => "somepackage");
						spyOn(NotificationIssue.prototype, "getRepoUrl").and.callFake(async () => "https://github.com/someguy/somepackage");
						generateException();
						fatalError = notificationContainer.querySelector("atom-notification.fatal");
						await fatalError.getRenderPromise();
						issueBody = fatalError.issue.issueBody;
					});

					it("asks the user to update their packages", () => {
						const fatalNotification = fatalError.querySelector(".fatal-notification");
						const button = fatalError.querySelector(".btn");

						expect(button.textContent).toContain("Check for package updates");
						expect(fatalNotification.textContent).toContain("Upgrading to the latest");
						expect(button.getAttribute("href")).toBe("#");
					});
				});

				describe("when the package is an atom-owned non-core package", () => {
					beforeEach(async () => {
						generateFakeFetchResponses({
							packageResponse: {
								repository: {url: "https://github.com/atom/sort-lines"},
								releases: {latest: "0.10.0"}
							}
						});
						spyOn(NotificationIssue.prototype, "getPackageName").and.callFake(async () => "sort-lines");
						spyOn(NotificationIssue.prototype, "getRepoUrl").and.callFake(async () => "https://github.com/atom/sort-lines");
						generateException();
						fatalError = notificationContainer.querySelector("atom-notification.fatal");

						await fatalError.getRenderPromise();
						issueBody = fatalError.issue.issueBody;
					});

					it("asks the user to update their packages", () => {
						const fatalNotification = fatalError.querySelector(".fatal-notification");
						const button = fatalError.querySelector(".btn");

						expect(button.textContent).toContain("Check for package updates");
						expect(fatalNotification.textContent).toContain("Upgrading to the latest");
						expect(button.getAttribute("href")).toBe("#");
					});
				});

				describe("when the package is a core package", () => {
					beforeEach(() => generateFakeFetchResponses({
						packageResponse: {
							repository: {url: "https://github.com/UziTech/notifications"},
							releases: {latest: "0.11.0"}
						}
					}));

					describe("when the locally installed version is lower than Atom's version", () => {
						beforeEach(async () => {
							const versionShippedWithAtom = "0.10.0";
							const UserUtilities = require("../lib/user-utilities");
							spyOn(UserUtilities, "getPackageVersionShippedWithAtom").and.callFake(() => versionShippedWithAtom);

							generateException();
							fatalError = notificationContainer.querySelector("atom-notification.fatal");
							await fatalError.getRenderPromise();
							issueBody = fatalError.issue.issueBody;
						});

						it("doesn't show the Create Issue button", () => {
							const button = fatalError.querySelector(".btn-issue");
							expect(button).not.toExist();
						});

						it("tells the user that the package is a locally installed core package and out of date", () => {
							const fatalNotification = fatalError.querySelector(".fatal-notification");
							expect(fatalNotification.textContent).toContain("Locally installed core Atom package");
							expect(fatalNotification.textContent).toContain("is out of date");
						});
					});

					describe("when the locally installed version matches Atom's version", () => {
						beforeEach(async () => {
							const versionShippedWithAtom = "0.9.0";
							const UserUtilities = require("../lib/user-utilities");
							spyOn(UserUtilities, "getPackageVersionShippedWithAtom").and.callFake(() => versionShippedWithAtom);

							generateException();
							fatalError = notificationContainer.querySelector("atom-notification.fatal");
							await fatalError.getRenderPromise();
							issueBody = fatalError.issue.issueBody;
						});

						it("ignores the out of date package because they cant upgrade it without upgrading atom", () => {
							fatalError = notificationContainer.querySelector("atom-notification.fatal");
							const button = fatalError.querySelector(".btn");
							expect(button.textContent).toContain("Create issue");
						});
					});
				});
			});

			describe("when Atom is out of date", () => {
				beforeEach(async () => {
					const installedVersion = "0.179.0";
					spyOn(atom, "getVersion").and.callFake(() => installedVersion);
					spyOn(atom, "inDevMode").and.returnValue(false);

					generateFakeFetchResponses({
						atomResponse: {
							name: "0.180.0"
						}
					});

					generateException();

					fatalError = notificationContainer.querySelector("atom-notification.fatal");
					await fatalError.getRenderPromise();
					issueBody = fatalError.issue.issueBody;
				});

				it("doesn't show the Create Issue button", () => {
					const button = fatalError.querySelector(".btn-issue");
					expect(button).not.toExist();
				});

				it("tells the user that Atom is out of date", () => {
					const fatalNotification = fatalError.querySelector(".fatal-notification");
					expect(fatalNotification.textContent).toContain("Atom is out of date");
				});

				it("provides a link to the latest released version", () => {
					const fatalNotification = fatalError.querySelector(".fatal-notification");
					expect(fatalNotification.innerHTML).toContain("<a href=\"https://github.com/atom/atom/releases/tag/v0.180.0\">latest version</a>");
				});
			});

			describe("when telemetry settings are changed", () => {
				beforeEach(() => {
					spyOn(atom, "inDevMode").and.returnValue(false);
					generateFakeFetchResponses();
				});

				it("does not send fetch when setting is 'no'", async () => {
					atom.config.set("notifications-plus.checkFatalIssues", "no");
					generateException();
					fatalError = notificationContainer.querySelector("atom-notification.fatal");
					await fatalError.getRenderPromise();

					const button = fatalError.querySelector(".btn");
					expect(window.fetch).not.toHaveBeenCalled();
					expect(button.textContent).toBe("Check reported issues");
				});

				it("does not send fetch when telemetry setting is 'no'", async () => {
					atom.config.set("core.telemetryConsent", "no");
					generateException();
					fatalError = notificationContainer.querySelector("atom-notification.fatal");
					await fatalError.getRenderPromise();

					const button = fatalError.querySelector(".btn");
					expect(window.fetch).not.toHaveBeenCalled();
					expect(button.textContent).toBe("Check reported issues");
				});

				it("does send fetch when setting is 'yes'", async () => {
					atom.config.set("notifications-plus.checkFatalIssues", "yes");
					atom.config.set("core.telemetryConsent", "no");
					generateException();
					fatalError = notificationContainer.querySelector("atom-notification.fatal");
					await fatalError.getRenderPromise();

					expect(window.fetch).toHaveBeenCalled();
				});

				it("does send fetch when button is clicked", async () => {
					atom.config.set("notifications-plus.checkFatalIssues", "no");
					generateException();
					fatalError = notificationContainer.querySelector("atom-notification.fatal");
					await fatalError.getRenderPromise();

					expect(window.fetch).not.toHaveBeenCalled();
					const button = fatalError.querySelector(".btn");
					button.click();
					await fatalError.getRenderPromise();

					expect(window.fetch).toHaveBeenCalled();
				});
			});

			describe("when the error has been reported", () => {
				beforeEach(() => spyOn(atom, "inDevMode").and.returnValue(false));

				describe("when the issue is open", () => {
					beforeEach(async () => {
						generateFakeFetchResponses({issuesResponse: {
							items: [
								{
									title: "ReferenceError: a is not defined in $ATOM_HOME/somewhere",
									html_url: "http://url.com/ok",
									state: "open"
								}
							]
						}});
						generateException();
						fatalError = notificationContainer.querySelector("atom-notification.fatal");
						await fatalError.getRenderPromise();
						issueBody = fatalError.issue.issueBody;
					});

					it("shows the user a view issue button", () => {
						const fatalNotification = fatalError.querySelector(".fatal-notification");
						const button = fatalError.querySelector(".btn");
						expect(button.textContent).toContain("View Issue");
						expect(button.getAttribute("href")).toBe("http://url.com/ok");
						expect(fatalNotification.textContent).toContain("already been reported");
						expect(fetch.calls.mostRecent().args[0]).toContain(encodeURIComponent("UziTech/notifications"));
					});
				});

				describe("when the issue is closed", () => {
					beforeEach(async () => {
						generateFakeFetchResponses({issuesResponse: {
							items: [
								{
									title: "ReferenceError: a is not defined in $ATOM_HOME/somewhere",
									html_url: "http://url.com/closed",
									state: "closed"
								}
							]
						}});
						generateException();
						fatalError = notificationContainer.querySelector("atom-notification.fatal");
						await fatalError.getRenderPromise();
						issueBody = fatalError.issue.issueBody;
					});

					it("shows the user a view issue button", () => {
						const button = fatalError.querySelector(".btn");
						expect(button.textContent).toContain("View Issue");
						expect(button.getAttribute("href")).toBe("http://url.com/closed");
					});
				});
			});

			describe("when a BufferedProcessError is thrown", () => {
				it("adds an error to the notifications", () => {
					expect(notificationContainer.querySelector("atom-notification.error")).not.toExist();

					window.onerror("Uncaught BufferedProcessError: Failed to spawn command `bad-command`", "abc", 2, 3, {name: "BufferedProcessError"});

					const error = notificationContainer.querySelector("atom-notification.error");
					expect(error).toExist();
					expect(error.innerHTML).toContain("Failed to spawn command");
					expect(error.innerHTML).not.toContain("BufferedProcessError");
				});
			});

			describe("when a spawn ENOENT error is thrown", () => {
				beforeEach(() => spyOn(atom, "inDevMode").and.returnValue(false));

				describe("when the binary has no path", () => {
					beforeEach(() => {
						const error = new Error("Error: spawn some_binary ENOENT");
						error.code = "ENOENT";
						window.onerror.call(window, error.message, "abc", 2, 3, error);
					});

					it("displays a dismissable error without the stack trace", () => {
						notificationContainer = workspaceElement.querySelector("atom-notifications");
						const error = notificationContainer.querySelector("atom-notification.error");
						expect(error.textContent).toContain("'some_binary' could not be spawned");
					});
				});

				describe("when the binary has /atom in the path", () => {
					beforeEach(() => {
						try {
							// eslint-disable-next-line no-undef, no-unused-expressions
							a + 1;
						} catch (e) {
							e.code = "ENOENT";
							const message = "Error: spawn /opt/atom/Atom Helper (deleted) ENOENT";
							window.onerror.call(window, message, "abc", 2, 3, e);
						}
					});

					it("displays a fatal error", () => {
						notificationContainer = workspaceElement.querySelector("atom-notifications");
						const error = notificationContainer.querySelector("atom-notification.fatal");
						expect(error).toExist();
					});
				});
			});
		});

		describe("when the Allow Popups setting is set", () => {

			describe("when it is set to None", () => {
				beforeEach(() => {
					atom.config.set("notifications-plus.allowPopups", "None");
				});

				it("will not display any notifications", () => {
					expect(notificationContainer.childNodes.length).toBe(0);

					let notification = atom.notifications.addSuccess("A message");
					expect(notificationContainer.childNodes.length).toBe(0);
					expect(notification.wasDisplayed()).toBe(false);

					notification = atom.notifications.addSuccess("A message", {dismissable: true});
					expect(notificationContainer.childNodes.length).toBe(0);
					expect(notification.wasDisplayed()).toBe(false);

					notification = atom.notifications.addInfo("A message");
					expect(notificationContainer.childNodes.length).toBe(0);
					expect(notification.wasDisplayed()).toBe(false);

					notification = atom.notifications.addWarning("A message");
					expect(notificationContainer.childNodes.length).toBe(0);
					expect(notification.wasDisplayed()).toBe(false);

					notification = atom.notifications.addError("A message");
					expect(notificationContainer.childNodes.length).toBe(0);
					expect(notification.wasDisplayed()).toBe(false);

					notification = atom.notifications.addFatalError("A message");
					expect(notificationContainer.childNodes.length).toBe(0);
					expect(notification.wasDisplayed()).toBe(false);
				});
			});

			describe("when it is set to Errors", () => {
				beforeEach(() => {
					atom.config.set("notifications-plus.allowPopups", "Errors");
				});

				it("will only display error and fatal notifications", () => {
					expect(notificationContainer.childNodes.length).toBe(0);

					let notification = atom.notifications.addSuccess("A message");
					expect(notificationContainer.childNodes.length).toBe(0);
					expect(notification.wasDisplayed()).toBe(false);

					notification = atom.notifications.addSuccess("A message", {dismissable: true});
					expect(notificationContainer.childNodes.length).toBe(0);
					expect(notification.wasDisplayed()).toBe(false);

					notification = atom.notifications.addInfo("A message");
					expect(notificationContainer.childNodes.length).toBe(0);
					expect(notification.wasDisplayed()).toBe(false);

					notification = atom.notifications.addWarning("A message");
					expect(notificationContainer.childNodes.length).toBe(0);
					expect(notification.wasDisplayed()).toBe(false);

					notification = atom.notifications.addError("A message");
					expect(notificationContainer.childNodes.length).toBe(1);
					expect(notification.wasDisplayed()).toBe(true);

					notification = atom.notifications.addFatalError("A message");
					expect(notificationContainer.childNodes.length).toBe(2);
					expect(notification.wasDisplayed()).toBe(true);
				});
			});

			describe("when it is set to Dismissable", () => {
				beforeEach(() => {
					atom.config.set("notifications-plus.allowPopups", "Dismissable");
				});

				it("will only display dismissable notifications", () => {
					expect(notificationContainer.childNodes.length).toBe(0);

					let notification = atom.notifications.addSuccess("A message");
					expect(notificationContainer.childNodes.length).toBe(0);
					expect(notification.wasDisplayed()).toBe(false);

					notification = atom.notifications.addSuccess("A dismissable message", {dismissable: true});
					expect(notificationContainer.childNodes.length).toBe(1);
					expect(notification.wasDisplayed()).toBe(true);

					notification = atom.notifications.addInfo("A message");
					expect(notificationContainer.childNodes.length).toBe(1);
					expect(notification.wasDisplayed()).toBe(false);

					notification = atom.notifications.addWarning("A message");
					expect(notificationContainer.childNodes.length).toBe(1);
					expect(notification.wasDisplayed()).toBe(false);

					notification = atom.notifications.addError("A message");
					expect(notificationContainer.childNodes.length).toBe(1);
					expect(notification.wasDisplayed()).toBe(false);

					notification = atom.notifications.addFatalError("A message");
					expect(notificationContainer.childNodes.length).toBe(1);
					expect(notification.wasDisplayed()).toBe(false);
				});
			});

			describe("when it is set to anything else", () => {
				beforeEach(() => {
					atom.config.set("notifications-plus.allowPopups", "anything else");
				});

				it("will display all notifications", () => {
					expect(notificationContainer.childNodes.length).toBe(0);

					let notification = atom.notifications.addSuccess("A message");
					expect(notificationContainer.childNodes.length).toBe(1);
					expect(notification.wasDisplayed()).toBe(true);

					notification = atom.notifications.addSuccess("A dismissable message", {dismissable: true});
					expect(notificationContainer.childNodes.length).toBe(2);
					expect(notification.wasDisplayed()).toBe(true);

					notification = atom.notifications.addInfo("A message");
					expect(notificationContainer.childNodes.length).toBe(3);
					expect(notification.wasDisplayed()).toBe(true);

					notification = atom.notifications.addWarning("A message");
					expect(notificationContainer.childNodes.length).toBe(4);
					expect(notification.wasDisplayed()).toBe(true);

					notification = atom.notifications.addError("A message");
					expect(notificationContainer.childNodes.length).toBe(5);
					expect(notification.wasDisplayed()).toBe(true);

					notification = atom.notifications.addFatalError("A message");
					expect(notificationContainer.childNodes.length).toBe(6);
					expect(notification.wasDisplayed()).toBe(true);
				});
			});
		});
	});
});
