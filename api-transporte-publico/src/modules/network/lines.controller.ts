import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { RespuestaLista, RespuestaUno } from '../../../contract/api.js';
import type { Linea } from '../../../contract/types.js';
import { Publico } from '../../common/auth/decorators.js';
import { Ejemplo, ErroresPosibles } from '../../common/documentation/swagger.js';
import { respuestaLista, respuestaUno } from '../../common/response/response.js';
import { ListarLineasDto } from './dto/list-lines.dto.js';
import { LINEA_DE_EJEMPLO } from './examples.js';
import { RedServicio } from './network.service.js';

@ApiTags('Red')
@Controller('lineas')
export class LineasControlador {
  constructor(private readonly servicio: RedServicio) {}

  @Get()
  @Publico()
  @ApiOperation({
    summary: 'Las líneas, con sus recorridos',
    description:
      'Público. Las líneas urbanas con un recorrido por sentido (ida y vuelta, con paradas ' +
      'distintas). Ordenadas por número ("2" antes que "14"). Incluye las inactivas (`activa: false`).',
  })
  @Ejemplo(200, 'Lista de líneas', {
    datos: [LINEA_DE_EJEMPLO],
    meta: { total: 14, pagina: 1, porPagina: 20 },
  })
  @ErroresPosibles('VALIDACION_FALLIDA')
  async listar(@Query() consulta: ListarLineasDto): Promise<RespuestaLista<Linea>> {
    const { datos, meta } = await this.servicio.listarLineas(consulta);
    return respuestaLista(datos, meta);
  }

  @Get(':id')
  @Publico()
  @ApiOperation({ summary: 'Detalle de una línea', description: 'Público.' })
  @ApiParam({ name: 'id', example: 'lin-05' })
  @Ejemplo(200, 'La línea', { datos: LINEA_DE_EJEMPLO, meta: null })
  @ErroresPosibles('LINEA_NO_ENCONTRADA')
  async obtener(@Param('id') id: string): Promise<RespuestaUno<Linea>> {
    return respuestaUno(await this.servicio.obtenerLinea(id));
  }
}
