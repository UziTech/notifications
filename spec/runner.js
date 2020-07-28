const {createRunner} = require("atom-jasmine3-test-runner");

module.exports = createRunner({
	specHelper: {
		jasminePass: true,
		customMatchers: true,
		attachToDom: true,
		ci: true
	},
});
