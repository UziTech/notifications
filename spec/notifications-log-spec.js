/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const {Notification} = require('atom');
const NotificationElement = require('../lib/notification-element');
const NotificationIssue = require('../lib/notification-issue');
const NotificationsLog = require('../lib/notifications-log');
const {generateFakeFetchResponses, generateException} = require('./helper');

describe("Notifications Log", function() {
  let workspaceElement = null;

  beforeEach(function() {
    workspaceElement = atom.views.getView(atom.workspace);
    atom.notifications.clear();

    waitsForPromise(() => atom.packages.activatePackage('notifications-plus'));

    return waitsForPromise(() => atom.workspace.open(NotificationsLog.prototype.getURI()));
  });

  describe("when the package is activated", () => it("attaches an .notifications-log element to the dom", () => expect(workspaceElement.querySelector('.notifications-log')).toExist()));

  describe("when there are notifications before activation", function() {
    beforeEach(() => waitsForPromise(() => // Wrapped in Promise.resolve so this test continues to work on earlier versions of Atom
    Promise.resolve(atom.packages.deactivatePackage('notifications-plus'))));

    return it("displays all notifications", function() {
      const warning = new Notification('warning', 'Un-displayed warning');
      const error = new Notification('error', 'Displayed error');
      error.setDisplayed(true);

      atom.notifications.addNotification(error);
      atom.notifications.addNotification(warning);

      waitsForPromise(() => atom.packages.activatePackage('notifications-plus'));

      waitsForPromise(() => atom.workspace.open(NotificationsLog.prototype.getURI()));

      return runs(function() {
        const notificationsLogContainer = workspaceElement.querySelector('.notifications-log-items');
        let notification = notificationsLogContainer.querySelector('.notifications-log-notification.warning');
        expect(notification).toExist();
        notification = notificationsLogContainer.querySelector('.notifications-log-notification.error');
        return expect(notification).toExist();
      });
    });
  });

  describe("when notifications are added to atom.notifications", function() {
    let notificationsLogContainer = null;

    beforeEach(function() {
      const enableInitNotification = atom.notifications.addSuccess('A message to trigger initialization', {dismissable: true});
      enableInitNotification.dismiss();
      advanceClock(NotificationElement.prototype.visibilityDuration);
      advanceClock(NotificationElement.prototype.animationDuration);

      notificationsLogContainer = workspaceElement.querySelector('.notifications-log-items');
      jasmine.attachToDOM(workspaceElement);

      return generateFakeFetchResponses();
    });

    it("adds an .notifications-log-item element to the container with a class corresponding to the type", function() {
      atom.notifications.addSuccess('A message');
      let notification = notificationsLogContainer.querySelector('.notifications-log-item.success');
      expect(notificationsLogContainer.childNodes).toHaveLength(2);
      expect(notification.querySelector('.message').textContent.trim()).toBe('A message');
      expect(notification.querySelector('.btn-toolbar')).toBeEmpty();

      atom.notifications.addInfo('A message');
      expect(notificationsLogContainer.childNodes).toHaveLength(3);
      expect(notificationsLogContainer.querySelector('.notifications-log-item.info')).toExist();

      atom.notifications.addWarning('A message');
      expect(notificationsLogContainer.childNodes).toHaveLength(4);
      expect(notificationsLogContainer.querySelector('.notifications-log-item.warning')).toExist();

      atom.notifications.addError('A message');
      expect(notificationsLogContainer.childNodes).toHaveLength(5);
      expect(notificationsLogContainer.querySelector('.notifications-log-item.error')).toExist();

      atom.notifications.addFatalError('A message');
      notification = notificationsLogContainer.querySelector('.notifications-log-item.fatal');
      expect(notificationsLogContainer.childNodes).toHaveLength(6);
      expect(notification).toExist();
      return expect(notification.querySelector('.btn-toolbar')).not.toBeEmpty();
    });

    describe("when the `buttons` options is used", () => it("displays the buttons in the .btn-toolbar element", function() {
      const clicked = [];
      atom.notifications.addSuccess('A message', {
        buttons: [{
          text: 'Button One',
          className: 'btn-one',
          onDidClick() { return clicked.push('one'); }
        }, {
          text: 'Button Two',
          className: 'btn-two',
          onDidClick() { return clicked.push('two'); }
        }]
      });

      const notification = notificationsLogContainer.querySelector('.notifications-log-item.success');
      expect(notification.querySelector('.btn-toolbar')).not.toBeEmpty();

      const btnOne = notification.querySelector('.btn-one');
      const btnTwo = notification.querySelector('.btn-two');

      expect(btnOne).toHaveClass('btn-success');
      expect(btnOne.textContent).toBe('Button One');
      expect(btnTwo).toHaveClass('btn-success');
      expect(btnTwo.textContent).toBe('Button Two');

      btnTwo.click();
      btnOne.click();

      return expect(clicked).toEqual(['two', 'one']);
  }));

    describe("when an exception is thrown", function() {
      let fatalError = null;

      describe("when the there is an error searching for the issue", function() {
        beforeEach(function() {
          spyOn(atom, 'inDevMode').andReturn(false);
          generateFakeFetchResponses({issuesErrorResponse: '403'});
          generateException();
          fatalError = notificationsLogContainer.querySelector('.notifications-log-item.fatal');
          return waitsForPromise(() => fatalError.getRenderPromise());
        });

        return it("asks the user to create an issue", function() {
          const button = fatalError.querySelector('.btn');
          const copyReport = fatalError.querySelector('.btn-copy-report');
          expect(button).toExist();
          expect(button.textContent).toContain('Create issue');
          return expect(copyReport).toExist();
        });
      });

      describe("when the package is out of date", function() {
        beforeEach(function() {
          const installedVersion = '0.9.0';
          const UserUtilities = require('../lib/user-utilities');
          spyOn(UserUtilities, 'getPackageVersion').andCallFake(() => installedVersion);
          spyOn(atom, 'inDevMode').andReturn(false);
          generateFakeFetchResponses({
            packageResponse: {
              repository: { url: 'https://github.com/someguy/somepackage'
            },
              releases: { latest: '0.10.0'
            }
            }
          });
          spyOn(NotificationIssue.prototype, 'getPackageName').andCallFake(() => "somepackage");
          spyOn(NotificationIssue.prototype, 'getRepoUrl').andCallFake(() => "https://github.com/someguy/somepackage");
          generateException();
          fatalError = notificationsLogContainer.querySelector('.notifications-log-item.fatal');
          return waitsForPromise(() => fatalError.getRenderPromise());
        });

        return it("asks the user to update their packages", function() {
          const button = fatalError.querySelector('.btn');

          expect(button.textContent).toContain('Check for package updates');
          return expect(button.getAttribute('href')).toBe('#');
        });
      });

      return describe("when the error has been reported", function() {
        beforeEach(function() {
          spyOn(atom, 'inDevMode').andReturn(false);
          generateFakeFetchResponses({
            issuesResponse: {
              items: [
                {
                  title: 'ReferenceError: a is not defined in $ATOM_HOME/somewhere',
                  html_url: 'http://url.com/ok',
                  state: 'open'
                }
              ]
            }});
          generateException();
          fatalError = notificationsLogContainer.querySelector('.notifications-log-item.fatal');
          return waitsForPromise(() => fatalError.getRenderPromise());
        });

        return it("shows the user a view issue button", function() {
          const button = fatalError.querySelector('.btn');
          expect(button.textContent).toContain('View Issue');
          return expect(button.getAttribute('href')).toBe('http://url.com/ok');
        });
      });
    });

    return describe("when a log item is clicked", function() {
      let [notification, notificationView, logItem] = Array.from([]);

      describe("when the notification is not dismissed", () => describe("when the notification is not dismissable", function() {

        beforeEach(function() {
          notification = atom.notifications.addInfo('A message');
          notificationView = atom.views.getView(notification);
          return logItem = notificationsLogContainer.querySelector('.notifications-log-item.info');
        });

        return it("makes the notification dismissable", function() {
          logItem.click();
          expect(notificationView.element.classList.contains('has-close')).toBe(true);
          expect(notification.isDismissable()).toBe(true);

          advanceClock(NotificationElement.prototype.visibilityDuration);
          advanceClock(NotificationElement.prototype.animationDuration);
          return expect(notificationView.element).toBeVisible();
        });
      }));

      return describe("when the notification is dismissed", function() {

        beforeEach(function() {
          notification = atom.notifications.addInfo('A message', {dismissable: true});
          notificationView = atom.views.getView(notification);
          logItem = notificationsLogContainer.querySelector('.notifications-log-item.info');
          notification.dismiss();
          return advanceClock(NotificationElement.prototype.animationDuration);
        });

        it("displays the notification", function() {
          let didDisplay = false;
          notification.onDidDisplay(() => didDisplay = true);
          logItem.click();

          expect(didDisplay).toBe(true);
          expect(notification.dismissed).toBe(false);
          return expect(notificationView.element).toBeVisible();
        });

        return describe("when the notification is dismissed again", () => it("emits did-dismiss", function() {
          let didDismiss = false;
          notification.onDidDismiss(() => didDismiss = true);
          logItem.click();

          notification.dismiss();
          advanceClock(NotificationElement.prototype.animationDuration);

          expect(didDismiss).toBe(true);
          expect(notification.dismissed).toBe(true);
          return expect(notificationView.element).not.toBeVisible();
        }));
      });
    });
  });

  describe("when notifications are cleared", function() {

    beforeEach(function() {
      const clearButton = workspaceElement.querySelector('.notifications-log .notifications-clear-log');
      atom.notifications.addInfo('A message', {dismissable: true});
      atom.notifications.addInfo('non-dismissable');
      return clearButton.click();
    });

    return it("clears the notifications", function() {
      expect(atom.notifications.getNotifications()).toHaveLength(0);
      const notifications = workspaceElement.querySelector('atom-notifications');
      advanceClock(NotificationElement.prototype.animationDuration);
      expect(notifications.children).toHaveLength(0);
      const logItems = workspaceElement.querySelector('.notifications-log-items');
      return expect(logItems.children).toHaveLength(0);
    });
  });

  return describe("the dock pane", function() {
    let notificationsLogPane = null;

    beforeEach(() => notificationsLogPane = atom.workspace.paneForURI(NotificationsLog.prototype.getURI()));

    return describe("when notifications-plus:toggle-log is dispatched", function() {
      it("toggles the pane URI", function() {
        spyOn(atom.workspace, "toggle");

        atom.commands.dispatch(workspaceElement, "notifications-plus:toggle-log");
        return expect(atom.workspace.toggle).toHaveBeenCalledWith(NotificationsLog.prototype.getURI());
      });

      describe("when the pane is destroyed", function() {

        beforeEach(() => notificationsLogPane.destroyItems());

        it("opens the pane", function() {
          let [notificationsLog] = Array.from([]);

          waitsForPromise(() => atom.workspace.toggle(NotificationsLog.prototype.getURI()).then(paneItem => notificationsLog = paneItem));

          return runs(() => expect(notificationsLog).toBeDefined());
        });

        return describe("when notifications are displayed", function() {

          beforeEach(() => atom.notifications.addSuccess("success"));

          return it("lists all notifications", function() {
            waitsForPromise(() => atom.workspace.toggle(NotificationsLog.prototype.getURI()));

            return runs(function() {
              const notificationsLogContainer = workspaceElement.querySelector('.notifications-log-items');
              return expect(notificationsLogContainer.childNodes).toHaveLength(1);
            });
          });
        });
      });

      describe("when the pane is hidden", function() {

        beforeEach(() => atom.workspace.hide(NotificationsLog.prototype.getURI()));

        return it("opens the pane", function() {
          let [notificationsLog] = Array.from([]);

          waitsForPromise(() => atom.workspace.toggle(NotificationsLog.prototype.getURI()).then(paneItem => notificationsLog = paneItem));

          return runs(() => expect(notificationsLog).toBeDefined());
        });
      });

      return describe("when the pane is open", function() {

        beforeEach(() => waitsForPromise(() => atom.workspace.open(NotificationsLog.prototype.getURI())));

        return it("closes the pane", function() {
          let notificationsLog = null;

          waitsForPromise(() => atom.workspace.toggle(NotificationsLog.prototype.getURI()).then(paneItem => notificationsLog = paneItem));

          return runs(() => expect(notificationsLog).toBeUndefined());
        });
      });
    });
  });
});
