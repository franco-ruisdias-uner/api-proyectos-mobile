import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { EstadoReporte } from '../../../contract/types.js';
import { Avisos } from '../../common/notifications/notices.service.js';
import { TipoDeReporte } from '../catalogs/report-type.entity.js';
import { Usuario } from '../users/user.entity.js';
import {
  avisoDeAdhesion,
  avisoDeEstado,
  avisoDeReporteNuevo,
  type AvisoDeReporte,
} from './rules/notices.js';

/** Lo que hace falta del reporte (la entidad `Reporte` lo cumple). */
export interface ReporteAvisado {
  id: string;
  codigo: string;
  autorId: string;
  tipoId: string;
  direccion: string;
}

/**
 * Push de reportes (Especificación §7). Se llama después de confirmar la transacción; un
 * problema al avisar se loguea y nunca rompe el pedido.
 */
@Injectable()
export class AvisosDeReportes {
  private readonly logger = new Logger('AvisosDeReportes');

  constructor(
    private readonly avisos: Avisos,
    @InjectRepository(TipoDeReporte)
    private readonly tipos: Repository<TipoDeReporte>,
    @InjectRepository(Usuario)
    private readonly usuarios: Repository<Usuario>,
  ) {}

  cambioDeEstado(
    reporte: ReporteAvisado,
    estado: EstadoReporte,
  ): Promise<void> {
    return this.avisar([reporte.autorId], reporte, (r) =>
      avisoDeEstado(r, estado),
    );
  }

  adhesion(reporte: ReporteAvisado, totalAdhesiones: number): Promise<void> {
    return this.avisar([reporte.autorId], reporte, (r) =>
      avisoDeAdhesion(r, totalAdhesiones),
    );
  }

  /** Reporte nuevo → todos los operadores (el filtro de `avisosActivos` lo hace `Avisos`). */
  async reporteNuevo(reporte: ReporteAvisado): Promise<void> {
    try {
      const operadores = await this.usuarios.find({
        where: { rol: 'operador' },
        select: { id: true },
      });
      await this.avisar(
        operadores.map((o) => o.id),
        reporte,
        avisoDeReporteNuevo,
      );
    } catch (error) {
      this.logger.warn(`No se pudo avisar: ${(error as Error).message}`);
    }
  }

  private async avisar(
    usuarioIds: string[],
    reporte: ReporteAvisado,
    armar: (r: {
      id: string;
      codigo: string;
      tipo: string;
      direccion: string;
    }) => AvisoDeReporte,
  ): Promise<void> {
    try {
      const tipo = await this.tipos.findOneBy({ id: reporte.tipoId });
      const aviso = armar({
        id: reporte.id,
        codigo: reporte.codigo,
        tipo: tipo?.nombre ?? 'Reporte',
        direccion: reporte.direccion,
      });
      await this.avisos.avisar(usuarioIds, aviso);
    } catch (error) {
      this.logger.warn(`No se pudo avisar: ${(error as Error).message}`);
    }
  }
}
