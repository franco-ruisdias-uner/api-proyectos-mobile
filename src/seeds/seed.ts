import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { type DataSource, IsNull, Not } from 'typeorm';
import type { AlmacenArchivos } from '../common/files/file-storage.js';
import { nuevaClave } from '../common/files/rules/keys.js';
import { hashearContrasena } from '../common/auth/passwords.js';
import { hoyEnZona } from '../common/dates/dates.js';
import type { Reloj } from '../common/clock/clock.js';
import { normalizarParaBusqueda } from '../common/text/text.js';
import { Comercio } from '../modules/businesses/business.entity.js';
import { Promocion } from '../modules/promotions/promotion.entity.js';
import { Rubro } from '../modules/businesses/category.entity.js';
import { Favorito } from '../modules/users/favorite.entity.js';
import { RubroDeInteres } from '../modules/users/interest-category.entity.js';
import { ReporteDeResena } from '../modules/reviews/review-report.entity.js';
import { Resena } from '../modules/reviews/review.entity.js';
import { promedioDeEstrellas } from '../modules/reviews/rules/reviews.js';
import { UsoDePromocion } from '../modules/redemptions/promotion-redemption.entity.js';
import { Usuario } from '../modules/users/user.entity.js';
import { COMERCIOS } from './data/businesses.js';
import { PROMOCIONES } from './data/promotions.js';
import { generarResenas, VECINOS_DE_RELLENO } from './data/reviews.js';
import { generarUsos } from './data/redemptions.js';
import { RUBROS } from './data/categories.js';
import { CONTRASENA_DEMO, FAVORITOS_DEMO, RUBROS_DE_INTERES_DEMO, USUARIOS } from './data/users.js';

export interface DependenciasSemillas {
  dataSource: DataSource;
  reloj: Reloj;
  /** Los medios de demo se suben por el puerto, así existen en cualquier proveedor (AGENTS §17.4). */
  almacen: AlmacenArchivos;
}

const MILISEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000;

/** Sube las imágenes de `src/seeds/media/` y devuelve nombre → clave. */
async function subirMedios(almacen: AlmacenArchivos, reloj: Reloj): Promise<Map<string, string>> {
  const usados = new Set([
    ...COMERCIOS.flatMap((c) => c.imagenes),
    ...PROMOCIONES.flatMap((p) => (p.imagen ? [p.imagen] : [])),
  ]);
  const claves = new Map<string, string>();
  for (const nombre of usados) {
    const contenido = await readFile(join(import.meta.dirname, 'media', `${nombre}.png`));
    const clave = nuevaClave('imagen', 'png', reloj.ahora());
    await almacen.guardar(clave, contenido, 'image/png');
    claves.set(nombre, clave);
  }
  return claves;
}

const VIDEO_DE_MUESTRA = 'sample';

/** Sube el video de muestra una sola vez y devuelve su clave. */
async function subirVideo(almacen: AlmacenArchivos, reloj: Reloj): Promise<string> {
  const contenido = await readFile(join(import.meta.dirname, 'media', `${VIDEO_DE_MUESTRA}.mp4`));
  const clave = nuevaClave('video', 'mp4', reloj.ahora());
  await almacen.guardar(clave, contenido, 'video/mp4');
  return clave;
}

/** Carga los datos de demo. Supone la base vacía (ver `db:reiniciar` y SEMBRAR_SI_VACIA). */
export async function sembrar({ dataSource, reloj, almacen }: DependenciasSemillas): Promise<void> {
  const hash = await hashearContrasena(CONTRASENA_DEMO);
  const medios = await subirMedios(almacen, reloj);
  const claveVideo = await subirVideo(almacen, reloj);
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
      COMERCIOS.map(({ vacacionesDias, imagenes, video, ...c }) => ({
        ...c,
        nombreBusqueda: normalizarParaBusqueda(c.nombre),
        descripcionBusqueda: normalizarParaBusqueda(c.descripcion),
        imagenes: imagenes.map((nombre) => medios.get(nombre)!),
        videoClave: video ? claveVideo : null,
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
