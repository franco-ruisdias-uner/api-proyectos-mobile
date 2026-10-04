import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { RespuestaUno } from '../../../contrato/api.js';
import type { Reserva } from '../../../contrato/tipos.js';
import { Roles } from '../../comun/auth/decoradores.js';
import { respuestaUno } from '../../comun/respuesta/respuesta.js';
import { MarcarAusenteDto, RegistrarIngresoDto } from './dto/ingresos.dto.js';
import { IngresosServicio } from './ingresos.servicio.js';

const EJEMPLO = {
  id: 'res-1180',
  turnoId: 'tur-esp-02-20260919-19',
  espacioId: 'esp-02',
  usuarioId: 'usr-207',
  cantidadPersonas: 10,
  codigoQr: 'VGY-0919-19-K3X9QM',
  estado: 'cumplida',
  ingresoEn: '2026-09-19T18:50:00-03:00',
  creadaEn: '2026-09-17T18:42:00-03:00',
  cancelableHasta: '2026-09-19T15:00:00-03:00',
};

@ApiTags('Ingreso y agenda')
@ApiBearerAuth()
@Controller()
export class IngresosControlador {
  constructor(private readonly servicio: IngresosServicio) {}

  @Post('ingresos')
  @HttpCode(200)
  @Roles('encargado', 'administrador')
  @ApiOperation({
    summary: 'Registrar la llegada de una reserva (QR)',
    description:
      'Encargado o administrador. `codigoQr` es el de la reserva y `espacioId` el espacio ' +
      'donde está quien lo escanea. Se puede desde 30 minutos antes del inicio hasta el fin ' +
      'del turno. La reserva queda `cumplida` con `ingresoEn`.\n\n' +
      'Errores: VALIDACION_FALLIDA (400), NO_AUTENTICADO (401), SIN_PERMISO (403), ' +
      'CODIGO_INVALIDO (404), INGRESO_YA_REGISTRADO (409), RESERVA_CANCELADA (422), ' +
      'RESERVA_AUSENTE (422), CODIGO_DE_OTRO_DIA (422), CODIGO_DE_OTRO_ESPACIO (422), ' +
      'FUERA_DE_HORARIO (422).',
  })
  @ApiResponse({
    status: 200,
    schema: { example: { datos: EJEMPLO, meta: null } },
  })
  async ingresar(
    @Body() dto: RegistrarIngresoDto,
  ): Promise<RespuestaUno<Reserva>> {
    return respuestaUno(await this.servicio.registrarIngreso(dto));
  }

  @Post('reservas/:id/ausente')
  @HttpCode(200)
  @Roles('encargado', 'administrador')
  @ApiOperation({
    summary: 'Marcar que no se presentó',
    description:
      'Encargado o administrador. Sólo una reserva `confirmada`, desde 15 minutos después ' +
      'del inicio del turno. Queda `ausente` y suma 1 a `ausencias` del jugador. Marcar una ' +
      'que ya es `ausente` responde 200 sin cambios.\n\n' +
      'Errores: VALIDACION_FALLIDA (400), NO_AUTENTICADO (401), SIN_PERMISO (403), ' +
      'RESERVA_NO_ENCONTRADA (404), INGRESO_YA_REGISTRADO (409), RESERVA_CANCELADA (422), ' +
      'ANTES_DE_TIEMPO (422).',
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        datos: { ...EJEMPLO, estado: 'ausente', ingresoEn: null },
        meta: null,
      },
    },
  })
  async ausente(
    @Param('id') id: string,
    @Body() _cuerpo: MarcarAusenteDto,
  ): Promise<RespuestaUno<Reserva>> {
    return respuestaUno(await this.servicio.marcarAusente(id));
  }
}
