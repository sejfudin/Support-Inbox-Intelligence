const { buildSprintSummaryPrompt } = require('./sprintSummaryPrompts');

const fact = (over = {}) => ({
  number: 12,
  subject: 'Popraviti Settings stranicu',
  description: 'Izbrisati nepotrebne opcije i konfuzan tekst.',
  bucket: 'done',
  points: 3,
  assigneeIds: ['u1'],
  ...over,
});

describe('buildSprintSummaryPrompt', () => {
  it('states the JSON contract and the per-line theme format', () => {
    const prompt = buildSprintSummaryPrompt({ sprintName: 'Sprint 7', ticketFacts: [fact()] });

    expect(prompt).toContain(
      '{"team":{"themes":["..."]},"perUser":[{"userId":"<id>","themes":["..."]}]}'
    );
    expect(prompt).toContain('Title Case Headline - short plain description');
    // The " - " separator the frontend splits on is spelled out, with an example.
    expect(prompt).toContain('single space, a hyphen, a single space');
    expect(prompt).toMatch(/Example:/);
  });

  it('pins the recap to English regardless of the ticket language', () => {
    const prompt = buildSprintSummaryPrompt({ sprintName: 'Sprint 7', ticketFacts: [fact()] });

    expect(prompt).toContain(
      'Write the recap in English even if the tickets are written in another language.'
    );
  });

  it('renders one line per ticket with number, bucket, points and assignees', () => {
    const prompt = buildSprintSummaryPrompt({
      sprintName: 'Sprint 7',
      ticketFacts: [
        fact({ number: 5, points: 2, assigneeIds: ['a', 'b'], subject: 'Dark mode fix' }),
      ],
    });

    expect(prompt).toContain('- #5 [done, 2 pts] by a, b: Dark mode fix');
    expect(prompt).toContain('    Izbrisati nepotrebne opcije i konfuzan tekst.');
  });

  it('marks an unestimated, unassigned ticket without inventing figures', () => {
    const prompt = buildSprintSummaryPrompt({
      sprintName: 'Sprint 7',
      ticketFacts: [fact({ number: null, points: 0, assigneeIds: [], description: '' })],
    });

    expect(prompt).toContain('- (no number) [done] unassigned: Popraviti Settings stranicu');
  });

  it('lists members as "id = name", or "(none)" when there are none', () => {
    const withMembers = buildSprintSummaryPrompt({
      sprintName: 'Sprint 7',
      ticketFacts: [fact()],
      members: [{ id: 'u1', name: 'Dino Bajramović' }],
    });
    expect(withMembers).toContain('- u1 = Dino Bajramović');

    const noMembers = buildSprintSummaryPrompt({ sprintName: 'Sprint 7', ticketFacts: [fact()] });
    expect(noMembers).toContain('Members:\n(none)');
  });

  it('says "(none)" for an empty ticket set', () => {
    const prompt = buildSprintSummaryPrompt({ sprintName: 'Sprint 7', ticketFacts: [] });
    expect(prompt).toContain('Tickets:\n(none)');
  });
});
