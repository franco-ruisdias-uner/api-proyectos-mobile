import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { DataSource } from 'typeorm';
import type { AlmacenArchivos } from '../comun/archivos/almacen-archivos.js';
import { nuevaClave } from '../comun/archivos/reglas/claves.js';
import { hashearContrasena } from '../comun/auth/contrasenas.js';
import { hoyEnZona } from '../comun/fechas/fechas.js';
import type { Reloj } from '../comun/reloj/reloj.js';
import { normalizarParaBusqueda } from '../comun/texto/texto.js';
import { Comercio } from '../modulos/comercios/comercio.entidad.js';
import { Promocion } from '../modulos/promociones/promocion.entidad.js';
import { Rubro } from '../modulos/comercios/rubro.entidad.js';
import { Usuario } from '../modulos/usuarios/usuario.entidad.js';
import { COMERCIOS } from './datos/comercios.js';
import { PROMOCIONES } from './datos/promociones.js';
import { RUBROS } from './datos/rubros.js';
import { CONTRASENA_DEMO, USUARIOS } from './datos/usuarios.js';

export interface DependenciasSemillas {
  dataSource: DataSource;
  reloj: Reloj;
  /** Los medios de demo se suben por el puerto, así existen en cualquier proveedor (AGENTS §17.4). */
  almacen: AlmacenArchivos;
}

const MILISEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000;

/** Sube las imágenes de `src/semillas/medios/` y devuelve nombre → clave. */
async function subirMedios(almacen: AlmacenArchivos, reloj: Reloj): Promise<Map<string, string>> {
  const usados = new Set([
    ...COMERCIOS.flatMap((c) => c.imagenes),
    ...PROMOCIONES.flatMap((p) => (p.imagen ? [p.imagen] : [])),
  ]);
  const claves = new Map<string, string>();
  for (const nombre of usados) {
    const contenido = await readFile(join(import.meta.dirname, 'medios', `${nombre}.png`));
    const clave = nuevaClave('imagen', 'png', reloj.ahora());
    await almacen.guardar(clave, contenido, 'image/png');
    claves.set(nombre, clave);
  }
  return claves;
}

/** Carga los datos de demo. Supone la base vacía (ver `db:reiniciar` y SEMBRAR_SI_VACIA). */
export async function sembrar({ dataSource, reloj, almacen }: DependenciasSemillas): Promise<void> {
  const hash = await hashearContrasena(CONTRASENA_DEMO);
  const medios = await subirMedios(almacen, reloj);
  const ahora = reloj.ahora();

  await dataSource.transaction(async (m) => {
    await m
      .getRepository(Usuario)
      .insert(USUARIOS.map((u) => ({ ...u, hashContrasena: hash, creadoEn: ahora })));
    await m.getRepository(Rubro).insert(RUBROS);
    await m.getRepository(Comercio).insert(
      COMERCIOS.map(({ vacacionesDias, imagenes, ...c }) => ({
        ...c,
        nombreBusqueda: normalizarParaBusqueda(c.nombre),
        descripcionBusqueda: normalizarParaBusqueda(c.descripcion),
        imagenes: imagenes.map((nombre) => medios.get(nombre)!),
        videoClave: null,
        cerradoHasta:
          vacacionesDias === null
            ? null
            : hoyEnZona(new Date(ahora.getTime() + vacacionesDias * MILISEGUNDOS_POR_DIA)),
      })),
    );
    await m.getRepository(Promocion).insert(
      PROMOCIONES.map(({ desdeDias, hastaDias, imagen, ...p }) => ({
        ...p,
        desde: new Date(ahora.getTime() + desdeDias * MILISEGUNDOS_POR_DIA),
        hasta: new Date(ahora.getTime() + hastaDias * MILISEGUNDOS_POR_DIA),
        imagenClave: imagen === null ? null : medios.get(imagen)!,
      })),
    );
  });
}

/** ¿Está vacía la base? Se mira la tabla de usuarios, que tiene datos en toda semilla. */
export async function baseVacia(dataSource: DataSource): Promise<boolean> {
  return (await dataSource.getRepository(Usuario).count()) === 0;
}
