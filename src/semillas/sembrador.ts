import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AlmacenArchivos } from '../comun/archivos/almacen-archivos.js';
import { hashearContrasena } from '../comun/auth/contrasenas.js';
import { Reloj } from '../comun/reloj/reloj.js';
import { CategoriasServicio } from '../modulos/categorias/categorias.servicio.js';
import { EventosServicio } from '../modulos/eventos/eventos.servicio.js';
import { comienzoDelDia } from '../modulos/eventos/reglas/agenda.js';
import { FavoritosServicio } from '../modulos/favoritos/favoritos.servicio.js';
import { LugaresServicio } from '../modulos/lugares/lugares.servicio.js';
import { UsuarioEntidad } from '../modulos/usuarios/usuario.entidad.js';
import { diaLocal } from '../comun/fechas/fechas.js';
import { CATEGORIAS_SEMILLA, LUGARES_SEMILLA } from './datos/catalogo.js';
import { EVENTOS_SEMILLA, type Momento } from './datos/eventos.js';
import { USUARIOS_SEMILLA } from './datos/usuarios.js';
import { duracionMp3, MediosSemilla } from './medios.js';

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
    await this.favoritos.cargar({ id: 'fav-088', usuarioId: 'usr-201', lugarId: 'lug-004', creadoEn: hace(19) });
    await this.favoritos.cargar({ id: 'fav-089', usuarioId: 'usr-201', lugarId: 'lug-009', creadoEn: hace(12) });
    await this.favoritos.cargar({ id: 'fav-090', usuarioId: 'usr-201', lugarId: 'lug-001', creadoEn: hace(3) });
  }
}
