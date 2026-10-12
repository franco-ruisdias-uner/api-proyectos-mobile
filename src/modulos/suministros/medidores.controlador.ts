import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { RespuestaUno } from '../../../contrato/api.js';
import type { Medidor } from '../../../contrato/tipos.js';
import { Sesion } from '../../comun/auth/decoradores.js';
import type { SesionActual } from '../../comun/auth/sesion-actual.js';
import { IdPipe } from '../../comun/ids/id.pipe.js';
import { Doc } from '../../comun/respuesta/documentacion.js';
import { respuestaUno } from '../../comun/respuesta/respuesta.js';
import { EJEMPLO_MEDIDOR } from './ejemplos.js';
import { SuministrosServicio } from './suministros.servicio.js';

@ApiTags('Medidores')
@Controller('medidores')
export class MedidoresControlador {
  constructor(private readonly suministros: SuministrosServicio) {}

  // Va antes que ':id' para que "qr" no se tome por un id.
  @Get('qr/:codigoQr')
  @Doc({
    resumen: 'El medidor de un código QR',
    descripcion:
      'El código es el del PRD: `COOP-CHJ:<medidorId>`. Con la ruta descargada el teléfono lo resuelve sin señal; ' +
      'esto es para cuando hay señal. Misma regla de acceso que `GET /medidores/:id`.',
    roles: [],
    ejemplo: EJEMPLO_MEDIDOR,
    errores: ['SIN_PERMISO', 'MEDIDOR_NO_ENCONTRADO'],
  })
  async porQr(
    @Param('codigoQr') codigoQr: string,
    @Sesion() sesion: SesionActual,
  ): Promise<RespuestaUno<Medidor>> {
    return respuestaUno(
      await this.suministros.obtenerMedidorPorQr(codigoQr, sesion),
    );
  }

  @Get(':id')
  @Doc({
    resumen: 'Un medidor',
    descripcion:
      '`videoInstructivoUrl` apunta a un video servido por esta API (`/archivos/…`, con `Range`) o es `null`. ' +
      'Un lector sólo ve los medidores de los suministros de sus rutas; administración, todos.',
    roles: [],
    ejemplo: EJEMPLO_MEDIDOR,
    errores: ['VALIDACION_FALLIDA', 'SIN_PERMISO', 'MEDIDOR_NO_ENCONTRADO'],
  })
  async obtener(
    @Param('id', new IdPipe('med')) id: string,
    @Sesion() sesion: SesionActual,
  ): Promise<RespuestaUno<Medidor>> {
    return respuestaUno(await this.suministros.obtenerMedidor(id, sesion));
  }
}
