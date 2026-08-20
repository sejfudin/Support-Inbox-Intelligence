import { describe, expect, it } from 'vitest';
import {
  DESKTOP_NOTIFICATIONS_DEFAULT,
  desktopNotificationsValue,
  isDesktopNotificationsOn,
  isValidDesktopNotifications,
  shouldShowDesktopNotification,
  drawsInForeground,
} from './desktopNotifications';

const reminder = {
  _id: 'n1',
  type: 'daily_attendance_reminder',
  title: 'Reminder',
  body: 'Check in',
};

// Anything outside FOREGROUND_TYPES — the bell can hold it until the reader looks.
const mention = {
  _id: 'n3',
  type: 'ticket_mention',
  title: 'Mentioned',
  body: 'In a comment',
};

const args = (overrides = {}) => ({
  notification: reminder,
  enabled: true,
  permission: 'granted',
  appInBackground: true,
  mutedGroups: [],
  ...overrides,
});

describe('stored value', () => {
  it('defaults to off', () => {
    expect(isDesktopNotificationsOn(DESKTOP_NOTIFICATIONS_DEFAULT)).toBe(false);
  });

  it('round-trips a boolean', () => {
    expect(isDesktopNotificationsOn(desktopNotificationsValue(true))).toBe(true);
    expect(isDesktopNotificationsOn(desktopNotificationsValue(false))).toBe(false);
  });

  it('rejects anything it did not write', () => {
    expect(isValidDesktopNotifications('on')).toBe(true);
    expect(isValidDesktopNotifications('off')).toBe(true);
    expect(isValidDesktopNotifications('true')).toBe(false);
    expect(isValidDesktopNotifications('')).toBe(false);
    expect(isValidDesktopNotifications(null)).toBe(false);
  });

  it('treats an unreadable stored value as off', () => {
    expect(isDesktopNotificationsOn(undefined)).toBe(false);
    expect(isDesktopNotificationsOn('yes')).toBe(false);
  });
});

describe('shouldShowDesktopNotification', () => {
  it('shows a banner when every condition holds', () => {
    expect(shouldShowDesktopNotification(args())).toBe(true);
  });

  it('stays silent when the reader has not switched it on', () => {
    expect(shouldShowDesktopNotification(args({ enabled: false }))).toBe(false);
  });

  it('stays silent without granted permission', () => {
    expect(shouldShowDesktopNotification(args({ permission: 'default' }))).toBe(false);
    expect(shouldShowDesktopNotification(args({ permission: 'denied' }))).toBe(false);
    expect(shouldShowDesktopNotification(args({ permission: 'unsupported' }))).toBe(false);
  });

  it('stays silent while the reader is looking at the app', () => {
    expect(
      shouldShowDesktopNotification(args({ notification: mention, appInBackground: false }))
    ).toBe(false);
  });

  it('draws the daily reminder even with the app on screen', () => {
    expect(shouldShowDesktopNotification(args({ appInBackground: false }))).toBe(true);
  });

  it('still respects the switch, permission and mute for a foreground type', () => {
    const foreground = { appInBackground: false };
    expect(shouldShowDesktopNotification(args({ ...foreground, enabled: false }))).toBe(false);
    expect(shouldShowDesktopNotification(args({ ...foreground, permission: 'denied' }))).toBe(
      false
    );
    expect(shouldShowDesktopNotification(args({ ...foreground, mutedGroups: ['reminders'] }))).toBe(
      false
    );
  });

  it('respects a muted group', () => {
    expect(shouldShowDesktopNotification(args({ mutedGroups: ['reminders'] }))).toBe(false);
  });

  it('ignores a mute on some other group', () => {
    expect(shouldShowDesktopNotification(args({ mutedGroups: ['mentions'] }))).toBe(true);
  });

  it('needs a title to draw', () => {
    expect(shouldShowDesktopNotification(args({ notification: { ...reminder, title: '' } }))).toBe(
      false
    );
    expect(shouldShowDesktopNotification(args({ notification: null }))).toBe(false);
    expect(shouldShowDesktopNotification(args({ notification: undefined }))).toBe(false);
  });

  it('still shows a type that has no mute group of its own', () => {
    const ungrouped = { _id: 'n2', type: 'brand_new_type', title: 'New', body: 'Body' };
    expect(
      shouldShowDesktopNotification(args({ notification: ungrouped, mutedGroups: ['reminders'] }))
    ).toBe(true);
  });
});

describe('drawsInForeground', () => {
  it('is the daily reminder and nothing else', () => {
    expect(drawsInForeground(reminder)).toBe(true);
    expect(drawsInForeground(mention)).toBe(false);
    expect(drawsInForeground(null)).toBe(false);
    expect(drawsInForeground(undefined)).toBe(false);
  });
});
