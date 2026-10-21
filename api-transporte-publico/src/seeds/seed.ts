import type { DataSource, EntityManager } from 'typeorm';
import type { ArchivosServicio } from '../common/files/files.service.js';
import { hashearContrasena } from '../common/auth/passwords.js';
import type { Reloj } from '../common/clock/clock.js';
import { LineaFavoritaEntidad, ParadaFavoritaEntidad } from '../modules/users/favorite.entity.js';
import { UsuarioEntidad } from '../modules/users/user.entity.js';
import { LineaEntidad } from '../modules/network/line.entity.js';
import { ParadaEntidad } from '../modules/network/stop.entity.js';
import { RecorridoParadaEntidad } from '../modules/network/trip-stop.entity.js';
import { RecorridoEntidad } from '../modules/network/trip.entity.js';
import { ordenDeNumero } from '../modules/network/rules/line-number.js';
import { normalizarParaBusqueda } from '../common/text/texto.js';
import { FeriadoEntidad } from '../modules/schedules/holiday.entity.js';
import { HorarioEntidad } from '../modules/schedules/schedule.entity.js';
import { AvisoLineaEntidad } from '../modules/notices/notice-line.entity.js';
import { AvisoEntidad } from '../modules/notices/notice.entity.js';
import { ConfirmacionDemoraEntidad } from '../modules/reports/delay-confirmation.entity.js';
import { ReporteDemoraEntidad } from '../modules/reports/delay-report.entity.js';
import { reportesDeDemo } from './data/reports.js';
import { avisosDeDemo } from './data/notices.js';
import { CLAVE_DE_LA_FOTO_DE_DEMO, fotoDeDemo } from './media/demo-photo.js';
import { CLAVE_DEL_VIDEO_DE_DEMO, videoDeDemo } from './media/demo-video.js';
import { FERIADOS } from './data/holidays.js';
import { generarHorarios } from './data/schedules.js';
import { LINEAS, PARADAS } from './data/network.js';
import { FAVORITAS_DE_DEMO, USUARIOS } from './data/users.js';

/**
 * Carga los datos de demo en una base vacía (con el esquema ya creado). Los medios de muestra se
 * suben por el puerto de archivos (AGENTS §17.4); sin `archivos` no se suben.
 */
export async function sembrar(
  dataSource: DataSource,
  reloj: Reloj,
  archivos?: ArchivosServicio,
): Promise<void> {
  await archivos?.guardarConClave(CLAVE_DEL_VIDEO_DE_DEMO, videoDeDemo(), 'video/mp4');
  await archivos?.guardarConClave(CLAVE_DE_LA_FOTO_DE_DEMO, fotoDeDemo(), 'image/png');
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
    await sembrarRed(manejador);
    await sembrarHorarios(manejador);
    await sembrarFavoritas(manejador);
    await sembrarAvisos(manejador, reloj.ahora());
    await sembrarReportes(manejador, reloj.ahora());
  });
}

/** ¿La base está vacía? Se mira la tabla de usuarios, que siempre tiene datos de demo. */
export async function baseVacia(dataSource: DataSource): Promise<boolean> {
  return (await dataSource.getRepository(UsuarioEntidad).count()) === 0;
}

/** M1: paradas, líneas y recorridos (las paradas de cada recorrido, en orden de paso). */
async function sembrarRed(manejador: EntityManager): Promise<void> {
  await manejador
    .getRepository(ParadaEntidad)
    .insert(PARADAS.map((p) => ({ ...p, nombreBusqueda: normalizarParaBusqueda(p.nombre) })));
  await manejador.getRepository(LineaEntidad).insert(
    LINEAS.map((l) => ({
      id: l.id,
      numero: l.numero,
      numeroOrden: ordenDeNumero(l.numero),
      nombre: l.nombre,
      color: l.color,
      empresa: l.empresa,
      activa: l.activa,
    })),
  );
  for (const linea of LINEAS) {
    for (const r of linea.recorridos) {
      await manejador.getRepository(RecorridoEntidad).insert({
        lineaId: linea.id,
        sentido: r.sentido,
        destino: r.destino,
        trazado: r.trazado.map(([latitud, longitud]) => ({ latitud, longitud })),
      });
      await manejador.getRepository(RecorridoParadaEntidad).insert(
        r.paradaIds.map((paradaId, orden) => ({
          lineaId: linea.id,
          sentido: r.sentido,
          orden,
          paradaId,
        })),
      );
    }
  }
}

/** M2: la tabla de horarios y los feriados. Se inserta de a tandas por el límite de variables. */
async function sembrarHorarios(manejador: EntityManager): Promise<void> {
  await manejador.getRepository(FeriadoEntidad).insert(FERIADOS);
  const horarios = generarHorarios();
  for (let desde = 0; desde < horarios.length; desde += 500) {
    await manejador.getRepository(HorarioEntidad).insert(horarios.slice(desde, desde + 500));
  }
}

/** M3: líneas y paradas favoritas de las cuentas de demo (después de la red). */
async function sembrarFavoritas(manejador: EntityManager): Promise<void> {
  for (const [usuarioId, { lineas, paradas }] of Object.entries(FAVORITAS_DE_DEMO)) {
    for (const [orden, lineaId] of lineas.entries()) {
      await manejador.getRepository(LineaFavoritaEntidad).insert({ usuarioId, lineaId, orden });
    }
    for (const [orden, paradaId] of paradas.entries()) {
      await manejador.getRepository(ParadaFavoritaEntidad).insert({ usuarioId, paradaId, orden });
    }
  }
}

/** M4: avisos de demo, con las líneas que afectan en orden (después de la red). */
async function sembrarAvisos(manejador: EntityManager, ahora: Date): Promise<void> {
  for (const { lineaIds, ...aviso } of avisosDeDemo(ahora)) {
    await manejador.getRepository(AvisoEntidad).insert(aviso);
    await manejador
      .getRepository(AvisoLineaEntidad)
      .insert(lineaIds.map((lineaId, orden) => ({ avisoId: aviso.id, lineaId, orden })));
  }
}

/** M5: reportes de demora de demo y sus confirmaciones (después de la red y los usuarios). */
async function sembrarReportes(manejador: EntityManager, ahora: Date): Promise<void> {
  for (const { confirmaronIds, ...reporte } of reportesDeDemo(ahora)) {
    await manejador
      .getRepository(ReporteDemoraEntidad)
      .insert({ ...reporte, confirmaciones: confirmaronIds.length });
    for (const usuarioId of confirmaronIds) {
      await manejador.getRepository(ConfirmacionDemoraEntidad).insert({
        reporteId: reporte.id,
        usuarioId,
        creadaEn: new Date(Math.floor(ahora.getTime() / 1000) * 1000),
      });
    }
  }
}
