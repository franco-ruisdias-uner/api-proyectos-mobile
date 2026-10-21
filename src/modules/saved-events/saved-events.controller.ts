import { Controller, Delete, Get, HttpCode, Param, Put, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { RespuestaLista, RespuestaUno } from '../../../contract/api.js';
import type { Evento } from '../../../contract/types.js';
import { UsuarioActual, type UsuarioAutenticado } from '../../common/auth/decorators.js';
import { PaginacionDto } from '../../common/response/pagination.dto.js';
import { respuestaLista, respuestaUno } from '../../common/response/response.js';
import { EJEMPLO_EVENTO, ejemploError } from '../../common/swagger/examples.js';
import { EventosGuardadosServicio } from './saved-events.service.js';

@ApiTags('Eventos guardados')
@ApiBearerAuth()
@Controller('yo/eventos-guardados')
export class EventosGuardadosControlador {
  constructor(private readonly guardados: EventosGuardadosServicio) {}

  @Get()
  @ApiOperation({
    summary: 'Mis eventos guardados',
    description:
      'Con sesión. Por `inicio` ascendente. Incluye los que ya terminaron o se cancelaron, con su ' +
      'estado de hoy.',
  })
  @ApiResponse({
    status: 200,
    schema: { example: { datos: [EJEMPLO_EVENTO], meta: { total: 1, pagina: 1, porPagina: 20 } } },
  })
  @ApiResponse({ status: 400, description: 'VALIDACION_FALLIDA', schema: ejemploError('VALIDACION_FALLIDA') })
  @ApiResponse({ status: 401, description: 'NO_AUTENTICADO', schema: ejemploError('NO_AUTENTICADO') })
  async listar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Query() consulta: PaginacionDto,
  ): Promise<RespuestaLista<Evento>> {
    const { datos, meta } = await this.guardados.listar(usuario.id, consulta);
    return respuestaLista(datos, meta);
  }

  @Put(':eventoId')
  @ApiOperation({
    summary: 'Guardar un evento',
    description:
      'Con sesión. 201 con el `Evento` si es nuevo; 200 si ya estaba guardado. Sólo se guardan ' +
      'eventos programados o suspendidos. Si el evento se suspende o se cancela, la API avisa por push.',
  })
  @ApiParam({ name: 'eventoId', example: 'evt-017' })
  @ApiResponse({ status: 200, schema: { example: { datos: EJEMPLO_EVENTO, meta: null } } })
  @ApiResponse({ status: 201, schema: { example: { datos: EJEMPLO_EVENTO, meta: null } } })
  @ApiResponse({ status: 401, description: 'NO_AUTENTICADO', schema: ejemploError('NO_AUTENTICADO') })
  @ApiResponse({
    status: 404,
    description: 'EVENTO_NO_ENCONTRADO',
    schema: ejemploError('EVENTO_NO_ENCONTRADO'),
  })
  @ApiResponse({
    status: 422,
    description: 'EVENTO_NO_VIGENTE (cancelado o ya terminado)',
    schema: ejemploError('EVENTO_NO_VIGENTE'),
  })
  async guardar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('eventoId') eventoId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RespuestaUno<Evento>> {
    const { evento, creado } = await this.guardados.guardar(usuario.id, eventoId);
    res.status(creado ? 201 : 200);
    return respuestaUno(evento);
  }

  @Delete(':eventoId')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Dejar de guardar un evento',
    description: 'Con sesión. 204 siempre, también si no estaba. Deja de recibir avisos de ese evento.',
  })
  @ApiParam({ name: 'eventoId', example: 'evt-017' })
  @ApiResponse({ status: 204, description: 'Sin cuerpo.' })
  @ApiResponse({ status: 401, description: 'NO_AUTENTICADO', schema: ejemploError('NO_AUTENTICADO') })
  async quitar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('eventoId') eventoId: string,
  ): Promise<void> {
    await this.guardados.quitar(usuario.id, eventoId);
  }
}
