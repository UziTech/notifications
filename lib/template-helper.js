/** @babel */

export default {
	create(htmlString) {
		const template = document.createElement("template");
		template.innerHTML = htmlString;
		document.body.appendChild(template);
		return template;
	},

	render(template) {
		return document.importNode(template.content, true);
	},
};
