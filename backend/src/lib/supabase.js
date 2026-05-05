const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ Supabase Storage not configured. Image uploads will fail. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
