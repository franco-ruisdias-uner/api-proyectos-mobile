import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  In,
  type EntityManager,
  type FindOptionsWhere,
  type Repository,
} from 'typeorm';
import { ServicioArchivos } from '../../comun/archivos/archivos.servicio.js';
import { esViolacionDeUnicidad } from '../../comun/db/unicidad.js';
import { ErrorApi } from '../../comun/errores/catalogo.js';
import { sinMilisegundos } from '../../comun/fechas/fechas.js';
import { nuevoId } from '../../comun/ids/ids.js';
import { Reloj } from '../../comun/reloj/reloj.js';
import { saltoYTamano } from '../../comun/respuesta/respuesta.js';
import { Cuadrilla } from '../catalogos/cuadrilla.entidad.js';
import type { Usuario } from '../usuarios/usuario.entidad.js';
import { Adhesion } from './adhesion.entidad.js';
import { recalcularAdhesiones } from './adhesiones.servicio.js';
import { CambioDeEstado } from './cambio-de-estado.entidad.js';
import {
  ZONA_TODAS,
  type AsignarCuadrillaDto,
  type CambiarEstadoDto,
  type FiltroBandejaDto,
  type FotoDelArregloDto,
  type MarcarDuplicadoDto,
} from './dto/bandeja.dto.js';
import { FotoDeReporte } from './foto.entidad.js';
import { Reporte } from './reporte.entidad.js';
import { ESTADOS_ABIERTOS, esEstadoAbierto } from './reglas/estados.js';
import {
  TOPE_FOTOS_DEL_ARREGLO,
  admiteFotoDelArreglo,
  comentarioDeDuplicado,
  transicionPorCuadrilla,
  transicionPorEstado,
} from './reglas/transiciones.js';
import { ServicioReportes, type ReporteCompleto } from './reportes.servicio.js';
import type { EstadoReporte } from '../../../contrato/tipos.js';

/**
 * Toma el lock de la fila del reporte (una escritura que no cambia nada) antes de leerlo:
 * dos operadores que actúan a la vez sobre el mismo reporte esperan uno al otro y el segundo
 * ve el estado que dejó el primero. Devuelve el reporte ya leído dentro de la transacción.
 */
async function reporteBloqueado(
  manager: EntityManager,
  id: string,
): Promise<Reporte> {
  await manager.update(Reporte, { id }, { adhesiones: () => 'adhesiones' });
  const reporte = await manager.findOneBy(Reporte, { id });
  if (!reporte) throw new ErrorApi('REPORTE_NO_ENCONTRADO');
  return reporte;
}

@Injectable()
export class ServicioBandeja {
  /**
   * Las escrituras de la bandeja se hacen de a una dentro de este proceso: con SQLite todas las
   * transacciones comparten una conexión y se intercalarían. Entre procesos (PostgreSQL, MySQL)
   * el lock de la fila del reporte cubre lo mismo.
   */
  private cola: Promise<unknown> = Promise.resolve();

  private transaccion<T>(
    tarea: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    const actual = this.cola.then(() => this.dataSource.transaction(tarea));
    this.cola = actual.catch(() => undefined);
    return actual;
  }

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Reporte) private readonly reportes: Repository<Reporte>,
    private readonly servicioReportes: ServicioReportes,
    private readonly archivos: ServicioArchivos,
    private readonly reloj: Reloj,
  ) {}

  /** Reportes abiertos: los más apoyados primero y, a igualdad, el más viejo. */
  async listar(
    operador: Usuario,
    f: FiltroBandejaDto,
  ): Promise<[ReporteCompleto[], number]> {
    const donde: FindOptionsWhere<Reporte> = {
      estado: In(f.estado ?? ESTADOS_ABIERTOS),
    };
    if (f.tipoId) donde.tipoId = f.tipoId;
    const zonaId = f.zonaId ?? operador.zonaId;
    if (zonaId && zonaId !== ZONA_TODAS) donde.zonaId = zonaId;
    const [filas, total] = await this.reportes.findAndCount({
      where: donde,
      order: { adhesiones: 'DESC', creadoEn: 'ASC', id: 'ASC' },
      ...saltoYTamano(f),
    });
    return [await this.servicioReportes.conFotos(filas), total];
  }

  /** R11 y R12. */
  async cambiarEstado(
    operador: Usuario,
    id: string,
    dto: CambiarEstadoDto,
  ): Promise<ReporteCompleto> {
    await this.transaccion(async (manager) => {
      const reporte = await reporteBloqueado(manager, id);
      const resultado = transicionPorEstado(reporte.estado, dto.estado);
      if (resultado !== 'ok') throw new ErrorApi(resultado);
      if (dto.estado === 'rechazado' && !dto.comentario) {
        throw new ErrorApi('MOTIVO_REQUERIDO');
      }
      await this.registrarCambio(
        manager,
        reporte,
        dto.estado,
        dto.comentario ?? null,
        operador,
      );
    });
    return this.servicioReportes.obtener(id);
  }

  /** R14: asigna o reasigna y deja el reporte en `asignado`. */
  async asignarCuadrilla(
    operador: Usuario,
    id: string,
    dto: AsignarCuadrillaDto,
  ): Promise<ReporteCompleto> {
    await this.transaccion(async (manager) => {
      const reporte = await reporteBloqueado(manager, id);
      if (!dto.cuadrillaId) throw new ErrorApi('CUADRILLA_REQUERIDA');
      const resultado = transicionPorCuadrilla(reporte.estado);
      if (resultado !== 'ok') throw new ErrorApi(resultado);
      const cuadrilla = await manager.findOneBy(Cuadrilla, {
        id: dto.cuadrillaId,
      });
      if (!cuadrilla) throw new ErrorApi('CUADRILLA_NO_ENCONTRADA');
      if (!cuadrilla.activa) throw new ErrorApi('CUADRILLA_INACTIVA');
      if (cuadrilla.zonaId !== reporte.zonaId) {
        throw new ErrorApi('CUADRILLA_DE_OTRA_ZONA');
      }
      await this.registrarCambio(
        manager,
        reporte,
        'asignado',
        dto.comentario ?? null,
        operador,
        cuadrilla.id,
      );
    });
    return this.servicioReportes.obtener(id);
  }

  /** R13: el duplicado queda rechazado y su autor se suma al original. */
  async marcarDuplicado(
    operador: Usuario,
    id: string,
    { originalId }: MarcarDuplicadoDto,
  ): Promise<ReporteCompleto> {
    await this.transaccion(async (manager) => {
      if (!(await manager.existsBy(Reporte, { id }))) {
        throw new ErrorApi('REPORTE_NO_ENCONTRADO');
      }
      if (
        id === originalId ||
        !(await manager.existsBy(Reporte, { id: originalId }))
      ) {
        throw new ErrorApi('DUPLICADO_INVALIDO');
      }
      // Los dos locks siempre en el mismo orden (por id): dos pedidos cruzados no se traban.
      const bloqueados = new Map<string, Reporte>();
      for (const rid of [id, originalId].sort()) {
        bloqueados.set(rid, await reporteBloqueado(manager, rid));
      }
      const duplicado = bloqueados.get(id)!;
      const original = bloqueados.get(originalId)!;

      // Repetir el mismo pedido (la cola offline reintenta) no cambia nada.
      if (duplicado.duplicadoDe === originalId) return;
      const resultado = transicionPorEstado(duplicado.estado, 'rechazado');
      if (resultado !== 'ok') throw new ErrorApi(resultado);
      if (
        !esEstadoAbierto(original.estado) ||
        original.duplicadoDe !== null ||
        (await manager.existsBy(Reporte, { duplicadoDe: id }))
      ) {
        throw new ErrorApi('DUPLICADO_INVALIDO');
      }

      await this.registrarCambio(
        manager,
        duplicado,
        'rechazado',
        comentarioDeDuplicado(original.codigo),
        operador,
      );
      await manager.update(Reporte, { id }, { duplicadoDe: originalId });

      if (duplicado.autorId !== original.autorId) {
        const yaSumado = await manager.existsBy(Adhesion, {
          reporteId: originalId,
          usuarioId: duplicado.autorId,
        });
        if (!yaSumado) {
          await manager.insert(
            Adhesion,
            Object.assign(new Adhesion(), {
              id: nuevoId('adh'),
              reporteId: originalId,
              usuarioId: duplicado.autorId,
              creadoEn: this.reloj.ahora(),
            }),
          );
        }
        await recalcularAdhesiones(manager, originalId);
      }
    });
    return this.servicioReportes.obtener(id);
  }

  /** R15: foto del arreglo. `creada` es false si el `id` del teléfono ya estaba en este reporte. */
  async agregarFotoDelArreglo(
    id: string,
    dto: FotoDelArregloDto,
  ): Promise<ReporteCompleto & { creada: boolean }> {
    if (!(await this.reportes.existsBy({ id }))) {
      throw new ErrorApi('REPORTE_NO_ENCONTRADO');
    }
    let creada = true;
    try {
      creada = await this.transaccion(async (manager) => {
        const reporte = await reporteBloqueado(manager, id);
        if (dto.id) {
          const previa = await manager.findOneBy(FotoDeReporte, { id: dto.id });
          if (previa) {
            if (previa.reporteId !== id || previa.momento !== 'arreglo') {
              throw new ErrorApi('ID_EN_USO');
            }
            return false;
          }
        }
        if (!admiteFotoDelArreglo(reporte.estado)) {
          throw new ErrorApi('ESTADO_NO_ADMITE_FOTO');
        }
        const existentes = await manager.findBy(FotoDeReporte, {
          reporteId: id,
        });
        const delArreglo = existentes.filter((f) => f.momento === 'arreglo');
        if (delArreglo.length >= TOPE_FOTOS_DEL_ARREGLO) {
          throw new ErrorApi(
            'VALIDACION_FALLIDA',
            'Se pueden subir hasta tres fotos del arreglo.',
          );
        }
        const clave = await this.archivos.claveSubida(dto.url);
        if (clave === null || !clave.startsWith('imagenes/')) {
          throw new ErrorApi('ARCHIVO_NO_SUBIDO');
        }
        await manager.insert(
          FotoDeReporte,
          Object.assign(new FotoDeReporte(), {
            id: dto.id ?? nuevoId('fot'),
            reporteId: id,
            clave,
            momento: 'arreglo' as const,
            orden: Math.max(0, ...existentes.map((f) => f.orden)) + 1,
          }),
        );
        return true;
      });
    } catch (error) {
      // El mismo id de foto llegó en otro pedido simultáneo.
      if (!esViolacionDeUnicidad(error) || !dto.id) throw error;
      const previa = await this.dataSource
        .getRepository(FotoDeReporte)
        .findOneBy({ id: dto.id });
      if (!previa || previa.reporteId !== id) throw new ErrorApi('ID_EN_USO');
      creada = false;
    }
    return { ...(await this.servicioReportes.obtener(id)), creada };
  }

  /** Guarda un `CambioDeEstado` y deja el reporte en su nuevo estado (dentro de la transacción). */
  private async registrarCambio(
    manager: EntityManager,
    reporte: Reporte,
    estado: EstadoReporte,
    comentario: string | null,
    operador: Usuario,
    cuadrillaId?: string,
  ): Promise<void> {
    const ultimo = await manager.findOne(CambioDeEstado, {
      where: { reporteId: reporte.id },
      order: { secuencia: 'DESC' },
    });
    const ahora = sinMilisegundos(this.reloj.ahora());
    await manager.insert(
      CambioDeEstado,
      Object.assign(new CambioDeEstado(), {
        id: nuevoId('cam'),
        reporteId: reporte.id,
        estado,
        comentario,
        operadorId: operador.id,
        // Nunca antes que el cambio anterior (el `creadoEn` del teléfono puede adelantarse un poco).
        fechaHora:
          ultimo && ultimo.fechaHora > ahora ? ultimo.fechaHora : ahora,
        secuencia: (ultimo?.secuencia ?? 0) + 1,
      }),
    );
    await manager.update(
      Reporte,
      { id: reporte.id },
      cuadrillaId === undefined ? { estado } : { estado, cuadrillaId },
    );
  }
}
