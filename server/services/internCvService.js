const crypto = require('crypto');
const { supabase, supabaseCvBucket } = require('../config/supabase');
const InternProfile = require('../models/InternProfile');
const Technology = require('../models/Technology');
const { extractPdfText } = require('../helpers/pdfText');
const { matchTechnologiesInText } = require('../helpers/cvTechnologyMatcher');
const { mergeCvTechnologies } = require('../helpers/cvTechnologySync');

const buildInternCvPath = (userId) => {
  const ts = Date.now();
  const random = crypto.randomBytes(6).toString('hex');
  return `interns/${userId}/cv/${ts}-${random}.pdf`;
};

const buildCvUrl = (cvPath) => {
  if (!cvPath) return null;
  const { data } = supabase.storage.from(supabaseCvBucket).getPublicUrl(cvPath);
  return data?.publicUrl || null;
};

const removeCvFromStorage = async (cvPath) => {
  if (!cvPath) return;
  await supabase.storage.from(supabaseCvBucket).remove([cvPath]);
};

// Fresh array per call — callers hand this straight to the response, so a shared constant
// would let one request's mutation leak into the next.
const emptySync = () => ({ addedTechnologies: [] });

// Best-effort: read the uploaded CV, recognize technologies from the canonical catalog, and add
// the ones the intern has not declared yet. Adding is all a scan ever does — a re-upload never
// removes, so nothing the intern has on their list can disappear because a newer PDF spells their
// skills differently, omits a section, or turns out to be unreadable (see helpers/cvTechnologySync.js).
// Mutates `profile.selfTechnologies` (the caller saves) and returns what it added.
//
// Recognition is a convenience, never a hard requirement — a corrupt PDF or missing text must
// not fail the CV upload, so this swallows its own errors and changes nothing on failure.
const syncTechnologiesFromCv = async (profile, buffer) => {
  try {
    const text = await extractPdfText(buffer);
    if (!text) return emptySync();

    const technologies = await Technology.find({ isActive: true }).select('_id name slug').lean();
    const matched = matchTechnologiesInText(text, technologies);

    const next = mergeCvTechnologies({
      selfTechnologies: profile.selfTechnologies || [],
      matched,
    });

    // Adding has the same effect as a manual "Add a technology": no ReadinessFlag is created,
    // so each new technology reads as "Not assessed" until a mentor assesses it.
    profile.selfTechnologies = next.selfTechnologies;

    return {
      addedTechnologies: next.addedTechnologies.map((t) => ({
        _id: t._id,
        name: t.name,
        slug: t.slug,
      })),
    };
  } catch {
    return emptySync();
  }
};

const uploadInternCv = async ({ userId, file }) => {
  const profile = await InternProfile.findOne({ user: userId });
  if (!profile) throw new Error('Intern profile not found');

  const path = buildInternCvPath(userId);
  const { error } = await supabase.storage.from(supabaseCvBucket).upload(path, file.buffer, {
    contentType: file.mimetype,
    upsert: false,
  });

  if (error) throw new Error(error.message || 'Failed to upload CV');

  if (profile.cvPath && profile.cvPath !== path) {
    await removeCvFromStorage(profile.cvPath);
  }

  profile.cvPath = path;
  const { addedTechnologies } = await syncTechnologiesFromCv(profile, file.buffer);
  await profile.save();

  return { cvPath: path, cvUrl: buildCvUrl(path), addedTechnologies };
};

const deleteInternCv = async (userId) => {
  const profile = await InternProfile.findOne({ user: userId });
  if (!profile) throw new Error('Intern profile not found');

  if (profile.cvPath) {
    await removeCvFromStorage(profile.cvPath);
    profile.cvPath = null;
    // The AI summary goes with the file. Staleness alone would not cover this:
    // deleting a CV is the intern withdrawing the document, and a description of
    // it left on the profile would outlive the thing they withdrew.
    //
    // A re-upload deliberately does NOT clear it here — the summary is still a
    // true description of a CV they had, so it stays visible and marked stale
    // until someone regenerates, rather than the panel emptying itself.
    profile.cvSummary = null;
    profile.cvSummaryFor = null;
    profile.cvSummaryAt = null;
    await profile.save();
  }

  return { cvPath: null, cvUrl: null };
};

module.exports = {
  buildCvUrl,
  uploadInternCv,
  deleteInternCv,
};
