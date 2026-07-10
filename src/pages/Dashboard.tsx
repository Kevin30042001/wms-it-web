import { useEffect, useState } from 'react'
import { Pie, Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js'
import { supabase } from '@/lib/supabase'
import type { DashboardKPIs, EquiposPorEstado, EquiposPorTipo, HistorialEntry } from '@/types/database'

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend)

const ESTADO_COLOR: Record<string, string> = {
  Operativo: '#22A055',
  'En reparación': '#E8710A',
  'Fuera de servicio': '#D93025',
  'En bodega': '#0070CE',
  'Reportado con falla': '#F59E0B',
  Transferido: '#6B7280',
}

function KpiCard({ label, value, accent }: { label: string; value: number | string; accent: string }) {
  return (
    <div className="card">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold" style={{ color: accent }}>
        {value}
      </p>
    </div>
  )
}

export default function Dashboard() {
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null)
  const [porEstado, setPorEstado] = useState<EquiposPorEstado[]>([])
  const [porTipo, setPorTipo] = useState<EquiposPorTipo[]>([])
  const [ultimos, setUltimos] = useState<HistorialEntry[]>([])
  const [loading, setLoading] = useState(true)

  async function cargar() {
    setLoading(true)
    const [kpisRes, estadoRes, tipoRes, histRes] = await Promise.all([
      supabase.from('v_dashboard_kpis').select('*').single(),
      supabase.from('v_equipos_por_estado').select('*'),
      supabase.from('v_equipos_por_tipo').select('*'),
      supabase.from('historial').select('*').order('fecha_hora', { ascending: false }).limit(5),
    ])
    if (kpisRes.data) setKpis(kpisRes.data as DashboardKPIs)
    if (estadoRes.data) setPorEstado(estadoRes.data as EquiposPorEstado[])
    if (tipoRes.data) setPorTipo(tipoRes.data as EquiposPorTipo[])
    if (histRes.data) setUltimos(histRes.data as HistorialEntry[])
    setLoading(false)
  }

  useEffect(() => {
    cargar()

    // Realtime: si cualquier técnico cambia algo, el dashboard se refresca solo
    const channel = supabase
      .channel('dashboard-cambios')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'equipos' }, cargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fallas' }, cargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'consumibles' }, cargar)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  if (loading) return <p className="text-slate-400">Cargando dashboard…</p>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Panel de control</h1>
        <p className="text-sm text-slate-500">Resumen general — Hortifruti CD Santa Tecla</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <KpiCard label="Total equipos" value={kpis?.total_equipos ?? 0} accent="#0070CE" />
        <KpiCard label="Operativos" value={kpis?.equipos_operativos ?? 0} accent="#22A055" />
        <KpiCard label="En reparación" value={kpis?.equipos_reparacion ?? 0} accent="#E8710A" />
        <KpiCard label="Fuera de servicio" value={kpis?.equipos_fuera_servicio ?? 0} accent="#D93025" />
        <KpiCard label="Con falla activa" value={kpis?.equipos_con_falla ?? 0} accent="#F59E0B" />
        <KpiCard label="Consumibles en alerta" value={kpis?.consumibles_alerta ?? 0} accent="#D93025" />
        <KpiCard label="Transferencias del mes" value={kpis?.transferencias_mes ?? 0} accent="#0070CE" />
        <KpiCard label="Baterías en pool" value={kpis?.baterias_pool ?? 0} accent="#6B7280" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Equipos por estado</h2>
          {porEstado.length === 0 ? (
            <p className="text-sm text-slate-400">Sin datos todavía.</p>
          ) : (
            <Pie
              data={{
                labels: porEstado.map((e) => e.estado),
                datasets: [
                  {
                    data: porEstado.map((e) => e.cantidad),
                    backgroundColor: porEstado.map((e) => ESTADO_COLOR[e.estado] ?? '#94A3B8'),
                  },
                ],
              }}
              options={{ plugins: { legend: { position: 'bottom' } } }}
            />
          )}
        </div>

        <div className="card">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Equipos por tipo</h2>
          {porTipo.length === 0 ? (
            <p className="text-sm text-slate-400">Sin datos todavía.</p>
          ) : (
            <Bar
              data={{
                labels: porTipo.map((t) => t.tipo),
                datasets: [{ data: porTipo.map((t) => t.cantidad), backgroundColor: '#0070CE' }],
              }}
              options={{ plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }}
            />
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Últimas actividades</h2>
        {ultimos.length === 0 ? (
          <p className="text-sm text-slate-400">Sin actividad registrada aún.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {ultimos.map((h) => (
              <li key={h.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <span className="font-medium text-slate-700">{h.accion}</span>{' '}
                  <span className="text-slate-500">{h.referencia}</span>
                </div>
                <span className="text-xs text-slate-400">
                  {new Date(h.fecha_hora).toLocaleString('es-SV')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
