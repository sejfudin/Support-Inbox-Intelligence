export const WORKSPACE_LOGO_ALLOWED_MIME_TYPES = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/svg+xml',
]);

export const WORKSPACE_LOGO_ACCEPT = WORKSPACE_LOGO_ALLOWED_MIME_TYPES.join(',');
export const WORKSPACE_LOGO_MAX_SIZE_BYTES = 1 * 1024 * 1024;
export const WORKSPACE_LOGO_VALIDATION_MESSAGES = Object.freeze({
  invalidType: 'Logo must be JPG, PNG, GIF, or SVG.',
  tooLarge: 'Logo must be 1MB or smaller.',
});
export const WORKSPACE_LOGO_HELPER_TEXT = 'Allowed: JPG, PNG, GIF, SVG. Max 1MB.';

const WORKSPACE_LOGO_ALLOWED_MIME_SET = new Set(WORKSPACE_LOGO_ALLOWED_MIME_TYPES);

export const getWorkspaceLogoValidationError = (file, { required = false } = {}) => {
  if (!file) return required ? 'Logo file is required.' : null;
  if (!WORKSPACE_LOGO_ALLOWED_MIME_SET.has(file.type)) {
    return WORKSPACE_LOGO_VALIDATION_MESSAGES.invalidType;
  }
  if (file.size > WORKSPACE_LOGO_MAX_SIZE_BYTES) {
    return WORKSPACE_LOGO_VALIDATION_MESSAGES.tooLarge;
  }
  return null;
};
