// Builders de usuarios para los tests: cada test arma sus propios datos.
import type { Rol, Usuario } from '../../contrato/tipos.js';
import { nuevoId } from '../../src/comun/ids/ids.js';
import { hashContrasena } from '../../src/comun/auth/contrasenas.js';
import { UsuarioEntidad } from '../../src/modulos/usuarios/usuario.entidad.js';
import type { AppDePrueba } from './crear-app.js';

export interface UsuarioDePrueba {
  usuario: Usuario;
  token: string;
  contrasena: string;
}

let contador = 0;

/** Registra un jugador por la API, como lo haría la app. */
export async function registrarJugador(
  a: AppDePrueba,
  datos: Partial<{
    nombre: string;
    email: string;
    contrasena: string;
    telefono: string;
  }> = {},
): Promise<UsuarioDePrueba> {
  contador += 1;
  const cuerpo = {
    nombre: `Jugador ${contador}`,
    email: `jugador${contador}-${Date.now()}@prueba.ar`,
    contrasena: 'clave-segura-123',
    telefono: '3455-401122',
    ...datos,
  };
  const res = await a.http().post('/auth/registro').send(cuerpo);
  if (res.status !== 201)
    throw new Error(`No se pudo registrar: ${JSON.stringify(res.body)}`);
  const { token, usuario } = (
    res.body as { datos: { token: string; usuario: Usuario } }
  ).datos;
  return { token, usuario, contrasena: cuerpo.contrasena };
}

/** Crea un usuario con cualquier rol directo en la base (encargado y administrador no se registran). */
export async function crearUsuario(
  a: AppDePrueba,
  rol: Rol,
  datos: Partial<{ nombre: string; email: string; telefono: string }> = {},
): Promise<UsuarioDePrueba> {
  contador += 1;
  const contrasena = 'clave-segura-123';
  const entidad = a.dataSource.getRepository(UsuarioEntidad).create({
    id: nuevoId('usr'),
    nombre: datos.nombre ?? `${rol} ${contador}`,
    email: (
      datos.email ?? `${rol}${contador}-${Date.now()}@prueba.ar`
    ).toLowerCase(),
    telefono: datos.telefono ?? '3455-400000',
    rol,
    contrasenaHash: await hashContrasena(contrasena),
    cancelacionesTardias: 0,
    ausencias: 0,
    creadoEn: a.reloj.ahora(),
  });
  await a.dataSource.getRepository(UsuarioEntidad).save(entidad);
  const res = await a
    .http()
    .post('/auth/ingreso')
    .send({ email: entidad.email, contrasena });
  if (res.status !== 200)
    throw new Error(`No se pudo ingresar: ${JSON.stringify(res.body)}`);
  const { token, usuario } = (
    res.body as { datos: { token: string; usuario: Usuario } }
  ).datos;
  return { token, usuario, contrasena };
}
