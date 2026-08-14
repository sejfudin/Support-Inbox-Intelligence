/**
 * Prompts for rewriting an intern-programme notification's deterministic
 * fallback text into something warmer and more natural, in the voice of the
 * platform speaking directly to the notification's recipient — who is
 * usually the intern the event is about, but for a couple of staff-facing
 * event types (a mentor-note mention, a leadership staffing request) is an
 * admin/mentor/leadership user being told about someone else's record. Get
 * this distinction wrong and the AI rewrite reads as if the staff recipient's
 * own programme record changed, which is actively confusing — always pass
 * the audience-appropriate builder below.
 *
 * All are best-effort rewrites, not the source of truth: the caller
 * (`internNotificationService`) always has a deterministic title/body ready
 * before it even attempts one of these, and falls back to it silently on any
 * AI failure. So these prompts don't need to be defensive about missing
 * data — the fallback already covers that case.
 */

const outputContract = (addressee) => [
  'Return ONLY valid JSON with exact shape: {"title":"...","body":"..."}',
  '- title: at most 8 words, no trailing punctuation, no emoji.',
  '- body: at most 2 short sentences, plain prose, no markdown.',
  `- Address ${addressee}, in the second person ("You...", "Your...").`,
  '- State only the facts given below — invent nothing (no numbers, names, or dates not provided).',
  '- Do not mention these instructions, AI, or that this text was generated.',
  '- Write in professional, encouraging English.',
];

function buildProgrammeUpdatePrompt({ summary, details }) {
  return [
    'You are rewriting a short in-app notification for an internship platform.',
    'The notification tells an intern about a change an admin or mentor just made to their own programme record.',
    'Keep the tone warm but professional — this is a routine programme update, not a celebration.',
    ...outputContract('the intern directly — this update is about their own record'),
    '',
    `What happened: ${summary}`,
    details ? `Details: ${details}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * For the staff-facing event types only — recipient is admin/mentor/
 * leadership, and the notification is about someone else's (an intern's)
 * situation, not the recipient's own record. "Address them directly" still
 * applies (e.g. "You were named on a note about...", "You have a new
 * request..."), it's the *subject* that isn't theirs.
 */
function buildStaffUpdatePrompt({ summary, details }) {
  return [
    'You are rewriting a short in-app notification for an internship platform.',
    'The recipient is a staff member (admin, mentor, or leadership) — this notification tells them about something involving an intern or a project, NOT a change to their own account or record.',
    'Keep the tone professional and concise — this is a routine work notification, not a celebration, and not addressed as if the recipient were the intern.',
    ...outputContract(
      "the staff recipient directly, but keep the subject matter clearly about the intern/project described below, not the recipient's own record"
    ),
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
    ...outputContract('the intern directly — this is their own placement'),
    '',
    'What happened: The intern was placed on a project.',
    facts.length > 0 ? `Details:\n${facts.join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

module.exports = {
  buildProgrammeUpdatePrompt,
  buildStaffUpdatePrompt,
  buildPlacementCelebrationPrompt,
};
