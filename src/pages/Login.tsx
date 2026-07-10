import { useState, type FormEvent } from 'react'
import { useAuth } from '@/hooks/useAuth'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) setError('Correo o contraseña incorrectos.')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-wmblue-dark px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-wmyellow text-2xl font-black text-wmblue-dark">
            IT
          </div>
          <h1 className="text-2xl font-bold text-white">
            WMS<span className="text-wmyellow">·</span>IT
          </h1>
          <p className="mt-1 text-sm text-white/60">Hortifruti CD Santa Tecla</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-6 shadow-xl">
          <div className="mb-4">
            <label className="label">Correo</label>
            <input
              type="email"
              required
              autoFocus
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tecnico@hortifruti.com"
            />
          </div>
          <div className="mb-4">
            <label className="label">Contraseña</label>
            <input
              type="password"
              required
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {error && (
            <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
          <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-white/40">
          ¿No tienes cuenta? Pídele al administrador que la cree en Supabase.
        </p>
      </div>
    </div>
  )
}
