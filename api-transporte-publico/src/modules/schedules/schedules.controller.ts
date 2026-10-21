import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { RespuestaLista } from '../../../contract/api.js';
import type { Horario } from '../../../contract/types.js';
import { Publico } from '../../common/auth/decorators.js';
import { Ejemplo, ErroresPosibles } from '../../common/documentation/swagger.js';
import { respuestaLista } from '../../common/response/response.js';
import { ListarHorariosDto } from './dto/list-schedules.dto.js';
import { ProximosDto } from './dto/upcoming.dto.js';
import { HORARIO_DE_EJEMPLO } from './examples.js';
import { HorariosServicio } from './schedules.service.js';

@ApiTags('Horarios')
@Controller()
export class HorariosControlador {
  constructor(private readonly servicio: HorariosServicio) {}

  @Get('horarios')
  @Publico()
  @ApiOperation({
    summary: 'Tabla de horarios de una línea o de una parada',
    description:
      'Público. Exige `lineaId` o `paradaId` (no se descargan todas las filas de una). Filtros: ' +
      '`sentido` y `tipoDeDia` (`habil`, `sabado`, `domingo` o `feriado`). Orden: `hora`, ' +
      '`lineaId`, `paradaId`. `porPagina` llega a 5000 para guardar la tabla en el teléfono y ' +
      'usarla sin señal. Son horas de tabla: no hay posición de los colectivos en vivo.',
  })
  @Ejemplo(200, 'Horarios de una parada', {
    datos: [HORARIO_DE_EJEMPLO],
    meta: { total: 1, pagina: 1, porPagina: 20 },
  })
  @ErroresPosibles('VALIDACION_FALLIDA')
  async listar(@Query() consulta: ListarHorariosDto): Promise<RespuestaLista<Horario>> {
    const { datos, meta } = await this.servicio.listarHorarios(consulta);
    return respuestaLista(datos, meta);
  }

  @Get('paradas/:id/proximos')
  @Publico()
  @ApiOperation({
    summary: 'Próximos pasos de las líneas por una parada',
    description:
      'Público. Para cada línea que para ahí, los `cantidad` (1 a 10, por defecto 3) pasos ' +
      'siguientes a este momento según la tabla del tipo de día de hoy. Si no alcanzan, se ' +
      'completan con los de mañana, con **la tabla del tipo de día de mañana**: se reconocen ' +
      'porque su `hora` es menor que la actual. Orden cronológico. Si una línea no tiene ' +
      'servicio ni hoy ni mañana, no aparece. Sólo devuelve horas de tabla.',
  })
  @ApiParam({ name: 'id', example: 'par-101' })
  @Ejemplo(200, 'Próximos pasos', {
    datos: [HORARIO_DE_EJEMPLO],
    meta: { total: 1, pagina: 1, porPagina: 1 },
  })
  @ErroresPosibles('PARADA_NO_ENCONTRADA', 'VALIDACION_FALLIDA')
  async proximos(
    @Param('id') id: string,
    @Query() consulta: ProximosDto,
  ): Promise<RespuestaLista<Horario>> {
    const { datos, meta } = await this.servicio.proximos(id, consulta);
    return respuestaLista(datos, meta);
  }
}
