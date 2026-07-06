export const TASK_MANAGER_LOGO_FULL_SRC = '/brand/TMLogo.png';
export const TASK_MANAGER_LOGO_WHITE_SRC = '/brand/TMLogoWhite.png';
export const TASK_MANAGER_FAVICON_SRC = '/favicon.svg';

export const LOGO_PRESENTATION_SHELL = 'shell';

export function getLogoPresentation() {
  return LOGO_PRESENTATION_SHELL;
}

export function usesThemedLogoShell() {
  return true;
}

export function getTaskManagerLogoSrc() {
  return TASK_MANAGER_LOGO_WHITE_SRC;
}
