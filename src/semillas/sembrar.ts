// Datos de demo. Idempotente: lo que ya existe (por id) no se toca. Cada módulo agrega lo suyo.
// Los medios de demo se suben por el puerto AlmacenArchivos (AGENTS §17.4).
import type { DataSource } from 'typeorm';
import type { AlmacenArchivos } from '../comun/archivos/almacen-archivos.js';
import { hashearContrasena } from '../comun/auth/contrasenas.js';
import { parsearInstante } from '../comun/fechas/fechas.js';
import type { Reloj } from '../comun/reloj/reloj.js';
import { Usuario } from '../modulos/usuarios/usuario.entidad.js';
import { Cuadrilla } from '../modulos/catalogos/cuadrilla.entidad.js';
import { TipoDeReporte } from '../modulos/catalogos/tipo-de-reporte.entidad.js';
import { Zona } from '../modulos/catalogos/zona.entidad.js';
import { CUADRILLAS_DEMO, TIPOS_DEMO, ZONAS_DEMO } from './datos/catalogos.js';
import { CONTRASENA_DEMO, USUARIOS_DEMO } from './datos/usuarios.js';

export async function sembrar(
  dataSource: DataSource,
  _almacen: AlmacenArchivos,
  _reloj: Reloj,
): Promise<void> {
  await sembrarCatalogos(dataSource);
  await sembrarUsuarios(dataSource);
}

/** Inserta lo que falta (por id) de una lista de datos de demo. */
async function sembrarLista<T extends { id: string }>(
  dataSource: DataSource,
  entidad: new () => T,
  datos: T[],
): Promise<void> {
  const repo = dataSource.getRepository(entidad);
  for (const d of datos) {
    if (await repo.existsBy({ id: d.id } as never)) continue;
    await repo.insert(d as never);
  }
}

async function sembrarCatalogos(dataSource: DataSource): Promise<void> {
  await sembrarLista(dataSource, TipoDeReporte, TIPOS_DEMO as TipoDeReporte[]);
  await sembrarLista(dataSource, Zona, ZONAS_DEMO as Zona[]);
  await sembrarLista(dataSource, Cuadrilla, CUADRILLAS_DEMO as Cuadrilla[]);
}

/** ¿La base no tiene datos? (SEMBRAR_SI_VACIA siembra sólo en ese caso). */
export async function baseVacia(dataSource: DataSource): Promise<boolean> {
  return (await dataSource.getRepository(Usuario).count()) === 0;
}

async function sembrarUsuarios(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(Usuario);
  const hash = await hashearContrasena(CONTRASENA_DEMO);
  for (const u of USUARIOS_DEMO) {
    if (await repo.existsBy({ id: u.id })) continue;
    const creadoEn = parsearInstante(u.creadoEn);
    if (!creadoEn) throw new Error(`Fecha inválida en la semilla de ${u.id}`);
    await repo.insert({ ...u, contrasenaHash: hash, creadoEn });
  }
}
