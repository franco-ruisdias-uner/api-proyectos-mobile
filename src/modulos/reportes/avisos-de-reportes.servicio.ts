import { Injectable, Logger } from '@nestjs/common';
import type { EstadoReporte } from '../../../contrato/tipos.js';
import { Avisos } from '../../comun/notificaciones/avisos.servicio.js';
import {
  avisoDeAdhesion,
  avisoDeEstado,
  type AvisoDeReporte,
} from './reglas/avisos.js';

export interface ReporteAvisado {
  id: string;
  codigo: string;
  autorId: string;
}

/**
 * Push de reportes (Especificación §7). Se llama después de confirmar la transacción; un
 * problema al avisar se loguea y nunca rompe el pedido.
 */
@Injectable()
export class AvisosDeReportes {
  private readonly logger = new Logger('AvisosDeReportes');

  constructor(private readonly avisos: Avisos) {}

  cambioDeEstado(
    reporte: ReporteAvisado,
    estado: EstadoReporte,
  ): Promise<void> {
    return this.avisar(reporte.autorId, avisoDeEstado(reporte, estado));
  }

  adhesion(reporte: ReporteAvisado, totalAdhesiones: number): Promise<void> {
    return this.avisar(
      reporte.autorId,
      avisoDeAdhesion(reporte, totalAdhesiones),
    );
  }

  private async avisar(
    usuarioId: string,
    aviso: AvisoDeReporte,
  ): Promise<void> {
    try {
      await this.avisos.avisar([usuarioId], aviso);
    } catch (error) {
      this.logger.warn(`No se pudo avisar: ${(error as Error).message}`);
    }
  }
}
