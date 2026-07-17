import { useState, type FormEvent } from 'react'
import { FileDown } from 'lucide-react'
import Modal from '@/components/Modal'
import { useUI } from '@/hooks/useUI'
import { supabase } from '@/lib/supabase'
import {
  generarMemoBlob,
  descargarBlob,
  nombreArchivoMemo,
  type MemoEquipoFila,
  type MemoDatos,
} from '@/lib/memoDocx'
import type { CentroDistribucion } from '@/types/database'

const CUERPO_DEFAULT =
  'Por este medio se hace constar la salida del área de Automatización del CD F&V del siguiente ' +
  'listado de equipos en concepto de equipo actualización, realizando su salida el día de hoy.'

function hoyDDMMYYYY() {
  const d = new Date()
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

export default function MemoModal({
  filas,
  centros,
  onClose,
}: {
  filas: MemoEquipoFila[]
  centros: CentroDistribucion[]
  onClose: () => void
}) {
  const { toast } = useUI()
  const [para, setPara] = useState('')
  const [de, setDe] = useState('Automatización F&V')
  const [cc, setCc] = useState('PA')
  const [fecha, setFecha] = useState(hoyDDMMYYYY())
  const [asunto, setAsunto] = useState('Salida de equipo')
  const [cuerpo, setCuerpo] = useState(CUERPO_DEFAULT)
  const [extras, setExtras] = useState('')
  const [autorizado1, setAutorizado1] = useState('Kevin Chávez.')
  const [autorizado2, setAutorizado2] = useState('')
  const [generando, setGenerando] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!para.trim()) {
      toast('error', 'Indica el CD destino (PARA).')
      return
    }
    setGenerando(true)
    try {
      const datos: MemoDatos = {
        para: para.trim(),
        de: de.trim(),
        cc: cc.trim(),
        fecha: fecha.trim(),
        asunto: asunto.trim(),
        cuerpo: cuerpo.trim(),
        equipos: filas,
        extras: extras.split('\n'),
        autorizado1: autorizado1.trim(),
        autorizado2: autorizado2.trim(),
      }
      const blob = await generarMemoBlob(datos)
      const nombre = nombreArchivoMemo(datos)
      descargarBlob(blob, nombre)

      // Archivar: subir el .docx exacto a Storage y registrar en el historial
      const hora = new Date().toISOString().slice(11, 19).replace(/:/g, '')
      const path = `memorandos/${new Date().getFullYear()}/${nombre.replace('.docx', `_${hora}.docx`)}`
      const { error: upErr } = await supabase.storage.from('documentos').upload(path, blob, {
        contentType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      })
      const { error: dbErr } = await supabase.from('memorandos').insert({
        cd_destino: datos.para,
        asunto: datos.asunto,
        num_equipos: filas.length,
        series_texto: filas.map((f) => f.serie).join(' '),
        datos,
        archivo_path: upErr ? null : path,
      })
      if (upErr || dbErr) {
        toast(
          'info',
          'Memorando descargado, pero no se pudo archivar en el historial. Revisa que corriste sql/03_documentos.sql.'
        )
      } else {
        toast('success', 'Memorando descargado y archivado en Documentos.')
      }
      onClose()
    } catch {
      toast('error', 'No se pudo generar el memorando. Intenta de nuevo.')
    } finally {
      setGenerando(false)
    }
  }

  return (
    <Modal title={`Memorando de salida — ${filas.length} equipo(s)`} onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">PARA (CD destino) *</label>
            <input
              className="input"
              list="memo-cds"
              value={para}
              onChange={(e) => setPara(e.target.value)}
              placeholder="Ej. CD APOPA 7417"
              autoFocus
            />
            <datalist id="memo-cds">
              {centros.map((c) => (
                <option key={c.id} value={c.nombre} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label">Fecha</label>
            <input className="input" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div>
            <label className="label">DE</label>
            <input className="input" value={de} onChange={(e) => setDe(e.target.value)} />
          </div>
          <div>
            <label className="label">CC</label>
            <input className="input" value={cc} onChange={(e) => setCc(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label">ASUNTO</label>
          <input className="input" value={asunto} onChange={(e) => setAsunto(e.target.value)} />
        </div>

        <div>
          <label className="label">Cuerpo del memorando</label>
          <textarea
            className="input min-h-[70px]"
            value={cuerpo}
            onChange={(e) => setCuerpo(e.target.value)}
          />
        </div>

        <div className="max-h-40 overflow-y-auto rounded-md border border-slate-200">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-2 py-1.5 text-left">Características</th>
                <th className="px-2 py-1.5 text-left">Modelo</th>
                <th className="px-2 py-1.5 text-left">Marca</th>
                <th className="px-2 py-1.5 text-left">Serie</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filas.map((f) => (
                <tr key={f.serie}>
                  <td className="px-2 py-1.5">{f.caracteristica}</td>
                  <td className="px-2 py-1.5">{f.modelo}</td>
                  <td className="px-2 py-1.5">{f.marca}</td>
                  <td className="px-2 py-1.5 font-mono">{f.serie}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <label className="label">Ítems adicionales (uno por línea, sin serie)</label>
          <textarea
            className="input min-h-[60px]"
            value={extras}
            onChange={(e) => setExtras(e.target.value)}
            placeholder={'14 baterías para TC72\n3 baterías para TC83'}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Autorizado por (1)</label>
            <input
              className="input"
              value={autorizado1}
              onChange={(e) => setAutorizado1(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Autorizado por (2)</label>
            <input
              className="input"
              value={autorizado2}
              onChange={(e) => setAutorizado2(e.target.value)}
              placeholder="Ej. Caleb Martínez."
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button type="submit" disabled={generando} className="btn-primary">
            <FileDown size={15} /> {generando ? 'Generando…' : 'Descargar memorando (.docx)'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
