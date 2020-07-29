const config = {
	"showErrorsInDevMode": {
		"type": "boolean",
		"default": false,
		"description": "Show notifications for uncaught exceptions even if Atom is running in dev mode. If this config setting is disabled, uncaught exceptions will trigger the dev tools to open and be logged in the console tab.",
		"order": 1,
	},
	"allowPopups": {
		"type": "string",
		"default": "All",
		"description": "Allow popup notifications when a notification is received. (All notifications will still go into the notification log)",
		"order": 2,
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
		"order": 3,
	},
	"alwaysDismiss": {
		"type": "boolean",
		"default": false,
		"description": "Dissmiss all notifications after timeout.",
		"order": 4,
	},
	"checkFatalIssues": {
		"type": "string",
		"default": "telemetry",
		"description": "Automatically check for issues for fatal errors",
		"order": 5,
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

module.exports = config;
