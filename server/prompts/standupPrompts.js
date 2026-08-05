/**
 * Prompt for condensing one intern's daily standup note.
 *
 * The output is read on the intern's own dashboard in place of a note too long
 * to fit the card, with the full text one click away — so the summary's job is
 * to be *shorter*, not to interpret, praise, or assess. That is the opposite of
 * `buildUserSummaryPrompt` in `ticketPrompts.js`, which deliberately writes an
 * appraisal of someone's output; do not merge the two.
 */
function buildStandupSummaryPrompt({ done = [], todo = [], blockers = [] }) {
  const section = (label, lines) =>
    lines.length > 0 ? [`${label}:`, ...lines.map((line) => `- ${line}`)].join('\n') : '';

  return [
    'Condense the following daily standup note into at most three sentences of plain prose.',
    '',
    'STRICT DIRECTIVES:',
    '1. Write in the first person, as the person who wrote the note ("I finished…", "Today I…").',
    '2. Preserve every ticket reference exactly as written (e.g. #12 stays #12).',
    '3. Keep any blocker — what is blocking and what is needed to unblock it. Never drop a blocker to save space; it is the most important part of a standup.',
    '4. State only what the note says. Add no assessment, no praise, no advice, and no invented detail.',
    '5. Do not restate the section labels ("Done", "Today", "Blocked") as headings — write it as one short paragraph.',
    '6. Respond with the summary text only: no preamble, no bullet points, no markdown.',
    '7. Respond in the same language the note is written in.',
    '',
    'Standup note:',
    [section('Done', done), section('Today', todo), section('Blocked', blockers)]
      .filter(Boolean)
      .join('\n'),
  ].join('\n');
}

module.exports = { buildStandupSummaryPrompt };
