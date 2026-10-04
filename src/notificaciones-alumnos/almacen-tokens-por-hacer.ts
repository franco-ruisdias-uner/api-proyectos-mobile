// PARTE 1 DE 2 PARA PROGRAMAR — dónde viven los tokens de Expo de cada usuario.
// Leé docs/NOTIFICACIONES.md. Cuando funcione, `pnpm test:notificaciones` tiene que pasar.
import { Injectable } from '@nestjs/common';
import { ErrorApi } from '../comun/errores/error-api.js';
import {
  AlmacenTokensPush,
  type Plataforma,
} from '../comun/notificaciones/puertos.js';

@Injectable()
export class AlmacenTokensPorHacer extends AlmacenTokensPush {
  // TODO(alumnos): anotar el token de este usuario en la base. Si ese token ya estaba
  // anotado (a nombre de este usuario o de otro), tiene que quedar una sola fila, a nombre
  // de `usuarioId` y con la `plataforma` nueva. Pensá qué pasa si llegan dos pedidos
  // iguales al mismo tiempo.
  guardar(
    _usuarioId: string,
    _tokenExpo: string,
    _plataforma: Plataforma,
  ): Promise<void> {
    throw new ErrorApi('NO_IMPLEMENTADO');
  }

  // TODO(alumnos): sacar ese token de la base. Si no estaba, no es un error.
  borrar(_tokenExpo: string): Promise<void> {
    throw new ErrorApi('NO_IMPLEMENTADO');
  }

  // TODO(alumnos): devolver todos los tokens de esos usuarios (cada usuario puede tener
  // varios teléfonos). Si la lista de usuarios viene vacía, devolvé una lista vacía.
  tokensDe(_usuarioIds: string[]): Promise<string[]> {
    throw new ErrorApi('NO_IMPLEMENTADO');
  }

  // TODO(alumnos): borrar de la base los tokens que Expo dijo que ya no sirven.
  descartar(_tokens: string[]): Promise<void> {
    throw new ErrorApi('NO_IMPLEMENTADO');
  }
}
