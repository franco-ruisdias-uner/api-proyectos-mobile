import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { RespuestaLista } from '../../../contrato/api.js';
import type { Turno } from '../../../contrato/tipos.js';
import { Publico } from '../../comun/auth/decoradores.js';
import { TurnosDto } from './dto/turnos.dto.js';
import { TurnosServicio } from './turnos.servicio.js';

@ApiTags('Grilla')
@Controller()
export class TurnosControlador {
  constructor(private readonly servicio: TurnosServicio) {}

  @Get('espacios/:id/turnos')
  @Publico()
  @ApiOperation({
    summary: 'Turnos de un espacio en un día',
    description:
      'Público. Los 16 turnos del día (08:00 a 24:00), por `inicio`. `fecha` es ' +
      '`AAAA-MM-DD` (default hoy) y puede ser de hoy a hoy + 6. Estado de cada turno, por ' +
      'prioridad: `mantenimiento` (bloqueo) > `fijo` (reserva fija) > `reservado` > `libre`. ' +
      'Los turnos que ya pasaron se muestran con su estado. `precio` es el precio actual ' +
      'del espacio.\n\nErrores: VALIDACION_FALLIDA (400), ESPACIO_NO_ENCONTRADO (404), ' +
      'FECHA_FUERA_DE_RANGO (422).',
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        datos: [
          {
            id: 'tur-esp-02-20260919-19',
            espacioId: 'esp-02',
            fecha: '2026-09-19',
            inicio: '19:00',
            fin: '20:00',
            estado: 'reservado',
            reservaId: 'res-1180',
            motivoBloqueo: null,
            precio: 8000,
          },
        ],
        meta: { total: 16, pagina: 1, porPagina: 20 },
      },
    },
  })
  turnos(
    @Param('id') id: string,
    @Query() q: TurnosDto,
  ): Promise<RespuestaLista<Turno>> {
    return this.servicio.grilla(id, q);
  }
}
