# Notifications+ package
[![Build Status](https://travis-ci.org/UziTech/notifications.svg?branch=master)](https://travis-ci.org/UziTech/notifications)
[![Windows Build status](https://ci.appveyor.com/api/projects/status/q7pdov4qeu2weee4/branch/master?svg=true)](https://ci.appveyor.com/project/UziTech/notifications)
[![Dependencies Status](https://david-dm.org/UziTech/notifications/status.svg)](https://david-dm.org/UziTech/notifications)

![notifications](https://cloud.githubusercontent.com/assets/69169/5176406/350d0e80-73fd-11e4-8101-1776b9d6d8bf.gif)

This is a fork of the core [notifications](https://github.com/atom/notifications) package that adds a few new features.

## Make notifications dismissable

Prevent a notification from auto closing by clicking on the notification or hover over the notification when it would close.

## Status bar notification count

See how many notifications are in the log.

![notifications-count](https://user-images.githubusercontent.com/97994/28998231-813edfbc-79eb-11e7-8bc9-8d97153f4243.gif)

## Disable popup notifications setting

Disable certain popup notifications when you don't want to be disturbed.

## Timeout option for notifications

Set the `timeout` option when adding a notification to override the default timeout.

## Updated dependencies
[![Dependencies Status](https://david-dm.org/UziTech/notifications/status.svg)](https://david-dm.org/UziTech/notifications)

## And a few other fixes
[All changes](https://github.com/atom/notifications/compare/master...UziTech:master#files_bucket)

### Docs

Notifications are available for use in your Atom packages via the `atom.notifications` `NotificationManager` object. See
https://atom.io/docs/api/latest/NotificationManager and https://atom.io/docs/api/latest/Notification for documentation.
