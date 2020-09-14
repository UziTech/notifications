## [2.0.2](https://github.com/UziTech/notifications/compare/v2.0.1...v2.0.2) (2020-09-14)


### Bug Fixes

* **deps:** Bump moment from 2.27.0 to 2.28.0 ([#27](https://github.com/UziTech/notifications/issues/27)) ([fc23b98](https://github.com/UziTech/notifications/commit/fc23b983dde6bfafd2568aa0729fa356a36bdbdc))

## [2.0.1](https://github.com/UziTech/notifications/compare/v2.0.0...v2.0.1) (2020-09-04)


### Bug Fixes

* **deps:** Bump dompurify from 2.0.14 to 2.0.15 ([#25](https://github.com/UziTech/notifications/issues/25)) ([b4cd8e1](https://github.com/UziTech/notifications/commit/b4cd8e1376874eec4471de48ee037832f5111dc7))

# [2.0.0](https://github.com/UziTech/notifications/compare/v1.1.1...v2.0.0) (2020-08-03)


### Bug Fixes

* decaffeinate and use etch ([#15](https://github.com/UziTech/notifications/issues/15)) ([00d14bd](https://github.com/UziTech/notifications/commit/00d14bd70d611ed59318013285506b2c1a95360a))


### BREAKING CHANGES

* Move source code to javascript and move some views to etch

## [1.1.1](https://github.com/UziTech/notifications/compare/v1.1.0...v1.1.1) (2020-04-29)


### Bug Fixes

* **deps:** update deps ([#13](https://github.com/UziTech/notifications/issues/13)) ([0ade394](https://github.com/UziTech/notifications/commit/0ade394eda053101e48ba0688b919bd3f326b7f2))

# [1.1.0](https://github.com/UziTech/notifications/compare/v1.0.2...v1.1.0) (2020-02-24)


### Bug Fixes

* set config order ([1a6b1a4](https://github.com/UziTech/notifications/commit/1a6b1a4ca779a80789e2ceb40c003836c14ac2f5))
* update deps ([932d101](https://github.com/UziTech/notifications/commit/932d101da9fb41e659253158297f2c3d2933e753))


### Features

* add alwaysDismiss setting ([b0717c8](https://github.com/UziTech/notifications/commit/b0717c8defd3dd878edd43ba8a25b299f83a6be0))

## [1.0.2](https://github.com/UziTech/notifications/compare/v1.0.1...v1.0.2) (2019-11-28)


### Bug Fixes

* update to stacktrace-parser to 0.1.8 ([61ea45f](https://github.com/UziTech/notifications/commit/61ea45ff7fa481925399f480558c2383da7e6a6b))

## [1.0.1](https://github.com/UziTech/notifications/compare/v1.0.0...v1.0.1) (2019-11-27)


### Bug Fixes

* add semantic-release ([f5f878c](https://github.com/UziTech/notifications/commit/f5f878cff283e9af8896e61c43b283221f8507d1))
* use github actions ([#11](https://github.com/UziTech/notifications/issues/11)) ([b360a2e](https://github.com/UziTech/notifications/commit/b360a2e5b9bdcb3f9dedf9eebd626aeceb104e34))

## 1.0.0
* Add setting to disable telemetry
* Update dependencies

## 0.69.16
* Update dependencies

## 0.69.15
* Update dependencies

## 0.69.14
* Sanitize markdown notifications

## 0.69.13
* New style

## 0.69.12
* Security Fix: Update `moment` to prevent redos [moment/moment#4163](https://github.com/moment/moment/issues/4163)

## 0.69.11
* Add `notifications-plus:clear-log` command to clear the notifications log
* Add button on top right of log to clear the notifications log

## 0.69.10
* Use [8fold-marked](https://www.npmjs.com/package/8fold-marked) to [prevent ReDoS in markdown](https://github.com/chjj/marked/issues/937)

## 0.69.9
* Show the last notification time on the status bar tooltip

## 0.69.8
* Fix dismiss on non-dismissable notification turned dismissable
