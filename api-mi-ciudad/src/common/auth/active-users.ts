import type { Rol } from './decorators.js';

/** Lo que el guard necesita saber de los usuarios; lo implementa el módulo de usuarios. */
export abstract class UsuariosActivos {
  abstract rolDe(usuarioId: string): Promise<Rol | null>;
}
