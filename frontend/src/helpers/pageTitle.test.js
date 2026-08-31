import { describe, expect, it } from 'vitest';
import { APP_NAME, formatPageTitle, resolveRouteTitle } from './pageTitle';

describe('formatPageTitle', () => {
  it('suffixes the app name', () => {
    expect(formatPageTitle('Tickets')).toBe(`Tickets · ${APP_NAME}`);
  });

  it('falls back to the bare app name when there is no page title', () => {
    expect(formatPageTitle('')).toBe(APP_NAME);
    expect(formatPageTitle(null)).toBe(APP_NAME);
    expect(formatPageTitle(undefined)).toBe(APP_NAME);
  });

  it('collapses whitespace from record titles', () => {
    expect(formatPageTitle('  Fix   the login\nredirect ')).toBe(
      `Fix the login redirect · ${APP_NAME}`
    );
  });

  it('ellipsizes a title too long for a tab', () => {
    const long = 'x'.repeat(120);
    const formatted = formatPageTitle(long);
    expect(formatted.endsWith(`… · ${APP_NAME}`)).toBe(true);
    expect(formatted.length).toBeLessThan(long.length);
  });
});

describe('resolveRouteTitle', () => {
  it('titles a static route', () => {
    expect(resolveRouteTitle('/tickets')).toBe('Tickets');
    expect(resolveRouteTitle('/admin/daily-insights')).toBe('Daily insights');
  });

  it('titles a detail route by its pattern', () => {
    expect(resolveRouteTitle('/my-interns/652f1a2b3c4d5e6f7a8b9c0d')).toBe('Intern');
    expect(resolveRouteTitle('/projects/abc123')).toBe('Project');
  });

  it('prefers the more specific pattern', () => {
    expect(resolveRouteTitle('/admin/workspaces')).toBe('All workspaces');
    expect(resolveRouteTitle('/admin/workspaces/abc123')).toBe('Workspace');
    expect(resolveRouteTitle('/admin/workspaces/abc123/settings')).toBe('Workspace settings');
    expect(resolveRouteTitle('/programme')).toBe('Programme dashboard');
    expect(resolveRouteTitle('/programme/settings')).toBe('Settings');
  });

  it('returns nothing for an unmapped path', () => {
    expect(resolveRouteTitle('/nope')).toBe('');
  });
});
