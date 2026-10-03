import { hashearContrasena } from '../../src/comun/auth/contrasenas.js';
import { Tokens } from '../../src/comun/auth/tokens.js';
import { nuevoId } from '../../src/comun/ids/ids.js';
import { Usuario } from '../../src/modulos/usuarios/usuario.entidad.js';
import type { AppDePrueba } from './crear-app.js';

export const CONTRASENA_DE_PRUEBA = 'clave-de-prueba';
let hashCache: Promise<string> | null = null;

export interface UsuarioDePrueba {
  id: string;
  email: string;
  token: string;
  auth: { Authorization: string };
}

/** Builder: crea un usuario directo en la base y devuelve su token. */
export async function crearUsuario(
  t: AppDePrueba,
  datos: Partial<
    Pick<Usuario, 'id' | 'nombre' | 'email' | 'rol' | 'comercioId' | 'avisosActivos'>
  > = {},
): Promise<UsuarioDePrueba> {
  hashCache ??= hashearContrasena(CONTRASENA_DE_PRUEBA);
  const id = datos.id ?? nuevoId('usr');
  const usuario = {
    id,
    nombre: datos.nombre ?? 'Vecina de Prueba',
    email: datos.email ?? `${id}@prueba.ar`,
    rol: datos.rol ?? 'vecino',
    comercioId: datos.comercioId ?? null,
    avisosActivos: datos.avisosActivos ?? true,
    hashContrasena: await hashCache,
    creadoEn: t.reloj.ahora(),
  };
  await t.dataSource.getRepository(Usuario).insert(usuario);
  const token = t.app.get(Tokens).firmar({ id, rol: usuario.rol });
  return { id, email: usuario.email, token, auth: { Authorization: `Bearer ${token}` } };
}
