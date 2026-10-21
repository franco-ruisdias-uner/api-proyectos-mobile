import { Injectable } from '@nestjs/common';
import type { Plataforma } from '../../contract/api.js';
import {
  PuertoSinImplementar,
  type AlmacenTokensPush,
} from '../common/notifications/ports.js';

/**
 * TODO(alumnos): acá viven los tokens de Expo de cada usuario. Mientras estos métodos tiren
 * PuertoSinImplementar, los tres endpoints de /dispositivos responden 501 y las push no salen
 * (la API lo anota en el log y sigue).
 *
 * Para guardarlos van a necesitar una entidad de TypeORM propia (y registrarla con
 * TypeOrmModule.forFeature en src/common/notificaciones/notificaciones.module.ts). Leé
 * docs/NOTIFICATIONS.md.
 */
@Injectable()
export class AlmacenTokensPorHacer implements AlmacenTokensPush {
  /**
   * TODO(alumnos): guardar el token de ese usuario. Si ya existía, no se duplica; si lo tenía
   * otro usuario, pasa a éste (el teléfono cambió de cuenta); si cambió la plataforma, se
   * actualiza. Ojo con dos pedidos simultáneos del mismo token.
   */
  guardar(
    _usuarioId: string,
    _tokenExpo: string,
    _plataforma: Plataforma,
  ): Promise<void> {
    return Promise.reject(new PuertoSinImplementar('guardar'));
  }

  /** TODO(alumnos): borrar ese token. Si no existe, no es un error. */
  borrar(_tokenExpo: string): Promise<void> {
    return Promise.reject(new PuertoSinImplementar('borrar'));
  }

  /**
   * TODO(alumnos): devolver los tokens de todos esos usuarios (una lista vacía si no hay
   * ninguno). Es lo que usa Avisos para saber a qué teléfonos mandar.
   */
  tokensDe(_usuarioIds: string[]): Promise<string[]> {
    return Promise.reject(new PuertoSinImplementar('tokensDe'));
  }

  /** TODO(alumnos): borrar estos tokens, que Expo informó como dados de baja. */
  descartar(_tokens: string[]): Promise<void> {
    return Promise.reject(new PuertoSinImplementar('descartar'));
  }
}
