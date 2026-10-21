import type { Rol, Usuario } from '../../contract/types.js';
import { hashearContrasena } from '../../src/common/auth/passwords.js';
import { nuevoId } from '../../src/common/ids/ids.js';
import { normalizarParaBusqueda } from '../../src/common/text/text.js';
import { normalizarLegajo } from '../../src/modules/users/rules/employee-id.js';
import { UsuarioEntidad } from '../../src/modules/users/user.entity.js';
import type { AppDePrueba } from './create-app.js';

export const CONTRASENA_DE_PRUEBA = 'clave-de-prueba';

let contador = 0;

export interface UsuarioDePrueba {
  id: string;
  legajo: string;
  nombre: string;
  rol: Rol;
  contrasena: string;
}

/** Builder: crea un usuario directo en la base (no depende de las semillas). */
export async function crearUsuario(
  contexto: AppDePrueba,
  datos: Partial<Omit<UsuarioDePrueba, 'id'>> & {
    biometriaActiva?: boolean;
  } = {},
): Promise<UsuarioDePrueba> {
  contador += 1;
  const sufijo = `${Date.now().toString(36).slice(-4)}${contador}`;
  const usuario: UsuarioDePrueba = {
    id: nuevoId('usr'),
    legajo: datos.legajo ?? `T-${sufijo}`,
    nombre: datos.nombre ?? `Persona de prueba ${sufijo}`,
    rol: datos.rol ?? 'lector',
    contrasena: datos.contrasena ?? CONTRASENA_DE_PRUEBA,
  };
  await contexto.dataSource.getRepository(UsuarioEntidad).insert({
    id: usuario.id,
    legajo: usuario.legajo,
    legajoBusqueda: normalizarLegajo(usuario.legajo),
    nombre: usuario.nombre,
    nombreBusqueda: normalizarParaBusqueda(usuario.nombre),
    rol: usuario.rol,
    biometriaActiva: datos.biometriaActiva ?? false,
    hashContrasena: await hashearContrasena(usuario.contrasena),
    versionSesion: 0,
    creadoEn: contexto.reloj.ahora(),
  });
  return usuario;
}

/** Ingresa por la API y devuelve el token. */
export async function ingresar(
  contexto: AppDePrueba,
  usuario: { legajo: string; contrasena: string },
): Promise<string> {
  const respuesta = await contexto
    .http()
    .post('/auth/ingreso')
    .send({ legajo: usuario.legajo, contrasena: usuario.contrasena })
    .expect(200);
  return (respuesta.body as { datos: { token: string; usuario: Usuario } })
    .datos.token;
}

/** Crea un usuario de ese rol, ingresa y devuelve el usuario con su token. */
export async function conSesion(
  contexto: AppDePrueba,
  rol: Rol,
  datos: Partial<Omit<UsuarioDePrueba, 'id' | 'rol'>> = {},
): Promise<UsuarioDePrueba & { token: string }> {
  const usuario = await crearUsuario(contexto, { ...datos, rol });
  return { ...usuario, token: await ingresar(contexto, usuario) };
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
