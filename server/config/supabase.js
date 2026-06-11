const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAttachmentBucket = process.env.SUPABASE_ATTACHMENT_BUCKET;
const supabaseWorkspaceLogoBucket = process.env.SUPABASE_WORKSPACE_LOGO_BUCKET;
const supabaseCvBucket = process.env.SUPABASE_CV_BUCKET || supabaseWorkspaceLogoBucket;

if (!supabaseUrl) throw new Error('Missing SUPABASE_URL');
if (!supabaseServiceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
if (!supabaseAttachmentBucket) throw new Error('Missing SUPABASE_ATTACHMENT_BUCKET');
if (!supabaseWorkspaceLogoBucket) throw new Error('Missing SUPABASE_WORKSPACE_LOGO_BUCKET');

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

module.exports = {
  supabase,
  supabaseBucket: supabaseAttachmentBucket,
  supabaseWorkspaceLogoBucket,
  supabaseCvBucket,
};
