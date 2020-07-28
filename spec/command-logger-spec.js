/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS202: Simplify dynamic range loops
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// Originally from lee-dohm/bug-report

const CommandLogger = require('../lib/command-logger');

describe('CommandLogger', function() {
  let [element, logger] = Array.from([]);

  const dispatch = command => atom.commands.dispatch(element, command);

  beforeEach(function() {
    element = document.createElement("section");
    element.id = "some-id";
    element.className = "some-class another-class";
    logger = new CommandLogger;
    return logger.start();
  });

  describe('logging of commands', function() {
    it('catches the name of the command', function() {
      dispatch('foo:bar');
      return expect(logger.latestEvent().name).toBe('foo:bar');
    });

    it('catches the target of the command', function() {
      dispatch('foo:bar');
      expect(logger.latestEvent().targetNodeName).toBe("SECTION");
      expect(logger.latestEvent().targetClassName).toBe("some-class another-class");
      return expect(logger.latestEvent().targetId).toBe("some-id");
    });

    it('logs repeat commands as one command', function() {
      dispatch('foo:bar');
      dispatch('foo:bar');

      expect(logger.latestEvent().name).toBe('foo:bar');
      return expect(logger.latestEvent().count).toBe(2);
    });

    it('ignores show.bs.tooltip commands', function() {
      dispatch('show.bs.tooltip');

      return expect(logger.latestEvent().name).not.toBe('show.bs.tooltip');
    });

    it('ignores editor:display-updated commands', function() {
      dispatch('editor:display-updated');

      return expect(logger.latestEvent().name).not.toBe('editor:display-updated');
    });

    it('ignores mousewheel commands', function() {
      dispatch('mousewheel');

      return expect(logger.latestEvent().name).not.toBe('mousewheel');
    });

    return it('only logs up to `logSize` commands', function() {
      for (let char = 'a', end = 'z', asc = 'a' <= end; asc ? char <= end : char >= end; asc ? char++ : char--) { dispatch(char); }

      return expect(logger.eventLog.length).toBe(logger.logSize);
    });
  });

  return describe('formatting of text log', function() {
    it('does not output empty log items', () => expect(logger.getText()).toBe(`\
\`\`\`
\`\`\`\
`
    ));

    it('formats commands with the time, name and target', function() {
      dispatch('foo:bar');

      return expect(logger.getText()).toBe(`\
\`\`\`
     -0:00.0 foo:bar (section#some-id.some-class.another-class)
\`\`\`\
`
      );
    });

    it('omits the target ID if it has none', function() {
      element.id = "";

      dispatch('foo:bar');

      return expect(logger.getText()).toBe(`\
\`\`\`
     -0:00.0 foo:bar (section.some-class.another-class)
\`\`\`\
`
      );
    });

    it('formats commands in chronological order', function() {
      dispatch('foo:first');
      dispatch('foo:second');
      dispatch('foo:third');

      return expect(logger.getText()).toBe(`\
\`\`\`
     -0:00.0 foo:first (section#some-id.some-class.another-class)
     -0:00.0 foo:second (section#some-id.some-class.another-class)
     -0:00.0 foo:third (section#some-id.some-class.another-class)
\`\`\`\
`
      );
    });

    it('displays a multiplier for repeated commands', function() {
      dispatch('foo:bar');
      dispatch('foo:bar');

      return expect(logger.getText()).toBe(`\
\`\`\`
  2x -0:00.0 foo:bar (section#some-id.some-class.another-class)
\`\`\`\
`
      );
    });

    it('logs the external data event as the last event', function() {
      dispatch('foo:bar');
      const event = {
        time: Date.now(),
        title: 'bummer'
      };

      return expect(logger.getText(event)).toBe(`\
\`\`\`
     -0:00.0 foo:bar (section#some-id.some-class.another-class)
     -0:00.0 bummer
\`\`\`\
`
      );
    });

    it('does not report anything older than ten minutes', function() {
      logger.logCommand({
        type: 'foo:bar',
        time: Date.now() - (11 * 60 * 1000),
        target: { nodeName: 'DIV'
      }
      });

      logger.logCommand({
        type: 'wow:bummer',
        target: { nodeName: 'DIV'
      }
      });

      return expect(logger.getText()).toBe(`\
\`\`\`
     -0:00.0 wow:bummer (div)
\`\`\`\
`
      );
    });

    return it('does not report commands that have no name', function() {
      dispatch('');

      return expect(logger.getText()).toBe(`\
\`\`\`
\`\`\`\
`
      );
    });
  });
});
