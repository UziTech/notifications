/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
describe("Notifications Plus", function () {

	describe("when the notifications package is enabled before activation", function () {

		beforeEach(() => waitsForPromise(() => atom.packages.activatePackage("notifications")));

		return it("disables the notifications package", function () {
			expect(atom.packages.isPackageDisabled("notifications")).toBe(false);

			waitsForPromise(() => atom.packages.activatePackage("notifications-plus"));

			return runs(() => expect(atom.packages.isPackageDisabled("notifications")).toBe(true));
		});
	});

	return describe("when the notifications package is enabled after activation", function () {

		beforeEach(function () {
			waitsForPromise(() => atom.packages.activatePackage("notifications"));

			runs(() => atom.packages.disablePackage("notifications"));

			return waitsForPromise(() => atom.packages.activatePackage("notifications-plus"));
		});

		return it("disables the notifications package", function () {
			atom.packages.enablePackage("notifications");

			return expect(atom.packages.isPackageDisabled("notifications")).toBe(true);
		});
	});
});
