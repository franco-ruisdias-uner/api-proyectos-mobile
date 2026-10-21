import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { RespuestaLista, RespuestaUno } from '../../../contract/api.js';
import type { Parada } from '../../../contract/types.js';
import { Publico } from '../../common/auth/decorators.js';
import { Ejemplo, ErroresPosibles } from '../../common/documentation/swagger.js';
import { respuestaLista, respuestaUno } from '../../common/response/response.js';
import { ListarParadasDto } from './dto/list-stops.dto.js';
import { PARADA_DE_EJEMPLO } from './examples.js';
import { RedServicio } from './network.service.js';

@ApiTags('Red')
@Controller('paradas')
export class ParadasControlador {
  constructor(private readonly servicio: RedServicio) {}

  @Get()
  @Publico()
  @ApiOperation({
    summary: 'Paradas: búsqueda, por línea y cercanas',
    description:
      'Público. Filtros: `q` (nombre o calle, sin tildes), `lineaId`, `sentido`, y `latitud` + ' +
      '`longitud` + `radioMetros` para las cercanas. `orden=nombre` (por defecto) u `orden=distancia` ' +
      '(pide latitud y longitud; la distancia no viaja en la respuesta). `porPagina` llega a 1000 ' +
      'para poder guardar todas las paradas en el teléfono y usarlas sin señal.',
  })
  @Ejemplo(200, 'Lista de paradas', {
    datos: [PARADA_DE_EJEMPLO],
    meta: { total: 70, pagina: 1, porPagina: 20 },
  })
  @ErroresPosibles('VALIDACION_FALLIDA')
  async listar(@Query() consulta: ListarParadasDto): Promise<RespuestaLista<Parada>> {
    const { datos, meta } = await this.servicio.listarParadas(consulta);
    return respuestaLista(datos, meta);
  }

  @Get('qr/:codigo')
  @Publico()
  @ApiOperation({
    summary: 'Resolver el QR de una parada',
    description:
      'Público. El código de la parada tiene la forma `PARANA:<paradaId>` (decisión D5). ' +
      'Cualquier otra cosa da `QR_NO_RECONOCIDO`.',
  })
  @ApiParam({ name: 'codigo', example: 'PARANA:par-101' })
  @Ejemplo(200, 'La parada del QR', { datos: PARADA_DE_EJEMPLO, meta: null })
  @ErroresPosibles('QR_NO_RECONOCIDO')
  async porQr(@Param('codigo') codigo: string): Promise<RespuestaUno<Parada>> {
    return respuestaUno(await this.servicio.paradaPorQr(codigo));
  }

  @Get(':id')
  @Publico()
  @ApiOperation({ summary: 'Detalle de una parada', description: 'Público.' })
  @ApiParam({ name: 'id', example: 'par-101' })
  @Ejemplo(200, 'La parada', { datos: PARADA_DE_EJEMPLO, meta: null })
  @ErroresPosibles('PARADA_NO_ENCONTRADA')
  async obtener(@Param('id') id: string): Promise<RespuestaUno<Parada>> {
    return respuestaUno(await this.servicio.obtenerParada(id));
  }
}
