import { extraRouteSeeds } from '@/mocks/roster'
import { commonModels, coordenadas, previousReadingAt, titulares } from '@/mocks/shared'

import type { RouteSeed } from '@/mocks/roster'
import type { Medidor, Suministro } from '@/types/entities'

const suppliesPerRoute = 20

export type NeighborhoodEntry = {
  routeNumero: string
  medidor: Medidor
  suministro: Suministro
}

function neighborhoodEntry(route: RouteSeed, routeIndex: number, index: number): NeighborhoodEntry {
  const numero = `${route.numero}${String(index + 1).padStart(4, '0')}`
  const medidorId = `med-${numero}`
  const modelo = commonModels[index % commonModels.length] ?? 'agujas'

  const medidor: Medidor = {
    id: medidorId,
    serie: `N-${numero}`,
    modelo,
    multiplicador: 1,
    digitos: 5,
    videoInstructivoUrl: `https://api.coopchajari.com.ar/v/${modelo}.mp4`,
    codigoQr: `COOP-CHJ:${medidorId}`,
    instaladoEn: '2017-04-08T00:00:00-03:00',
  }

  const suministro: Suministro = {
    id: `sum-${numero}`,
    numero,
    titular: titulares[(routeIndex + index) % titulares.length] ?? 'Acosta, Mirta',
    direccion: `${route.calle} ${100 + index * 12}`,
    coordenadas: coordenadas(index, {
      latitud: -30.77 + routeIndex * 0.004,
      longitud: -57.99 + routeIndex * 0.003,
    }),
    categoria: index % 10 === 0 ? 'comercial' : 'residencial',
    medidorId,
    lecturaAnterior: 500 + index * 4,
    fechaLecturaAnterior: previousReadingAt,
    consumoPromedio: 18,
    activo: true,
  }

  return { routeNumero: route.numero, medidor, suministro }
}

export const neighborhoodEntries: NeighborhoodEntry[] = extraRouteSeeds.flatMap((route, routeIndex) =>
  Array.from({ length: suppliesPerRoute }, (_, index) => neighborhoodEntry(route, routeIndex, index)),
)
