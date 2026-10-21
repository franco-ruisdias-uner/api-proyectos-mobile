import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { RespuestaLista, RespuestaUno } from '../../../contract/api.js';
import type { Promocion } from '../../../contract/types.js';
import { Publico } from '../../common/auth/decorators.js';
import { metaDe } from '../../common/response/pagination.dto.js';
import { respuestaLista, respuestaUno } from '../../common/response/response.js';
import { DocErrores } from '../../swagger/error-docs.js';
import { ListarPromocionesDto } from './dto/list-promotions.dto.js';
import { EJEMPLO_PROMOCION } from './promotions.examples.js';
import { PromocionesServicio } from './promotions.service.js';

@ApiTags('Promociones')
@Controller('promociones')
export class PromocionesControlador {
  constructor(private readonly servicio: PromocionesServicio) {}

  @Get()
  @Publico()
  @ApiOperation({
    summary: 'Promociones',
    description:
      'Público. `estado`: `vigentes` (default), `proximas` (empiezan en los próximos 7 días) o ' +
      '`por-vencer` (vigentes que vencen en 3 días o menos). Filtros `rubroId` y `comercioId`. ' +
      'Nunca devuelve promos vencidas, dadas de baja ni de comercios dados de baja. Vigentes y ' +
      'por vencer van por `hasta` ascendente; las próximas, por `desde`.',
  })
  @ApiResponse({
    status: 200,
    example: { datos: [EJEMPLO_PROMOCION], meta: { total: 1, pagina: 1, porPagina: 20 } },
  })
  @DocErrores('VALIDACION_FALLIDA')
  async listar(@Query() q: ListarPromocionesDto): Promise<RespuestaLista<Promocion>> {
    const { datos, total } = await this.servicio.listar(q);
    return respuestaLista(datos, metaDe(q, total));
  }

  @Get(':id')
  @Publico()
  @ApiOperation({
    summary: 'Detalle de una promoción',
    description:
      'Público. Una promoción vencida da 410 `PROMO_VENCIDA`; una dada de baja, o de un comercio ' +
      'dado de baja, da 404.',
  })
  @ApiParam({ name: 'id', example: 'pro-441' })
  @ApiResponse({ status: 200, example: { datos: EJEMPLO_PROMOCION, meta: null } })
  @DocErrores('PROMOCION_NO_ENCONTRADA', 'PROMO_VENCIDA')
  async detalle(@Param('id') id: string): Promise<RespuestaUno<Promocion>> {
    return respuestaUno(await this.servicio.detalle(id));
  }
}
