const { createClient } = require('@supabase/supabase-js');

const requiredEnv = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
const missing = requiredEnv.filter((key) => !process.env[key]);

if (missing.length > 0) {
  throw new Error(
    `Configuration Supabase incomplète. Variables manquantes: ${missing.join(
      ', ',
    )}. Vérifiez votre fichier .env`
  );
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Pour les opérations admin, utiliser la clé service role
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

module.exports = { supabase, supabaseAdmin };
