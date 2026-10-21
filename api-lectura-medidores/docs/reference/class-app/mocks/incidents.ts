import { brasilSupplyAt } from '@/mocks/brasil'
import { incidentIndex, lectorId, rutaBrasilId } from '@/mocks/shared'

import type { MotivoNovedad, Novedad } from '@/types/entities'

const incidentIndexes = [2, 22, 23, 24, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 41, 42]

const motivos: MotivoNovedad[] = [
  'perro_suelto',
  'porton_cerrado',
  'pasto_alto',
  'medidor_tapado',
  'medidor_roto',
  'deshabitada',
  'no_se_encuentra',
]

const comments: Record<MotivoNovedad, string> = {
  perro_suelto: 'Dos perros grandes sueltos',
  porton_cerrado: 'El portón está con candado',
  pasto_alto: 'No se llega al medidor',
  medidor_tapado: 'Hay un mueble adelante',
  medidor_roto: 'El visor está roto',
  deshabitada: 'La casa está vacía',
  no_se_encuentra: 'No aparece en el frente',
}

function clock(totalMinutes: number): string {
  const hour = 8 + Math.floor(totalMinutes / 60)
  const minute = totalMinutes % 60
  const hh = String(hour).padStart(2, '0')
  const mm = String(minute).padStart(2, '0')
  return `2026-09-15T${hh}:${mm}:00-03:00`
}

function novedadAt(index: number): Novedad {
  const suministro = brasilSupplyAt(index)
  const motivo = index === incidentIndex ? 'perro_suelto' : (motivos[index % motivos.length] ?? 'perro_suelto')
  const id = index === incidentIndex ? 'nov-3312' : `nov-${String(3300 + index)}`
  const withNote = index !== incidentIndex && index % 2 === 0

  return {
    id,
    rutaId: rutaBrasilId,
    suministroId: suministro.id,
    lectorId,
    motivo,
    comentario: withNote ? comments[motivo] : null,
    audioUri: index === incidentIndex ? 'file:///novedades/nov-3312.m4a' : null,
    fotoUri: `file:///novedades/${id}.jpg`,
    fechaHora: index === incidentIndex ? '2026-09-15T08:31:00-03:00' : clock(index + 5),
    sincronizada: index % 2 === 0,
  }
}

export const novedades: Novedad[] = incidentIndexes.map((index) => novedadAt(index))
