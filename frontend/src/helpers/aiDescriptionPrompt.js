export const AI_PROMPT_MIN_LENGTH = 10;
const AI_PROMPT_REGEX = /^\s*\/ai\b([\s\S]*)$/i;

export function htmlToPlainText(html) {
  const safeHtml = String(html || "");

  if (typeof document === "undefined") {
    return safeHtml.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }

  const tmp = document.createElement("div");
  tmp.innerHTML = safeHtml;
  return String(tmp.textContent || tmp.innerText || "")
    .replace(/\u00a0/g, " ")
    .trim();
}

export function extractAiPromptFromDescriptionHtml(descriptionHtml) {
  const plainText = htmlToPlainText(descriptionHtml);
  const match = plainText.match(AI_PROMPT_REGEX);

  if (!match) {
    return {
      isAiPromptMode: false,
      prompt: "",
      plainText,
    };
  }

  return {
    isAiPromptMode: true,
    prompt: String(match[1] || "").trim(),
    plainText,
  };
}
