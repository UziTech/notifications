const fs = require("fs-plus");
const path = require("path");
const temp = require("temp").track();
const {Notification} = require("atom");
const NotificationElement = require("../lib/notification-element");
const NotificationIssue = require("../lib/notification-issue");
const {generateFakeFetchResponses, generateException} = require("./helper");

describe("Notifications", function () {
	let [workspaceElement, activationPromise] = [];

	beforeEach(function () {
		workspaceElement = atom.views.getView(atom.workspace);
		atom.notifications.clear();
		activationPromise = atom.packages.activatePackage("notifications-plus");

		return waitsForPromise(() => activationPromise);
	});

	describe("when there are notifications before activation", function () {
		beforeEach(function () {
			waitsForPromise(() => // Wrapped in Promise.resolve so this test continues to work on earlier versions of Atom
				Promise.resolve(atom.packages.deactivatePackage("notifications-plus")));

			runs(function () {
				const warning = new Notification("warning", "Un-displayed warning");
				const error = new Notification("error", "Displayed error");
				error.setDisplayed(true);

				atom.notifications.addNotification(error);
				return atom.notifications.addNotification(warning);
			});

			return waitsForPromise(() => atom.packages.activatePackage("notifications-plus"));
		});

		return it("displays all non displayed notifications", function () {
			const notificationContainer = workspaceElement.querySelector("atom-notifications");
			let notification = notificationContainer.querySelector("atom-notification.warning");
			expect(notification).toExist();
			notification = notificationContainer.querySelector("atom-notification.error");
			return expect(notification).not.toExist();
		});
	});

	return describe("when notifications are added to atom.notifications", function () {
		let notificationContainer = null;
		beforeEach(function () {
			const enableInitNotification = atom.notifications.addSuccess("A message to trigger initialization", {dismissable: true});
			enableInitNotification.dismiss();
			advanceClock(NotificationElement.prototype.visibilityDuration);
			advanceClock(NotificationElement.prototype.animationDuration);

			notificationContainer = workspaceElement.querySelector("atom-notifications");
			jasmine.attachToDOM(workspaceElement);

			return generateFakeFetchResponses();
		});

		it("adds an atom-notification element to the container with a class corresponding to the type", function () {
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
			return expect(notificationContainer.querySelector("atom-notification.fatal")).toExist();
		});

		it("displays notification with a detail when a detail is specified", function () {
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
			return expect(notification.querySelector(".detail").textContent).toContain("cats,ok");
		});

		it("does not add the has-stack class if a stack is provided without any detail", function () {
			atom.notifications.addInfo("A message", {stack: "Some stack"});
			const notification = notificationContainer.childNodes[0];
			const notificationElement = notificationContainer.querySelector("atom-notification.info");
			return expect(notificationElement).not.toHaveClass("has-stack");
		});

		it("renders the message as sanitized markdown", function () {
			atom.notifications.addInfo("test <b>html</b> <iframe>but sanitized</iframe>");
			const notification = notificationContainer.childNodes[0];
			const html = notification.querySelector(".message").innerHTML;
			expect(html).toContain("test <b>html</b> ");
			return expect(html).not.toContain("<iframe");
		});


		describe("when a dismissable notification is added", function () {
			it("auto removes when alwaysDismiss is true", function () {
				atom.config.set("notifications-plus.alwaysDismiss", true);
				const model = atom.notifications.addSuccess("A message", {dismissable: true});
				const notification = notificationContainer.querySelector("atom-notification.success");
				const closeButton = notification.querySelector(".close");

				expect(closeButton).toBeVisible();
				expect(notification).not.toHaveClass("remove");

				advanceClock(NotificationElement.prototype.visibilityDuration);
				expect(notification).toHaveClass("remove");
				expect(notificationContainer.childNodes.length).toBe(1);

				advanceClock(NotificationElement.prototype.animationDuration);
				return expect(notificationContainer.childNodes.length).toBe(0);
			});

			it("is removed when Notification::dismiss() is called", function () {
				const notification = atom.notifications.addSuccess("A message", {dismissable: true});
				const notificationElement = notificationContainer.querySelector("atom-notification.success");

				expect(notificationContainer.childNodes.length).toBe(1);

				notification.dismiss();

				advanceClock(NotificationElement.prototype.visibilityDuration);
				expect(notificationElement).toHaveClass("remove");

				advanceClock(NotificationElement.prototype.animationDuration);
				return expect(notificationContainer.childNodes.length).toBe(0);
			});

			it("is removed when the close icon is clicked", function () {
				jasmine.attachToDOM(workspaceElement);

				waitsForPromise(() => atom.workspace.open());

				return runs(function () {
					const notification = atom.notifications.addSuccess("A message", {dismissable: true});
					const notificationElement = notificationContainer.querySelector("atom-notification.success");

					expect(notificationContainer.childNodes.length).toBe(1);

					notificationElement.focus();
					notificationElement.querySelector(".close.icon").click();

					advanceClock(NotificationElement.prototype.visibilityDuration);
					expect(notificationElement).toHaveClass("remove");

					advanceClock(NotificationElement.prototype.animationDuration);
					return expect(notificationContainer.childNodes.length).toBe(0);
				});
			});

			it("is removed when core:cancel is triggered", function () {
				const notification = atom.notifications.addSuccess("A message", {dismissable: true});
				const notificationElement = notificationContainer.querySelector("atom-notification.success");

				expect(notificationContainer.childNodes.length).toBe(1);

				atom.commands.dispatch(workspaceElement, "core:cancel");

				advanceClock(NotificationElement.prototype.visibilityDuration * 3);
				expect(notificationElement).toHaveClass("remove");

				advanceClock(NotificationElement.prototype.animationDuration * 3);
				return expect(notificationContainer.childNodes.length).toBe(0);
			});

			return it("focuses the active pane only if the dismissed notification has focus", function () {
				jasmine.attachToDOM(workspaceElement);

				waitsForPromise(() => atom.workspace.open());

				return runs(function () {
					const notification1 = atom.notifications.addSuccess("First message", {dismissable: true});
					const notification2 = atom.notifications.addError("Second message", {dismissable: true});
					const notificationElement1 = notificationContainer.querySelector("atom-notification.success");
					const notificationElement2 = notificationContainer.querySelector("atom-notification.error");

					expect(notificationContainer.childNodes.length).toBe(2);

					notificationElement2.focus();

					notification1.dismiss();

					advanceClock(NotificationElement.prototype.visibilityDuration);
					advanceClock(NotificationElement.prototype.animationDuration);
					expect(notificationContainer.childNodes.length).toBe(1);
					expect(notificationElement2).toHaveFocus();

					notificationElement2.querySelector(".close.icon").click();

					advanceClock(NotificationElement.prototype.visibilityDuration);
					advanceClock(NotificationElement.prototype.animationDuration);
					expect(notificationContainer.childNodes.length).toBe(0);
					return expect(atom.views.getView(atom.workspace.getActiveTextEditor())).toHaveFocus();
				});
			});
		});

		describe("when an autoclose notification is added", function () {
			let [notification, closeButton, model] = [];

			beforeEach(function () {
				model = atom.notifications.addSuccess("A message");
				notification = notificationContainer.querySelector("atom-notification.success");
				return closeButton = notification.querySelector(".close");
			});

			it("closes and removes the message after a given amount of time", function () {
				expect(closeButton).not.toBeVisible();
				expect(notification).not.toHaveClass("remove");

				advanceClock(NotificationElement.prototype.visibilityDuration);
				expect(notification).toHaveClass("remove");
				expect(notificationContainer.childNodes.length).toBe(1);

				advanceClock(NotificationElement.prototype.animationDuration);
				return expect(notificationContainer.childNodes.length).toBe(0);
			});

			describe("when the notification is clicked", function () {
				beforeEach(() => notification.click());

				it("makes the notification dismissable", function () {
					expect(closeButton).toBeVisible();
					expect(notification).toHaveClass("has-close");

					advanceClock(NotificationElement.prototype.visibilityDuration);
					return expect(notification).not.toHaveClass("remove");
				});

				return it("removes the notification when dismissed", function () {
					model.dismiss();
					return expect(notification).toHaveClass("remove");
				});
			});

			return describe("when the mouse is hovering over the notification", function () {
				beforeEach(function () {
					const event = new MouseEvent("mouseenter");
					return notification.dispatchEvent(event);
				});

				it("shows the close button", () => expect(closeButton).toBeVisible());

				it("makes the notification dismissable if hovering past close timeout", function () {
					advanceClock(NotificationElement.prototype.visibilityDuration);
					expect(closeButton).toBeVisible();
					expect(notification).toHaveClass("has-close");
					return expect(notification).not.toHaveClass("remove");
				});

				return describe("when the mouse leaves before the close timeout", () => beforeEach(function () {
					const event = new MouseEvent("mouseleave");
					notification.dispatchEvent(event);

					return it("dismisses the notification after the close timeout", function () {
						expect(closeButton).not.toBeVisible();
						advanceClock(NotificationElement.prototype.visibilityDuration);
						return expect(notification).toHaveClass("remove");
					});
				}));
			});
		});

		describe("when the default timeout setting is changed", function () {
			let [notification] = [];

			beforeEach(function () {
				atom.config.set("notifications-plus.defaultTimeout", 1000);
				atom.notifications.addSuccess("A message");
				return notification = notificationContainer.querySelector("atom-notification.success");
			});

			it("uses the setting value for the autoclose timeout", function () {
				expect(notification).not.toHaveClass("remove");
				advanceClock(1000);
				return expect(notification).toHaveClass("remove");
			});

			return describe("when the 'timeout' option is used", function () {

				beforeEach(function () {
					atom.notifications.addInfo("A message", {timeout: 10000});
					return notification = notificationContainer.querySelector("atom-notification.info");
				});

				return it("uses the 'timeout' value for the autoclose timeout", function () {
					expect(notification).not.toHaveClass("remove");
					advanceClock(NotificationElement.prototype.visibilityDuration);
					expect(notification).not.toHaveClass("remove");
					advanceClock(10000 - NotificationElement.prototype.visibilityDuration);
					return expect(notification).toHaveClass("remove");
				});
			});
		});

		describe("when the `description` option is used", () => it("displays the description text in the .description element", function () {
			atom.notifications.addSuccess("A message", {description: "This is [a link](http://atom.io)"});
			const notification = notificationContainer.querySelector("atom-notification.success");
			expect(notification).toHaveClass("has-description");
			expect(notification.querySelector(".meta")).toBeVisible();
			expect(notification.querySelector(".description").textContent.trim()).toBe("This is a link");
			return expect(notification.querySelector(".description a").href).toBe("http://atom.io/");
		}));

		describe("when the `buttons` options is used", () => it("displays the buttons in the .description element", function () {
			const clicked = [];
			atom.notifications.addSuccess("A message", {
				buttons: [{
					text: "Button One",
					className: "btn-one",
					onDidClick() {
						return clicked.push("one");
					}
				}, {
					text: "Button Two",
					className: "btn-two",
					onDidClick() {
						return clicked.push("two");
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

			return expect(clicked).toEqual(["two", "one"]);
		}));

		describe("when an exception is thrown", function () {
			let fatalError, issueBody, issueTitle;
			[notificationContainer, fatalError, issueTitle, issueBody] = [];
			describe("when the editor is in dev mode", function () {
				beforeEach(function () {
					spyOn(atom, "inDevMode").andReturn(true);
					generateException();
					notificationContainer = workspaceElement.querySelector("atom-notifications");
					return fatalError = notificationContainer.querySelector("atom-notification.fatal");
				});

				return it("does not display a notification", function () {
					expect(notificationContainer.childNodes.length).toBe(0);
					return expect(fatalError).toBe(null);
				});
			});

			describe("when the exception has no core or package paths in the stack trace", () => it("does not display a notification", function () {
				atom.notifications.clear();
				spyOn(atom, "inDevMode").andReturn(false);
				const handler = jasmine.createSpy("onWillThrowErrorHandler");
				atom.onWillThrowError(handler);

				// Fake an unhandled error with a call stack located outside of the source
				// of Atom or an Atom package
				fs.readFile(__dirname, function () {
					const err = new Error();
					err.stack = "FakeError: foo is not bar\n    at blah.fakeFunc (directory/fakefile.js:1:25)";
					throw err;
				});

				waitsFor(() => handler.callCount === 1);

				return runs(() => expect(atom.notifications.getNotifications().length).toBe(0));
			}));

			describe("when the message contains a newline", () => it("removes the newline when generating the issue title", function () {
				const message = "Uncaught Error: Cannot read property 'object' of undefined\nTypeError: Cannot read property 'object' of undefined";
				atom.notifications.addFatalError(message);
				notificationContainer = workspaceElement.querySelector("atom-notifications");
				fatalError = notificationContainer.querySelector("atom-notification.fatal");

				waitsForPromise(() => fatalError.getRenderPromise().then(() => issueTitle = fatalError.issue.getIssueTitle()));
				return runs(function () {
					expect(issueTitle).not.toContain("\n");
					return expect(issueTitle).toBe("Uncaught Error: Cannot read property 'object' of undefinedTypeError: Cannot read property 'objec...");
				});
			}));

			describe("when the message contains continguous newlines", () => it("removes the newlines when generating the issue title", function () {
				const message = "Uncaught Error: Cannot do the thing\n\nSuper sorry about this";
				atom.notifications.addFatalError(message);
				notificationContainer = workspaceElement.querySelector("atom-notifications");
				fatalError = notificationContainer.querySelector("atom-notification.fatal");

				waitsForPromise(() => fatalError.getRenderPromise().then(() => issueTitle = fatalError.issue.getIssueTitle()));
				return runs(() => expect(issueTitle).toBe("Uncaught Error: Cannot do the thingSuper sorry about this"));
			}));

			describe("when there are multiple packages in the stack trace", function () {
				beforeEach(function () {
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

					spyOn(fs, "realpathSync").andCallFake(p => p);
					return spyOn(fatalError.issue, "getPackagePathsByPackageName").andCallFake(() => ({
						"save-session": "/Users/someguy/.atom/packages/save-session",
						"tabs": "/Applications/Atom.app/Contents/Resources/app/node_modules/tabs"
					}));
				});

				return it("chooses the first package in the trace", () => expect(fatalError.issue.getPackageName()).toBe("save-session"));
			});

			describe("when an exception is thrown from a package", function () {
				beforeEach(function () {
					issueTitle = null;
					issueBody = null;
					spyOn(atom, "inDevMode").andReturn(false);
					generateFakeFetchResponses();
					generateException();
					notificationContainer = workspaceElement.querySelector("atom-notifications");
					return fatalError = notificationContainer.querySelector("atom-notification.fatal");
				});

				it("displays a fatal error with the package name in the error", function () {
					waitsForPromise(() => fatalError.getRenderPromise().then(function () {
						issueTitle = fatalError.issue.getIssueTitle();
						return fatalError.issue.getIssueBody().then(result => issueBody = result);
					}));

					return runs(function () {
						expect(notificationContainer.childNodes.length).toBe(1);
						expect(fatalError).toHaveClass("has-close");
						expect(fatalError.innerHTML).toContain("ReferenceError: a is not defined");
						expect(fatalError.innerHTML).toContain("<a href=\"https://github.com/UziTech/notifications\">notifications-plus package</a>");
						expect(fatalError.issue.getPackageName()).toBe("notifications-plus");

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
						return expect(issueBody).toContain("### Non-Core Packages");
					});
				});

				// FIXME: this doesnt work on the test server. `apm ls` is not working for some reason.
				// expect(issueBody).toContain 'notifications '

				return it("standardizes platform separators on #win32", function () {
					waitsForPromise(() => fatalError.getRenderPromise().then(() => issueTitle = fatalError.issue.getIssueTitle()));

					return runs(function () {
						expect(issueTitle).toContain(path.posix.sep);
						return expect(issueTitle).not.toContain(path.win32.sep);
					});
				});
			});

			describe("when an exception contains the user's home directory", function () {
				beforeEach(function () {
					issueTitle = null;
					spyOn(atom, "inDevMode").andReturn(false);
					generateFakeFetchResponses();

					// Create a custom error message that contains the user profile but not ATOM_HOME
					try {
						a + 1;
					} catch (e) {
						const home = process.platform === "win32" ? process.env.USERPROFILE : process.env.HOME;
						const errMsg = `${e.toString()} in ${home}${path.sep}somewhere`;
						window.onerror.call(window, errMsg, "/dev/null", 2, 3, e);
					}

					notificationContainer = workspaceElement.querySelector("atom-notifications");
					return fatalError = notificationContainer.querySelector("atom-notification.fatal");
				});

				return it("replaces the directory with a ~", function () {
					waitsForPromise(() => fatalError.getRenderPromise().then(() => issueTitle = fatalError.issue.getIssueTitle()));

					return runs(function () {
						expect(issueTitle).toContain("~");
						if (process.platform === "win32") {
							return expect(issueTitle).not.toContain(process.env.USERPROFILE);
						}
						return expect(issueTitle).not.toContain(process.env.HOME);

					});
				});
			});

			describe("when an exception is thrown from a linked package", function () {
				beforeEach(function () {
					spyOn(atom, "inDevMode").andReturn(false);
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
					return fatalError = notificationContainer.querySelector("atom-notification.fatal");
				});

				return it("displays a fatal error with the package name in the error", function () {
					waitsForPromise(() => fatalError.getRenderPromise());

					return runs(function () {
						expect(notificationContainer.childNodes.length).toBe(1);
						expect(fatalError).toHaveClass("has-close");
						expect(fatalError.innerHTML).toContain("Uncaught ReferenceError: path is not defined");
						expect(fatalError.innerHTML).toContain("<a href=\"https://github.com/UziTech/notifications\">linked-package package</a>");
						return expect(fatalError.issue.getPackageName()).toBe("linked-package");
					});
				});
			});

			describe("when an exception is thrown from an unloaded package", function () {
				beforeEach(function () {
					spyOn(atom, "inDevMode").andReturn(false);

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
					return fatalError = notificationContainer.querySelector("atom-notification.fatal");
				});

				return it("displays a fatal error with the package name in the error", function () {
					waitsForPromise(() => fatalError.getRenderPromise());

					return runs(function () {
						expect(notificationContainer.childNodes.length).toBe(1);
						expect(fatalError).toHaveClass("has-close");
						expect(fatalError.innerHTML).toContain("ReferenceError: unloaded error");
						expect(fatalError.innerHTML).toContain("<a href=\"https://github.com/UziTech/notifications\">unloaded package</a>");
						return expect(fatalError.issue.getPackageName()).toBe("unloaded");
					});
				});
			});

			describe("when an exception is thrown from a package trying to load", function () {
				beforeEach(function () {
					spyOn(atom, "inDevMode").andReturn(false);
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
					return fatalError = notificationContainer.querySelector("atom-notification.fatal");
				});

				return it("displays a fatal error with the package name in the error", function () {
					waitsForPromise(() => fatalError.getRenderPromise());

					return runs(function () {
						expect(notificationContainer.childNodes.length).toBe(1);
						expect(fatalError).toHaveClass("has-close");
						expect(fatalError.innerHTML).toContain("TypeError: Cannot read property 'prototype' of undefined");
						expect(fatalError.innerHTML).toContain("<a href=\"https://github.com/UziTech/notifications\">broken-load package</a>");
						return expect(fatalError.issue.getPackageName()).toBe("broken-load");
					});
				});
			});

			describe("when an exception is thrown from a package trying to load a grammar", function () {
				beforeEach(function () {
					spyOn(atom, "inDevMode").andReturn(false);
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
					return fatalError = notificationContainer.querySelector("atom-notification.fatal");
				});

				return it("displays a fatal error with the package name in the error", function () {
					waitsForPromise(() => fatalError.getRenderPromise());

					return runs(function () {
						expect(notificationContainer.childNodes.length).toBe(1);
						expect(fatalError).toHaveClass("has-close");
						expect(fatalError.innerHTML).toContain("Failed to load a language-broken-grammar package grammar");
						expect(fatalError.innerHTML).toContain("<a href=\"https://github.com/UziTech/notifications\">language-broken-grammar package</a>");
						return expect(fatalError.issue.getPackageName()).toBe("language-broken-grammar");
					});
				});
			});

			describe("when an exception is thrown from a package trying to activate", function () {
				beforeEach(function () {
					spyOn(atom, "inDevMode").andReturn(false);
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
					return fatalError = notificationContainer.querySelector("atom-notification.fatal");
				});

				return it("displays a fatal error with the package name in the error", function () {
					waitsForPromise(() => fatalError.getRenderPromise());

					return runs(function () {
						expect(notificationContainer.childNodes.length).toBe(1);
						expect(fatalError).toHaveClass("has-close");
						expect(fatalError.innerHTML).toContain("TypeError: Cannot read property 'command' of undefined");
						expect(fatalError.innerHTML).toContain("<a href=\"https://github.com/UziTech/notifications\">broken-activation package</a>");
						return expect(fatalError.issue.getPackageName()).toBe("broken-activation");
					});
				});
			});

			describe("when an exception is thrown from a package without a trace, but with a URL", function () {
				beforeEach(function () {
					issueBody = null;
					spyOn(atom, "inDevMode").andReturn(false);
					generateFakeFetchResponses();
					try {
						a + 1;
					} catch (e) {
						// Pull the file path from the stack
						const filePath = e.stack.split("\n")[1].match(/\((.+?):\d+/)[1];
						window.onerror.call(window, e.toString(), filePath, 2, 3, {message: e.toString(), stack: undefined});
					}

					notificationContainer = workspaceElement.querySelector("atom-notifications");
					return fatalError = notificationContainer.querySelector("atom-notification.fatal");
				});

				return it("detects the package name from the URL", function () {
					waitsForPromise(() => fatalError.getRenderPromise());

					return runs(function () {
						expect(fatalError.innerHTML).toContain("ReferenceError: a is not defined");
						expect(fatalError.innerHTML).toContain("<a href=\"https://github.com/UziTech/notifications\">notifications-plus package</a>");
						return expect(fatalError.issue.getPackageName()).toBe("notifications-plus");
					});
				});
			});

			describe("when an exception is thrown from core", function () {
				beforeEach(function () {
					atom.commands.dispatch(workspaceElement, "some-package:a-command");
					atom.commands.dispatch(workspaceElement, "some-package:a-command");
					atom.commands.dispatch(workspaceElement, "some-package:a-command");
					spyOn(atom, "inDevMode").andReturn(false);
					generateFakeFetchResponses();
					try {
						a + 1;
					} catch (e) {
						// Mung the stack so it looks like its from core
						e.stack = e.stack.replace(new RegExp(__filename, "g"), "<embedded>").replace(/notifications/g, "core");
						window.onerror.call(window, e.toString(), "/dev/null", 2, 3, e);
					}

					notificationContainer = workspaceElement.querySelector("atom-notifications");
					fatalError = notificationContainer.querySelector("atom-notification.fatal");
					return waitsForPromise(() => fatalError.getRenderPromise().then(() => fatalError.issue.getIssueBody().then(result => issueBody = result)));
				});

				it("displays a fatal error with the package name in the error", function () {
					expect(notificationContainer.childNodes.length).toBe(1);
					expect(fatalError).toExist();
					expect(fatalError).toHaveClass("has-close");
					expect(fatalError.innerHTML).toContain("ReferenceError: a is not defined");
					expect(fatalError.innerHTML).toContain("bug in Atom");
					expect(fatalError.issue.getPackageName()).toBeUndefined();

					const button = fatalError.querySelector(".btn");
					expect(button.textContent).toContain("Create issue on atom/atom");
					const buttonCopyReport = fatalError.querySelector(".btn-copy-report");
					expect(buttonCopyReport).toExist();
					const buttonOpenSettings = fatalError.querySelector(".btn-open-settings");
					expect(buttonOpenSettings).not.toExist();

					expect(issueBody).toContain("ReferenceError: a is not defined");
					return expect(issueBody).toContain("**Thrown From**: Atom Core");
				});

				it("contains the commands that the user run in the issue body", () => expect(issueBody).toContain("some-package:a-command"));

				return it("allows the user to toggle the stack trace", function () {
					const stackToggle = fatalError.querySelector(".stack-toggle");
					const stackContainer = fatalError.querySelector(".stack-container");
					expect(stackToggle).toExist();
					expect(stackContainer.style.display).toBe("none");

					stackToggle.click();
					expect(stackContainer.style.display).toBe("block");

					stackToggle.click();
					return expect(stackContainer.style.display).toBe("none");
				});
			});

			describe("when the there is an error searching for the issue", function () {
				beforeEach(function () {
					spyOn(atom, "inDevMode").andReturn(false);
					generateFakeFetchResponses({issuesErrorResponse: "403"});
					generateException();
					fatalError = notificationContainer.querySelector("atom-notification.fatal");
					return waitsForPromise(() => fatalError.getRenderPromise().then(() => issueBody = fatalError.issue.issueBody));
				});

				return it("asks the user to create an issue", function () {
					const button = fatalError.querySelector(".btn");
					const fatalNotification = fatalError.querySelector(".fatal-notification");
					expect(button.textContent).toContain("Create issue");
					return expect(fatalNotification.textContent).toContain("You can help by creating an issue");
				});
			});

			describe("when the error has not been reported", function () {
				beforeEach(() => spyOn(atom, "inDevMode").andReturn(false));

				return describe("when the message is longer than 100 characters", function () {
					const message = "Uncaught Error: Cannot find module 'dialog'Error: Cannot find module 'dialog' at Function.Module._resolveFilename (module.js:351:15) at Function.Module._load (module.js:293:25) at Module.require (module.js:380:17) at EventEmitter.<anonymous> (/Applications/Atom.app/Contents/Resources/atom/browser/lib/rpc-server.js:128:79) at EventEmitter.emit (events.js:119:17) at EventEmitter.<anonymous> (/Applications/Atom.app/Contents/Resources/atom/browser/api/lib/web-contents.js:99:23) at EventEmitter.emit (events.js:119:17)";
					const expectedIssueTitle = "Uncaught Error: Cannot find module 'dialog'Error: Cannot find module 'dialog' at Function.Module....";

					beforeEach(function () {
						generateFakeFetchResponses();
						try {
							return a + 1;
						} catch (e) {
							e.code = "Error";
							e.message = message;
							return window.onerror.call(window, e.message, "abc", 2, 3, e);
						}
					});

					return it("truncates the issue title to 100 characters", function () {
						fatalError = notificationContainer.querySelector("atom-notification.fatal");

						waitsForPromise(() => fatalError.getRenderPromise());

						return runs(function () {
							const button = fatalError.querySelector(".btn");
							expect(button.textContent).toContain("Create issue");
							return expect(fatalError.issue.getIssueTitle()).toBe(expectedIssueTitle);
						});
					});
				});
			});

			describe("when the package is out of date", function () {
				beforeEach(function () {
					const installedVersion = "0.9.0";
					const UserUtilities = require("../lib/user-utilities");
					spyOn(UserUtilities, "getPackageVersion").andCallFake(() => installedVersion);
					return spyOn(atom, "inDevMode").andReturn(false);
				});

				describe("when the package is a non-core package", function () {
					beforeEach(function () {
						generateFakeFetchResponses({
							packageResponse: {
								repository: {url: "https://github.com/someguy/somepackage"},
								releases: {latest: "0.10.0"}
							}
						});
						spyOn(NotificationIssue.prototype, "getPackageName").andCallFake(() => "somepackage");
						spyOn(NotificationIssue.prototype, "getRepoUrl").andCallFake(() => "https://github.com/someguy/somepackage");
						generateException();
						fatalError = notificationContainer.querySelector("atom-notification.fatal");
						return waitsForPromise(() => fatalError.getRenderPromise().then(() => issueBody = fatalError.issue.issueBody));
					});

					return it("asks the user to update their packages", function () {
						const fatalNotification = fatalError.querySelector(".fatal-notification");
						const button = fatalError.querySelector(".btn");

						expect(button.textContent).toContain("Check for package updates");
						expect(fatalNotification.textContent).toContain("Upgrading to the latest");
						return expect(button.getAttribute("href")).toBe("#");
					});
				});

				describe("when the package is an atom-owned non-core package", function () {
					beforeEach(function () {
						generateFakeFetchResponses({
							packageResponse: {
								repository: {url: "https://github.com/atom/sort-lines"},
								releases: {latest: "0.10.0"}
							}
						});
						spyOn(NotificationIssue.prototype, "getPackageName").andCallFake(() => "sort-lines");
						spyOn(NotificationIssue.prototype, "getRepoUrl").andCallFake(() => "https://github.com/atom/sort-lines");
						generateException();
						fatalError = notificationContainer.querySelector("atom-notification.fatal");

						return waitsForPromise(() => fatalError.getRenderPromise().then(() => issueBody = fatalError.issue.issueBody));
					});

					return it("asks the user to update their packages", function () {
						const fatalNotification = fatalError.querySelector(".fatal-notification");
						const button = fatalError.querySelector(".btn");

						expect(button.textContent).toContain("Check for package updates");
						expect(fatalNotification.textContent).toContain("Upgrading to the latest");
						return expect(button.getAttribute("href")).toBe("#");
					});
				});

				return describe("when the package is a core package", function () {
					beforeEach(() => generateFakeFetchResponses({
						packageResponse: {
							repository: {url: "https://github.com/UziTech/notifications"},
							releases: {latest: "0.11.0"}
						}
					}));

					describe("when the locally installed version is lower than Atom's version", function () {
						beforeEach(function () {
							const versionShippedWithAtom = "0.10.0";
							const UserUtilities = require("../lib/user-utilities");
							spyOn(UserUtilities, "getPackageVersionShippedWithAtom").andCallFake(() => versionShippedWithAtom);

							generateException();
							fatalError = notificationContainer.querySelector("atom-notification.fatal");
							return waitsForPromise(() => fatalError.getRenderPromise().then(() => issueBody = fatalError.issue.issueBody));
						});

						it("doesn't show the Create Issue button", function () {
							const button = fatalError.querySelector(".btn-issue");
							return expect(button).not.toExist();
						});

						return it("tells the user that the package is a locally installed core package and out of date", function () {
							const fatalNotification = fatalError.querySelector(".fatal-notification");
							expect(fatalNotification.textContent).toContain("Locally installed core Atom package");
							return expect(fatalNotification.textContent).toContain("is out of date");
						});
					});

					return describe("when the locally installed version matches Atom's version", function () {
						beforeEach(function () {
							const versionShippedWithAtom = "0.9.0";
							const UserUtilities = require("../lib/user-utilities");
							spyOn(UserUtilities, "getPackageVersionShippedWithAtom").andCallFake(() => versionShippedWithAtom);

							generateException();
							fatalError = notificationContainer.querySelector("atom-notification.fatal");
							return waitsForPromise(() => fatalError.getRenderPromise().then(() => issueBody = fatalError.issue.issueBody));
						});

						return it("ignores the out of date package because they cant upgrade it without upgrading atom", function () {
							fatalError = notificationContainer.querySelector("atom-notification.fatal");
							const button = fatalError.querySelector(".btn");
							return expect(button.textContent).toContain("Create issue");
						});
					});
				});
			});

			describe("when Atom is out of date", function () {
				beforeEach(function () {
					const installedVersion = "0.179.0";
					spyOn(atom, "getVersion").andCallFake(() => installedVersion);
					spyOn(atom, "inDevMode").andReturn(false);

					generateFakeFetchResponses({
						atomResponse: {
							name: "0.180.0"
						}
					});

					generateException();

					fatalError = notificationContainer.querySelector("atom-notification.fatal");
					return waitsForPromise(() => fatalError.getRenderPromise().then(() => issueBody = fatalError.issue.issueBody));
				});

				it("doesn't show the Create Issue button", function () {
					const button = fatalError.querySelector(".btn-issue");
					return expect(button).not.toExist();
				});

				it("tells the user that Atom is out of date", function () {
					const fatalNotification = fatalError.querySelector(".fatal-notification");
					return expect(fatalNotification.textContent).toContain("Atom is out of date");
				});

				return it("provides a link to the latest released version", function () {
					const fatalNotification = fatalError.querySelector(".fatal-notification");
					return expect(fatalNotification.innerHTML).toContain("<a href=\"https://github.com/atom/atom/releases/tag/v0.180.0\">latest version</a>");
				});
			});

			describe("when telemetry settings are changed", function () {
				beforeEach(function () {
					spyOn(atom, "inDevMode").andReturn(false);
					return generateFakeFetchResponses();
				});

				it("does not send fetch when setting is 'no'", function () {
					atom.config.set("notifications-plus.checkFatalIssues", "no");
					generateException();
					fatalError = notificationContainer.querySelector("atom-notification.fatal");
					waitsForPromise(() => fatalError.getRenderPromise());

					return runs(function () {
						const button = fatalError.querySelector(".btn");
						expect(window.fetch).not.toHaveBeenCalled();
						return expect(button.textContent).toBe("Check reported issues");
					});
				});

				it("does not send fetch when telemetry setting is 'no'", function () {
					atom.config.set("core.telemetryConsent", "no");
					generateException();
					fatalError = notificationContainer.querySelector("atom-notification.fatal");
					waitsForPromise(() => fatalError.getRenderPromise());

					return runs(function () {
						const button = fatalError.querySelector(".btn");
						expect(window.fetch).not.toHaveBeenCalled();
						return expect(button.textContent).toBe("Check reported issues");
					});
				});

				it("does send fetch when setting is 'yes'", function () {
					atom.config.set("notifications-plus.checkFatalIssues", "yes");
					atom.config.set("core.telemetryConsent", "no");
					generateException();
					fatalError = notificationContainer.querySelector("atom-notification.fatal");
					waitsForPromise(() => fatalError.getRenderPromise());

					return runs(() => expect(window.fetch).toHaveBeenCalled());
				});

				return it("does send fetch when button is clicked", function () {
					atom.config.set("notifications-plus.checkFatalIssues", "no");
					generateException();
					fatalError = notificationContainer.querySelector("atom-notification.fatal");
					waitsForPromise(() => fatalError.getRenderPromise());

					return runs(function () {
						expect(window.fetch).not.toHaveBeenCalled();
						const button = fatalError.querySelector(".btn");
						button.click();
						waitsForPromise(() => fatalError.getRenderPromise());

						return runs(() => expect(window.fetch).toHaveBeenCalled());
					});
				});
			});

			describe("when the error has been reported", function () {
				beforeEach(() => spyOn(atom, "inDevMode").andReturn(false));

				describe("when the issue is open", function () {
					beforeEach(function () {
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
						return waitsForPromise(() => fatalError.getRenderPromise().then(() => issueBody = fatalError.issue.issueBody));
					});

					return it("shows the user a view issue button", function () {
						const fatalNotification = fatalError.querySelector(".fatal-notification");
						const button = fatalError.querySelector(".btn");
						expect(button.textContent).toContain("View Issue");
						expect(button.getAttribute("href")).toBe("http://url.com/ok");
						expect(fatalNotification.textContent).toContain("already been reported");
						return expect(fetch.calls[0].args[0]).toContain(encodeURIComponent("UziTech/notifications"));
					});
				});

				return describe("when the issue is closed", function () {
					beforeEach(function () {
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
						return waitsForPromise(() => fatalError.getRenderPromise().then(() => issueBody = fatalError.issue.issueBody));
					});

					return it("shows the user a view issue button", function () {
						const button = fatalError.querySelector(".btn");
						expect(button.textContent).toContain("View Issue");
						return expect(button.getAttribute("href")).toBe("http://url.com/closed");
					});
				});
			});

			describe("when a BufferedProcessError is thrown", () => it("adds an error to the notifications", function () {
				expect(notificationContainer.querySelector("atom-notification.error")).not.toExist();

				window.onerror("Uncaught BufferedProcessError: Failed to spawn command `bad-command`", "abc", 2, 3, {name: "BufferedProcessError"});

				const error = notificationContainer.querySelector("atom-notification.error");
				expect(error).toExist();
				expect(error.innerHTML).toContain("Failed to spawn command");
				return expect(error.innerHTML).not.toContain("BufferedProcessError");
			}));

			return describe("when a spawn ENOENT error is thrown", function () {
				beforeEach(() => spyOn(atom, "inDevMode").andReturn(false));

				describe("when the binary has no path", function () {
					beforeEach(function () {
						const error = new Error("Error: spawn some_binary ENOENT");
						error.code = "ENOENT";
						return window.onerror.call(window, error.message, "abc", 2, 3, error);
					});

					return it("displays a dismissable error without the stack trace", function () {
						notificationContainer = workspaceElement.querySelector("atom-notifications");
						const error = notificationContainer.querySelector("atom-notification.error");
						return expect(error.textContent).toContain("'some_binary' could not be spawned");
					});
				});

				return describe("when the binary has /atom in the path", function () {
					beforeEach(function () {
						try {
							return a + 1;
						} catch (e) {
							e.code = "ENOENT";
							const message = "Error: spawn /opt/atom/Atom Helper (deleted) ENOENT";
							return window.onerror.call(window, message, "abc", 2, 3, e);
						}
					});

					return it("displays a fatal error", function () {
						notificationContainer = workspaceElement.querySelector("atom-notifications");
						const error = notificationContainer.querySelector("atom-notification.fatal");
						return expect(error).toExist();
					});
				});
			});
		});

		return describe("when the Allow Popups setting is set", function () {

			describe("when it is set to None", function () {
				beforeEach(() => atom.config.set("notifications-plus.allowPopups", "None"));

				return it("will not display any notifications", function () {
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
					return expect(notification.wasDisplayed()).toBe(false);
				});
			});

			describe("when it is set to Errors", function () {
				beforeEach(() => atom.config.set("notifications-plus.allowPopups", "Errors"));

				return it("will only display error and fatal notifications", function () {
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
					return expect(notification.wasDisplayed()).toBe(true);
				});
			});

			describe("when it is set to Dismissable", function () {
				beforeEach(() => atom.config.set("notifications-plus.allowPopups", "Dismissable"));

				return it("will only display dismissable notifications", function () {
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
					return expect(notification.wasDisplayed()).toBe(false);
				});
			});

			return describe("when it is set to anything else", function () {
				beforeEach(() => atom.config.set("notifications-plus.allowPopups", "anything else"));

				return it("will display all notifications", function () {
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
					return expect(notification.wasDisplayed()).toBe(true);
				});
			});
		});
	});
});
