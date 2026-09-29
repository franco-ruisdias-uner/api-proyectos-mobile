import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type Repository } from 'typeorm';
import { esViolacionDeUnicidad } from '../../comun/db/unicidad.js';
import { ErrorApi } from '../../comun/errores/catalogo.js';
import { nuevoId } from '../../comun/ids/ids.js';
import { Reloj } from '../../comun/reloj/reloj.js';
import type { Usuario } from '../usuarios/usuario.entidad.js';
import { AvisosDeReportes } from './avisos-de-reportes.servicio.js';
import { Adhesion } from './adhesion.entidad.js';
import { Reporte } from './reporte.entidad.js';
import { esEstadoAbierto } from './reglas/estados.js';
import { ServicioReportes, type ReporteCompleto } from './reportes.servicio.js';

@Injectable()
export class ServicioAdhesiones {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Reporte) private readonly reportes: Repository<Reporte>,
    @InjectRepository(Adhesion)
    private readonly adhesiones: Repository<Adhesion>,
    private readonly servicioReportes: ServicioReportes,
    private readonly reloj: Reloj,
    private readonly avisos: AvisosDeReportes,
  ) {}

  /** Sumarse a un reporte ajeno y abierto (R10). `creada` es false si ya estaba sumado. */
  async sumar(
    reporteId: string,
    vecino: Usuario,
  ): Promise<ReporteCompleto & { creada: boolean }> {
    const reporte = await this.reportes.findOneBy({ id: reporteId });
    if (!reporte) throw new ErrorApi('REPORTE_NO_ENCONTRADO');
    if (reporte.autorId === vecino.id) {
      throw new ErrorApi('ADHESION_A_REPORTE_PROPIO');
    }
    const previa = await this.adhesiones.existsBy({
      reporteId,
      usuarioId: vecino.id,
    });
    if (previa) return this.respuesta(reporteId, false);
    if (!esEstadoAbierto(reporte.estado)) throw new ErrorApi('REPORTE_CERRADO');

    try {
      await this.dataSource.transaction(async (manager) => {
        // Toma el lock de la fila del reporte antes de insertar y contar: dos personas que se
        // suman a la vez esperan una a la otra y el recuento final ve las dos adhesiones.
        await manager.update(
          Reporte,
          { id: reporteId },
          { adhesiones: () => 'adhesiones' },
        );
        await manager.insert(
          Adhesion,
          Object.assign(new Adhesion(), {
            id: nuevoId('adh'),
            reporteId,
            usuarioId: vecino.id,
            creadoEn: this.reloj.ahora(),
          }),
        );
        await recalcularAdhesiones(manager, reporteId);
      });
    } catch (error) {
      // La misma persona, en otro pedido simultáneo, ya se había sumado.
      if (!esViolacionDeUnicidad(error)) throw error;
      return this.respuesta(reporteId, false);
    }
    const respuesta = await this.respuesta(reporteId, true);
    await this.avisos.adhesion(reporte, respuesta.reporte.adhesiones);
    return respuesta;
  }

  private async respuesta(reporteId: string, creada: boolean) {
    const completo = await this.servicioReportes.obtener(reporteId);
    return { ...completo, creada };
  }
}

/** `adhesiones` sale de contar la tabla, no de sumar 1 (AGENTS §5.5). */
export async function recalcularAdhesiones(
  manager: DataSource['manager'],
  reporteId: string,
): Promise<number> {
  const total = await manager.countBy(Adhesion, { reporteId });
  await manager.update(Reporte, { id: reporteId }, { adhesiones: total });
  return total;
}
