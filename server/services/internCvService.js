const crypto = require('crypto');
const { supabase, supabaseCvBucket } = require('../config/supabase');
const InternProfile = require('../models/InternProfile');
const Technology = require('../models/Technology');
const { extractPdfText } = require('../helpers/pdfText');
const { matchTechnologiesInText } = require('../helpers/cvTechnologyMatcher');

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

// Best-effort: read the uploaded CV, recognize technologies from the canonical catalog,
// and add any not already declared to the intern's list. Mutates `profile.selfTechnologies`
// (the caller saves) and returns the technologies it added. Recognition is a convenience,
// never a hard requirement — a corrupt PDF or missing text must not fail the CV upload, so
// this swallows its own errors and returns [] on any failure.
const autoDeclareTechnologiesFromCv = async (profile, buffer) => {
  try {
    const text = await extractPdfText(buffer);
    if (!text) return [];

    const technologies = await Technology.find({ isActive: true }).select('_id name slug').lean();
    const matched = matchTechnologiesInText(text, technologies);
    if (!matched.length) return [];

    const existing = new Set((profile.selfTechnologies || []).map((id) => String(id)));
    const added = matched.filter((tech) => !existing.has(String(tech._id)));
    if (!added.length) return [];

    // Same effect as a manual "Add a technology": push the ref. No ReadinessFlag is created,
    // so each new technology reads as "Not assessed" until a mentor assesses it.
    profile.selfTechnologies = [...(profile.selfTechnologies || []), ...added.map((t) => t._id)];

    return added.map((t) => ({ _id: t._id, name: t.name, slug: t.slug }));
  } catch {
    return [];
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
  const addedTechnologies = await autoDeclareTechnologiesFromCv(profile, file.buffer);
  await profile.save();

  return { cvPath: path, cvUrl: buildCvUrl(path), addedTechnologies };
};

const deleteInternCv = async (userId) => {
  const profile = await InternProfile.findOne({ user: userId });
  if (!profile) throw new Error('Intern profile not found');

  if (profile.cvPath) {
    await removeCvFromStorage(profile.cvPath);
    profile.cvPath = null;
    await profile.save();
  }

  return { cvPath: null, cvUrl: null };
};

module.exports = {
  buildCvUrl,
  uploadInternCv,
  deleteInternCv,
};
