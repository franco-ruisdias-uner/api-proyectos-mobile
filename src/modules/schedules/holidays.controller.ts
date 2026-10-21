import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Feriado, RespuestaLista } from '../../../contract/api.js';
import { Publico } from '../../common/auth/decorators.js';
import { Ejemplo, ErroresPosibles } from '../../common/documentation/swagger.js';
import { respuestaLista } from '../../common/response/response.js';
import { ListarFeriadosDto } from './dto/list-holidays.dto.js';
import { FERIADO_DE_EJEMPLO } from './examples.js';
import { HorariosServicio } from './schedules.service.js';

@ApiTags('Horarios')
@Controller('feriados')
export class FeriadosControlador {
  constructor(private readonly servicio: HorariosServicio) {}

  @Get()
  @Publico()
  @ApiOperation({
    summary: 'Feriados de un año',
    description:
      'Público. Los feriados nacionales del `anio` (por defecto, el actual), por fecha. El ' +
      'teléfono los guarda para saber, sin señal, qué tabla de horarios usar: un feriado usa ' +
      'la tabla `feriado`, aunque caiga sábado o domingo. Es un tipo que no está en el PRD: ' +
      '`Feriado { fecha: string; nombre: string }`, con `fecha` en formato `AAAA-MM-DD`.',
  })
  @Ejemplo(200, 'Feriados', {
    datos: [FERIADO_DE_EJEMPLO],
    meta: { total: 19, pagina: 1, porPagina: 20 },
  })
  @ErroresPosibles('VALIDACION_FALLIDA')
  async listar(@Query() consulta: ListarFeriadosDto): Promise<RespuestaLista<Feriado>> {
    const { datos, meta } = await this.servicio.listarFeriados(consulta);
    return respuestaLista(datos, meta);
  }
}
