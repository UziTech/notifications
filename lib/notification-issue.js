/** @babel */

import fs from "fs-plus";
import path from "path";
import * as StackTraceParser from "stacktrace-parser";

import CommandLogger from "./command-logger";
import UserUtilities from "./user-utilities";

// Truncate issue title to 100 characters (including ellipsis)
const TITLE_CHAR_LIMIT = 100;

const FileURLRegExp = /file:\/\/\w*\/(.*)/;

export default class NotificationIssue {
	constructor(notification) {
		this.normalizedStackPaths = this.normalizedStackPaths.bind(this);
		this.notification = notification;
	}

	async findSimilarIssues() {
		let repoUrl = await this.getRepoUrl();
		if (!repoUrl) {
			repoUrl = "atom/atom";
		}
		const repo = repoUrl.replace(/http(s)?:\/\/(\d+\.)?github.com\//gi, "");
		const issueTitle = this.getIssueTitle();
		const query = `${issueTitle} repo:${repo}`;
		const githubHeaders = new Headers({
			accept: "application/vnd.github.v3+json",
			contentType: "application/json",
		});

		try {
			const response = await fetch(`https://api.github.com/search/issues?q=${encodeURIComponent(query)}&sort=created`, {headers: githubHeaders});
			const data = await response.json();
			if (data && data.items) {
				const issues = {};
				for (const issue of data.items) {
					if ((issue.title.indexOf(issueTitle) > -1) && !issues[issue.state]) {
						issues[issue.state] = issue;
						if (issues.open && issues.closed) {
							return issues;
						}
					}
				}

				if (issues.open || issues.closed) {
					return issues;
				}
			}
		} catch (ex) {
			// silent error
		}
	}

	async getIssueUrlForSystem() {
		// Windows will not launch URLs greater than ~2000 bytes so we need to shrink it
		// Also is.gd has a limit of 5000 bytes...
		try {
			const issueUrl = await this.getIssueUrl();
			const response = await fetch("https://is.gd/create.php?format=simple", {
				method: "POST",
				headers: {"Content-Type": "application/x-www-form-urlencoded"},
				body: `url=${encodeURIComponent(issueUrl)}`,
			});
			return await response.text();
		} catch (ex) {
			// silent error
		}
	}

	async getIssueUrl() {
		const issueBody = await this.getIssueBody();
		let repoUrl = await this.getRepoUrl();
		if (!repoUrl) {
			repoUrl = "https://github.com/atom/atom";
		}
		return `${repoUrl}/issues/new?title=${this.encodeURI(this.getIssueTitle())}&body=${this.encodeURI(issueBody)}`;
	}

	encodeURI(str) {
		return encodeURI(str).replace(/#/g, "%23").replace(/;/g, "%3B").replace(/%20/g, "+");
	}

	getIssueTitle() {
		let title = this.notification.getMessage();
		title = title.replace(process.env.ATOM_HOME, "$ATOM_HOME");
		// Standardize issue titles
		if (process.platform === "win32") {
			title = title.replace(process.env.USERPROFILE, "~");
			title = title.replace(path.sep, path.posix.sep);
		} else {
			title = title.replace(process.env.HOME, "~");
		}

		if (title.length > TITLE_CHAR_LIMIT) {
			title = `${title.substring(0, TITLE_CHAR_LIMIT - 3)}...`;
		}
		return title.replace(/\r?\n|\r/g, "");
	}

	async getIssueBody() {
		if (this.issueBody) {
			return this.issueBody;
		}

		const [systemName, nonCorePackages] = await Promise.all([
			UserUtilities.getOSVersion(),
			UserUtilities.getNonCorePackages(),
		]);
		let packageMessage, packageVersion;

		const message = this.notification.getMessage();
		const options = this.notification.getOptions();
		const repoUrl = await this.getRepoUrl();
		const packageName = await this.getPackageName();
		if (packageName) {
			const pkg = atom.packages.getLoadedPackage(packageName);
			const metadata = pkg && pkg.metadata;
			packageVersion = metadata && metadata.version;
		}
		const copyText = "";
		const systemUser = process.env.USER;
		let rootUserStatus = "";

		if (systemUser === "root") {
			rootUserStatus = "**User**: root";
		}

		if (packageName && repoUrl) {
			packageMessage = `[${packageName}](${repoUrl}) package ${packageVersion}`;
		} else if (packageName) {
			packageMessage = `'${packageName}' package v${packageVersion}`;
		} else {
			packageMessage = "Atom Core";
		}

		this.issueBody = `\
[Enter steps to reproduce:]

1. ...
2. ...

**Atom**: ${atom.getVersion()} ${process.arch}
**Electron**: ${process.versions.electron}
**OS**: ${systemName}
**Thrown From**: ${packageMessage}
${rootUserStatus}

### Stack Trace

${message}

\`\`\`
At ${options.detail}

${this.normalizedStackPaths(options.stack)}
\`\`\`

### Commands

${CommandLogger.instance().getText()}

### Non-Core Packages

\`\`\`
${nonCorePackages.join("\n")}
\`\`\`

${copyText}\
`;
		return this.issueBody;
	}

	normalizedStackPaths(stack) {
		if (!stack) {
			return;
		}
		return stack.replace(/(^\W+at )([\w.]{2,} [(])?(.*)(:\d+:\d+[)]?)/gm, (m, p1, p2, p3, p4) => {
			return p1 + (p2 || "") + this.normalizePath(p3) + p4;
		});
	}

	normalizePath(filePath) {
		// Randomly inserted file url protocols
		return filePath.replace("file:///", "")
			// Temp switch for Windows home matching
			.replace(/[/]/g, "\\")
			// Remove users home dir for apm-dev'ed packages
			.replace(fs.getHomeDirectory(), "~")
			// Switch \ back to / for everyone
			.replace(/\\/g, "/")
			// Remove everything before app.asar or pacakges
			.replace(/.*(\/(app\.asar|packages\/).*)/, "$1");
	}

	async getRepoUrl() {
		const packageName = await this.getPackageName();
		if (!packageName) {
			return;
		}
		const pkg = atom.packages.getLoadedPackage(packageName);
		const metadata = pkg && pkg.metadata;
		let repo = metadata && metadata.repository;
		let repoUrl = repo && repo.url ? repo.url : repo;
		if (!repoUrl) {
			const packagePath = atom.packages.resolvePackagePath(packageName);
			if (packagePath) {
				try {
					const pkgContent = await new Promise((resolve, reject) => {
						fs.readFile(path.join(packagePath, "package.json"), (err, content) => {
							if (err) {
								reject(err);
							} else {
								resolve(content);
							}
						});
					});
					const pkgJson = JSON.parse(pkgContent);
					repo = pkgJson && pkgJson.repository;
					repoUrl = repo && repo.url ? repo.url : repo;
				} catch (error) {
					// silent error
				}
			}
		}

		if (repoUrl) {
			return repoUrl.replace(/\.git$/, "").replace(/^git\+/, "");
		}
	}

	getPackageNameFromFilePath(filePath) {
		if (!filePath) {
			return;
		}

		let match = /\/\.atom\/dev\/packages\/([^/]+)\//.exec(filePath);
		let packageName = match && match[1];
		if (packageName) {
			return packageName;
		}

		match = /\\\.atom\\dev\\packages\\([^\\]+)\\/.exec(filePath);
		packageName = match && match[1];
		if (packageName) {
			return packageName;
		}

		match = /\/\.atom\/packages\/([^/]+)\//.exec(filePath);
		packageName = match && match[1];
		if (packageName) {
			return packageName;
		}

		match = /\\\.atom\\packages\\([^\\]+)\\/.exec(filePath);
		packageName = match && match[1];
		if (packageName) {
			return packageName;
		}
	}

	getRealPath(pkgPath) {
		return new Promise((resolve, reject) => {
			fs.realpath(pkgPath, (err, p) => {
				if (err) {
					reject(err);
				} else {
					resolve(p);
				}
			});
		});
	}

	async getPackageName() {
		let packageName, packagePath;
		const options = this.notification.getOptions();

		if (options.packageName) {
			return options.packageName;
		}
		if (!options.stack && !options.detail) {
			return;
		}

		const packagePaths = this.getPackagePathsByPackageName();
		for (packageName in packagePaths) {
			packagePath = packagePaths[packageName];
			if ((packagePath.indexOf(path.join(".atom", "dev", "packages")) > -1) || (packagePath.indexOf(path.join(".atom", "packages")) > -1)) {
				packagePaths[packageName] = await this.getRealPath(packagePath);
			}
		}

		const getPackageName = (pkgPath) => {
			let filePath = /\((.+?):\d+|\((.+)\)|(.+)/.exec(pkgPath)[0];

			// Stack traces may be a file URI
			const match = FileURLRegExp.exec(filePath);
			if (match) {
				filePath = match[1];
			}

			filePath = path.normalize(filePath);

			if (path.isAbsolute(filePath)) {
				for (const packName in packagePaths) {
					packagePath = packagePaths[packName];
					if (filePath === "node.js") {
						continue;
					}
					const isSubfolder = filePath.indexOf(path.normalize(packagePath + path.sep)) === 0;
					if (isSubfolder) {
						return packName;
					}
				}
			}
			return this.getPackageNameFromFilePath(filePath);
		};

		if (options.detail) {
			packageName = getPackageName(options.detail);
			if (packageName) {
				return packageName;
			}
		}

		if (options.stack) {
			const stack = StackTraceParser.parse(options.stack);
			for (let i = 0; i < stack.length; i++) {
				const {file} = stack[i];

				// Empty when it was run from the dev console
				if (!file) {
					return;
				}
				packageName = getPackageName(file);
				if (packageName) {
					return packageName;
				}
			}
		}

	}

	getPackagePathsByPackageName() {
		const packagePathsByPackageName = {};
		for (const pack of atom.packages.getLoadedPackages()) {
			packagePathsByPackageName[pack.name] = pack.path;
		}
		return packagePathsByPackageName;
	}
}
