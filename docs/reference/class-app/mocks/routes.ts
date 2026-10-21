import { brasilEntries } from '@/mocks/brasil'
import { neighborhoodEntries } from '@/mocks/neighborhoods'
import { quintasEntries } from '@/mocks/quintas'
import { extraRouteSeeds, routeId } from '@/mocks/roster'
import { lectorId, rutaBrasilId, rutaQuintasId } from '@/mocks/shared'

import type { Ruta } from '@/types/entities'
import type { RouteSeed } from '@/mocks/roster'

function extraRoute(seed: RouteSeed): Ruta {
  const closed = seed.estado === 'cerrada'
  const downloaded = seed.estado !== 'asignada'

  return {
    id: routeId(seed.numero),
    numero: seed.numero,
    nombre: seed.nombre,
    bimestre: '2026-05',
    lectorId: seed.lectorId,
    suministroIds: neighborhoodEntries
      .filter((entry) => entry.routeNumero === seed.numero)
      .map((entry) => entry.suministro.id),
    estado: seed.estado,
    descargadaEn: downloaded ? '2026-09-15T07:40:00-03:00' : null,
    cerradaEn: closed ? '2026-09-14T17:02:00-03:00' : null,
  }
}

export const rutas: Ruta[] = [
  {
    id: rutaBrasilId,
    numero: '07',
    nombre: 'Barrio Brasil',
    // P-18: "2026-05" is stored as sent. It is not decided whether 05 is May or the fifth period.
    bimestre: '2026-05',
    lectorId,
    suministroIds: brasilEntries.map((entry) => entry.suministro.id),
    estado: 'en_curso',
    descargadaEn: '2026-09-15T07:40:00-03:00',
    cerradaEn: null,
  },
  {
    id: rutaQuintasId,
    numero: '12',
    nombre: 'Quintas Norte',
    bimestre: '2026-05',
    lectorId,
    suministroIds: quintasEntries.map((entry) => entry.suministro.id),
    estado: 'cerrada',
    descargadaEn: '2026-09-14T07:10:00-03:00',
    cerradaEn: '2026-09-14T17:02:00-03:00',
  },
  ...extraRouteSeeds.map((seed) => extraRoute(seed)),
]
