// ═══════════════════════════════════════════════════════════════
// Tipos generados a mano a partir de sql/01_schema.sql
// Si cambias el esquema en Supabase, actualiza este archivo también
// (o genera automático con: npx supabase gen types typescript)
// ═══════════════════════════════════════════════════════════════

export type EstadoEquipo =
  | 'Operativo'
  | 'En reparación'
  | 'Fuera de servicio'
  | 'En bodega'
  | 'Reportado con falla'
  | 'Transferido'

export type PrioridadFalla = 'CRÍTICA' | 'ALTA' | 'MEDIA' | 'BAJA'

export type EstadoFalla =
  | 'Reportada'
  | 'En diagnóstico'
  | 'En reparación'
  | 'Resuelta'
  | 'Cerrada'
  | 'Irreparable'

export type TipoMovimiento = 'Entrada' | 'Salida'

export type EstadoTransferencia = 'En tránsito' | 'Recibido' | 'Confirmado' | 'Rechazado'

export type EstadoSemaforo = 'AGOTADO' | 'CRÍTICO' | 'BAJO' | 'ÓPTIMO' | 'EXCESO'

export interface CentroDistribucion {
  id: string
  nombre: string
  activo: boolean
  created_at: string
}

export interface TipoEquipo {
  id: string
  tipo: string
  modelo: string
  marca: string | null
  lleva_usuario: boolean
  prefijo_id: string
  activo: boolean
  created_at: string
}

export interface UsuarioTecnico {
  id: string
  nombre_completo: string
  numero_usuario: string | null
  cargo: string | null
  cd_id: string | null
  activo: boolean
  created_at: string
  updated_at: string
}

export interface UsuarioResumen extends UsuarioTecnico {
  equipos_asignados: number
  fallas_reportadas: number
}

export interface Equipo {
  id: string
  codigo: string | null
  tipo_equipo_id: string | null
  marca: string | null
  modelo: string | null
  serie: string
  pn: string | null
  usuario_id: string | null
  cd_id: string | null
  estado: EstadoEquipo
  fecha_ingreso: string
  observaciones: string | null
  created_at: string
  updated_at: string
}

export interface Falla {
  id: string
  codigo: string | null
  equipo_id: string | null
  problema: string
  reportado_por: string | null
  tecnico_asignado: string | null
  prioridad: PrioridadFalla
  estado: EstadoFalla
  fecha_reporte: string
  fecha_resolucion: string | null
  solucion: string | null
  costo_estimado: number | null
  requiere_proveedor: boolean
  observaciones: string | null
  created_at: string
}

export interface Consumible {
  id: string
  codigo: string | null
  nombre: string
  categoria: string | null
  unidad: string
  stock: number
  stock_min: number
  stock_max: number
  proveedor: string | null
  precio_unitario: number | null
  updated_at: string
}

export interface ConsumibleConEstado extends Consumible {
  estado_semaforo: EstadoSemaforo
}

export interface MovimientoConsumible {
  id: string
  consumible_id: string | null
  tipo: TipoMovimiento
  cantidad: number
  motivo: string | null
  responsable_id: string | null
  observaciones: string | null
  created_at: string
}

export interface Transferencia {
  id: string
  codigo: string | null
  equipo_id: string | null
  cd_origen_id: string | null
  cd_destino_id: string | null
  responsable_id: string | null
  recibido_por_id: string | null
  motivo: string | null
  estado: EstadoTransferencia
  fecha_envio: string
  fecha_recepcion: string | null
  observaciones: string | null
  created_at: string
}

export interface HistorialEntry {
  id: number
  fecha_hora: string
  accion: string
  referencia: string | null
  campo: string | null
  valor_anterior: string | null
  valor_nuevo: string | null
  realizado_por: string | null
  modulo: string | null
}

export interface DashboardKPIs {
  total_equipos: number
  equipos_operativos: number
  equipos_reparacion: number
  equipos_fuera_servicio: number
  equipos_con_falla: number
  consumibles_alerta: number
  transferencias_mes: number
  fallas_mes: number
  baterias_pool: number
}

export interface EquiposPorEstado {
  estado: EstadoEquipo
  cantidad: number
}

export interface EquiposPorTipo {
  tipo: string
  cantidad: number
}
