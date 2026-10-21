// Carga los datos de demo. Se usa desde `pnpm db:reiniciar` y, con SEMBRAR_SI_VACIA,
// al arrancar la API contra una base vacía.
import type { DataSource } from 'typeorm';
import type { AlmacenArchivos } from '../common/files/file-storage.js';
import { aIsoConZona } from '../common/dates/dates.js';
import { hashContrasena } from '../common/auth/passwords.js';
import type { Reloj } from '../common/clock/clock.js';
import { DeporteEntidad } from '../modules/venues/sport.entity.js';
import { EspacioEntidad } from '../modules/venues/venue.entity.js';
import { normalizarTexto } from '../common/text/text.js';
import { diaEnZona } from '../common/dates/dates.js';
import { BloqueoEntidad } from '../modules/slots/block.entity.js';
import { ReservaFijaEntidad } from '../modules/slots/standing-booking.entity.js';
import { ReservaEntidad } from '../modules/slots/reserva.entity.js';
import { FavoritoEntidad } from '../modules/users/favorite.entity.js';
import { UsuarioEntidad } from '../modules/users/user.entity.js';
import { DEPORTES, ESPACIOS } from './data/venues.js';
import { subirMedios } from './media.js';
import { turnosDeDemo } from './data/slots.js';
import { CONTRASENA_DEMO, USUARIOS } from './data/users.js';

export async function sembrar(
  dataSource: DataSource,
  reloj: Reloj,
  almacen?: AlmacenArchivos,
): Promise<void> {
  const ahora = reloj.ahora();
  // Sin almacén (algunos tests) los espacios quedan sin imágenes.
  const [anio, mes] = aIsoConZona(ahora).split('-');
  const imagenes = almacen
    ? await subirMedios(almacen, ESPACIOS, anio, mes)
    : new Map<string, string[]>();
  const contrasenaHash = await hashContrasena(CONTRASENA_DEMO);
  await dataSource.transaction(async (m) => {
    await m
      .getRepository(UsuarioEntidad)
      .insert(USUARIOS.map((u) => ({ ...u, contrasenaHash, creadoEn: ahora })));
    // Emiliano (usr-207) tiene la cancha 2 de favorita (ESPECIFICACION §8).
    await m
      .getRepository(FavoritoEntidad)
      .insert({ usuarioId: 'usr-207', espacioId: 'esp-02', creadoEn: ahora });
    await m.getRepository(DeporteEntidad).insert(DEPORTES);
    await m.getRepository(EspacioEntidad).insert(
      ESPACIOS.map((e) => ({
        ...e,
        imagenes: imagenes.get(e.id) ?? e.imagenes,
        complejoBusqueda: normalizarTexto(e.complejo),
      })),
    );
    const turnos = turnosDeDemo(diaEnZona(ahora), ahora);
    await m.getRepository(ReservaFijaEntidad).insert(turnos.fijas);
    await m.getRepository(BloqueoEntidad).insert(turnos.bloqueos);
    await m.getRepository(ReservaEntidad).insert(turnos.reservas);
  });
}

/** ¿La base está vacía? (se mira la tabla de usuarios, que siempre tiene algo sembrado). */
export async function baseVacia(dataSource: DataSource): Promise<boolean> {
  return (await dataSource.getRepository(UsuarioEntidad).count()) === 0;
}
