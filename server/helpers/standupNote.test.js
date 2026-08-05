const {
  SUMMARY_MIN_CHARS,
  noteLength,
  noteSourceHash,
  shouldSummarize,
  isSummaryFresh,
} = require('./standupNote');

// A line long enough that a couple of them clear the threshold on their own.
const line = (n) => 'x'.repeat(n);

const entry = (attrs = {}) => ({ done: [], todo: [], blockers: [], ...attrs });

describe('noteLength', () => {
  it('counts every section', () => {
    const note = entry({
      done: ['aaa'],
      todo: ['bb'],
      blockers: [{ text: 'c' }],
    });

    expect(noteLength(note)).toBe(6);
  });

  it('ignores surrounding whitespace', () => {
    expect(noteLength(entry({ done: ['  ab  '] }))).toBe(2);
  });

  it('accepts blockers as plain strings too', () => {
    expect(noteLength(entry({ blockers: ['abcd'] }))).toBe(4);
  });
});

describe('shouldSummarize', () => {
  it('leaves a short note alone', () => {
    expect(shouldSummarize(entry({ done: ['finished the export job'] }))).toBe(false);
  });

  it('summarises a note at the threshold', () => {
    expect(shouldSummarize(entry({ done: [line(SUMMARY_MIN_CHARS)] }))).toBe(true);
  });

  it('does not summarise one character below it', () => {
    expect(shouldSummarize(entry({ done: [line(SUMMARY_MIN_CHARS - 1)] }))).toBe(false);
  });

  it('adds up across sections to reach the threshold', () => {
    const third = Math.ceil(SUMMARY_MIN_CHARS / 3);
    const note = entry({
      done: [line(third)],
      todo: [line(third)],
      blockers: [{ text: line(third) }],
    });

    expect(shouldSummarize(note)).toBe(true);
  });
});

describe('noteSourceHash', () => {
  it('is stable for the same note', () => {
    const note = entry({ done: ['a'], todo: ['b'] });

    expect(noteSourceHash(note)).toBe(noteSourceHash(entry({ done: ['a'], todo: ['b'] })));
  });

  it('changes when a line changes', () => {
    expect(noteSourceHash(entry({ done: ['a'] }))).not.toBe(noteSourceHash(entry({ done: ['b'] })));
  });

  it('changes when a line moves between sections', () => {
    // The same words under a different heading is a different standup — "I did
    // this" and "I will do this" must not share a summary.
    expect(noteSourceHash(entry({ done: ['a'] }))).not.toBe(noteSourceHash(entry({ todo: ['a'] })));
  });

  it('changes when a blocker is added', () => {
    expect(noteSourceHash(entry({ done: ['a'] }))).not.toBe(
      noteSourceHash(entry({ done: ['a'], blockers: [{ text: 'ci is red' }] }))
    );
  });
});

describe('isSummaryFresh', () => {
  const note = entry({ done: ['pushed the pagination fix'], todo: ['pair with Jon'] });

  it('accepts a summary whose hash matches the note', () => {
    const withSummary = {
      ...note,
      aiSummary: { text: 'a summary', sourceHash: noteSourceHash(note) },
    };

    expect(isSummaryFresh(withSummary)).toBe(true);
  });

  it('rejects a summary generated from different text', () => {
    const edited = {
      ...note,
      done: ['pushed the pagination fix and reviewed #5'],
      aiSummary: { text: 'a summary', sourceHash: noteSourceHash(note) },
    };

    expect(isSummaryFresh(edited)).toBe(false);
  });

  it('rejects a summary with no hash recorded', () => {
    expect(isSummaryFresh({ ...note, aiSummary: { text: 'a summary' } })).toBe(false);
  });

  it('rejects empty text', () => {
    expect(
      isSummaryFresh({ ...note, aiSummary: { text: '', sourceHash: noteSourceHash(note) } })
    ).toBe(false);
  });

  it('rejects an entry with no summary at all', () => {
    expect(isSummaryFresh(note)).toBe(false);
    expect(isSummaryFresh(undefined)).toBe(false);
  });
});
