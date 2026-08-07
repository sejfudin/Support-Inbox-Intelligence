const Daily = require('../models/Daily');
const { ROLES } = require('../constants/roles');
const { startOfDay } = require('../helpers/dailyRules');
const { noteSourceHash, shouldSummarize, isSummaryFresh } = require('../helpers/standupNote');
const { buildStandupSummaryPrompt } = require('../prompts/standupPrompts');
const { resolveActiveWorkspaceId } = require('../helpers/workspaceAuthz');
const { createAiServiceError, requestGroqOutputText } = require('./groqAiClient');
const { httpError } = require('../helpers/httpError');

/** Strip fences and collapse whitespace — same shaping `aiSummaryService` applies. */
const sanitizeSummaryText = (value) =>
  String(value || '')
    .trim()
    .replace(/^```(?:text|markdown)?\s*/i, '')
    .replace(/```$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Summarise the signed-in intern's own standup note for today.
 *
 * Self-scoped like the rest of the intern dashboard: the subject is `req.user`
 * and the entry is located by matching `entry.member` against it, so there is no
 * id to tamper with and no path to anyone else's note. An intern can only ever
 * summarise what they themselves wrote.
 *
 * Idempotent and cached. A fresh summary short-circuits before the Groq call, so
 * the dashboard mounting twice costs one request, not two — and re-reading the
 * board all day costs nothing. Editing the note changes `sourceHash`, which is
 * what lets the next read regenerate rather than serve a stale paraphrase.
 */
const summarizeOwnStandup = async (user) => {
  if (user.role !== ROLES.INTERN) {
    throw httpError('Not authorized', 403);
  }
  // Verified, not trusted: `user.workspaceId` is a pointer that outlives the
  // membership behind it, and this path *writes* (and spends a Groq call). A
  // stale pointer resolves to `null` here rather than saving into a workspace
  // the caller has left. See `helpers/workspaceAuthz.js`.
  const workspaceId = await resolveActiveWorkspaceId({ user });
  if (!workspaceId) {
    throw httpError('You have no active workspace.', 400);
  }

  const today = startOfDay(new Date());
  const daily = await Daily.findOne({ workspace: workspaceId, date: today });
  if (!daily) {
    throw httpError('There is no standup for today yet.', 404);
  }

  const entry = daily.entries.find((item) => String(item.member) === String(user._id));
  if (!entry) {
    throw httpError('You have not written a standup note today.', 404);
  }

  // Guard the threshold on the server too. The client only asks when it believes
  // the note is long, but the rule that decides what counts as long has to live
  // in one place — otherwise a client-side change quietly starts billing AI calls
  // for two-line notes.
  if (!shouldSummarize(entry)) {
    throw httpError('This note is short enough to read in full.', 422);
  }

  if (isSummaryFresh(entry)) {
    return {
      summary: entry.aiSummary.text,
      generatedAt: entry.aiSummary.generatedAt,
      cached: true,
    };
  }

  const prompt = buildStandupSummaryPrompt({
    done: entry.done || [],
    todo: entry.todo || [],
    blockers: (entry.blockers || []).map((blocker) => blocker.text),
  });

  const summary = sanitizeSummaryText(await requestGroqOutputText({ prompt }));
  if (!summary) {
    throw createAiServiceError('AI generated an empty summary.', 502);
  }

  const generatedAt = new Date();
  // Hashed from the entry as it is right now, not from what the client sent — a
  // note edited while the AI call was in flight must not be stamped as summarised.
  entry.aiSummary = { text: summary, sourceHash: noteSourceHash(entry), generatedAt };
  await daily.save();

  return { summary, generatedAt, cached: false };
};

module.exports = { summarizeOwnStandup };
