// Builders de usuarios para los tests: no dependen de las semillas de demo.
import type { Rol } from '../../contrato/tipos.js';
import { Usuario } from '../../src/modulos/usuarios/usuario.entidad.js';
import { hashearContrasena } from '../../src/comun/auth/contrasenas.js';
import { nuevoId } from '../../src/comun/ids/ids.js';
import { ServicioTokens } from '../../src/comun/auth/tokens.servicio.js';
import type { AppDePrueba } from './crear-app.js';

export const CONTRASENA_DE_PRUEBA = 'clave-de-prueba';

export interface UsuarioDePrueba {
  usuario: Usuario;
  token: string;
  /** Cabecera Authorization lista para usar con supertest. */
  auth: [string, string];
}

let secuencia = 0;

export async function crearUsuario(
  ctx: AppDePrueba,
  datos: Partial<
    Pick<
      Usuario,
      'id' | 'nombre' | 'email' | 'telefono' | 'zonaId' | 'avisosActivos'
    >
  > & {
    rol?: Rol;
  } = {},
): Promise<UsuarioDePrueba> {
  secuencia += 1;
  const usuario = Object.assign(new Usuario(), {
    id: datos.id ?? nuevoId('usr'),
    nombre: datos.nombre ?? `Persona ${secuencia}`,
    email: (
      datos.email ??
      `persona${secuencia}-${Math.random().toString(36).slice(2, 8)}@prueba.ar`
    ).toLowerCase(),
    contrasenaHash: await hashearContrasena(CONTRASENA_DE_PRUEBA),
    telefono: datos.telefono ?? null,
    rol: datos.rol ?? 'vecino',
    zonaId: datos.zonaId ?? null,
    avisosActivos: datos.avisosActivos ?? true,
    creadoEn: ctx.reloj.ahora(),
  });
  await ctx.dataSource.getRepository(Usuario).insert(usuario);
  const token = ctx.app.get(ServicioTokens).firmar(usuario);
  return { usuario, token, auth: ['Authorization', `Bearer ${token}`] };
}

export const crearVecino = (
  ctx: AppDePrueba,
  datos: Parameters<typeof crearUsuario>[1] = {},
) => crearUsuario(ctx, { ...datos, rol: 'vecino' });

export const crearOperador = (
  ctx: AppDePrueba,
  datos: Parameters<typeof crearUsuario>[1] = {},
) => crearUsuario(ctx, { zonaId: 'zon-norte', ...datos, rol: 'operador' });
