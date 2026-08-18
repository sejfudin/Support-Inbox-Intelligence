const { supabase, supabaseCvBucket } = require('../config/supabase');
const { extractPdfText } = require('../helpers/pdfText');
const { buildCvSummaryPrompt } = require('../prompts/internCvPrompts');
const { createAiServiceError, requestGroqOutputText } = require('./groqAiClient');
const {
  assertInternAccess,
  canWriteMentorData,
  canReadMentorAssessment,
} = require('../helpers/internAccess');
const { httpError } = require('../helpers/httpError');

/**
 * The AI read of an intern's uploaded CV, for the profile overview.
 *
 * Generated on demand and cached on the profile, never on upload: uploading is
 * the intern's action and they never see this text, so making them wait on a
 * model call would charge the cost to the wrong person — and to every upload,
 * including the profiles nobody opens.
 *
 * The cache key is the `cvPath` the summary was made from. A re-upload writes a
 * new path, so the stored summary is recognised as stale rather than served
 * against a CV it never read.
 *
 * Reading and generating are gated differently. Reading is
 * `canReadMentorAssessment` — admin, leadership, or the assigned mentor; not the
 * broader `canViewInternProfile` that `assertInternAccess` grants by default,
 * because that default includes the intern viewing their own profile, which is
 * exactly who this must NOT be shown to (see the route). Generating additionally
 * requires `canWriteMentorData`, so leadership reads a summary but never spends
 * the model call: it is a write to the profile, and leadership writes nothing
 * here. `assertInternAccess` is still called first either way, for the
 * 404-on-missing-profile behaviour every other intern-scoped endpoint gets.
 */

// Enough of a CV to summarise, bounded so a pathological PDF cannot push an
// unbounded prompt at the provider. Two pages of dense text sit well under this;
// a CV that runs past it is padded, and the tail is the least informative part.
const MAX_CV_CHARS = 12000;

// The model occasionally wraps prose in a fence or a "Summary:" lead-in despite
// being told not to. Cheaper to strip here than to re-prompt.
const sanitizeSummary = (value) =>
  String(value || '')
    .trim()
    .replace(/^```(?:text|markdown)?\s*/i, '')
    .replace(/```$/i, '')
    .replace(/^\s*summary\s*:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();

const assertCanReadCvSummary = (actor, profile) => {
  if (!canReadMentorAssessment(actor, profile)) {
    throw httpError("Not authorized to access this intern's CV summary", 403);
  }
};

const assertCanGenerateCvSummary = (actor, profile) => {
  if (!canWriteMentorData(actor, profile)) {
    throw httpError("Not authorized to generate this intern's CV summary", 403);
  }
};

const downloadCv = async (cvPath) => {
  const { data, error } = await supabase.storage.from(supabaseCvBucket).download(cvPath);
  if (error || !data) throw httpError('Could not read the uploaded CV.', 502);
  return Buffer.from(await data.arrayBuffer());
};

const toSummaryPayload = (profile) => ({
  summary: profile.cvSummary || null,
  generatedAt: profile.cvSummaryAt || null,
  hasCv: Boolean(profile.cvPath),
  // Whether the cached text describes the CV currently on file. The client uses
  // this to label a summary as out of date instead of silently showing a
  // description of a document that has since been replaced.
  isStale: Boolean(profile.cvSummary) && profile.cvSummaryFor !== profile.cvPath,
});

/** The cached summary, or an empty payload. Never calls the model. */
const getCvSummary = async (actor, internUserId) => {
  const profile = await assertInternAccess(actor, internUserId);
  assertCanReadCvSummary(actor, profile);
  return toSummaryPayload(profile);
};

/**
 * Generate (or regenerate) the summary and cache it.
 *
 * Unlike the technology scan in `internCvService`, this does NOT swallow its
 * failures: it runs because someone pressed a button and is waiting for the
 * result, so a failure has to reach them. The scan's silence is right for its
 * own case — it rides along with an upload nobody asked it to affect.
 */
const generateCvSummary = async (actor, internUserId) => {
  const profile = await assertInternAccess(actor, internUserId);
  assertCanGenerateCvSummary(actor, profile);

  if (!profile.cvPath) {
    throw httpError('This intern has not uploaded a CV.', 400);
  }

  // Captured before the download so the stamp below records the path actually
  // read: a CV replaced mid-generation must not leave the new path pointing at a
  // summary of the old document.
  const readCvPath = profile.cvPath;
  const buffer = await downloadCv(readCvPath);
  const text = await extractPdfText(buffer);

  if (!text.trim()) {
    throw httpError('No readable text in the uploaded CV — it may be a scan or an image.', 422);
  }

  // `assertInternAccess` returns the profile unpopulated; the name is only worth
  // a lookup once we know there is text to summarise.
  await profile.populate({ path: 'user', select: 'fullname' });

  const output = await requestGroqOutputText({
    prompt: buildCvSummaryPrompt({
      text: text.slice(0, MAX_CV_CHARS),
      fullname: profile.user?.fullname,
    }),
  });

  const summary = sanitizeSummary(output);
  if (!summary) throw createAiServiceError('AI returned an empty summary.', 502);

  profile.cvSummary = summary;
  profile.cvSummaryFor = readCvPath;
  profile.cvSummaryAt = new Date();
  await profile.save();

  return toSummaryPayload(profile);
};

module.exports = {
  getCvSummary,
  generateCvSummary,
};
