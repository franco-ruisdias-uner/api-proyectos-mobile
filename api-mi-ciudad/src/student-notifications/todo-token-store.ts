import { Injectable } from '@nestjs/common';
import {
  PendienteDeImplementar,
  type AlmacenTokensPush,
  type PlataformaPush,
} from '../common/notifications/ports.js';

/**
 * Dónde viven los tokens de Expo de cada usuario. Esta pieza la programan ustedes:
 * leé docs/NOTIFICATIONS.md y corré `pnpm test:notificaciones` hasta que quede en verde.
 */
@Injectable()
export class AlmacenTokensPorHacer implements AlmacenTokensPush {
  // TODO(alumnos): Guardar el token de Expo del teléfono para ese usuario. Registrar dos veces el
  // mismo token no puede duplicarlo, y si el token era de otro usuario, pasa al actual (es el
  // mismo aparato con otra cuenta). Hace falta una tabla propia: creen la entidad y regístrenla
  // en student-notifications.module.ts. Devolvé `{ nuevo: true }` si el token no existía y
  // `{ nuevo: false }` si ya estaba.
  guardar(_usuarioId: string, _tokenExpo: string, _plataforma: PlataformaPush): Promise<{ nuevo: boolean }> {
    throw new PendienteDeImplementar('guardar el token de Expo');
  }

  // TODO(alumnos): Dar de baja ese token. Si no existe, no pasa nada (no es un error).
  borrar(_tokenExpo: string): Promise<void> {
    throw new PendienteDeImplementar('borrar el token de Expo');
  }

  // TODO(alumnos): Devolver todos los tokens de esos usuarios (cada uno puede tener varios
  // teléfonos). Con una lista vacía, devolver una lista vacía.
  tokensDe(_usuarioIds: string[]): Promise<string[]> {
    throw new PendienteDeImplementar('buscar los tokens de Expo');
  }

  // TODO(alumnos): Borrar los tokens que Expo informó como inválidos, para no volver a mandarles.
  descartar(_tokens: string[]): Promise<void> {
    throw new PendienteDeImplementar('descartar tokens inválidos');
  }
}
