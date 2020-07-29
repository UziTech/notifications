const os = require("os");
const path = require("path");
const semver = require("semver");
const {BufferedProcess} = require("atom");

/*
A collection of methods for retrieving information about the user's system for
bug report purposes.
*/

const DEV_PACKAGE_PATH = path.join("dev", "packages");

module.exports = {

	// OS version strings lifted from https://github.com/lee-dohm/bug-report
	async getOSVersion() {
		let info;
		try {
			switch (os.platform()) {
				case "darwin":
					info = await this.macVersionText();
					break;
				case "win32":
					info = await this.winVersionText();
					break;
				case "linux":
					info = await this.linuxVersionText();
					break;
				default:
					// do nothing
			}
		} catch (ex) {
			// fail silently
		}
		if (info) {
			return info;
		}
		return `${os.platform()} ${os.release()}`;
	},

	async macVersionText() {
		const info = await this.macVersionInfo();
		if (!info || !info.ProductName || !info.ProductVersion) {
			return;
		}
		return `${info.ProductName} ${info.ProductVersion}`;
	},

	macVersionInfo() {
		return new Promise(resolve => {
			let stdout = "";
			const plistBuddy = new BufferedProcess({
				command: "/usr/libexec/PlistBuddy",
				args: [
					"-c",
					"Print ProductVersion",
					"-c",
					"Print ProductName",
					"/System/Library/CoreServices/SystemVersion.plist",
				],
				stdout(output) {
					stdout += output;
				},
				exit() {
					const [ProductVersion, ProductName] = stdout.trim().split("\n");
					resolve({ProductVersion, ProductName});
				},
			});

			plistBuddy.onWillThrowError(function ({handle}) {
				handle();
				resolve();
			});
		});
	},

	async linuxVersionText() {
		const info = await this.linuxVersionInfo();
		if (!info || !info.DistroName || !info.DistroVersion) {
			return;
		}
		return `${info.DistroName} ${info.DistroVersion}`;
	},

	linuxVersionInfo() {
		return new Promise(resolve => {
			let stdout = "";

			const lsbRelease = new BufferedProcess({
				command: "lsb_release",
				args: ["-ds"],
				stdout(output) {
					stdout += output;
				},
				exit() {
					const [DistroName, DistroVersion] = stdout.trim().split(" ");
					resolve({DistroName, DistroVersion});
				},
			});

			lsbRelease.onWillThrowError(function ({handle}) {
				handle();
				resolve({});
			});
		});
	},

	winVersionText() {
		return new Promise(resolve => {
			const data = [];
			const systemInfo = new BufferedProcess({
				command: "systeminfo",
				stdout(oneLine) {
					data.push(oneLine);
				},
				exit() {
					const info = data.join("\n");
					const version = /OS.+(Microsoft.+)$/im.exec(info);
					let undef;
					resolve(version ? version[1] : undef);
				},
			});

			systemInfo.onWillThrowError(function ({handle}) {
				handle();
				resolve();
			});
		});
	},

	/*
  Section: Installed Packages
  */

	async getNonCorePackages() {
		const nonCorePackages = atom.packages.getAvailablePackageMetadata().filter(p => !atom.packages.isBundledPackage(p.name));
		const devPackageNames = atom.packages.getAvailablePackagePaths().filter(p => p.includes(DEV_PACKAGE_PATH)).map(p => path.basename(p));
		return nonCorePackages.map((pack) => `${pack.name} ${pack.version} ${devPackageNames.includes(pack.name) ? "(dev)" : ""}`);
	},

	async getLatestAtomData() {
		const githubHeaders = new Headers({
			accept: "application/vnd.github.v3+json",
			contentType: "application/json",
		});
		const response = await fetch("https://atom.io/api/updates", {headers: githubHeaders});

		if (!response.ok) {
			throw response.statusCode;
		}

		const data = await response.json();
		return data;
	},

	async checkAtomUpToDate() {
		const latestAtomData = await this.getLatestAtomData();
		const version = atom.getVersion();
		const installedVersion = version.replace(/-.*$/, "");
		const latestVersion = latestAtomData.name;
		const upToDate = installedVersion && semver.gte(installedVersion, latestVersion);
		return {upToDate, latestVersion, installedVersion};
	},

	getPackageVersion(packageName) {
		const pack = atom.packages.getLoadedPackage(packageName);
		return pack && pack.metadata.version;
	},

	getPackageVersionShippedWithAtom(packageName) {
		return require(path.join(atom.getLoadSettings().resourcePath, "package.json")).packageDependencies[packageName];
	},

	async getLatestPackageData(packageName) {
		const githubHeaders = new Headers({
			accept: "application/vnd.github.v3+json",
			contentType: "application/json",
		});
		const response = await fetch(`https://atom.io/api/packages/${packageName}`, {headers: githubHeaders});

		if (!response.ok) {
			throw response.statusCode;
		}

		const data = await response.json();
		return data;
	},

	async checkPackageUpToDate(packageName) {
		const latestPackageData = await this.getLatestPackageData(packageName);
		const installedVersion = this.getPackageVersion(packageName);
		let upToDate = installedVersion && semver.gte(installedVersion, latestPackageData.releases.latest);
		const latestVersion = latestPackageData.releases.latest;
		const versionShippedWithAtom = this.getPackageVersionShippedWithAtom(packageName);

		const isCore = versionShippedWithAtom;
		if (isCore) {
			// A core package is out of date if the version which is being used
			// is lower than the version which normally ships with the version
			// of Atom which is running. This will happen when there's a locally
			// installed version of the package with a lower version than Atom's.
			upToDate = installedVersion && semver.gte(installedVersion, versionShippedWithAtom);
		}

		return {isCore, upToDate, latestVersion, installedVersion, versionShippedWithAtom};
	},
};
