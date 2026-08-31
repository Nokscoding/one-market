import { createClient } from '@supabase/supabase-js'

/**
 * Connexion navigateur vers Supabase.
 *
 * RÈGLE DE SÉCURITÉ :
 * - seule la Publishable Key / anon key doit être utilisée dans le frontend ;
 * - ne JAMAIS placer la service_role key ou une clé secrète dans ce fichier ;
 * - les permissions réelles sont imposées côté Supabase avec RLS.
 *
 * Configuration : copier .env.example vers .env.local puis renseigner les
 * variables VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY.
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Configuration Supabase manquante. Copiez .env.example vers .env.local et renseignez VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
