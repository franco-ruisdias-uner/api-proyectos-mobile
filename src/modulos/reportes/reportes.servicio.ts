import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Like, type Repository } from 'typeorm';
import { ServicioArchivos } from '../../comun/archivos/archivos.servicio.js';
import { esViolacionDeUnicidad } from '../../comun/db/unicidad.js';
import { ErrorApi } from '../../comun/errores/catalogo.js';
import {
  anioMesEnZona,
  parsearInstante,
  sinMilisegundos,
} from '../../comun/fechas/fechas.js';
import { nuevoId } from '../../comun/ids/ids.js';
import { saltoYTamano, type Pagina } from '../../comun/respuesta/respuesta.js';
import { Reloj } from '../../comun/reloj/reloj.js';
import { ServicioTipos } from '../catalogos/tipos.servicio.js';
import { ServicioZonas } from '../catalogos/zonas.servicio.js';
import type { Usuario } from '../usuarios/usuario.entidad.js';
import { CambioDeEstado } from './cambio-de-estado.entidad.js';
import type { CrearReporteDto } from './dto/crear-reporte.dto.js';
import { FotoDeReporte } from './foto.entidad.js';
import { Reporte } from './reporte.entidad.js';
import {
  correlativoSiguiente,
  formatearCodigo,
  normalizarCodigo,
  prefijoDelAnio,
} from './reglas/codigo.js';
import { esFechaFutura } from './reglas/fecha-hecho.js';

export interface ReporteCompleto {
  reporte: Reporte;
  fotos: FotoDeReporte[];
}

/** Cuántas veces se reintenta si otro proceso se llevó el mismo código de seguimiento. */
const INTENTOS_DE_CODIGO = 10;

@Injectable()
export class ServicioReportes {
  /** Cola de creaciones: dentro de este proceso se crean de a una (el índice único cubre el resto). */
  private cola: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Reporte) private readonly reportes: Repository<Reporte>,
    @InjectRepository(FotoDeReporte)
    private readonly fotos: Repository<FotoDeReporte>,
    @InjectRepository(CambioDeEstado)
    private readonly cambios: Repository<CambioDeEstado>,
    private readonly tipos: ServicioTipos,
    private readonly zonas: ServicioZonas,
    private readonly archivos: ServicioArchivos,
    private readonly reloj: Reloj,
  ) {}

  /** Crea el reporte (R1 a R7). Idempotente por `id` (AGENTS §10.5): `creado` dice si es nuevo. */
  crear(
    autor: Usuario,
    dto: CrearReporteDto,
  ): Promise<ReporteCompleto & { creado: boolean }> {
    const tarea = this.cola.then(() => this.crearAhora(autor, dto));
    this.cola = tarea.catch(() => undefined);
    return tarea;
  }

  async obtener(id: string): Promise<ReporteCompleto> {
    const reporte = await this.reportes.findOneBy({ id });
    if (!reporte) throw new ErrorApi('REPORTE_NO_ENCONTRADO');
    return (await this.conFotos([reporte]))[0];
  }

  async obtenerPorCodigo(codigo: string): Promise<ReporteCompleto> {
    const normalizado = normalizarCodigo(codigo);
    const reporte = normalizado
      ? await this.reportes.findOneBy({ codigo: normalizado })
      : null;
    if (!reporte) throw new ErrorApi('REPORTE_NO_ENCONTRADO');
    return (await this.conFotos([reporte]))[0];
  }

  async listarPropios(
    autorId: string,
    pagina: Pagina,
  ): Promise<[ReporteCompleto[], number]> {
    const [filas, total] = await this.reportes.findAndCount({
      where: { autorId },
      order: { creadoEn: 'DESC', id: 'DESC' },
      ...saltoYTamano(pagina),
    });
    return [await this.conFotos(filas), total];
  }

  async listarCambios(
    reporteId: string,
    pagina: Pagina,
  ): Promise<[CambioDeEstado[], number]> {
    if (!(await this.reportes.existsBy({ id: reporteId }))) {
      throw new ErrorApi('REPORTE_NO_ENCONTRADO');
    }
    return this.cambios.findAndCount({
      where: { reporteId },
      order: { fechaHora: 'ASC', secuencia: 'ASC', id: 'ASC' },
      ...saltoYTamano(pagina),
    });
  }

  /** Junta las fotos de varios reportes con una sola consulta. */
  async conFotos(reportes: Reporte[]): Promise<ReporteCompleto[]> {
    if (reportes.length === 0) return [];
    const fotos = await this.fotos.find({
      where: { reporteId: In(reportes.map((r) => r.id)) },
      order: { orden: 'ASC', id: 'ASC' },
    });
    return reportes.map((reporte) => ({
      reporte,
      fotos: fotos.filter((f) => f.reporteId === reporte.id),
    }));
  }

  private async crearAhora(
    autor: Usuario,
    dto: CrearReporteDto,
  ): Promise<ReporteCompleto & { creado: boolean }> {
    if (dto.id) {
      const previo = await this.previoDelMismoId(dto.id, autor);
      if (previo) return { ...previo, creado: false };
    }

    const fotosEntrantes = dto.fotos ?? [];
    if (fotosEntrantes.length === 0) throw new ErrorApi('FOTO_REQUERIDA');
    const idsDeFotos = fotosEntrantes.flatMap((f) => (f.id ? [f.id] : []));
    if (new Set(idsDeFotos).size !== idsDeFotos.length) {
      throw new ErrorApi(
        'VALIDACION_FALLIDA',
        'Hay dos fotos con el mismo identificador.',
      );
    }

    const creadoEn = parsearInstante(dto.creadoEn);
    if (!creadoEn) throw new ErrorApi('VALIDACION_FALLIDA');
    if (esFechaFutura(creadoEn, this.reloj.ahora())) {
      throw new ErrorApi('FECHA_EN_EL_FUTURO');
    }

    if (!(await this.tipos.existe(dto.tipoId))) {
      throw new ErrorApi('TIPO_NO_ENCONTRADO');
    }

    const clavesDeFotos = await Promise.all(
      fotosEntrantes.map((f) => this.claveSubida(f.url, 'imagenes/')),
    );
    const audioClave = dto.audioUrl
      ? await this.claveSubida(dto.audioUrl, 'audios/')
      : null;

    const zona = await this.zonas.zonaDe(dto.coordenadas);
    if (!zona) throw new ErrorApi('FUERA_DE_LA_CIUDAD');

    if (
      idsDeFotos.length > 0 &&
      (await this.fotos.existsBy({ id: In(idsDeFotos) }))
    ) {
      throw new ErrorApi('ID_EN_USO');
    }

    const reporte = Object.assign(new Reporte(), {
      id: dto.id ?? nuevoId('rep'),
      tipoId: dto.tipoId,
      descripcion: dto.descripcion ?? null,
      audioClave,
      latitud: dto.coordenadas.latitud,
      longitud: dto.coordenadas.longitud,
      direccion: dto.direccion,
      zonaId: zona.id,
      estado: 'recibido' as const,
      autorId: autor.id,
      cuadrillaId: null,
      duplicadoDe: null,
      adhesiones: 0,
      creadoEn: sinMilisegundos(creadoEn),
    });
    const fotos = fotosEntrantes.map((f, i) =>
      Object.assign(new FotoDeReporte(), {
        id: f.id ?? nuevoId('fot'),
        reporteId: reporte.id,
        clave: clavesDeFotos[i],
        momento: 'problema' as const,
        orden: i + 1,
      }),
    );
    const primerCambio = Object.assign(new CambioDeEstado(), {
      id: nuevoId('cam'),
      reporteId: reporte.id,
      estado: 'recibido' as const,
      comentario: null,
      operadorId: null,
      fechaHora: reporte.creadoEn,
      secuencia: 1,
    });

    const anio = Number(anioMesEnZona(reporte.creadoEn).anio);
    for (let intento = 1; ; intento++) {
      try {
        await this.dataSource.transaction(async (manager) => {
          const ultimo = await manager.findOne(Reporte, {
            where: { codigo: Like(`${prefijoDelAnio(anio)}%`) },
            order: { codigo: 'DESC' },
            select: { codigo: true },
          });
          reporte.codigo = formatearCodigo(
            anio,
            correlativoSiguiente(ultimo?.codigo ?? null),
          );
          await manager.insert(Reporte, reporte);
          await manager.insert(FotoDeReporte, fotos);
          await manager.insert(CambioDeEstado, primerCambio);
        });
        return { reporte, fotos, creado: true };
      } catch (error) {
        if (!esViolacionDeUnicidad(error)) throw error;
        // Otro proceso creó el mismo id, usó el id de una foto o se llevó el código.
        const previo = await this.previoDelMismoId(reporte.id, autor);
        if (previo) return { ...previo, creado: false };
        if (
          idsDeFotos.length > 0 &&
          (await this.fotos.existsBy({ id: In(idsDeFotos) }))
        ) {
          throw new ErrorApi('ID_EN_USO');
        }
        if (intento >= INTENTOS_DE_CODIGO) throw error;
      }
    }
  }

  /** Lo que ya existe con ese id: si es del mismo autor, se devuelve; si es de otro, ID_EN_USO. */
  private async previoDelMismoId(
    id: string,
    autor: Usuario,
  ): Promise<ReporteCompleto | null> {
    const existente = await this.reportes.findOneBy({ id });
    if (!existente) return null;
    if (existente.autorId !== autor.id) throw new ErrorApi('ID_EN_USO');
    return (await this.conFotos([existente]))[0];
  }

  /** La clave de una URL subida con POST /archivos y del tipo de carpeta esperado (R2). */
  private async claveSubida(url: string, carpeta: string): Promise<string> {
    const clave = await this.archivos.claveSubida(url);
    if (clave === null || !clave.startsWith(carpeta)) {
      throw new ErrorApi('ARCHIVO_NO_SUBIDO');
    }
    return clave;
  }
}
