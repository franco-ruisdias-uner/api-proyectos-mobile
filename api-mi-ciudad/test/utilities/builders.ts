import { JwtService } from '@nestjs/jwt';
import type { Sesion } from '../../contract/api.js';
import type { Categoria } from '../../contract/types.js';
import { hashearContrasena } from '../../src/common/auth/passwords.js';
import { nuevoId } from '../../src/common/ids/ids.js';
import { CategoriasServicio } from '../../src/modules/categories/categories.service.js';
import type { LugarACargar } from '../../src/modules/places/place-to-load.js';
import type { EventoACargar } from '../../src/modules/events/event-to-load.js';
import { EventosServicio } from '../../src/modules/events/events.service.js';
import { LugaresServicio } from '../../src/modules/places/places.service.js';
import { UsuarioEntidad } from '../../src/modules/users/user.entity.js';
import type { AppDePrueba } from './create-app.js';

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

/** Crea una categoría por el servicio del catálogo (no hay endpoint: las carga la semilla). */
export async function crearCategoria(ctx: AppDePrueba, datos: Partial<Categoria> = {}): Promise<Categoria> {
  contador++;
  const categoria: Categoria = {
    id: datos.id ?? `cat-prueba-${contador}-${nuevoId('x').slice(2, 8)}`,
    nombre: datos.nombre ?? `Categoría ${contador}`,
    icono: datos.icono ?? 'leaf-outline',
    color: datos.color ?? '#336699',
    orden: datos.orden ?? contador,
  };
  await ctx.app.get(CategoriasServicio).cargar(categoria);
  return categoria;
}

/**
 * Crea un lugar por el servicio del catálogo, con todos los opcionales en `null` salvo que se
 * pidan. Si no se dice la categoría, crea una. Devuelve el id.
 */
export async function crearLugar(ctx: AppDePrueba, datos: Partial<LugarACargar> = {}): Promise<string> {
  contador++;
  const categoriaId = datos.categoriaId ?? (await crearCategoria(ctx)).id;
  return ctx.app.get(LugaresServicio).cargar({
    nombre: `Lugar ${contador}`,
    descripcionCorta: 'Un lugar para conocer.',
    descripcion: 'Un lugar para conocer, con una descripción más larga para el detalle.',
    coordenadas: { latitud: -32.2236, longitud: -58.1427 },
    direccion: 'Calle 12 de Abril 100, Colón',
    imagenes: [],
    horarios: [],
    telefono: null,
    sitioWeb: null,
    precioEntrada: null,
    audioguia: null,
    conQr: false,
    accesible: false,
    activo: true,
    ...datos,
    categoriaId,
  });
}

/** Clave del almacén a partir de la URL que devolvió `POST /archivos`. */
export const claveDe = (url: string) => new URL(url).pathname.replace(/^\/archivos\//, '');

/**
 * Crea un evento por el servicio de la agenda. Por defecto: mañana a las 21:00 de Buenos Aires
 * (con el reloj de prueba), en un lugar nuevo, sin fin. Devuelve el id.
 */
export async function crearEvento(ctx: AppDePrueba, datos: Partial<EventoACargar> = {}): Promise<string> {
  contador++;
  const sinLugar = datos.direccionLibre !== undefined && datos.direccionLibre !== null;
  const lugarId = sinLugar ? null : (datos.lugarId ?? (await crearLugar(ctx)));
  return ctx.app.get(EventosServicio).cargar({
    titulo: `Evento ${contador}`,
    descripcion: 'Un evento para no perderse.',
    direccionLibre: null,
    coordenadas: null,
    inicio: new Date('2026-11-15T21:00:00-03:00'),
    fin: null,
    imagenClave: null,
    precio: null,
    estado: 'programado',
    ...datos,
    lugarId,
  });
}

/**
 * Da de alta un teléfono para recibir push directo en el almacén de tokens de prueba (no por
 * `POST /dispositivos`, que lo programan los alumnos: AGENTS §19).
 */
export async function registrarTelefono(
  ctx: AppDePrueba,
  token: string,
  tokenExpo: string,
  plataforma: 'ios' | 'android' = 'ios',
): Promise<void> {
  const yo = await ctx.http().get('/yo').set(conSesion(token));
  await ctx.tokens.guardar((yo.body as { datos: { id: string } }).datos.id, tokenExpo, plataforma);
}
