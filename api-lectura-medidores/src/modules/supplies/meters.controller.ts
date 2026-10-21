import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { RespuestaUno } from '../../../contract/api.js';
import type { Medidor } from '../../../contract/types.js';
import { Sesion } from '../../common/auth/decorators.js';
import type { SesionActual } from '../../common/auth/current-session.js';
import { IdPipe } from '../../common/ids/id.pipe.js';
import { Doc } from '../../common/response/documentation.js';
import { respuestaUno } from '../../common/response/response.js';
import { EJEMPLO_MEDIDOR } from './examples.js';
import { SuministrosServicio } from './supplies.service.js';

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
