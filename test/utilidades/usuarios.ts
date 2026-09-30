import type { Sesion } from '../../contrato/api.js';
import { hashearContrasena } from '../../src/comun/auth/contrasenas.js';
import type { Rol } from '../../src/comun/auth/roles.js';
import { Sesiones } from '../../src/comun/auth/sesiones.js';
import { nuevoId } from '../../src/comun/ids/ids.js';
import { UsuarioEntidad } from '../../src/modulos/usuarios/usuario.entidad.js';
import type { AppDePrueba } from './crear-app.js';

let contador = 0;

export interface UsuarioDePrueba {
  id: string;
  email: string;
  contrasena: string;
  token: string;
  /** Cabecera lista para supertest: .set(u.auth) */
  auth: { Authorization: string };
}

/** Crea un usuario directo en la base (builder) y le firma un token. */
export async function crearUsuario(
  ctx: AppDePrueba,
  datos: Partial<Pick<UsuarioEntidad, 'nombre' | 'email' | 'avisosActivos' | 'tema'>> & {
    rol?: Rol;
    contrasena?: string;
  } = {},
): Promise<UsuarioDePrueba> {
  contador++;
  const contrasena = datos.contrasena ?? 'clave-de-prueba';
  const usuario = ctx.dataSource.getRepository(UsuarioEntidad).create({
    id: nuevoId('usr'),
    nombre: datos.nombre ?? `Persona ${contador}`,
    email: datos.email ?? `persona${contador}-${nuevoId('x').slice(2)}@prueba.ar`,
    contrasenaHash: await hashearContrasena(contrasena),
    rol: datos.rol ?? 'pasajero',
    avisosActivos: datos.avisosActivos ?? true,
    tema: datos.tema ?? 'sistema',
    creadoEn: ctx.reloj.ahora(),
  });
  await ctx.dataSource.getRepository(UsuarioEntidad).insert(usuario);
  const token = await ctx.app.get(Sesiones).firmar({ id: usuario.id, rol: usuario.rol });
  return {
    id: usuario.id,
    email: usuario.email,
    contrasena,
    token,
    auth: { Authorization: `Bearer ${token}` },
  };
}

/** Registra por la API (camino real) y devuelve la sesión. */
export async function registrar(
  ctx: AppDePrueba,
  datos: { nombre?: string; email?: string; contrasena?: string } = {},
): Promise<Sesion> {
  contador++;
  const respuesta = await ctx.http.post('/auth/registro').send({
    nombre: datos.nombre ?? `Persona ${contador}`,
    email: datos.email ?? `registro${contador}-${nuevoId('x').slice(2)}@prueba.ar`,
    contrasena: datos.contrasena ?? 'clave-de-prueba',
  });
  if (respuesta.status !== 201)
    throw new Error(`registro falló: ${JSON.stringify(respuesta.body)}`);
  return (respuesta.body as { datos: Sesion }).datos;
}
