import type { DataSource } from 'typeorm';
import { hashearContrasena } from '../comun/auth/contrasenas.js';
import type { Reloj } from '../comun/reloj/reloj.js';
import { UsuarioEntidad } from '../modulos/usuarios/usuario.entidad.js';
import { USUARIOS } from './datos/usuarios.js';

/** Carga los datos de demo en una base vacía (con el esquema ya creado). */
export async function sembrar(dataSource: DataSource, reloj: Reloj): Promise<void> {
  await dataSource.transaction(async (manejador) => {
    const usuarios = manejador.getRepository(UsuarioEntidad);
    for (const u of USUARIOS) {
      await usuarios.insert({
        id: u.id,
        nombre: u.nombre,
        email: u.email,
        contrasenaHash: await hashearContrasena(u.contrasena),
        rol: u.rol,
        avisosActivos: true,
        tema: 'sistema',
        creadoEn: reloj.ahora(),
      });
    }
  });
}

/** ¿La base está vacía? Se mira la tabla de usuarios, que siempre tiene datos de demo. */
export async function baseVacia(dataSource: DataSource): Promise<boolean> {
  return (await dataSource.getRepository(UsuarioEntidad).count()) === 0;
}
