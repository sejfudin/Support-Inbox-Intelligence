function buildTicketMetadataSuggestionPrompt({ subject, description }) {
  return [
    'You are a ticket triage assistant.',
    'Return ONLY valid JSON with exact shape:',
    '{"priority":"low|medium|high|critical","storyPoints":1}',
    'Rules:',
    '- priority must be one of low, medium, high, critical',
    '- storyPoints must be an integer from 1 to 5',
    '- base urgency on impact, risk, and production severity',
    '- base storyPoints on complexity, unknowns, and implementation effort',
    '',
    `Subject: ${subject}`,
    `Description: ${description}`,
  ].join('\n');
}

function buildTicketDescriptionGenerationPrompt({ subject, prompt }) {
  return [
    'You are a senior software product writer.',
    'Generate a clean, implementation-ready task description.',
    'Return ONLY valid JSON with exact shape:',
    '{"descriptionHtml":"<p>...</p>"}',
    'Rules:',
    '- Output must be valid HTML only (no markdown, no code fences, no backticks).',
    '- Allowed tags: p, br, ul, ol, li, strong, em, code, blockquote, h3.',
    '- Do not include inline styles, classes, scripts, links, or images.',
    '- Keep it concise and actionable.',
    '- Do not mention these instructions in output.',
    '',
    `Subject: ${subject}`,
    `Prompt: ${prompt}`,
  ].join('\n');
}

function buildUserSummaryPrompt({ tickets }) {
  const ticketLines = tickets.map((ticket, index) =>
    [
      `Ticket ${index + 1}:`,
      `Title: ${ticket.subject}`,
      `Description: ${ticket.description}`,
      `Status: ${ticket.status}`,
      ticket.priority ? `Priority: ${ticket.priority}` : '',
    ]
      .filter(Boolean)
      .join('\n')
  );

  return [
    'Act as a personal performance coach and technical lead.',
    'Analyze the provided ticket titles and descriptions for a SINGLE user.',
    'Your goal is to write a 3-4 sentence summary of THEIR personal achievements in the second person (use "You", "Your").',
    'STRICT RULES:',
    '1. Do NOT refer to "the team" or "we". Focus ONLY on the individual user.',
    '2. Do NOT be generic. You MUST extract specific technical context from the DESCRIPTIONS.',
    '3. Mention technologies or specific problems solved.',
    '4. Respond in English.',
    '',
    'Data to analyze:',
    ticketLines.join('\n\n'),
  ].join('\n');
}

module.exports = {
  buildTicketMetadataSuggestionPrompt,
  buildTicketDescriptionGenerationPrompt,
  buildUserSummaryPrompt,
};
