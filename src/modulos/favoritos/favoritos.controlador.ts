import { Controller, Delete, Get, HttpCode, Param, Put, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { RespuestaLista, RespuestaUno } from '../../../contrato/api.js';
import type { Favorito } from '../../../contrato/tipos.js';
import { UsuarioActual, type UsuarioAutenticado } from '../../comun/auth/decoradores.js';
import { PaginacionDto } from '../../comun/respuesta/paginacion.dto.js';
import { respuestaLista, respuestaUno } from '../../comun/respuesta/respuesta.js';
import { ejemploError } from '../../comun/swagger/ejemplos.js';
import { FavoritosServicio } from './favoritos.servicio.js';

const EJEMPLO_FAVORITO: Favorito = {
  id: 'fav-088',
  usuarioId: 'usr-201',
  lugarId: 'lug-004',
  creadoEn: '2026-09-10T16:05:00-03:00',
};

@ApiTags('Favoritos')
@ApiBearerAuth()
@Controller('yo/favoritos')
export class FavoritosControlador {
  constructor(private readonly favoritos: FavoritosServicio) {}

  @Get()
  @ApiOperation({ summary: 'Mis lugares favoritos', description: 'Con sesión. El más nuevo primero.' })
  @ApiResponse({
    status: 200,
    schema: { example: { datos: [EJEMPLO_FAVORITO], meta: { total: 1, pagina: 1, porPagina: 20 } } },
  })
  @ApiResponse({ status: 400, description: 'VALIDACION_FALLIDA', schema: ejemploError('VALIDACION_FALLIDA') })
  @ApiResponse({ status: 401, description: 'NO_AUTENTICADO', schema: ejemploError('NO_AUTENTICADO') })
  async listar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Query() consulta: PaginacionDto,
  ): Promise<RespuestaLista<Favorito>> {
    const { datos, meta } = await this.favoritos.listar(usuario.id, consulta);
    return respuestaLista(datos, meta);
  }

  @Put(':lugarId')
  @ApiOperation({
    summary: 'Marcar un lugar como favorito',
    description: 'Con sesión. 201 si es nuevo; 200 con el favorito existente si ya estaba (no se duplica).',
  })
  @ApiParam({ name: 'lugarId', example: 'lug-004' })
  @ApiResponse({ status: 200, schema: { example: { datos: EJEMPLO_FAVORITO, meta: null } } })
  @ApiResponse({ status: 201, schema: { example: { datos: EJEMPLO_FAVORITO, meta: null } } })
  @ApiResponse({ status: 401, description: 'NO_AUTENTICADO', schema: ejemploError('NO_AUTENTICADO') })
  @ApiResponse({
    status: 404,
    description: 'LUGAR_NO_ENCONTRADO',
    schema: ejemploError('LUGAR_NO_ENCONTRADO'),
  })
  async marcar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('lugarId') lugarId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RespuestaUno<Favorito>> {
    const { favorito, creado } = await this.favoritos.marcar(usuario.id, lugarId);
    res.status(creado ? 201 : 200);
    return respuestaUno(favorito);
  }

  @Delete(':lugarId')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Sacar un lugar de favoritos',
    description: 'Con sesión. 204 siempre, también si no estaba (es "un toque").',
  })
  @ApiParam({ name: 'lugarId', example: 'lug-004' })
  @ApiResponse({ status: 204, description: 'Sin cuerpo.' })
  @ApiResponse({ status: 401, description: 'NO_AUTENTICADO', schema: ejemploError('NO_AUTENTICADO') })
  async desmarcar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('lugarId') lugarId: string,
  ): Promise<void> {
    await this.favoritos.desmarcar(usuario.id, lugarId);
  }
}
