import { JwtService } from '@nestjs/jwt';
import type { Sesion } from '../../contrato/api.js';
import { hashearContrasena } from '../../src/comun/auth/contrasenas.js';
import { nuevoId } from '../../src/comun/ids/ids.js';
import { UsuarioEntidad } from '../../src/modulos/usuarios/usuario.entidad.js';
import type { AppDePrueba } from './crear-app.js';

let contador = 0;

/** Registra un turista por la API y devuelve su sesión. */
export async function registrarTurista(
  ctx: AppDePrueba,
  datos: Partial<{ nombre: string; email: string; contrasena: string }> = {},
): Promise<Sesion> {
  contador++;
  const res = await ctx
    .http()
    .post('/auth/registro')
    .send({
      nombre: datos.nombre ?? `Turista ${contador}`,
      email: datos.email ?? `turista${contador}-${nuevoId('t').slice(2)}@prueba.ar`,
      contrasena: datos.contrasena ?? 'una-clave-segura',
    });
  if (res.status !== 201) throw new Error(`No se pudo registrar: ${res.status} ${JSON.stringify(res.body)}`);
  return (res.body as { datos: Sesion }).datos;
}

/** Crea un administrador directo en la base (el registro público no puede) y le firma un token. */
export async function crearAdmin(ctx: AppDePrueba): Promise<{ id: string; token: string }> {
  const id = nuevoId('usr');
  await ctx.dataSource.getRepository(UsuarioEntidad).insert({
    id,
    nombre: 'Admin de prueba',
    email: `${id}@admin.prueba.ar`,
    hashContrasena: await hashearContrasena('una-clave-segura'),
    rol: 'admin',
    avatarClave: null,
    creadoEn: ctx.reloj.ahora(),
    preferencias: { categoriasFavoritas: [], avisarProximidad: true, radioAvisoMetros: 250, tema: 'sistema' },
    version: 0,
  });
  const token = await ctx.app.get(JwtService).signAsync({ sub: id, rol: 'admin' });
  return { id, token };
}

export const conSesion = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Bytes de archivos con la firma correcta, para subir. */
export const MUESTRAS = {
  png: (bytes = 256) =>
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(bytes - 8, 7),
    ]),
  jpg: (bytes = 256) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(bytes - 4, 3)]),
  m4a: (bytes = 256) =>
    Buffer.concat([
      Buffer.from([0, 0, 0, 0x20]),
      Buffer.from('ftypM4A ', 'latin1'),
      Buffer.alloc(bytes - 12, 1),
    ]),
  mp4: (bytes = 256) =>
    Buffer.concat([
      Buffer.from([0, 0, 0, 0x20]),
      Buffer.from('ftypisom', 'latin1'),
      Buffer.alloc(bytes - 12, 2),
    ]),
  texto: () => Buffer.from('esto no es una imagen, es texto plano'),
};

/** Sube un archivo y devuelve la URL. */
export async function subirArchivo(
  ctx: AppDePrueba,
  token: string,
  contenido: Buffer = MUESTRAS.png(),
  nombre = 'foto.png',
): Promise<string> {
  const res = await ctx.http().post('/archivos').set(conSesion(token)).attach('archivo', contenido, nombre);
  if (res.status !== 201) throw new Error(`No se pudo subir: ${res.status} ${JSON.stringify(res.body)}`);
  return (res.body as { datos: { url: string } }).datos.url;
}
