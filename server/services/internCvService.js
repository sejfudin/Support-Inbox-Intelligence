const crypto = require('crypto');
const { supabase, supabaseWorkspaceLogoBucket } = require('../config/supabase');
const InternProfile = require('../models/InternProfile');

const buildInternCvPath = (userId) => {
  const ts = Date.now();
  const random = crypto.randomBytes(6).toString('hex');
  return `interns/${userId}/cv/${ts}-${random}.pdf`;
};

const buildCvUrl = (cvPath) => {
  if (!cvPath) return null;
  const { data } = supabase.storage.from(supabaseWorkspaceLogoBucket).getPublicUrl(cvPath);
  return data?.publicUrl || null;
};

const removeCvFromStorage = async (cvPath) => {
  if (!cvPath) return;
  await supabase.storage.from(supabaseWorkspaceLogoBucket).remove([cvPath]);
};

const uploadInternCv = async ({ userId, file }) => {
  const profile = await InternProfile.findOne({ user: userId });
  if (!profile) throw new Error('Intern profile not found');

  const path = buildInternCvPath(userId);
  const { error } = await supabase.storage
    .from(supabaseWorkspaceLogoBucket)
    .upload(path, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (error) throw new Error(error.message || 'Failed to upload CV');

  if (profile.cvPath && profile.cvPath !== path) {
    await removeCvFromStorage(profile.cvPath);
  }

  profile.cvPath = path;
  await profile.save();

  return { cvPath: path, cvUrl: buildCvUrl(path) };
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
