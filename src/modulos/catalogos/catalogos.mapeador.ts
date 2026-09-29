import type {
  Cuadrilla as CuadrillaContrato,
  TipoDeReporte as TipoContrato,
  Zona as ZonaContrato,
} from '../../../contrato/tipos.js';
import type { Cuadrilla } from './cuadrilla.entidad.js';
import type { TipoDeReporte } from './tipo-de-reporte.entidad.js';
import type { Zona } from './zona.entidad.js';

export const aTipoDeReporte = (t: TipoDeReporte): TipoContrato => ({
  id: t.id,
  nombre: t.nombre,
  icono: t.icono,
  color: t.color,
  areaResponsable: t.areaResponsable,
});

export const aZona = (z: Zona): ZonaContrato => ({
  id: z.id,
  nombre: z.nombre,
  limite: z.limite.map((p) => ({ latitud: p.latitud, longitud: p.longitud })),
  referente: z.referente,
});

export const aCuadrilla = (c: Cuadrilla): CuadrillaContrato => ({
  id: c.id,
  nombre: c.nombre,
  zonaId: c.zonaId,
  especialidad: c.especialidad,
  activa: c.activa,
});
