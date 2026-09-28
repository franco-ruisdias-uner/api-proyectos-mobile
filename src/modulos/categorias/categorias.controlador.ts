import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { RespuestaLista } from '../../../contrato/api.js';
import type { Categoria } from '../../../contrato/tipos.js';
import { Publico } from '../../comun/auth/decoradores.js';
import { PaginacionDto } from '../../comun/respuesta/paginacion.dto.js';
import { respuestaLista } from '../../comun/respuesta/respuesta.js';
import { EJEMPLO_CATEGORIA, ejemploError } from '../../comun/swagger/ejemplos.js';
import { CategoriasServicio } from './categorias.servicio.js';

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
