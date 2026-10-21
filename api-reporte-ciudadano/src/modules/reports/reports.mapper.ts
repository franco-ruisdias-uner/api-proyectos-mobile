import type {
  CambioDeEstado as CambioContrato,
  Foto as FotoContrato,
  Reporte as ReporteContrato,
} from '../../../contract/types.js';
import { urlDeArchivo, urlDeArchivoONulo } from '../../common/files/origin.js';
import { aIsoConZona } from '../../common/dates/dates.js';
import type { CambioDeEstado } from './status-change.entity.js';
import type { FotoDeReporte } from './photo.entity.js';
import type { Reporte } from './report.entity.js';

export const aFoto = (f: FotoDeReporte): FotoContrato => ({
  id: f.id,
  url: urlDeArchivo(f.clave),
  momento: f.momento,
});

export const aReporte = (
  r: Reporte,
  fotos: FotoDeReporte[],
): ReporteContrato => ({
  id: r.id,
  codigo: r.codigo,
  tipoId: r.tipoId,
  descripcion: r.descripcion,
  audioUrl: urlDeArchivoONulo(r.audioClave),
  fotos: [...fotos].sort((a, b) => a.orden - b.orden).map(aFoto),
  coordenadas: { latitud: r.latitud, longitud: r.longitud },
  direccion: r.direccion,
  zonaId: r.zonaId,
  estado: r.estado,
  autorId: r.autorId,
  cuadrillaId: r.cuadrillaId,
  duplicadoDe: r.duplicadoDe,
  adhesiones: r.adhesiones,
  creadoEn: aIsoConZona(r.creadoEn),
  sincronizado: true,
});

export const aCambioDeEstado = (c: CambioDeEstado): CambioContrato => ({
  id: c.id,
  reporteId: c.reporteId,
  estado: c.estado,
  comentario: c.comentario,
  operadorId: c.operadorId,
  fechaHora: aIsoConZona(c.fechaHora),
});
