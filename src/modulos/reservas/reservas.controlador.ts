import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { RespuestaLista, RespuestaUno } from '../../../contrato/api.js';
import type { Reserva } from '../../../contrato/tipos.js';
import {
  Roles,
  SesionActual,
  type UsuarioSesion,
} from '../../comun/auth/decoradores.js';
import { respuestaUno } from '../../comun/respuesta/respuesta.js';
import {
  CancelarReservaDto,
  CrearReservaDto,
  FiltrosReservasDto,
  MisReservasDto,
} from './dto/reservas.dto.js';
import { ReservasServicio } from './reservas.servicio.js';

const EJEMPLO_RESERVA = {
  id: 'res-1180',
  turnoId: 'tur-esp-02-20260919-19',
  espacioId: 'esp-02',
  usuarioId: 'usr-207',
  cantidadPersonas: 10,
  codigoQr: 'VGY-0919-19-K3X9QM',
  estado: 'confirmada',
  ingresoEn: null,
  creadaEn: '2026-09-17T18:42:00-03:00',
  cancelableHasta: '2026-09-19T15:00:00-03:00',
};

@ApiTags('Reservas')
@ApiBearerAuth()
@Controller()
export class ReservasControlador {
  constructor(private readonly servicio: ReservasServicio) {}

  @Post('reservas')
  @Roles('jugador')
  @ApiOperation({
    summary: 'Reservar un turno',
    description:
      'Sólo `jugador`. `turnoId` es el id que viene en la grilla. 201 con la reserva; ' +
      '200 con la misma si el jugador ya tenía ese turno (reintento por mala señal).\n\n' +
      'Errores: VALIDACION_FALLIDA (400), NO_AUTENTICADO (401), SIN_PERMISO (403), ' +
      'TURNO_NO_ENCONTRADO (404), TURNO_OCUPADO (409), TURNO_NO_DISPONIBLE (409), ' +
      'FECHA_FUERA_DE_RANGO (422), TURNO_PASADO (422), CAPACIDAD_EXCEDIDA (422), ' +
      'LIMITE_DE_RESERVAS (422).',
  })
  @ApiResponse({
    status: 201,
    schema: { example: { datos: EJEMPLO_RESERVA, meta: null } },
  })
  async reservar(
    @SesionActual() sesion: UsuarioSesion,
    @Body() dto: CrearReservaDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RespuestaUno<Reserva>> {
    const { reserva, creada } = await this.servicio.crear(sesion.id, dto);
    res.status(creada ? 201 : 200);
    return respuestaUno(reserva);
  }

  @Get('yo/reservas')
  @ApiOperation({
    summary: 'Mis reservas',
    description:
      'Con sesión. `cuando=proximas` (default): confirmadas cuyo turno no terminó, por ' +
      '`inicio` ascendente. `cuando=pasadas`: todas las demás, por `inicio` descendente.\n\n' +
      'Errores: VALIDACION_FALLIDA (400), NO_AUTENTICADO (401).',
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        datos: [EJEMPLO_RESERVA],
        meta: { total: 1, pagina: 1, porPagina: 20 },
      },
    },
  })
  async misReservas(
    @SesionActual() sesion: UsuarioSesion,
    @Query() q: MisReservasDto,
  ): Promise<RespuestaLista<Reserva>> {
    return this.servicio.misReservas(sesion.id, q);
  }

  @Get('reservas')
  @Roles('encargado', 'administrador')
  @ApiTags('Ingreso y agenda')
  @ApiOperation({
    summary: 'Reservas de todos (para ver quién tiene cada turno)',
    description:
      'Encargado o administrador. Filtros opcionales: `fecha` (día del turno), `espacioId` y ' +
      '`estado`. Ordenadas por fecha e `inicio` ascendente.\n\n' +
      'Errores: VALIDACION_FALLIDA (400), NO_AUTENTICADO (401), SIN_PERMISO (403).',
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        datos: [EJEMPLO_RESERVA],
        meta: { total: 1, pagina: 1, porPagina: 20 },
      },
    },
  })
  async listar(
    @Query() q: FiltrosReservasDto,
  ): Promise<RespuestaLista<Reserva>> {
    return this.servicio.listar(q);
  }

  @Get('reservas/:id')
  @ApiOperation({
    summary: 'Una reserva',
    description:
      'Con sesión: el dueño, o un encargado o administrador.\n\n' +
      'Errores: NO_AUTENTICADO (401), SIN_PERMISO (403), RESERVA_NO_ENCONTRADA (404).',
  })
  @ApiResponse({
    status: 200,
    schema: { example: { datos: EJEMPLO_RESERVA, meta: null } },
  })
  async ver(
    @Param('id') id: string,
    @SesionActual() sesion: UsuarioSesion,
  ): Promise<RespuestaUno<Reserva>> {
    return respuestaUno(await this.servicio.ver(id, sesion));
  }

  @Post('reservas/:id/cancelacion')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Cancelar una reserva',
    description:
      'El dueño, hasta 4 horas antes del turno (`cancelableHasta`). Un encargado o ' +
      'administrador puede cancelar aunque haya pasado el plazo (mientras el turno no haya ' +
      'empezado) y en ese caso suma 1 a `cancelacionesTardias` del dueño. Cancelar una ya ' +
      'cancelada responde 200 sin cambios.\n\n' +
      'Errores: VALIDACION_FALLIDA (400), NO_AUTENTICADO (401), SIN_PERMISO (403), ' +
      'RESERVA_NO_ENCONTRADA (404), RESERVA_NO_CANCELABLE (409), CANCELACION_FUERA_DE_PLAZO (422).',
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        datos: { ...EJEMPLO_RESERVA, estado: 'cancelada' },
        meta: null,
      },
    },
  })
  async cancelar(
    @Param('id') id: string,
    @SesionActual() sesion: UsuarioSesion,
    @Body() _cuerpo: CancelarReservaDto,
  ): Promise<RespuestaUno<Reserva>> {
    return respuestaUno(await this.servicio.cancelar(id, sesion));
  }
}
