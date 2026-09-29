import type {
  CambioDeEstado as CambioContrato,
  Foto as FotoContrato,
  Reporte as ReporteContrato,
} from '../../../contrato/tipos.js';
import {
  urlDeArchivo,
  urlDeArchivoONulo,
} from '../../comun/archivos/origen.js';
import { aIsoConZona } from '../../comun/fechas/fechas.js';
import type { CambioDeEstado } from './cambio-de-estado.entidad.js';
import type { FotoDeReporte } from './foto.entidad.js';
import type { Reporte } from './reporte.entidad.js';

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
