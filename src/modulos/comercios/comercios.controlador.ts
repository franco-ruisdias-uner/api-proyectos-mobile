import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { RespuestaLista, RespuestaUno } from '../../../contrato/api.js';
import type { Comercio, Rubro } from '../../../contrato/tipos.js';
import { Publico } from '../../comun/auth/decoradores.js';
import { metaDe, PaginacionDto } from '../../comun/respuesta/paginacion.dto.js';
import { respuestaLista, respuestaUno } from '../../comun/respuesta/respuesta.js';
import { DocErrores } from '../../swagger/doc-errores.js';
import { EJEMPLO_COMERCIO, EJEMPLO_RUBRO } from './comercios.ejemplos.js';
import { ComerciosServicio } from './comercios.servicio.js';
import { ListarComerciosDto } from './dto/listar-comercios.dto.js';

@ApiTags('Comercios')
@Controller()
export class ComerciosControlador {
  constructor(private readonly servicio: ComerciosServicio) {}

  @Get('rubros')
  @Publico()
  @ApiOperation({ summary: 'Rubros', description: 'Público. Todos los rubros, por `orden`.' })
  @ApiResponse({
    status: 200,
    example: { datos: [EJEMPLO_RUBRO], meta: { total: 9, pagina: 1, porPagina: 20 } },
  })
  @DocErrores('VALIDACION_FALLIDA')
  async rubros(@Query() p: PaginacionDto): Promise<RespuestaLista<Rubro>> {
    const { datos, total } = await this.servicio.listarRubros(p);
    return respuestaLista(datos, metaDe(p, total));
  }

  @Get('comercios')
  @Publico()
  @ApiOperation({
    summary: 'Comercios',
    description:
      'Público. Sólo los comercios activos. Filtros: `rubroId`, `q` (nombre y descripción, sin tildes), ' +
      '`latitud` + `longitud` + `radioMetros`. `orden`: `nombre` (default), `distancia` o `puntaje`. ' +
      '`porPagina` llega hasta 1000: el teléfono guarda el listado. Si el comercio está de vacaciones ' +
      'sus `horarios` vienen vacíos. La API no calcula "abierto ahora": se calcula en el teléfono.',
  })
  @ApiResponse({
    status: 200,
    example: { datos: [EJEMPLO_COMERCIO], meta: { total: 40, pagina: 1, porPagina: 20 } },
  })
  @DocErrores('VALIDACION_FALLIDA')
  async listar(@Query() q: ListarComerciosDto): Promise<RespuestaLista<Comercio>> {
    const { datos, total } = await this.servicio.listar(q);
    return respuestaLista(datos, metaDe(q, total));
  }

  // Va antes que `:id` para que sea evidente que `qr` no es un id.
  @Get('comercios/qr/:codigo')
  @Publico()
  @ApiOperation({
    summary: 'Comercio por código QR',
    description:
      'Público. Resuelve el `codigoQr` de un comercio (`CCU:<comercioId>`), también si está dado de baja.',
  })
  @ApiParam({ name: 'codigo', example: 'CCU:com-118' })
  @ApiResponse({ status: 200, example: { datos: EJEMPLO_COMERCIO, meta: null } })
  @DocErrores('QR_NO_RECONOCIDO')
  async porQr(@Param('codigo') codigo: string): Promise<RespuestaUno<Comercio>> {
    return respuestaUno(await this.servicio.porQr(codigo));
  }

  @Get('comercios/:id')
  @Publico()
  @ApiOperation({
    summary: 'Detalle de un comercio',
    description: 'Público. También devuelve los comercios dados de baja, con `activo: false`.',
  })
  @ApiParam({ name: 'id', example: 'com-118' })
  @ApiResponse({ status: 200, example: { datos: EJEMPLO_COMERCIO, meta: null } })
  @DocErrores('COMERCIO_NO_ENCONTRADO')
  async detalle(@Param('id') id: string): Promise<RespuestaUno<Comercio>> {
    return respuestaUno(await this.servicio.detalle(id));
  }
}
