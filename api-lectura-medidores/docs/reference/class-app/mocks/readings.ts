import { brasilEntries } from '@/mocks/brasil'
import { lectorId, negativeReadingIndex, readIndex, rutaBrasilId } from '@/mocks/shared'

import type { Lectura, Medidor, Suministro } from '@/types/entities'

const readingIndexes = [1, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 25, 40]

function clock(totalMinutes: number): string {
  const hour = 8 + Math.floor(totalMinutes / 60)
  const minute = totalMinutes % 60
  const hh = String(hour).padStart(2, '0')
  const mm = String(minute).padStart(2, '0')
  return `2026-09-15T${hh}:${mm}:00-03:00`
}

function entryAt(index: number): { suministro: Suministro; medidor: Medidor } {
  const entry = brasilEntries[index]
  if (!entry) {
    throw new Error(`Missing supply at index ${index}`)
  }
  return entry
}

function lecturaAt(index: number): Lectura {
  const { suministro, medidor } = entryAt(index)
  const id = `lec-${String(88200 + index)}`

  if (index === readIndex) {
    return {
      id: 'lec-88201',
      rutaId: rutaBrasilId,
      suministroId: suministro.id,
      lectorId,
      valor: 1302,
      consumo: 18,
      fotoUri: 'file:///lecturas/lec-88201.jpg',
      coordenadas: suministro.coordenadas,
      fueraDeRango: false,
      confirmadaPorLector: false,
      fechaHora: '2026-09-15T08:12:00-03:00',
      sincronizada: false,
    }
  }

  if (index === negativeReadingIndex) {
    // P-04: the meter was replaced, so consumo is negative. A negative consumption is out of range:
    // the reader saw the warning and confirmed it.
    return {
      id: 'lec-88240',
      rutaId: rutaBrasilId,
      suministroId: suministro.id,
      lectorId,
      valor: 86,
      consumo: -4014,
      fotoUri: 'file:///lecturas/lec-88240.jpg',
      coordenadas: suministro.coordenadas,
      fueraDeRango: true,
      confirmadaPorLector: true,
      fechaHora: '2026-09-15T09:05:00-03:00',
      sincronizada: false,
    }
  }

  const anterior = suministro.lecturaAnterior
  if (anterior === null) {
    throw new Error(`Supply ${suministro.id} has no previous reading`)
  }

  const delta = 8 + (index % 11)
  return {
    id,
    rutaId: rutaBrasilId,
    suministroId: suministro.id,
    lectorId,
    valor: anterior + delta,
    consumo: delta * medidor.multiplicador,
    fotoUri: `file:///lecturas/${id}.jpg`,
    coordenadas: suministro.coordenadas,
    fueraDeRango: false,
    confirmadaPorLector: false,
    fechaHora: clock(index),
    sincronizada: index % 2 === 0,
  }
}

export const lecturas: Lectura[] = readingIndexes.map((index) => lecturaAt(index))
