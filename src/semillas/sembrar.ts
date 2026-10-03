import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { type DataSource, IsNull, Not } from 'typeorm';
import type { AlmacenArchivos } from '../comun/archivos/almacen-archivos.js';
import { nuevaClave } from '../comun/archivos/reglas/claves.js';
import { hashearContrasena } from '../comun/auth/contrasenas.js';
import { hoyEnZona } from '../comun/fechas/fechas.js';
import type { Reloj } from '../comun/reloj/reloj.js';
import { normalizarParaBusqueda } from '../comun/texto/texto.js';
import { Comercio } from '../modulos/comercios/comercio.entidad.js';
import { Promocion } from '../modulos/promociones/promocion.entidad.js';
import { Rubro } from '../modulos/comercios/rubro.entidad.js';
import { Favorito } from '../modulos/usuarios/favorito.entidad.js';
import { RubroDeInteres } from '../modulos/usuarios/rubro-de-interes.entidad.js';
import { ReporteDeResena } from '../modulos/resenas/reporte-de-resena.entidad.js';
import { Resena } from '../modulos/resenas/resena.entidad.js';
import { promedioDeEstrellas } from '../modulos/resenas/reglas/resenas.js';
import { UsoDePromocion } from '../modulos/usos/uso-de-promocion.entidad.js';
import { Usuario } from '../modulos/usuarios/usuario.entidad.js';
import { COMERCIOS } from './datos/comercios.js';
import { PROMOCIONES } from './datos/promociones.js';
import { generarResenas, VECINOS_DE_RELLENO } from './datos/resenas.js';
import { generarUsos } from './datos/usos.js';
import { RUBROS } from './datos/rubros.js';
import {
  CONTRASENA_DEMO,
  FAVORITOS_DEMO,
  RUBROS_DE_INTERES_DEMO,
  USUARIOS,
} from './datos/usuarios.js';

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

  const { resenas, reportes } = generarResenas(COMERCIOS);

  await dataSource.transaction(async (m) => {
    await m
      .getRepository(Usuario)

      .insert(
        [...USUARIOS, ...VECINOS_DE_RELLENO].map((u) => ({
          ...u,
          hashContrasena: hash,
          creadoEn: ahora,
        })),
      );
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
    await m.getRepository(Favorito).insert(
      FAVORITOS_DEMO.map((f, i) => ({
        ...f,
        creadoEn: new Date(ahora.getTime() - (FAVORITOS_DEMO.length - i) * MILISEGUNDOS_POR_DIA),
      })),
    );
    await m
      .getRepository(RubroDeInteres)
      .insert(RUBROS_DE_INTERES_DEMO.map((r, posicion) => ({ ...r, posicion })));
    await m.getRepository(Promocion).insert(
      PROMOCIONES.map(({ desdeDias, hastaDias, imagen, ...p }) => ({
        ...p,
        desde: new Date(ahora.getTime() + desdeDias * MILISEGUNDOS_POR_DIA),
        hasta: new Date(ahora.getTime() + hastaDias * MILISEGUNDOS_POR_DIA),
        imagenClave: imagen === null ? null : medios.get(imagen)!,
      })),
    );
    await m.getRepository(UsoDePromocion).insert(
      generarUsos().map(({ validado, ...u }) => {
        const promo = PROMOCIONES.find((p) => p.id === u.promocionId)!;
        if (!validado) {
          return {
            ...u,
            generadoEn: new Date(ahora.getTime() - MILISEGUNDOS_POR_DIA),
            validadoEn: null,
          };
        }
        // Repartidos entre el comienzo de la promo y hoy (o su fin, si ya venció).
        const desde = ahora.getTime() + promo.desdeDias * MILISEGUNDOS_POR_DIA;
        const fin = Math.min(
          ahora.getTime(),
          ahora.getTime() + promo.hastaDias * MILISEGUNDOS_POR_DIA,
        );
        const validadoEn = new Date(
          desde + ((fin - desde) * (validado.posicion + 1)) / (validado.total + 1),
        );
        return { ...u, generadoEn: new Date(validadoEn.getTime() - 5 * 60 * 1000), validadoEn };
      }),
    );
    // R13 (A20): `usos` de cada promo sale de los usos validados sembrados, no de un número fijo.
    for (const { id } of PROMOCIONES) {
      const usos = await m
        .getRepository(UsoDePromocion)
        .count({ where: { promocionId: id, validadoEn: Not(IsNull()) } });
      await m.getRepository(Promocion).update({ id }, { usos });
    }
    await m.getRepository(Resena).insert(
      resenas.map(({ haceDias, ...r }) => ({
        ...r,
        reportada: reportes.some((x) => x.resenaId === r.id),
        creadaEn: new Date(ahora.getTime() - haceDias * MILISEGUNDOS_POR_DIA),
      })),
    );
    await m
      .getRepository(ReporteDeResena)
      .insert(
        reportes.map((r) => ({ ...r, creadoEn: new Date(ahora.getTime() - MILISEGUNDOS_POR_DIA) })),
      );
    // R8 (A20): puntaje y cantidad salen de las reseñas sembradas, no de números fijos.
    for (const { id } of COMERCIOS) {
      const propias = resenas.filter((r) => r.comercioId === id).map((r) => r.estrellas);
      await m
        .getRepository(Comercio)
        .update({ id }, { puntaje: promedioDeEstrellas(propias), cantidadResenas: propias.length });
    }
  });
}

/** ¿Está vacía la base? Se mira la tabla de usuarios, que tiene datos en toda semilla. */
export async function baseVacia(dataSource: DataSource): Promise<boolean> {
  return (await dataSource.getRepository(Usuario).count()) === 0;
}
