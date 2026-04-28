function buildTicketMetadataSuggestionPrompt({ subject, description }) {
  return [
    "You are a ticket triage assistant.",
    "Return ONLY valid JSON with exact shape:",
    '{"priority":"low|medium|high|critical","storyPoints":1}',
    "Rules:",
    "- priority must be one of low, medium, high, critical",
    "- storyPoints must be an integer from 1 to 5",
    "- base urgency on impact, risk, and production severity",
    "- base storyPoints on complexity, unknowns, and implementation effort",
    "",
    `Subject: ${subject}`,
    `Description: ${description}`,
  ].join("\n");
}

module.exports = {
  buildTicketMetadataSuggestionPrompt,
};


