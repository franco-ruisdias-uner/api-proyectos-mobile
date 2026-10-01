import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Feriado, RespuestaLista } from '../../../contrato/api.js';
import { Publico } from '../../comun/auth/decoradores.js';
import { Ejemplo, ErroresPosibles } from '../../comun/documentacion/swagger.js';
import { respuestaLista } from '../../comun/respuesta/respuesta.js';
import { ListarFeriadosDto } from './dto/listar-feriados.dto.js';
import { FERIADO_DE_EJEMPLO } from './ejemplos.js';
import { HorariosServicio } from './horarios.servicio.js';

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
