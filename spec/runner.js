const {createRunner} = require("atom-jasmine3-test-runner");

module.exports = createRunner({
	specHelper: {
		customMatchers: true,
		attachToDom: true,
		ci: true,
	},
}, () => {
	beforeEach(() => {
		jasmine.clock().install();
	});

	afterEach(() => {
		jasmine.clock().uninstall();
	});
});
