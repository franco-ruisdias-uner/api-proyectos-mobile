// Datos de demo. Idempotente: lo que ya existe (por id) no se toca. Cada módulo agrega lo suyo.
// Los medios de demo se suben por el puerto AlmacenArchivos (AGENTS §17.4).
import type { DataSource } from 'typeorm';
import type { AlmacenArchivos } from '../comun/archivos/almacen-archivos.js';
import { nuevaClave } from '../comun/archivos/claves.js';
import { hashearContrasena } from '../comun/auth/contrasenas.js';
import { anioMesEnZona, parsearInstante } from '../comun/fechas/fechas.js';
import { nuevoId } from '../comun/ids/ids.js';
import type { Reloj } from '../comun/reloj/reloj.js';
import { Usuario } from '../modulos/usuarios/usuario.entidad.js';
import { Cuadrilla } from '../modulos/catalogos/cuadrilla.entidad.js';
import { TipoDeReporte } from '../modulos/catalogos/tipo-de-reporte.entidad.js';
import { Zona } from '../modulos/catalogos/zona.entidad.js';
import { Adhesion } from '../modulos/reportes/adhesion.entidad.js';
import { CambioDeEstado } from '../modulos/reportes/cambio-de-estado.entidad.js';
import { FotoDeReporte } from '../modulos/reportes/foto.entidad.js';
import { formatearCodigo } from '../modulos/reportes/reglas/codigo.js';
import { Reporte } from '../modulos/reportes/reporte.entidad.js';
import { CUADRILLAS_DEMO, TIPOS_DEMO, ZONAS_DEMO } from './datos/catalogos.js';
import { REPORTES_DEMO } from './datos/reportes.js';
import { audioDeMuestra, fotoDeMuestra } from './medios/generar.js';
import { CONTRASENA_DEMO, USUARIOS_DEMO } from './datos/usuarios.js';

export async function sembrar(
  dataSource: DataSource,
  almacen: AlmacenArchivos,
  reloj: Reloj,
): Promise<void> {
  await sembrarCatalogos(dataSource);
  await sembrarUsuarios(dataSource);
  await sembrarReportes(dataSource, almacen, reloj);
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

/** Los reportes de demo, con sus fotos (subidas por el puerto de archivos) y su historial. */
async function sembrarReportes(
  dataSource: DataSource,
  almacen: AlmacenArchivos,
  reloj: Reloj,
): Promise<void> {
  const ahora = reloj.ahora();
  const minutos = (desde: Date, min: number) =>
    new Date(desde.getTime() + min * 60_000);
  for (const d of REPORTES_DEMO) {
    if (await dataSource.getRepository(Reporte).existsBy({ id: d.id }))
      continue;
    const creadoEn = minutos(ahora, -d.haceMin);
    const anio = Number(anioMesEnZona(creadoEn).anio);
    const codigo = formatearCodigo(anio, d.numero);

    let audioClave: string | null = null;
    if (d.conAudio) {
      audioClave = nuevaClave('audio', 'mp3', ahora);
      await almacen.guardar(audioClave, audioDeMuestra(), 'audio/mpeg');
    }
    const fotos: FotoDeReporte[] = [];
    for (const [i, f] of d.fotos.entries()) {
      const clave = nuevaClave('imagen', 'png', ahora);
      await almacen.guardar(clave, fotoDeMuestra(f.color), 'image/png');
      fotos.push(
        Object.assign(new FotoDeReporte(), {
          id: f.id ?? nuevoId('fot'),
          reporteId: d.id,
          clave,
          momento: f.momento,
          orden: i + 1,
        }),
      );
    }
    const cambios = d.cambios.map((c, i) =>
      Object.assign(new CambioDeEstado(), {
        id: c.id ?? nuevoId('cam'),
        reporteId: d.id,
        estado: c.estado,
        comentario: c.comentario?.replace('{anio}', String(anio)) ?? null,
        operadorId: c.operadorId,
        fechaHora: minutos(creadoEn, c.despuesDeMin),
        secuencia: i + 1,
      }),
    );
    await dataSource.transaction(async (manager) => {
      await manager.insert(
        Reporte,
        Object.assign(new Reporte(), {
          id: d.id,
          codigo,
          tipoId: d.tipoId,
          descripcion: d.descripcion,
          audioClave,
          latitud: d.latitud,
          longitud: d.longitud,
          direccion: d.direccion,
          zonaId: d.zonaId,
          estado: d.estado,
          autorId: d.autorId,
          cuadrillaId: d.cuadrillaId,
          duplicadoDe: d.duplicadoDe,
          adhesiones: d.adhesionesDe?.length ?? 0,
          creadoEn,
        }),
      );
      await manager.insert(FotoDeReporte, fotos);
      await manager.insert(CambioDeEstado, cambios);
      const adhesiones = (d.adhesionesDe ?? []).map((usuarioId, i) =>
        Object.assign(new Adhesion(), {
          id: nuevoId('adh'),
          reporteId: d.id,
          usuarioId,
          creadoEn: minutos(creadoEn, 30 + i * 45),
        }),
      );
      if (adhesiones.length > 0) await manager.insert(Adhesion, adhesiones);
    });
  }
}
