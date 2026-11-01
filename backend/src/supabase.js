require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
  if (!process.env[k]) { console.error(`Missing required env var ${k}. Copy .env.example to .env.`); process.exit(1); }
}

// Service-role client: bypasses RLS, so every route MUST enforce authorization itself (see lib.js).
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

module.exports = { admin, BUCKET: 'report-photos' };
