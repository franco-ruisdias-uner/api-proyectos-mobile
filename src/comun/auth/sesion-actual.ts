import type { Rol } from '../../../contrato/tipos.js';

export interface SesionActual {
  usuarioId: string;
  rol: Rol;
}

/** Lo que va dentro del JWT. `ver` es la versión de sesión del usuario (R2). */
export interface CargaToken {
  sub: string;
  rol: Rol;
  ver: number;
  iat: number;
  exp: number;
}

/** Duración del token: 12 horas (teléfonos compartidos entre turnos, D2). */
export const DURACION_TOKEN_SEGUNDOS = 12 * 60 * 60;
