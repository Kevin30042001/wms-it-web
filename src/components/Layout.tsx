import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  Users,
  TriangleAlert,
  Tags,
  ArrowLeftRight,
  ScrollText,
  Settings,
  ScanBarcode,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import GlobalScan from '@/components/GlobalScan'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/inventario', label: 'Inventario', icon: Package },
  { to: '/usuarios', label: 'Usuarios', icon: Users },
  { to: '/fallas', label: 'Fallas', icon: TriangleAlert },
  { to: '/consumibles', label: 'Consumibles', icon: Tags },
  { to: '/transferencias', label: 'Transferencias', icon: ArrowLeftRight },
  { to: '/historial', label: 'Historial', icon: ScrollText },
  { to: '/configuracion', label: 'Configuración', icon: Settings },
]

function abrirBuscador() {
  window.dispatchEvent(new CustomEvent('wms:open-search'))
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex-1 space-y-0.5 px-3">
      {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-white/10 text-white'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
            }`
          }
        >
          {({ isActive }) => (
            <>
              {/* Indicador amarillo del módulo activo */}
              <span
                className={`absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-wmyellow transition-opacity ${
                  isActive ? 'opacity-100' : 'opacity-0'
                }`}
              />
              <Icon size={17} className="shrink-0" />
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

export default function Layout() {
  const { user, signOut } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const brand = (
    <div className="flex items-center gap-2.5 px-5 py-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-wmyellow font-display text-sm font-bold text-ink">
        IT
      </div>
      <div className="leading-tight">
        <p className="font-display text-lg font-bold uppercase tracking-wider text-white">
          WMS<span className="text-wmyellow">·</span>IT
        </p>
        <p className="text-[10px] uppercase tracking-widest text-slate-500">
          Hortifruti · Santa Tecla
        </p>
      </div>
    </div>
  )

  const searchButton = (
    <button
      onClick={abrirBuscador}
      className="mx-3 mb-3 flex items-center gap-2.5 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-400 transition-colors hover:border-white/20 hover:text-slate-200"
    >
      <ScanBarcode size={16} />
      <span className="flex-1 text-left">Buscar / escanear</span>
      <kbd className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-500">
        Ctrl K
      </kbd>
    </button>
  )

  const userFooter = (
    <div className="border-t border-white/10 p-3">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-wmblue text-[11px] font-semibold text-white">
          {user?.email?.[0]?.toUpperCase() ?? '?'}
        </div>
        <span className="min-w-0 flex-1 truncate text-xs text-slate-400">{user?.email}</span>
        <button
          onClick={() => signOut()}
          className="rounded p-1.5 text-slate-500 transition-colors hover:bg-white/10 hover:text-white"
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
        >
          <LogOut size={15} />
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-surface">
      {/* ── Sidebar escritorio ── */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col bg-ink lg:flex">
        {brand}
        {searchButton}
        <NavItems />
        {userFooter}
      </aside>

      {/* ── Barra superior móvil ── */}
      <header className="sticky top-0 z-40 flex items-center justify-between bg-ink px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-wmyellow font-display text-xs font-bold text-ink">
            IT
          </div>
          <span className="font-display text-base font-bold uppercase tracking-wider text-white">
            WMS<span className="text-wmyellow">·</span>IT
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={abrirBuscador}
            className="rounded p-2 text-slate-300 hover:bg-white/10"
            aria-label="Buscar o escanear"
          >
            <ScanBarcode size={19} />
          </button>
          <button
            onClick={() => setDrawerOpen(true)}
            className="rounded p-2 text-slate-300 hover:bg-white/10"
            aria-label="Abrir menú"
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      {/* ── Drawer móvil ── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setDrawerOpen(false)}>
          <div className="absolute inset-0 bg-ink/60" />
          <div
            className="absolute inset-y-0 left-0 flex w-64 flex-col bg-ink shadow-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pr-3">
              {brand}
              <button
                onClick={() => setDrawerOpen(false)}
                className="rounded p-2 text-slate-400 hover:bg-white/10"
                aria-label="Cerrar menú"
              >
                <X size={18} />
              </button>
            </div>
            <NavItems onNavigate={() => setDrawerOpen(false)} />
            {userFooter}
          </div>
        </div>
      )}

      {/* ── Contenido ── */}
      <main className="mx-auto max-w-7xl px-4 py-6 lg:pl-[17rem] lg:pr-8">
        <Outlet />
      </main>

      <GlobalScan />
    </div>
  )
}
