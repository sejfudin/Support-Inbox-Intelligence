const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

export const templateTextToDescriptionHtml = (template = '') => {
  const normalizedTemplate = String(template || '')
    .replace(/\r\n/g, '\n')
    .trim();

  if (!normalizedTemplate) return '';

  return normalizedTemplate
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('');
};
