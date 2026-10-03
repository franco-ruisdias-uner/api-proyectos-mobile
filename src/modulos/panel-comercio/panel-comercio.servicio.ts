import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type Repository } from 'typeorm';
import type {
  Comercio as ComercioContrato,
  Promocion as PromocionContrato,
} from '../../../contrato/tipos.js';
import { ArchivosServicio } from '../../comun/archivos/archivos.servicio.js';
import { Avisos } from '../../comun/notificaciones/avisos.js';
import { ErrorApi } from '../../comun/errores/error-api.js';
import { hoyEnZona, parsearInstante } from '../../comun/fechas/fechas.js';
import { nuevoId } from '../../comun/ids/ids.js';
import { Reloj } from '../../comun/reloj/reloj.js';
import { normalizarParaBusqueda } from '../../comun/texto/texto.js';
import { Comercio } from '../comercios/comercio.entidad.js';
import { comercioAContrato } from '../comercios/comercios.mapeador.js';
import { Promocion } from '../promociones/promocion.entidad.js';
import { promocionAContrato } from '../promociones/promociones.mapeador.js';
import { esIdDePromocion } from '../promociones/reglas/promociones.js';
import { Favorito } from '../usuarios/favorito.entidad.js';
import { RubroDeInteres } from '../usuarios/rubro-de-interes.entidad.js';
import { UsuariosServicio } from '../usuarios/usuarios.servicio.js';
import type { ActualizarComercioDto } from './dto/actualizar-comercio.dto.js';
import type { CrearPromocionDto, EditarPromocionDto } from './dto/promocion.dto.js';
import { avisoDePromocion, destinatariosDePromocion } from './reglas/avisos.js';
import { horariosInvalidos, horariosSuperpuestos } from './reglas/horarios.js';
import { sinRepetidos, ventanaDePromocion } from './reglas/panel.js';

/** `AAAA-MM-DD` que existe en el calendario (el 30/02 no). */
function esDiaReal(dia: string): boolean {
  const fecha = new Date(`${dia}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === dia;
}

@Injectable()
export class PanelComercioServicio {
  private readonly logger = new Logger('PanelComercio');

  constructor(
    @InjectRepository(Comercio) private readonly comercios: Repository<Comercio>,
    @InjectRepository(Promocion) private readonly promociones: Repository<Promocion>,
    @InjectRepository(Favorito) private readonly favoritos: Repository<Favorito>,
    @InjectRepository(RubroDeInteres) private readonly intereses: Repository<RubroDeInteres>,
    private readonly usuarios: UsuariosServicio,
    private readonly avisos: Avisos,
    private readonly archivos: ArchivosServicio,
    private readonly reloj: Reloj,
  ) {}

  async verComercio(usuarioId: string): Promise<ComercioContrato> {
    return this.aContrato(await this.comercioDe(usuarioId));
  }

  /** R2 y R14. Valida todo antes de escribir: o se guarda todo o no se guarda nada. */
  async editarComercio(usuarioId: string, dto: ActualizarComercioDto): Promise<ComercioContrato> {
    const comercio = await this.comercioDe(usuarioId);
    const cambios: Partial<Comercio> = {};

    if (dto.nombre !== undefined) {
      cambios.nombre = dto.nombre;
      cambios.nombreBusqueda = normalizarParaBusqueda(dto.nombre);
    }
    if (dto.descripcion !== undefined) {
      cambios.descripcion = dto.descripcion;
      cambios.descripcionBusqueda = normalizarParaBusqueda(dto.descripcion);
    }
    if (dto.direccion !== undefined) cambios.direccion = dto.direccion;
    if (dto.coordenadas !== undefined) {
      cambios.latitud = dto.coordenadas.latitud;
      cambios.longitud = dto.coordenadas.longitud;
    }
    if (dto.telefono !== undefined) cambios.telefono = dto.telefono;
    if (dto.whatsapp !== undefined) cambios.whatsapp = dto.whatsapp;
    if (dto.instagram !== undefined) cambios.instagram = dto.instagram;
    if (dto.mediosDePago !== undefined) cambios.mediosDePago = sinRepetidos(dto.mediosDePago);

    if (dto.cerradoHasta !== undefined) {
      if (dto.cerradoHasta !== null && !esDiaReal(dto.cerradoHasta)) {
        throw new ErrorApi('VALIDACION_FALLIDA', 'El último día de cierre no es una fecha válida.');
      }
      cambios.cerradoHasta = dto.cerradoHasta;
    }

    if (dto.horarios !== undefined) {
      const problema = horariosInvalidos(dto.horarios);
      if (problema === 'abre') {
        throw new ErrorApi('VALIDACION_FALLIDA', 'Cada horario tiene que abrir antes de cerrar.');
      }
      if (problema === 'formato') {
        throw new ErrorApi('VALIDACION_FALLIDA', 'Las horas de los horarios tienen que ser HH:MM.');
      }
      if (horariosSuperpuestos(dto.horarios)) throw new ErrorApi('HORARIOS_SUPERPUESTOS');
      cambios.horarios = dto.horarios.map(({ dia, abre, cierra }) => ({ dia, abre, cierra }));
    }

    if (dto.imagenes !== undefined) {
      const claves: string[] = [];
      for (const url of dto.imagenes) claves.push(await this.claveDe(url, 'imagenes/'));
      cambios.imagenes = claves;
    }
    if (dto.videoUrl !== undefined) {
      cambios.videoClave =
        dto.videoUrl === null ? null : await this.claveDe(dto.videoUrl, 'videos/');
    }

    if (Object.keys(cambios).length > 0) {
      await this.comercios.update({ id: comercio.id }, cambios);
      Object.assign(comercio, cambios);
    }
    return this.aContrato(comercio);
  }

  /** Todas las suyas, vencidas y dadas de baja incluidas. Las más nuevas primero (por `desde`). */
  async listarPromociones(
    usuarioId: string,
    p: { pagina: number; porPagina: number },
  ): Promise<{ datos: PromocionContrato[]; total: number }> {
    const comercio = await this.comercioDe(usuarioId);
    const [filas, total] = await this.promociones.findAndCount({
      where: { comercioId: comercio.id },
      order: { desde: 'DESC', id: 'DESC' },
      skip: (p.pagina - 1) * p.porPagina,
      take: p.porPagina,
    });
    return { datos: filas.map(promocionAContrato), total };
  }

  /** R6. Después de guardar, avisa por push (M7). */
  async crearPromocion(usuarioId: string, dto: CrearPromocionDto): Promise<PromocionContrato> {
    const comercio = await this.comercioDe(usuarioId);
    const ahora = this.reloj.ahora();
    const desde = dto.desde === undefined ? ahora : this.instante(dto.desde, 'La fecha de inicio');
    const hasta = this.instante(dto.hasta, 'La fecha en que termina la promoción');
    this.exigirVentana(desde, hasta, ahora);
    const imagenClave =
      dto.imagenUrl == null ? null : await this.claveDe(dto.imagenUrl, 'imagenes/');

    const nueva: Promocion = {
      id: nuevoId('pro'),
      comercioId: comercio.id,
      titulo: dto.titulo,
      detalle: dto.detalle,
      descuento: dto.descuento ?? null,
      desde,
      hasta,
      imagenClave,
      soloApp: dto.soloApp ?? false,
      usos: 0,
      activa: true,
    };
    await this.promociones.insert(nueva);
    await this.avisarPromocionNueva(usuarioId, comercio, nueva);
    return promocionAContrato(nueva);
  }

  /** ESPECIFICACION §7: favoritos y rubro de interés. El envío no bloquea; un error acá no rompe el alta. */
  private async avisarPromocionNueva(
    autorId: string,
    comercio: Comercio,
    promo: Promocion,
  ): Promise<void> {
    try {
      const [favoritos, interesados] = await Promise.all([
        this.favoritos.find({ select: { usuarioId: true }, where: { comercioId: comercio.id } }),
        this.intereses.find({ select: { usuarioId: true }, where: { rubroId: comercio.rubroId } }),
      ]);
      const ids = destinatariosDePromocion(
        favoritos.map((f) => f.usuarioId),
        interesados.map((i) => i.usuarioId),
        autorId,
      );
      this.avisos.avisar(ids, avisoDePromocion(comercio, promo));
    } catch (error) {
      this.logger.error(`No se pudo armar el aviso de la promo: ${(error as Error).message}`);
    }
  }

  /** R6: sólo una no vencida; la ventana se valida con lo guardado más lo que cambia. */
  async editarPromocion(
    usuarioId: string,
    id: string,
    dto: EditarPromocionDto,
  ): Promise<PromocionContrato> {
    const promo = await this.promoPropia(usuarioId, id);
    const ahora = this.reloj.ahora();
    if (promo.hasta.getTime() < ahora.getTime())
      throw new ErrorApi('PROMO_VENCIDA', undefined, 422);

    const cambios: Partial<Promocion> = {};
    if (dto.titulo !== undefined) cambios.titulo = dto.titulo;
    if (dto.detalle !== undefined) cambios.detalle = dto.detalle;
    if (dto.descuento !== undefined) cambios.descuento = dto.descuento;
    if (dto.soloApp !== undefined) cambios.soloApp = dto.soloApp;
    const desde =
      dto.desde === undefined ? promo.desde : this.instante(dto.desde, 'La fecha de inicio');
    const hasta =
      dto.hasta === undefined
        ? promo.hasta
        : this.instante(dto.hasta, 'La fecha en que termina la promoción');
    if (dto.desde !== undefined || dto.hasta !== undefined) {
      this.exigirVentana(desde, hasta, ahora);
      cambios.desde = desde;
      cambios.hasta = hasta;
    }
    if (dto.imagenUrl !== undefined) {
      cambios.imagenClave =
        dto.imagenUrl === null ? null : await this.claveDe(dto.imagenUrl, 'imagenes/');
    }

    if (Object.keys(cambios).length > 0) {
      await this.promociones.update({ id }, cambios);
      Object.assign(promo, cambios);
    }
    return promocionAContrato(promo);
  }

  /** Baja lógica e idempotente: `activa: false`. Los usos y el historial se conservan. */
  async darDeBajaPromocion(usuarioId: string, id: string): Promise<void> {
    await this.promoPropia(usuarioId, id);
    await this.promociones.update({ id }, { activa: false });
  }

  /** El comercio de la cuenta de la sesión. Una cuenta sin comercio no tiene panel. */
  private async comercioDe(usuarioId: string): Promise<Comercio> {
    const usuario = await this.usuarios.deLaSesion(usuarioId);
    if (!usuario.comercioId) throw new ErrorApi('SIN_PERMISO');
    const comercio = await this.comercios.findOneBy({ id: usuario.comercioId });
    if (!comercio) throw new ErrorApi('COMERCIO_NO_ENCONTRADO');
    return comercio;
  }

  /** 404 si no existe y 403 si es de otro comercio. */
  private async promoPropia(usuarioId: string, id: string): Promise<Promocion> {
    const comercio = await this.comercioDe(usuarioId);
    const promo = esIdDePromocion(id) ? await this.promociones.findOneBy({ id }) : null;
    if (!promo) throw new ErrorApi('PROMOCION_NO_ENCONTRADA');
    if (promo.comercioId !== comercio.id) throw new ErrorApi('SIN_PERMISO');
    return promo;
  }

  private aContrato(c: Comercio): ComercioContrato {
    return comercioAContrato(c, hoyEnZona(this.reloj.ahora()));
  }

  private instante(texto: string, que: string): Date {
    const fecha = parsearInstante(texto);
    if (!fecha) {
      throw new ErrorApi(
        'VALIDACION_FALLIDA',
        `${que} no es válida: usá AAAA-MM-DDTHH:MM:SS-03:00.`,
      );
    }
    return fecha;
  }

  private exigirVentana(desde: Date, hasta: Date, ahora: Date): void {
    const ventana = ventanaDePromocion(desde, hasta, ahora);
    if (ventana === 'orden') {
      throw new ErrorApi(
        'VALIDACION_FALLIDA',
        'La promoción tiene que terminar después de empezar.',
      );
    }
    if (ventana === 'vencida') throw new ErrorApi('PROMO_VENCIDA', undefined, 422);
  }

  /** URL de `/archivos` → clave, exigiendo que sea del tipo esperado (fotos o video). */
  private async claveDe(url: string, carpeta: 'imagenes/' | 'videos/'): Promise<string> {
    const clave = await this.archivos.claveDeUrlSubida(url);
    if (!clave.startsWith(carpeta)) throw new ErrorApi('ARCHIVO_NO_SUBIDO');
    return clave;
  }
}
