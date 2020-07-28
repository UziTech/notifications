/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */

/*
A collection of methods for retrieving information about the user's system for
bug report purposes.
*/

async function jsonPromise(object) {
	return {
		ok: true,
		async json() {
			return object;
		}
	};
}
async function textPromise(text) {
	return {
		ok: true,
		async text() {
			return text;
		}
	};
}

module.exports = {

	generateException() {
		try {
			// eslint-disable-next-line no-undef, no-unused-expressions
			a + 1;
		} catch (e) {
			const errMsg = `${e.toString()} in ${process.env.ATOM_HOME}/somewhere`;
			window.onerror.call(window, errMsg, "/dev/null", 2, 3, e);
		}
	},

	// shortenerResponse
	// packageResponse
	// issuesResponse
	generateFakeFetchResponses(options = {}) {
		if (!window.fetch.and) {
			spyOn(window, "fetch");
		}

		fetch.and.callFake(function (url) {
			if (url.indexOf("is.gd") > -1) {
				return textPromise(options.shortenerResponse ? options.shortenerResponse : "http://is.gd/cats");
			}

			if (url.indexOf("atom.io/api/packages") > -1) {
				return jsonPromise(options.packageResponse ? options.packageResponse : {
					repository: {url: "https://github.com/UziTech/notifications"},
					releases: {latest: "0.0.0"}
				});
			}

			if (url.indexOf("atom.io/api/updates") > -1) {
				return (jsonPromise(options.atomResponse ? options.atomResponse : {name: atom.getVersion()}));
			}

			if (options.issuesErrorResponse) {
				return Promise.reject(options.issuesErrorResponse);
			}

			return jsonPromise(options.issuesResponse ? options.issuesResponse : {items: []});
		});
	}
};
