// Carga los datos de demo. Se usa desde `pnpm db:reiniciar` y, con SEMBRAR_SI_VACIA,
// al arrancar la API contra una base vacía.
import type { DataSource } from 'typeorm';
import { hashContrasena } from '../comun/auth/contrasenas.js';
import type { Reloj } from '../comun/reloj/reloj.js';
import { UsuarioEntidad } from '../modulos/usuarios/usuario.entidad.js';
import { CONTRASENA_DEMO, USUARIOS } from './datos/usuarios.js';

export async function sembrar(
  dataSource: DataSource,
  reloj: Reloj,
): Promise<void> {
  const ahora = reloj.ahora();
  const contrasenaHash = await hashContrasena(CONTRASENA_DEMO);
  await dataSource.transaction(async (m) => {
    await m
      .getRepository(UsuarioEntidad)
      .insert(USUARIOS.map((u) => ({ ...u, contrasenaHash, creadoEn: ahora })));
  });
}

/** ¿La base está vacía? (se mira la tabla de usuarios, que siempre tiene algo sembrado). */
export async function baseVacia(dataSource: DataSource): Promise<boolean> {
  return (await dataSource.getRepository(UsuarioEntidad).count()) === 0;
}
