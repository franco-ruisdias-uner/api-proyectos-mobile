import type { Audioguia, Coordenadas, Horario } from '../../../contract/types.js';

/**
 * D1: la base guarda cada tramo con su temporada; la API devuelve sólo los vigentes hoy.
 * Verano: del 1/12 al 31/3.
 */
export type Temporada = 'todo-el-anio' | 'verano' | 'invierno';

export interface HorarioConTemporada extends Horario {
  temporada: Temporada;
}

/** Lo que la semilla (o un test) necesita para dar de alta un lugar. */
export interface LugarACargar {
  /** Si no viene, se genera `lug-` + 12 caracteres. */
  id?: string;
  nombre: string;
  categoriaId: string;
  descripcionCorta: string;
  descripcion: string;
  coordenadas: Coordenadas;
  direccion: string;
  /** Claves del almacén de archivos (no URLs). */
  imagenes: string[];
  horarios: HorarioConTemporada[];
  telefono: string | null;
  sitioWeb: string | null;
  precioEntrada: number | null;
  audioguia: { clave: string; duracionSegundos: number; idioma: Audioguia['idioma'] } | null;
  /** Si tiene cartel con QR: el código es `COLON:<id>` (D5). */
  conQr: boolean;
  accesible: boolean;
  activo: boolean;
  /** Si no viene, el momento de la carga. */
  actualizadoEn?: Date;
}
