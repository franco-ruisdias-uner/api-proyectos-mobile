import type { Coordenadas, ModeloMedidor } from '@/types/entities'

export const lectorId = 'usr-011'
export const rutaBrasilId = 'rut-07-2026-05'
export const rutaQuintasId = 'rut-12-2026-05'
export const brasilCount = 200
export const previousReadingAt = '2026-07-14T09:30:00-03:00'

export const readIndex = 1
export const incidentIndex = 2
export const newConnectionIndex = 10
export const multiplierIndex = 25
export const negativeReadingIndex = 40

export const pinnedTitulares = [
  'Coronel, Ramona',
  'Benítez, Olga',
  'Peralta, Dora',
  'Miguez, Hector',
]

export const titulares = [
  'Acosta, Mirta',
  'Fernández, Hugo',
  'Giménez, Elsa',
  'López, Carmen',
  'Martínez, Pedro',
  'Ojeda, Nelly',
  'Quiroga, Andrés',
  'Sosa, Graciela',
  'Vera, Julio',
  'Zabala, Irene',
]

export const commonModels: ModeloMedidor[] = ['agujas', 'digital', 'agujas_viejo']

export function coordenadas(index: number, origin: Coordenadas): Coordenadas {
  return {
    latitud: origin.latitud + index * 0.00012,
    longitud: origin.longitud + (index % 2 === 0 ? 0.00008 : -0.00008),
  }
}
