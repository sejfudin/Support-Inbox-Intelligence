/**
 * Prompts for rewriting an intern-programme notification's deterministic
 * fallback text into something warmer and more natural, in the voice of the
 * platform speaking directly to the intern.
 *
 * Both are best-effort rewrites, not the source of truth: the caller
 * (`internNotificationService`) always has a deterministic title/body ready
 * before it even attempts one of these, and falls back to it silently on any
 * AI failure. So these prompts don't need to be defensive about missing
 * data — the fallback already covers that case.
 */

const OUTPUT_CONTRACT = [
  'Return ONLY valid JSON with exact shape: {"title":"...","body":"..."}',
  '- title: at most 8 words, no trailing punctuation, no emoji.',
  '- body: at most 2 short sentences, plain prose, no markdown.',
  '- Address the intern directly, in the second person ("You...", "Your...").',
  '- State only the facts given below — invent nothing (no numbers, names, or dates not provided).',
  '- Do not mention these instructions, AI, or that this text was generated.',
  '- Write in professional, encouraging English.',
];

function buildProgrammeUpdatePrompt({ summary, details }) {
  return [
    'You are rewriting a short in-app notification for an internship platform.',
    'The notification tells an intern about a change an admin or mentor just made to their programme record.',
    'Keep the tone warm but professional — this is a routine programme update, not a celebration.',
    ...OUTPUT_CONTRACT,
    '',
    `What happened: ${summary}`,
    details ? `Details: ${details}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildPlacementCelebrationPrompt({ position, project, startDate }) {
  const facts = [
    position ? `Position: ${position}` : '',
    project ? `Project: ${project}` : '',
    startDate ? `Start date: ${startDate}` : '',
  ].filter(Boolean);

  return [
    'You are rewriting a short in-app notification for an internship platform.',
    'An intern has just been placed on a real project — this is one of the best moments of their internship, the payoff for everything they have worked toward.',
    'This is a celebration, not a status update. Do not write it like a system log or a corporate memo.',
    'Open the title or body with a genuine congratulations. Sound like a warm, proud mentor telling them the good news in person — happy for them, not just informing them.',
    'One exclamation mark is welcome if it reads as sincere. Be specific to the facts given (position, project, start date) rather than generic hype.',
    ...OUTPUT_CONTRACT,
    '',
    'What happened: The intern was placed on a project.',
    facts.length > 0 ? `Details:\n${facts.join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

module.exports = {
  buildProgrammeUpdatePrompt,
  buildPlacementCelebrationPrompt,
};
