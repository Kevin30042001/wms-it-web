import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthContextValue {
  session: Session | null
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error) return { error: null }

    // Un "Failed to fetch" / AuthRetryableFetchError significa que el
    // navegador no pudo ni siquiera llegar a Supabase (VPN, proxy, sin
    // internet...). Mostrarlo como "contraseña incorrecta" confunde: la
    // contraseña nunca se llegó a validar.
    const esErrorDeRed = error.name === 'AuthRetryableFetchError' || /fetch/i.test(error.message)
    if (esErrorDeRed) {
      return {
        error: 'No se pudo conectar con el servidor. Revisa tu conexión a internet o VPN e intenta de nuevo.',
      }
    }
    if (/invalid login credentials/i.test(error.message)) {
      return { error: 'Correo o contraseña incorrectos.' }
    }
    return { error: error.message }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
