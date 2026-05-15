const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const HTML_TAG_PATTERN = /<\/?[a-z][\s\S]*>/i;

export const templateTextToDescriptionHtml = (template = '') => {
  const normalizedTemplate = String(template || '')
    .replace(/\r\n/g, '\n')
    .trim();

  if (!normalizedTemplate) return '';

  if (HTML_TAG_PATTERN.test(normalizedTemplate)) return normalizedTemplate;

  return normalizedTemplate
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('');
};

export const templateHtmlToPlainText = (template = '') =>
  String(template || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();

export const normalizeTemplateForSave = (template = '') => {
  const html = templateTextToDescriptionHtml(template);
  return templateHtmlToPlainText(html) ? html : '';
};
