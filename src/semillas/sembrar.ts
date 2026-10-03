import type { DataSource } from 'typeorm';
import { hashearContrasena } from '../comun/auth/contrasenas.js';
import type { Reloj } from '../comun/reloj/reloj.js';
import { Usuario } from '../modulos/usuarios/usuario.entidad.js';
import { CONTRASENA_DEMO, USUARIOS } from './datos/usuarios.js';

export interface DependenciasSemillas {
  dataSource: DataSource;
  reloj: Reloj;
}

/** Carga los datos de demo. Supone la base vacía (ver `db:reiniciar` y SEMBRAR_SI_VACIA). */
export async function sembrar({ dataSource, reloj }: DependenciasSemillas): Promise<void> {
  const hash = await hashearContrasena(CONTRASENA_DEMO);
  await dataSource.transaction(async (m) => {
    await m
      .getRepository(Usuario)
      .insert(USUARIOS.map((u) => ({ ...u, hashContrasena: hash, creadoEn: reloj.ahora() })));
  });
}

/** ¿Está vacía la base? Se mira la tabla de usuarios, que tiene datos en toda semilla. */
export async function baseVacia(dataSource: DataSource): Promise<boolean> {
  return (await dataSource.getRepository(Usuario).count()) === 0;
}
