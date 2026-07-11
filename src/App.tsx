import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/hooks/useAuth'
import { UIProvider } from '@/hooks/useUI'
import Layout from '@/components/Layout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Escaneo from '@/pages/Escaneo'
import Inventario from '@/pages/Inventario'
import Usuarios from '@/pages/Usuarios'
import Fallas from '@/pages/Fallas'
import Consumibles from '@/pages/Consumibles'
import Transferencias from '@/pages/Transferencias'
import Historial from '@/pages/Historial'
import Configuracion from '@/pages/Configuracion'

function PrivateRoutes() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-400">
        Cargando…
      </div>
    )
  }

  if (!session) return <Login />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="/escaneo" element={<Escaneo />} />
        <Route path="/inventario" element={<Inventario />} />
        <Route path="/usuarios" element={<Usuarios />} />
        <Route path="/fallas" element={<Fallas />} />
        <Route path="/consumibles" element={<Consumibles />} />
        <Route path="/transferencias" element={<Transferencias />} />
        <Route path="/historial" element={<Historial />} />
        <Route path="/configuracion" element={<Configuracion />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <UIProvider>
          <PrivateRoutes />
        </UIProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
