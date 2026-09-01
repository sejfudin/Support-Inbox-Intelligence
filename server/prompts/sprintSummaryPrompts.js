/**
 * Prompt for the sprint recap shown on the Sprints → Summary tab.
 *
 * The model does ONE job here: grouping a sprint's shipped tickets into a
 * handful of named themes, team-wide and per assignee. Each theme is a short
 * Title Case headline, an " - " separator, then a plain one-line description of
 * the concrete changes it covers ("Settings page cleaned up and gated to
 * leadership - removed unused options, dropped the confusing helper text,
 * onboarding is now skippable"). Every number the tab could show — story points,
 * ticket counts, carry-over — is computed elsewhere from the tickets themselves
 * and never asked of the model, so the recap cannot invent a figure. Keep this
 * prompt descriptive, never evaluative: it says what was done, not how well (the
 * same line `buildStandupSummaryPrompt` holds).
 *
 * The recap is always written in English, even when the tickets are not — the
 * team reads it in one language regardless of how any given ticket was filed.
 *
 * JSON contract, parsed with `groqAiClient.extractJsonObject`:
 *   { "team": { "themes": string[] },
 *     "perUser": [ { "userId": string, "themes": string[] } ] }
 * where every theme string is "Title Case Headline - lower-case detail, detail".
 */
function buildSprintSummaryPrompt({ sprintName, ticketFacts = [], members = [] }) {
  const ticketLines = ticketFacts.map((fact) => {
    const head = [
      fact.number ? `#${fact.number}` : '(no number)',
      `[${fact.bucket}${fact.points ? `, ${fact.points} pts` : ''}]`,
      fact.assigneeIds.length ? `by ${fact.assigneeIds.join(', ')}` : 'unassigned',
    ].join(' ');
    const body = fact.description ? `\n    ${fact.description}` : '';
    return `- ${head}: ${fact.subject}${body}`;
  });

  const memberLines = members.map((member) => `- ${member.id} = ${member.name}`);

  return [
    'You are a delivery lead writing a short, factual recap of one sprint for the team.',
    'Return ONLY valid JSON, no markdown, with this exact shape:',
    '{"team":{"themes":["..."]},"perUser":[{"userId":"<id>","themes":["..."]}]}',
    '',
    'THEME FORMAT — every string in every "themes" array is ONE line of the form:',
    '  Title Case Headline - short plain description of what changed, comma separated',
    'The headline is a noun phrase, Title Case, at most 6 words, no punctuation. Then a',
    'single space, a hyphen, a single space, then one lower-case clause (or a few joined',
    'by commas) naming the concrete changes. No second sentence, no trailing period,',
    'about 30 words at most after the hyphen. Example:',
    '  "Settings Page Cleaned Up And Gated To Leadership - removed unused options,',
    '   dropped the confusing helper text, onboarding is now skippable, added a',
    '   notification toggle for it"',
    '',
    'RULES:',
    '1. team.themes: 3 to 6 lines in the format above, each grouping related tickets by',
    '   what shipped. Build them ONLY from tickets in the "done" bucket. If nothing is',
    '   done, return [].',
    '2. perUser: one entry per listed member id that has "done" tickets, with 2 to 4',
    "   lines in the same format covering only that person's done work. Omit members",
    '   with nothing done. Use the member id strings exactly as given.',
    '3. State only what the ticket titles and descriptions say. No praise, no assessment,',
    '   no advice, no invented detail. Preserve ticket references such as #12 exactly.',
    '4. Write the recap in English even if the tickets are written in another language.',
    '',
    `Sprint: ${sprintName}`,
    '',
    'Members:',
    memberLines.length ? memberLines.join('\n') : '(none)',
    '',
    'Tickets:',
    ticketLines.length ? ticketLines.join('\n') : '(none)',
  ].join('\n');
}

module.exports = { buildSprintSummaryPrompt };
