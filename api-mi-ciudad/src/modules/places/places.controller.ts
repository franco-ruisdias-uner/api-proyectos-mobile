import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { RespuestaLista, RespuestaUno } from '../../../contract/api.js';
import type { Lugar } from '../../../contract/types.js';
import { Publico } from '../../common/auth/decorators.js';
import { ErrorApi } from '../../common/errors/error-api.js';
import { respuestaLista, respuestaUno } from '../../common/response/response.js';
import { EJEMPLO_LUGAR, ejemploError } from '../../common/swagger/examples.js';
import { ListarLugaresDto } from './dto/list-places.dto.js';
import { LugaresServicio } from './places.service.js';

@ApiTags('Catálogo')
@Controller('lugares')
export class LugaresControlador {
  constructor(private readonly lugares: LugaresServicio) {}

  @Publico()
  @Get()
  @ApiOperation({
    summary: 'Lugares',
    description:
      'Público. Por nombre, o por distancia con `orden=distancia` y tu ubicación. Sin `actualizadoDesde`, ' +
      'sólo los activos. Los horarios son los de la temporada vigente (verano: 1/12 al 31/3). ' +
      '`porPagina` llega a 500 para guardar el catálogo entero en el teléfono.',
  })
  @ApiResponse({
    status: 200,
    schema: { example: { datos: [EJEMPLO_LUGAR], meta: { total: 27, pagina: 1, porPagina: 20 } } },
  })
  @ApiResponse({
    status: 400,
    description: 'VALIDACION_FALLIDA (por ejemplo, `orden=distancia` sin `latitud` y `longitud`)',
    schema: ejemploError('VALIDACION_FALLIDA'),
  })
  async listar(@Query() consulta: ListarLugaresDto): Promise<RespuestaLista<Lugar>> {
    const { datos, meta } = await this.lugares.listar(consulta);
    return respuestaLista(datos, meta);
  }

  @Publico()
  @Get('qr')
  @ApiExcludeEndpoint()
  /** Un QR vacío (R6): sin esta ruta, `/lugares/qr` caería en el detalle con id `qr`. */
  sinCodigo(): never {
    throw new ErrorApi('QR_NO_RECONOCIDO');
  }

  @Publico()
  @Get('qr/*codigo')
  @ApiOperation({
    summary: 'Lugar de un código QR',
    description:
      'Público. El contenido del QR del cartel, codificado para URL (`encodeURIComponent`). ' +
      'El formato es `COLON:<lugarId>`, por ejemplo `/lugares/qr/COLON%3Alug-004`. ' +
      'Cualquier otra cosa (un QR de otro sistema, una URL, texto roto) da `QR_NO_RECONOCIDO`.',
  })
  @ApiParam({ name: 'codigo', example: 'COLON%3Alug-004' })
  @ApiResponse({ status: 200, schema: { example: { datos: EJEMPLO_LUGAR, meta: null } } })
  @ApiResponse({ status: 404, description: 'QR_NO_RECONOCIDO', schema: ejemploError('QR_NO_RECONOCIDO') })
  async porQr(@Param('codigo') partes: string[] | string): Promise<RespuestaUno<Lugar>> {
    // Si el teléfono no codificó las barras de una URL, llegan como varias partes.
    const codigo = Array.isArray(partes) ? partes.join('/') : partes;
    return respuestaUno(await this.lugares.porQr(codigo));
  }

  @Publico()
  @Get(':id')
  @ApiOperation({
    summary: 'Detalle de un lugar',
    description: 'Público. Devuelve también los dados de baja, con `activo: false`.',
  })
  @ApiParam({ name: 'id', example: 'lug-004' })
  @ApiResponse({ status: 200, schema: { example: { datos: EJEMPLO_LUGAR, meta: null } } })
  @ApiResponse({
    status: 404,
    description: 'LUGAR_NO_ENCONTRADO',
    schema: ejemploError('LUGAR_NO_ENCONTRADO'),
  })
  async detalle(@Param('id') id: string): Promise<RespuestaUno<Lugar>> {
    return respuestaUno(await this.lugares.detalle(id));
  }
}
