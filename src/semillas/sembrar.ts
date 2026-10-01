import type { DataSource, EntityManager } from 'typeorm';
import { hashearContrasena } from '../comun/auth/contrasenas.js';
import type { Reloj } from '../comun/reloj/reloj.js';
import { UsuarioEntidad } from '../modulos/usuarios/usuario.entidad.js';
import { LineaEntidad } from '../modulos/red/linea.entidad.js';
import { ParadaEntidad } from '../modulos/red/parada.entidad.js';
import { RecorridoParadaEntidad } from '../modulos/red/recorrido-parada.entidad.js';
import { RecorridoEntidad } from '../modulos/red/recorrido.entidad.js';
import { ordenDeNumero } from '../modulos/red/reglas/numero-de-linea.js';
import { normalizarParaBusqueda } from '../comun/texto/texto.js';
import { FeriadoEntidad } from '../modulos/horarios/feriado.entidad.js';
import { HorarioEntidad } from '../modulos/horarios/horario.entidad.js';
import { FERIADOS } from './datos/feriados.js';
import { generarHorarios } from './datos/horarios.js';
import { LINEAS, PARADAS } from './datos/red.js';
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
    await sembrarRed(manejador);
    await sembrarHorarios(manejador);
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
