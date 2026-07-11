// Generador de reportes PDF con encabezado corporativo Walmart/Hortifruti.
// jsPDF se carga dinámicamente (import()) para no engordar el bundle inicial.

export async function generarPDF(opts: {
  titulo: string
  columnas: string[]
  filas: (string | number | null | undefined)[][]
  archivo: string
  orientacion?: 'landscape' | 'portrait'
}) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: opts.orientacion ?? 'landscape', unit: 'pt' })
  const ancho = doc.internal.pageSize.getWidth()

  function dibujarEncabezado() {
    // Banda navy + línea amarilla (identidad del sistema)
    doc.setFillColor(11, 18, 32)
    doc.rect(0, 0, ancho, 54, 'F')
    doc.setFillColor(255, 194, 32)
    doc.rect(0, 54, ancho, 3, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text('WMS·IT', 40, 24)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(148, 163, 184)
    doc.text('Walmart El Salvador · Hortifruti CD Santa Tecla', 40, 40)

    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text(opts.titulo.toUpperCase(), ancho - 40, 24, { align: 'right' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(148, 163, 184)
    doc.text(
      new Date().toLocaleString('es-SV', { dateStyle: 'short', timeStyle: 'short' }),
      ancho - 40,
      40,
      { align: 'right' }
    )
  }

  autoTable(doc, {
    startY: 72,
    margin: { top: 72, left: 40, right: 40 },
    head: [opts.columnas],
    body: opts.filas.map((f) => f.map((v) => (v == null || v === '' ? '—' : String(v)))),
    styles: { fontSize: 8, cellPadding: 4, textColor: [30, 41, 59] },
    headStyles: { fillColor: [0, 112, 206], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [246, 247, 249] },
    didDrawPage: () => {
      dibujarEncabezado()
      const alto = doc.internal.pageSize.getHeight()
      doc.setFontSize(8)
      doc.setTextColor(148, 163, 184)
      doc.text(`Página ${doc.getNumberOfPages()}`, ancho / 2, alto - 16, { align: 'center' })
    },
  })

  const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  doc.save(`${opts.archivo}_${fecha}.pdf`)
}
