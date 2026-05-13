const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseBucket = process.env.SUPABASE_BUCKET;

if (!supabaseUrl) throw new Error('Missing SUPABASE_URL');
if (!supabaseServiceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
if (!supabaseBucket) throw new Error('Missing SUPABASE_BUCKET');

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
});

module.exports = { 
    supabase,
    supabaseBucket
};

