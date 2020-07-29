/** @babel */

const config = {
	"showErrorsInDevMode": {
		"type": "boolean",
		"default": false,
		"description": "Show notifications for uncaught exceptions even if Atom is running in dev mode. If this config setting is disabled, uncaught exceptions will trigger the dev tools to open and be logged in the console tab.",
	},
	"allowPopups": {
		"type": "string",
		"default": "All",
		"description": "Allow popup notifications when a notification is received. (All notifications will still go into the notification log)",
		"enum": [
			{
				"value": "All",
				"description": "Show all popup notifications",
			},
			{
				"value": "Errors",
				"description": "Only show popup notifications for errors",
			},
			{
				"value": "Dismissable",
				"description": "Only show popup notifications that can be dismissed",
			},
			{
				"value": "None",
				"description": "Don't show any popup notifications",
			},
		],
	},
	"defaultTimeout": {
		"type": "integer",
		"default": 5000,
		"minimum": 1000,
		"description": "The default notification timeout for a non-dismissable notification.",
	},
	"alwaysDismiss": {
		"type": "boolean",
		"default": false,
		"description": "Dissmiss all notifications after timeout.",
	},
	"checkFatalIssues": {
		"type": "string",
		"default": "telemetry",
		"description": "Automatically check for issues for fatal errors",
		"enum": [
			{
				"value": "yes",
				"description": "Automatically check for issues",
			},
			{
				"value": "no",
				"description": "Do not automatically check for issues",
			},
			{
				"value": "telemetry",
				"description": "Use 'Core:Send Telemetry to the Atom Team' setting",
			},
		],
	},
};

function displayOrder(obj) {
	let order = 1;
	for (const name in obj) {
		obj[name].order = order++;
		if (obj[name].type === "object" && "properties" in obj[name]) {
			displayOrder(obj[name].properties);
		}
	}
}
displayOrder(config);

export default config;
