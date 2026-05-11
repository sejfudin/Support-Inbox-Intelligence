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
    'Act as an objective Technical Lead and Performance Auditor.',
    'Conduct a factual analysis of the provided ticket titles and descriptions for the specific individual.',
    'Synthesize a 4-5 sentence summary of personal output in the second person (e.g., "You addressed...", "Your implementation...").',
    'STRICT DIRECTIVES:',
    '1. Maintain an objective and neutral tone, avoiding hyperbolic or overly celebratory language.',
    '2. Focus exclusively on the individual contributor’s technical output and verifiable actions.',
    '3. Isolate specific technical parameters, tools, and logic mentioned within the ticket descriptions.',
    '4. Characterize the work by the complexity of the problems solved and the technologies utilized.',
    '5. Provide the response in professional English.',
    '',
    'Primary Data Source:',
    ticketLines.join('\n\n'),
  ].join('\n');
}

module.exports = {
  buildTicketMetadataSuggestionPrompt,
  buildTicketDescriptionGenerationPrompt,
  buildUserSummaryPrompt,
};
