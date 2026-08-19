const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAttachmentBucket = process.env.SUPABASE_ATTACHMENT_BUCKET;
const supabaseWorkspaceLogoBucket = process.env.SUPABASE_WORKSPACE_LOGO_BUCKET;
const supabaseCvBucket = process.env.SUPABASE_CV_BUCKET || supabaseWorkspaceLogoBucket;

// Required, not defaulted to the workspace-logo bucket.
//
// Falling back there was tried and does not work: that bucket is configured for
// logos, which means a 1MB object limit and a MIME allow-list without WEBP. A
// valid 1.5MB JPEG and every WEBP came back as a 502 from Supabase — a profile
// picture the app had already accepted, refused by storage. A misconfigured
// bucket has to fail at startup with a message that says what to do, not per
// upload with a number nobody can trace back to a bucket setting.
const supabaseProfileBucket = process.env.SUPABASE_PROFILE_BUCKET;

if (!supabaseUrl) throw new Error('Missing SUPABASE_URL');
if (!supabaseServiceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
if (!supabaseAttachmentBucket) throw new Error('Missing SUPABASE_ATTACHMENT_BUCKET');
if (!supabaseWorkspaceLogoBucket) throw new Error('Missing SUPABASE_WORKSPACE_LOGO_BUCKET');
if (!supabaseProfileBucket)
  throw new Error(
    'Missing SUPABASE_PROFILE_BUCKET — create a public bucket that allows image/jpeg, ' +
      'image/png and image/webp up to 2MB, and set this to its name.'
  );

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

module.exports = {
  supabase,
  supabaseBucket: supabaseAttachmentBucket,
  supabaseWorkspaceLogoBucket,
  supabaseCvBucket,
  supabaseProfileBucket,
};
