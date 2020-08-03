/** @babel */

describe("Notifications Plus", () => {

	describe("when the notifications package is enabled before activation", () => {

		beforeEach(async () => {
			await atom.packages.activatePackage("notifications");
		});

		it("disables the notifications package", async () => {
			expect(atom.packages.isPackageDisabled("notifications")).toBe(false);

			await atom.packages.activatePackage("notifications-plus");

			expect(atom.packages.isPackageDisabled("notifications")).toBe(true);
		});
	});

	describe("when the notifications package is enabled after activation", () => {

		beforeEach(async () => {
			await atom.packages.activatePackage("notifications");

			atom.packages.disablePackage("notifications");

			await atom.packages.activatePackage("notifications-plus");
		});

		it("disables the notifications package", () => {
			atom.packages.enablePackage("notifications");

			expect(atom.packages.isPackageDisabled("notifications")).toBe(true);
		});
	});
});
