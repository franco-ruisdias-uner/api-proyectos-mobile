import type { Coordenadas } from '../../../contract/types.js';
import type { EstadoGuardado } from './rules/agenda.js';

/** Lo que la semilla (o un test) necesita para dar de alta un evento. */
export interface EventoACargar {
  /** Si no viene, se genera `evt-` + 12 caracteres. */
  id?: string;
  titulo: string;
  descripcion: string;
  /** R7: `lugarId` o `direccionLibre`, uno solo de los dos. */
  lugarId: string | null;
  direccionLibre: string | null;
  /** R7: sólo cuando no hay `lugarId`. */
  coordenadas: Coordenadas | null;
  inicio: Date;
  fin: Date | null;
  /** Clave del almacén de archivos (no URL). */
  imagenClave: string | null;
  precio: number | null;
  estado: EstadoGuardado;
}
