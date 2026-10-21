import { commonModels, coordenadas, previousReadingAt, titulares } from '@/mocks/shared'

import type { Medidor, Suministro } from '@/types/entities'

const quintasCount = 20

function quintasEntry(index: number): { medidor: Medidor; suministro: Suministro } {
  const numero = String(8001 + index).padStart(6, '0')
  const medidorId = `med-Q${numero}`
  const modelo = commonModels[index % commonModels.length] ?? 'agujas'

  const medidor: Medidor = {
    id: medidorId,
    serie: `Q-${numero}`,
    modelo,
    multiplicador: 1,
    digitos: 5,
    videoInstructivoUrl: `https://api.coopchajari.com.ar/v/${modelo}.mp4`,
    codigoQr: `COOP-CHJ:${medidorId}`,
    instaladoEn: '2016-11-02T00:00:00-03:00',
  }

  const suministro: Suministro = {
    id: `sum-${numero}`,
    numero,
    titular: titulares[index % titulares.length] ?? 'Acosta, Mirta',
    direccion: `Los Sauces ${120 + index * 16}`,
    coordenadas: coordenadas(index, { latitud: -30.72, longitud: -57.97 }),
    categoria: 'rural',
    medidorId,
    lecturaAnterior: 800 + index * 5,
    fechaLecturaAnterior: previousReadingAt,
    consumoPromedio: 18,
    activo: true,
  }

  return { medidor, suministro }
}

export const quintasEntries = Array.from({ length: quintasCount }, (_, index) => quintasEntry(index))
