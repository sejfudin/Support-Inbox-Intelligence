const crypto = require('crypto');
const { supabase, supabaseCvBucket } = require('../config/supabase');
const InternProfile = require('../models/InternProfile');
const Technology = require('../models/Technology');
const { extractPdfText } = require('../helpers/pdfText');
const { matchTechnologiesInText } = require('../helpers/cvTechnologyMatcher');
const { reconcileCvTechnologies } = require('../helpers/cvTechnologySync');

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

// Fresh arrays per call — callers hand these straight to the response, so a shared constant
// would let one request's mutation leak into the next.
const emptySync = () => ({ addedTechnologies: [], removedTechnologies: [] });

const namesForTechnologyIds = async (ids) => {
  if (!ids.length) return [];
  return Technology.find({ _id: { $in: ids } })
    .select('_id name slug')
    .lean();
};

// Best-effort: read the uploaded CV, recognize technologies from the canonical catalog, and
// bring the intern's list in line with it — adding what the CV mentions and removing what the
// *previous* scan added but this one no longer mentions, so a re-upload replaces rather than
// accumulates. Manual declarations are never touched (see helpers/cvTechnologySync.js).
// Mutates `profile.selfTechnologies` / `profile.cvTechnologies` (the caller saves) and returns
// both deltas.
//
// Recognition is a convenience, never a hard requirement — a corrupt PDF or missing text must
// not fail the CV upload, so this swallows its own errors and changes nothing on failure.
// Bailing out without touching the list matters on the remove path too: text we could not read
// is not evidence that the intern dropped a technology, so an unreadable re-upload must leave
// the previous scan's technologies in place rather than wipe them.
const syncTechnologiesFromCv = async (profile, buffer) => {
  try {
    const text = await extractPdfText(buffer);
    if (!text) return emptySync();

    const technologies = await Technology.find({ isActive: true }).select('_id name slug').lean();
    // No `if (!matched.length) return` guard: a readable CV that mentions nothing we recognize
    // is a real result, and it still has to clear what the previous scan left behind.
    const matched = matchTechnologiesInText(text, technologies);

    const next = reconcileCvTechnologies({
      selfTechnologies: profile.selfTechnologies || [],
      cvTechnologies: profile.cvTechnologies || [],
      matched,
    });

    // Resolved before the profile is touched, and deliberately the last await in this function:
    // everything that can throw has to happen while the list is still untouched, so the catch
    // below can honestly report "nothing changed". A removed technology is by definition absent
    // from the new match and may since have been deactivated, so the active-catalog lookup above
    // cannot name it.
    const removedTechnologies = await namesForTechnologyIds(next.removedTechnologyIds);

    // Adding has the same effect as a manual "Add a technology": no ReadinessFlag is created,
    // so each new technology reads as "Not assessed" until a mentor assesses it. Removing
    // mirrors a manual remove and likewise leaves any existing flag alone — a re-assessment
    // is the mentor's call, and keeping the flag means re-adding the technology restores it.
    profile.selfTechnologies = next.selfTechnologies;
    profile.cvTechnologies = next.cvTechnologies;

    return {
      addedTechnologies: next.addedTechnologies.map((t) => ({
        _id: t._id,
        name: t.name,
        slug: t.slug,
      })),
      removedTechnologies,
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
  const { addedTechnologies, removedTechnologies } = await syncTechnologiesFromCv(
    profile,
    file.buffer
  );
  await profile.save();

  return { cvPath: path, cvUrl: buildCvUrl(path), addedTechnologies, removedTechnologies };
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
