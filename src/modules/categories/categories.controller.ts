import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { RespuestaLista } from '../../../contract/api.js';
import type { Categoria } from '../../../contract/types.js';
import { Publico } from '../../common/auth/decorators.js';
import { PaginacionDto } from '../../common/response/pagination.dto.js';
import { respuestaLista } from '../../common/response/response.js';
import { EJEMPLO_CATEGORIA, ejemploError } from '../../common/swagger/examples.js';
import { CategoriasServicio } from './categories.service.js';

@ApiTags('Catálogo')
@Controller('categorias')
export class CategoriasControlador {
  constructor(private readonly categorias: CategoriasServicio) {}

  @Publico()
  @Get()
  @ApiOperation({ summary: 'Categorías de lugares', description: 'Público. Todas, por `orden` ascendente.' })
  @ApiResponse({
    status: 200,
    schema: { example: { datos: [EJEMPLO_CATEGORIA], meta: { total: 8, pagina: 1, porPagina: 20 } } },
  })
  @ApiResponse({ status: 400, description: 'VALIDACION_FALLIDA', schema: ejemploError('VALIDACION_FALLIDA') })
  async listar(@Query() consulta: PaginacionDto): Promise<RespuestaLista<Categoria>> {
    const { datos, meta } = await this.categorias.listar(consulta);
    return respuestaLista(datos, meta);
  }
}
