import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cfg = window.APP_CONFIG || {};

if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
  throw new Error('Falta window.APP_CONFIG con SUPABASE_URL y SUPABASE_ANON_KEY');
}

export const supabase = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

export const APP_CONFIG = cfg;
