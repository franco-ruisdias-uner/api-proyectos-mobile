import { extraRouteSeeds, routeId, userSeeds } from '@/mocks/roster'
import { lectorId, rutaBrasilId, rutaQuintasId } from '@/mocks/shared'

import type { Usuario } from '@/types/entities'

function assignedRouteIds(userId: string): string[] {
  if (userId === lectorId) {
    return [rutaBrasilId, rutaQuintasId]
  }

  return extraRouteSeeds.filter((route) => route.lectorId === userId).map((route) => routeId(route.numero))
}

export const usuarios: Usuario[] = userSeeds.map((seed) => ({
  id: seed.id,
  legajo: seed.legajo,
  nombre: seed.nombre,
  rol: seed.rol,
  biometriaActiva: seed.biometriaActiva,
  rutasAsignadas: assignedRouteIds(seed.id),
}))
