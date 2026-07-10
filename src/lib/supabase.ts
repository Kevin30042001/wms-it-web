import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Faltan las variables de entorno VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
      'Revisa tu archivo .env (local) o la configuración de Environment Variables en Vercel.'
  )
}

// Nota: no tipamos el cliente con el genérico Database<> completo (requeriría
// mantener a mano el esquema exacto de Postgres). Usamos los tipos de
// src/types/database.ts para tipar manualmente los resultados en cada página.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})
