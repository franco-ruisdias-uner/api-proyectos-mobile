import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AlmacenArchivos } from '../common/files/file-storage.js';
import { hashearContrasena } from '../common/auth/passwords.js';
import { Reloj } from '../common/clock/clock.js';
import { CategoriasServicio } from '../modules/categories/categories.service.js';
import { EventosServicio } from '../modules/events/events.service.js';
import { comienzoDelDia } from '../modules/events/rules/agenda.js';
import { EventosGuardadosServicio } from '../modules/saved-events/saved-events.service.js';
import { FavoritosServicio } from '../modules/favorites/favorites.service.js';
import { VisitasServicio } from '../modules/visits/visits.service.js';
import { LugaresServicio } from '../modules/places/places.service.js';
import { UsuarioEntidad } from '../modules/users/user.entity.js';
import { diaLocal } from '../common/dates/dates.js';
import { CATEGORIAS_SEMILLA, LUGARES_SEMILLA } from './data/catalog.js';
import { EVENTOS_SEMILLA, type Momento } from './data/events.js';
import { USUARIOS_SEMILLA } from './data/users.js';
import { duracionMp3, MediosSemilla } from './media.js';

const DIA = 24 * 60 * 60 * 1000;

/**
 * Carga los datos de demo. Todo lo temporal se calcula relativo al reloj (AGENTS §6), así la
 * demo siempre tiene "hoy". Cada módulo agrega lo suyo acá.
 */
@Injectable()
export class Sembrador {
  private readonly log = new Logger('Semillas');

  constructor(
    private readonly dataSource: DataSource,
    private readonly reloj: Reloj,
    private readonly almacen: AlmacenArchivos,
    private readonly categorias: CategoriasServicio,
    private readonly lugares: LugaresServicio,
    private readonly eventos: EventosServicio,
    private readonly favoritos: FavoritosServicio,
    private readonly visitas: VisitasServicio,
    private readonly eventosGuardados: EventosGuardadosServicio,
  ) {}

  async estaVacia(): Promise<boolean> {
    return (await this.dataSource.getRepository(UsuarioEntidad).count()) === 0;
  }

  async sembrar(): Promise<void> {
    const ahora = this.reloj.ahora();
    const usuarios = this.dataSource.getRepository(UsuarioEntidad);
    for (const u of USUARIOS_SEMILLA) {
      await usuarios.insert({
        id: u.id,
        nombre: u.nombre,
        email: u.email,
        hashContrasena: await hashearContrasena(u.contrasena),
        rol: u.rol,
        avatarClave: null,
        creadoEn: new Date(ahora.getTime() - u.creadoHaceDias * DIA),
        preferencias: u.preferencias,
        version: 0,
      });
    }
    await this.sembrarCatalogo(ahora);
    await this.sembrarAgenda(ahora);
    await this.sembrarFavoritos(ahora);
    await this.sembrarVisitas(ahora);
    await this.sembrarEventosGuardados(ahora);
    this.log.log(
      `Datos de demo cargados: ${USUARIOS_SEMILLA.length} usuarios, ${CATEGORIAS_SEMILLA.length} categorías ` +
        `${LUGARES_SEMILLA.length} lugares y ${EVENTOS_SEMILLA.length} eventos.`,
    );
  }

  /** M1: categorías, lugares, sus imágenes y sus audioguías (subidas por el puerto de archivos). */
  private async sembrarCatalogo(ahora: Date): Promise<void> {
    const medios = new MediosSemilla(this.almacen, ahora);
    for (const categoria of CATEGORIAS_SEMILLA) await this.categorias.cargar(categoria);
    for (const { imagenes, audioguia, actualizadoHaceDias, actualizadoEnFijo, ...lugar } of LUGARES_SEMILLA) {
      const fijo = actualizadoEnFijo ? new Date(actualizadoEnFijo) : null;
      await this.lugares.cargar({
        ...lugar,
        imagenes: await Promise.all(imagenes.map((archivo) => medios.subir(archivo))),
        audioguia: audioguia
          ? {
              clave: await medios.subir(audioguia),
              duracionSegundos: Math.round(duracionMp3(medios.leer(audioguia))),
              idioma: 'es',
            }
          : null,
        actualizadoEn:
          fijo && fijo.getTime() <= ahora.getTime()
            ? fijo
            : new Date(ahora.getTime() - actualizadoHaceDias * DIA),
      });
    }
  }

  /** M2: la agenda, relativa a hoy en hora de Buenos Aires. */
  private async sembrarAgenda(ahora: Date): Promise<void> {
    const medios = new MediosSemilla(this.almacen, ahora);
    const hoy = diaLocal(ahora);
    const instante = ({ dia, hora }: Momento): Date => {
      const [h, m] = hora.split(':').map(Number);
      // Sumar días al mediodía y volver a las 00:00 evita depender del largo del día.
      const base = comienzoDelDia(
        diaLocal(new Date(comienzoDelDia(hoy).getTime() + (dia * 24 + 12) * 3600_000)),
      );
      return new Date(base.getTime() + (h * 60 + m) * 60_000);
    };
    for (const { imagen, inicio, fin, ...evento } of EVENTOS_SEMILLA) {
      await this.eventos.cargar({
        ...evento,
        inicio: instante(inicio),
        fin: fin ? instante(fin) : null,
        imagenClave: imagen ? await medios.subir(imagen) : null,
      });
    }
  }

  /** M3: los favoritos de Lucía (`fav-088` es el del PRD). El usuario nuevo no tiene ninguno. */
  private async sembrarFavoritos(ahora: Date): Promise<void> {
    const hace = (dias: number) => new Date(ahora.getTime() - dias * DIA);
    await this.favoritos.cargar({
      id: 'fav-088',
      usuarioId: 'usr-201',
      lugarId: 'lug-004',
      creadoEn: hace(19),
    });
    await this.favoritos.cargar({
      id: 'fav-089',
      usuarioId: 'usr-201',
      lugarId: 'lug-009',
      creadoEn: hace(12),
    });
    await this.favoritos.cargar({
      id: 'fav-090',
      usuarioId: 'usr-201',
      lugarId: 'lug-001',
      creadoEn: hace(3),
    });
  }

  /**
   * M4: el recorrido de Lucía. `vis-311` es el del PRD, ya con la foto subida (el ejemplo del PRD
   * la muestra con `file://` porque es el estado *antes* de subirla). El usuario nuevo no tiene.
   */
  private async sembrarVisitas(ahora: Date): Promise<void> {
    const medios = new MediosSemilla(this.almacen, ahora);
    const hace = (dias: number, horas = 0) => new Date(ahora.getTime() - dias * DIA - horas * 3600_000);
    const base = { usuarioId: 'usr-201', nota: null, fotoClave: null };
    await this.visitas.cargar({
      ...base,
      id: 'vis-311',
      lugarId: 'lug-004',
      fechaHora: hace(14, 2),
      origen: 'qr',
      fotoClave: await medios.subir('museums-1.png'),
      nota: 'Hacía 38 grados pero valió la pena',
    });
    await this.visitas.cargar({
      ...base,
      id: 'vis-312',
      lugarId: 'lug-009',
      fechaHora: hace(9),
      origen: 'gps',
    });
    await this.visitas.cargar({
      ...base,
      id: 'vis-313',
      lugarId: 'lug-001',
      fechaHora: hace(3, 5),
      origen: 'manual',
      fotoClave: await medios.subir('hot-springs-1.png'),
    });
    // El mismo lugar, otra vez el mismo día (R16).
    await this.visitas.cargar({
      ...base,
      id: 'vis-314',
      lugarId: 'lug-001',
      fechaHora: hace(3, 1),
      origen: 'gps',
      nota: 'Volvimos a la tarde.',
    });
  }

  /** M5: Lucía guardó la peña de hoy (`evt-017`). Ojo: si el admin la suspende, a ella le llega la push. */
  private async sembrarEventosGuardados(ahora: Date): Promise<void> {
    await this.eventosGuardados.cargar({
      usuarioId: 'usr-201',
      eventoId: 'evt-017',
      creadoEn: new Date(ahora.getTime() - 2 * DIA),
    });
  }
}
