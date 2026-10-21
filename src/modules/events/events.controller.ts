import { Body, Controller, Get, HttpCode, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { RespuestaLista, RespuestaUno } from '../../../contract/api.js';
import type { Evento } from '../../../contract/types.js';
import { Publico, Roles } from '../../common/auth/decorators.js';
import { respuestaLista, respuestaUno } from '../../common/response/response.js';
import { EJEMPLO_EVENTO, ejemploError } from '../../common/swagger/examples.js';
import { CambiarEstadoDto } from './dto/change-status.dto.js';
import { ListarEventosDto } from './dto/list-events.dto.js';
import { EventosServicio } from './events.service.js';

@ApiTags('Agenda')
@Controller('eventos')
export class EventosControlador {
  constructor(private readonly eventos: EventosServicio) {}

  @Publico()
  @Get()
  @ApiOperation({
    summary: 'Agenda de eventos',
    description:
      'Público. Por `inicio` ascendente. Sin filtros de día: desde hoy, sin tope. Un evento aparece ' +
      'en cada día que toca (una peña de 21:00 a 02:00, en los dos). Sin `fin`, cuenta hasta las 23:59 ' +
      'del día de `inicio`. `finalizado` se calcula: es un evento programado que ya terminó.',
  })
  @ApiResponse({
    status: 200,
    schema: { example: { datos: [EJEMPLO_EVENTO], meta: { total: 1, pagina: 1, porPagina: 20 } } },
  })
  @ApiResponse({
    status: 400,
    description:
      'VALIDACION_FALLIDA (un día mal escrito, `fecha` junto con `desde`, `hasta` antes que `desde`)',
    schema: ejemploError('VALIDACION_FALLIDA'),
  })
  async listar(@Query() consulta: ListarEventosDto): Promise<RespuestaLista<Evento>> {
    const { datos, meta } = await this.eventos.listar(consulta);
    return respuestaLista(datos, meta);
  }

  @Publico()
  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un evento', description: 'Público.' })
  @ApiParam({ name: 'id', example: 'evt-017' })
  @ApiResponse({ status: 200, schema: { example: { datos: EJEMPLO_EVENTO, meta: null } } })
  @ApiResponse({
    status: 404,
    description: 'EVENTO_NO_ENCONTRADO',
    schema: ejemploError('EVENTO_NO_ENCONTRADO'),
  })
  async detalle(@Param('id') id: string): Promise<RespuestaUno<Evento>> {
    return respuestaUno(await this.eventos.detalle(id));
  }

  @Roles('admin')
  @ApiBearerAuth()
  @Patch(':id/estado')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Suspender, cancelar o reprogramar un evento',
    description:
      'Rol `admin`. Acepta `programado`, `suspendido` o `cancelado`; `finalizado` se calcula y da ' +
      '`VALIDACION_FALLIDA`. Pasar al mismo estado que ya tiene es un 200 sin cambios.',
  })
  @ApiParam({ name: 'id', example: 'evt-017' })
  @ApiResponse({ status: 200, schema: { example: { datos: EJEMPLO_EVENTO, meta: null } } })
  @ApiResponse({ status: 400, description: 'VALIDACION_FALLIDA', schema: ejemploError('VALIDACION_FALLIDA') })
  @ApiResponse({ status: 401, description: 'NO_AUTENTICADO', schema: ejemploError('NO_AUTENTICADO') })
  @ApiResponse({ status: 403, description: 'SIN_PERMISO (no es admin)', schema: ejemploError('SIN_PERMISO') })
  @ApiResponse({
    status: 404,
    description: 'EVENTO_NO_ENCONTRADO',
    schema: ejemploError('EVENTO_NO_ENCONTRADO'),
  })
  async cambiarEstado(
    @Param('id') id: string,
    @Body() cuerpo: CambiarEstadoDto,
  ): Promise<RespuestaUno<Evento>> {
    return respuestaUno(await this.eventos.cambiarEstado(id, cuerpo));
  }
}
