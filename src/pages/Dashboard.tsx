import { useEffect, useState, type ComponentType } from 'react'
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
import {
  Package,
  CircleCheck,
  Wrench,
  CircleX,
  TriangleAlert,
  Tags,
  ArrowLeftRight,
  BatteryFull,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { DashboardKPIs, EquiposPorEstado, EquiposPorTipo, HistorialEntry } from '@/types/database'

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend)

const ESTADO_COLOR: Record<string, string> = {
  Operativo: '#1E9E55',
  'En reparación': '#E8710A',
  'Fuera de servicio': '#D93025',
  'En bodega': '#0070CE',
  'Reportado con falla': '#B45309',
  Transferido: '#6B7280',
}

interface KpiDef {
  label: string
  value: number
  icon: ComponentType<{ size?: number | string; className?: string }>
  accent: string
  bg: string
}

function KpiCard({ label, value, icon: Icon, accent, bg }: KpiDef) {
  return (
    <div className="card flex items-center gap-3">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${bg}`}>
        <Icon size={19} className={accent} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </p>
        <p className="font-display text-2xl font-bold leading-tight text-slate-900">{value}</p>
      </div>
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
    const [kpisRes, estadoRes, tipoRes, histRes] = await Promise.all([
      supabase.from('v_dashboard_kpis').select('*').single(),
      supabase.from('v_equipos_por_estado').select('*'),
      supabase.from('v_equipos_por_tipo').select('*'),
      supabase.from('historial').select('*').order('fecha_hora', { ascending: false }).limit(6),
    ])
    if (kpisRes.data) setKpis(kpisRes.data as DashboardKPIs)
    if (estadoRes.data) setPorEstado(estadoRes.data as EquiposPorEstado[])
    if (tipoRes.data) setPorTipo(tipoRes.data as EquiposPorTipo[])
    if (histRes.data) setUltimos(histRes.data as HistorialEntry[])
    setLoading(false)
  }

  useEffect(() => {
    cargar()
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

  const tarjetas: KpiDef[] = [
    { label: 'Total equipos', value: kpis?.total_equipos ?? 0, icon: Package, accent: 'text-wmblue', bg: 'bg-blue-50' },
    { label: 'Operativos', value: kpis?.equipos_operativos ?? 0, icon: CircleCheck, accent: 'text-estado-operativo', bg: 'bg-green-50' },
    { label: 'En reparación', value: kpis?.equipos_reparacion ?? 0, icon: Wrench, accent: 'text-estado-reparacion', bg: 'bg-orange-50' },
    { label: 'Fuera de servicio', value: kpis?.equipos_fuera_servicio ?? 0, icon: CircleX, accent: 'text-estado-fuera', bg: 'bg-red-50' },
    { label: 'Con falla activa', value: kpis?.equipos_con_falla ?? 0, icon: TriangleAlert, accent: 'text-estado-falla', bg: 'bg-amber-50' },
    { label: 'Consumibles en alerta', value: kpis?.consumibles_alerta ?? 0, icon: Tags, accent: 'text-estado-fuera', bg: 'bg-red-50' },
    { label: 'Transferencias del mes', value: kpis?.transferencias_mes ?? 0, icon: ArrowLeftRight, accent: 'text-wmblue', bg: 'bg-blue-50' },
    { label: 'Baterías en pool', value: kpis?.baterias_pool ?? 0, icon: BatteryFull, accent: 'text-slate-500', bg: 'bg-slate-100' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Panel de control</h1>
        <p className="page-sub">Resumen general — Hortifruti CD Santa Tecla</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton h-[74px]" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {tarjetas.map((t) => (
            <KpiCard key={t.label} {...t} />
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Equipos por estado
          </h2>
          {loading ? (
            <div className="skeleton h-56" />
          ) : porEstado.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">
              Sin equipos registrados todavía. Importa tu inventario para ver los gráficos.
            </p>
          ) : (
            <Pie
              data={{
                labels: porEstado.map((e) => e.estado),
                datasets: [
                  {
                    data: porEstado.map((e) => e.cantidad),
                    backgroundColor: porEstado.map((e) => ESTADO_COLOR[e.estado] ?? '#94A3B8'),
                    borderWidth: 2,
                    borderColor: '#ffffff',
                  },
                ],
              }}
              options={{
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } },
              }}
            />
          )}
        </div>

        <div className="card">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Equipos por tipo
          </h2>
          {loading ? (
            <div className="skeleton h-56" />
          ) : porTipo.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">Sin datos todavía.</p>
          ) : (
            <Bar
              data={{
                labels: porTipo.map((t) => t.tipo),
                datasets: [
                  {
                    data: porTipo.map((t) => t.cantidad),
                    backgroundColor: '#0070CE',
                    borderRadius: 4,
                    maxBarThickness: 42,
                  },
                ],
              }}
              options={{
                plugins: { legend: { display: false } },
                scales: {
                  y: { beginAtZero: true, ticks: { precision: 0 } },
                  x: { ticks: { font: { size: 11 } } },
                },
              }}
            />
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Últimas actividades
        </h2>
        {loading ? (
          <div className="space-y-2">
            <div className="skeleton h-8" />
            <div className="skeleton h-8" />
            <div className="skeleton h-8" />
          </div>
        ) : ultimos.length === 0 ? (
          <p className="text-sm text-slate-400">
            Sin actividad registrada aún. Todo lo que hagas en el sistema aparecerá aquí.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {ultimos.map((h) => (
              <li key={h.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="badge bg-slate-50 text-slate-500">{h.accion}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-600">
                  {h.referencia}
                </span>
                <span className="shrink-0 text-xs text-slate-400">
                  {new Date(h.fecha_hora).toLocaleString('es-SV', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
