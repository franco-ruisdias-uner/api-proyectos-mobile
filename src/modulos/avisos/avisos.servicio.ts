import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type FindOptionsWhere, In, Repository } from 'typeorm';
import type { Meta } from '../../../contrato/api.js';
import type { Aviso } from '../../../contrato/tipos.js';
import { ArchivosServicio } from '../../comun/archivos/archivos.servicio.js';
import { ErrorDeApi } from '../../comun/errores/error-de-api.js';
import { interpretarInstante, sinMilisegundos } from '../../comun/fechas/fechas.js';
import { esIdDe, nuevoId } from '../../comun/ids/ids.js';
import { Reloj } from '../../comun/reloj/reloj.js';
import { paginar } from '../../comun/respuesta/respuesta.js';
import { DispositivosServicio } from '../dispositivos/dispositivos.servicio.js';
import { LineaEntidad } from '../red/linea.entidad.js';
import { LineaFavoritaEntidad } from '../usuarios/favorita.entidad.js';
import { AvisoLineaEntidad } from './aviso-linea.entidad.js';
import { AvisoEntidad } from './aviso.entidad.js';
import { avisoAContrato } from './avisos.mapeador.js';
import type { ActualizarAvisoDto } from './dto/actualizar-aviso.dto.js';
import type { CrearAvisoDto } from './dto/crear-aviso.dto.js';
import type { ListarAvisosDto } from './dto/listar-avisos.dto.js';
import { usuariosAvisados } from './reglas/destinatarios.js';
import { ordenarAvisos } from './reglas/orden.js';
import { validarVentana } from './reglas/validar-aviso.js';
import { coincideConEstado, ventanaAlFinalizar } from './reglas/vigencia.js';

interface Pagina<T> {
  datos: T[];
  meta: Meta;
}

const LARGO_MAXIMO_DEL_CUERPO_DE_LA_PUSH = 200;

@Injectable()
export class AvisosServicio {
  private readonly registro = new Logger('Avisos');

  constructor(
    @InjectRepository(AvisoEntidad) private readonly avisos: Repository<AvisoEntidad>,
    @InjectRepository(AvisoLineaEntidad)
    private readonly avisoLineas: Repository<AvisoLineaEntidad>,
    @InjectRepository(LineaEntidad) private readonly lineas: Repository<LineaEntidad>,
    @InjectRepository(LineaFavoritaEntidad)
    private readonly favoritas: Repository<LineaFavoritaEntidad>,
    private readonly dataSource: DataSource,
    private readonly archivos: ArchivosServicio,
    private readonly dispositivos: DispositivosServicio,
    private readonly reloj: Reloj,
  ) {}

  /**
   * R10 y orden de la espec. §4. Son pocos avisos, así que el estado y el orden se resuelven
   * con las reglas puras y no con consultas por motor (las fechas se comparan igual en los cuatro).
   */
  async listar(filtros: ListarAvisosDto): Promise<Pagina<Aviso>> {
    const ahora = sinMilisegundos(this.reloj.ahora());
    const where: FindOptionsWhere<AvisoEntidad> = {};
    if (filtros.lineaId) {
      const lineaId = filtros.lineaId;
      // Se compara el id devuelto: MySQL y MariaDB no distinguen mayúsculas al buscar.
      const deLaLinea = (await this.avisoLineas.findBy({ lineaId })).filter(
        (l) => l.lineaId === lineaId,
      );
      if (deLaLinea.length === 0) return this.vacia(filtros);
      where.id = In(deLaLinea.map((l) => l.avisoId));
    }
    const estado = filtros.estado ?? 'vigentes';
    const candidatos = (await this.avisos.findBy(where)).filter((a) =>
      coincideConEstado(a, estado, ahora),
    );
    const ordenados = ordenarAvisos(candidatos);

    const pagina = paginar(filtros);
    const deLaPagina = ordenados.slice(pagina.skip, pagina.skip + pagina.take);
    return {
      datos: await this.aContrato(deLaPagina),
      meta: { total: ordenados.length, pagina: pagina.pagina, porPagina: pagina.porPagina },
    };
  }

  async obtener(id: string): Promise<Aviso> {
    return (await this.aContrato([await this.buscar(id)]))[0];
  }

  /** R11. Dispara la push después de confirmar la transacción (D9). */
  async crear(dto: CrearAvisoDto): Promise<Aviso> {
    const desde = interpretarInstante(dto.desde) as Date;
    const hasta = dto.hasta == null ? null : (interpretarInstante(dto.hasta) as Date);
    this.exigirVentana(desde, hasta);
    const lineaIds = [...new Set(dto.lineaIds)];
    await this.exigirLineas(lineaIds);
    const videoClave = dto.videoUrl == null ? null : await this.claveDeVideo(dto.videoUrl);

    const aviso = this.avisos.create({
      id: nuevoId('avi'),
      titulo: dto.titulo,
      detalle: dto.detalle,
      desde: sinMilisegundos(desde),
      hasta: hasta && sinMilisegundos(hasta),
      gravedad: dto.gravedad,
      trazadoAlternativo: dto.trazadoAlternativo ?? null,
      videoClave,
    });
    await this.dataSource.transaction(async (manejador) => {
      await manejador.insert(AvisoEntidad, aviso);
      await manejador.insert(
        AvisoLineaEntidad,
        lineaIds.map((lineaId, orden) => ({ avisoId: aviso.id, lineaId, orden })),
      );
    });
    await this.notificar(aviso, lineaIds);
    return (await this.aContrato([aviso]))[0];
  }

  /** Parcial, sin push (D9). `lineaIds` reemplaza la lista completa. */
  async editar(id: string, dto: ActualizarAvisoDto): Promise<Aviso> {
    const aviso = await this.buscar(id);
    const cambios: Partial<AvisoEntidad> = {};

    if (dto.titulo !== undefined) cambios.titulo = dto.titulo;
    if (dto.detalle !== undefined) cambios.detalle = dto.detalle;
    if (dto.gravedad !== undefined) cambios.gravedad = dto.gravedad;
    if (dto.trazadoAlternativo !== undefined) cambios.trazadoAlternativo = dto.trazadoAlternativo;
    if (dto.desde !== undefined) {
      cambios.desde = sinMilisegundos(interpretarInstante(dto.desde) as Date);
    }
    if (dto.hasta !== undefined) {
      cambios.hasta =
        dto.hasta === null ? null : sinMilisegundos(interpretarInstante(dto.hasta) as Date);
    }
    // La ventana sólo se revisa si cambió: un aviso cancelado (desde = hasta) se puede retitular.
    if (dto.desde !== undefined || dto.hasta !== undefined) {
      this.exigirVentana(
        cambios.desde ?? aviso.desde,
        cambios.hasta === undefined ? aviso.hasta : cambios.hasta,
      );
    }
    const lineaIds = dto.lineaIds && [...new Set(dto.lineaIds)];
    if (lineaIds) await this.exigirLineas(lineaIds);
    if (dto.videoUrl !== undefined) {
      cambios.videoClave = dto.videoUrl === null ? null : await this.claveDeVideo(dto.videoUrl);
    }

    await this.dataSource.transaction(async (manejador) => {
      if (Object.keys(cambios).length > 0)
        await manejador.update(AvisoEntidad, { id: aviso.id }, cambios);
      if (lineaIds) {
        await manejador.delete(AvisoLineaEntidad, { avisoId: aviso.id });
        await manejador.insert(
          AvisoLineaEntidad,
          lineaIds.map((lineaId, orden) => ({ avisoId: aviso.id, lineaId, orden })),
        );
      }
    });
    return this.obtener(aviso.id);
  }

  /** `hasta` = ahora; ver `ventanaAlFinalizar`. Idempotente, sin push. */
  async finalizar(id: string): Promise<Aviso> {
    const aviso = await this.buscar(id);
    const ventana = ventanaAlFinalizar(aviso, sinMilisegundos(this.reloj.ahora()));
    if (ventana !== aviso) {
      await this.avisos.update({ id: aviso.id }, { desde: ventana.desde, hasta: ventana.hasta });
    }
    return this.obtener(aviso.id);
  }

  private async buscar(id: string): Promise<AvisoEntidad> {
    const aviso = esIdDe('avi', id) ? await this.avisos.findOneBy({ id }) : null;
    if (!aviso || aviso.id !== id) throw new ErrorDeApi('AVISO_NO_ENCONTRADO');
    return aviso;
  }

  private exigirVentana(desde: Date, hasta: Date | null): void {
    if (!validarVentana(desde, hasta)) {
      throw new ErrorDeApi(
        'VALIDACION_FALLIDA',
        'El fin (hasta) tiene que ser posterior al inicio (desde).',
      );
    }
  }

  private async exigirLineas(lineaIds: string[]): Promise<void> {
    const existentes = new Set((await this.lineas.findBy({ id: In(lineaIds) })).map((l) => l.id));
    if (lineaIds.some((id) => !existentes.has(id))) throw new ErrorDeApi('LINEA_NO_ENCONTRADA');
  }

  /** R11: el video tiene que ser un archivo de esta API y de tipo video. */
  private async claveDeVideo(url: string): Promise<string> {
    const clave = await this.archivos.claveSubida(url, 'video');
    if (!clave)
      throw new ErrorDeApi('ARCHIVO_NO_SUBIDO', 'Primero hay que subir el video del aviso.');
    return clave;
  }

  /** Espec. §7: push a quienes tienen alguna de las líneas como favorita (y avisos activos). */
  private async notificar(aviso: AvisoEntidad, lineaIds: string[]): Promise<void> {
    try {
      const favoritas = await this.favoritas.findBy({ lineaId: In(lineaIds) });
      this.dispositivos.notificar(usuariosAvisados(favoritas, lineaIds), {
        titulo: aviso.titulo,
        cuerpo: resumir(aviso.detalle),
        datos: { tipo: 'aviso', avisoId: aviso.id },
      });
    } catch (error) {
      // El aviso ya está publicado: un problema para avisar no lo deshace.
      this.registro.error(`No se pudo preparar la push del aviso ${aviso.id}: ${String(error)}`);
    }
  }

  private vacia(filtros: ListarAvisosDto): Pagina<Aviso> {
    const pagina = paginar(filtros);
    return { datos: [], meta: { total: 0, pagina: pagina.pagina, porPagina: pagina.porPagina } };
  }

  private async aContrato(avisos: AvisoEntidad[]): Promise<Aviso[]> {
    if (avisos.length === 0) return [];
    const filas = await this.avisoLineas.find({
      where: { avisoId: In(avisos.map((a) => a.id)) },
      order: { orden: 'ASC', lineaId: 'ASC' },
    });
    const urlDe = (clave: string) => this.archivos.urlDe(clave);
    return avisos.map((a) =>
      avisoAContrato(
        a,
        filas.filter((f) => f.avisoId === a.id).map((f) => f.lineaId),
        urlDe,
      ),
    );
  }
}

function resumir(texto: string): string {
  return texto.length <= LARGO_MAXIMO_DEL_CUERPO_DE_LA_PUSH
    ? texto
    : `${texto.slice(0, LARGO_MAXIMO_DEL_CUERPO_DE_LA_PUSH - 1).trimEnd()}…`;
}
