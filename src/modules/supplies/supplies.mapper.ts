import type { Medidor, Suministro } from '../../../contract/types.js';
import { aIsoConZona } from '../../common/dates/dates.js';
import type { MedidorEntidad } from './meter.entity.js';
import type { SuministroEntidad } from './supply.entity.js';

/** Entidad → `Suministro` del PRD. */
export function aContrato(s: SuministroEntidad): Suministro {
  return {
    id: s.id,
    numero: s.numero,
    titular: s.titular,
    direccion: s.direccion,
    coordenadas: { latitud: s.latitud, longitud: s.longitud },
    categoria: s.categoria,
    medidorId: s.medidorId,
    lecturaAnterior: s.lecturaAnterior,
    fechaLecturaAnterior:
      s.fechaLecturaAnterior === null
        ? null
        : aIsoConZona(s.fechaLecturaAnterior),
    consumoPromedio: s.consumoPromedio,
    activo: s.activo,
  };
}

/** Entidad → `Medidor` del PRD. `urlDeArchivo` hace absoluta la clave del video. */
export function medidorAContrato(
  m: MedidorEntidad,
  urlDeArchivo: (clave: string) => string,
): Medidor {
  return {
    id: m.id,
    serie: m.serie,
    modelo: m.modelo,
    multiplicador: m.multiplicador,
    digitos: m.digitos,
    videoInstructivoUrl:
      m.videoClave === null ? null : urlDeArchivo(m.videoClave),
    codigoQr: m.codigoQr,
    instaladoEn: aIsoConZona(m.instaladoEn),
  };
}
