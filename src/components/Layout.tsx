import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: '📊', end: true },
  { to: '/inventario', label: 'Inventario', icon: '📦' },
  { to: '/usuarios', label: 'Usuarios', icon: '👤' },
  { to: '/fallas', label: 'Fallas', icon: '⚠️' },
  { to: '/consumibles', label: 'Consumibles', icon: '🏷️' },
  { to: '/transferencias', label: 'Transferencias', icon: '🔀' },
  { to: '/historial', label: 'Historial', icon: '📋' },
  { to: '/configuracion', label: 'Config', icon: '⚙️' },
]

export default function Layout() {
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-wmblue-dark">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-wmyellow text-sm font-black text-wmblue-dark">
              IT
            </div>
            <span className="font-bold text-white">
              WMS<span className="text-wmyellow">·</span>IT
            </span>
            <span className="hidden text-xs text-white/50 sm:inline">Hortifruti Santa Tecla</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-white/70 sm:inline">{user?.email}</span>
            <button onClick={() => signOut()} className="btn-secondary !bg-white/10 !text-white hover:!bg-white/20">
              Salir
            </button>
          </div>
        </div>

        <nav className="mx-auto max-w-7xl overflow-x-auto px-4 pb-2">
          <div className="flex gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive ? 'bg-wmyellow text-wmblue-dark' : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <span>{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
