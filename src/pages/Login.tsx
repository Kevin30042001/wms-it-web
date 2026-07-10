import { useState, type FormEvent } from 'react'
import { ScanBarcode } from 'lucide-react'
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
    <div className="flex min-h-screen items-center justify-center bg-ink px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-wmyellow font-display text-2xl font-bold text-ink">
            IT
          </div>
          <h1 className="font-display text-3xl font-bold uppercase tracking-wider text-white">
            WMS<span className="text-wmyellow">·</span>IT
          </h1>
          <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-slate-500">
            Hortifruti · CD Santa Tecla
          </p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-xl bg-white p-6 shadow-pop">
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
            <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
          <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-500">
          <ScanBarcode size={13} />
          Sistema de inventario TI · Walmart El Salvador
        </p>
      </div>
    </div>
  )
}
