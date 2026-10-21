import {
  brasilCount,
  commonModels,
  coordenadas,
  multiplierIndex,
  negativeReadingIndex,
  newConnectionIndex,
  pinnedTitulares,
  previousReadingAt,
  readIndex,
  titulares,
} from '@/mocks/shared'

import type { Medidor, ModeloMedidor, Suministro } from '@/types/entities'

const pinnedStreetNumbers = [1420, 1436, 1450, 1462]
const pinnedNumeros = ['004120', '004136', '004150', '004162']

function streetNumber(index: number): number {
  const pinned = pinnedStreetNumbers[index]
  if (pinned !== undefined) {
    return pinned
  }

  return 1462 + (index - 3) * 14
}

function accountNumber(index: number): string {
  const pinned = pinnedNumeros[index]
  if (pinned !== undefined) {
    return pinned
  }

  return String(4200 + index).padStart(6, '0')
}

function brasilEntry(index: number): { medidor: Medidor; suministro: Suministro } {
  const numero = accountNumber(index)
  const suministroId = `sum-${numero}`
  const medidorId = index === 0 ? 'med-A88413' : `med-${numero}`
  const isNewConnection = index === newConnectionIndex
  // P-05: multiplicador 10 is mocked. This does not decide whether the ×10 meter is agujas_viejo or multiplicador.
  const isMultiplier = index === multiplierIndex
  const modelo: ModeloMedidor = isMultiplier
    ? 'multiplicador'
    : (commonModels[index % commonModels.length] ?? 'agujas')

  let lecturaAnterior = 1000 + index * 3
  if (index === 0 || index === readIndex) {
    lecturaAnterior = 1284
  }
  if (index === negativeReadingIndex) {
    lecturaAnterior = 4100
  }

  const medidor: Medidor = {
    id: medidorId,
    serie: index === 0 ? 'A-88413' : `B-${numero}`,
    modelo,
    multiplicador: isMultiplier ? 10 : 1,
    digitos: 5,
    videoInstructivoUrl: isMultiplier
      ? null
      : `https://api.coopchajari.com.ar/v/${modelo}.mp4`,
    codigoQr: `COOP-CHJ:${medidorId}`,
    instaladoEn: index === 0 ? '2019-03-11T00:00:00-03:00' : '2018-06-01T00:00:00-03:00',
  }

  const suministro: Suministro = {
    id: suministroId,
    numero,
    titular: pinnedTitulares[index] ?? titulares[index % titulares.length] ?? 'Acosta, Mirta',
    direccion: `Brasil ${streetNumber(index)}`,
    coordenadas: coordenadas(index, { latitud: -30.7521, longitud: -57.9814 }),
    categoria: 'residencial',
    medidorId,
    // P-03: a new connection. Consumption is valor * multiplicador: a new meter starts at zero.
    lecturaAnterior: isNewConnection ? null : lecturaAnterior,
    fechaLecturaAnterior: isNewConnection ? null : previousReadingAt,
    consumoPromedio: isNewConnection ? null : 18,
    activo: true,
  }

  return { medidor, suministro }
}

export const brasilEntries = Array.from({ length: brasilCount }, (_, index) => brasilEntry(index))

export function brasilSupplyAt(index: number): Suministro {
  const suministro = brasilEntries[index]?.suministro
  if (!suministro) {
    throw new Error(`Missing supply at index ${index}`)
  }
  return suministro
}
