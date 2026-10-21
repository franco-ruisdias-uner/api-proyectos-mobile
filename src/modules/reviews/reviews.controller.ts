import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { RespuestaLista, RespuestaUno } from '../../../contract/api.js';
import type { Resena } from '../../../contract/types.js';
import { Publico, Roles, UsuarioActual, type UsuarioSesion } from '../../common/auth/decorators.js';
import { metaDe, PaginacionDto } from '../../common/response/pagination.dto.js';
import { respuestaLista, respuestaUno } from '../../common/response/response.js';
import { DocErrores } from '../../swagger/error-docs.js';
import { CrearResenaDto } from './dto/create-review.dto.js';
import { EditarResenaDto } from './dto/edit-review.dto.js';
import { ResponderResenaDto } from './dto/reply-review.dto.js';
import { EJEMPLO_RESENA } from './reviews.examples.js';
import { ResenasServicio } from './reviews.service.js';

@ApiTags('Reseñas')
@Controller()
export class ResenasControlador {
  constructor(private readonly servicio: ResenasServicio) {}

  @Get('comercios/:id/resenas')
  @Publico()
  @ApiOperation({
    summary: 'Reseñas de un comercio',
    description:
      'Público. De la más nueva a la más vieja. El promedio es `Comercio.puntaje`. También funciona con un comercio dado de baja.',
  })
  @ApiParam({ name: 'id', example: 'com-118' })
  @ApiResponse({
    status: 200,
    example: { datos: [EJEMPLO_RESENA], meta: { total: 1, pagina: 1, porPagina: 20 } },
  })
  @DocErrores('VALIDACION_FALLIDA', 'COMERCIO_NO_ENCONTRADO')
  async listar(
    @Param('id') id: string,
    @Query() p: PaginacionDto,
  ): Promise<RespuestaLista<Resena>> {
    const { datos, total } = await this.servicio.listar(id, p);
    return respuestaLista(datos, metaDe(p, total));
  }

  @Post('comercios/:id/resenas')
  @Roles('vecino')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Dejar una reseña',
    description:
      'Sólo vecinos. `{ id?, estrellas, comentario, creadaEn? }`. Una por vecino y comercio. ' +
      'Idempotente por `id` (para la cola offline): reenviar la misma reseña devuelve 200 con la ya ' +
      'creada, sin duplicar; si el `id` es de otro usuario, 409 `ID_EN_USO`. Recalcula `puntaje` y ' +
      '`cantidadResenas` del comercio. `sincronizada` en la entrada se ignora y en la respuesta es `true`.',
  })
  @ApiParam({ name: 'id', example: 'com-118' })
  @ApiResponse({ status: 201, example: { datos: EJEMPLO_RESENA, meta: null } })
  @ApiResponse({ status: 200, description: 'Ya existía con ese `id` y es del mismo usuario.' })
  @DocErrores(
    'VALIDACION_FALLIDA',
    'NO_AUTENTICADO',
    'SIN_PERMISO',
    'COMERCIO_NO_ENCONTRADO',
    'RESENA_YA_EXISTE',
    'ID_EN_USO',
    'FECHA_EN_EL_FUTURO',
  )
  async crear(
    @UsuarioActual() sesion: UsuarioSesion,
    @Param('id') comercioId: string,
    @Body() cuerpo: CrearResenaDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RespuestaUno<Resena>> {
    const { resena, creada } = await this.servicio.crear(sesion.id, comercioId, cuerpo);
    res.status(creada ? 201 : 200);
    return respuestaUno(resena);
  }

  @Patch('resenas/:id')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Editar mi reseña',
    description:
      'Sólo el autor. `{ estrellas?, comentario? }`; lo que no mandás queda como estaba. Recalcula el puntaje del comercio.',
  })
  @ApiParam({ name: 'id', example: 'res-2210' })
  @ApiResponse({ status: 200, example: { datos: EJEMPLO_RESENA, meta: null } })
  @DocErrores('VALIDACION_FALLIDA', 'NO_AUTENTICADO', 'SIN_PERMISO', 'RESENA_NO_ENCONTRADA')
  async editar(
    @UsuarioActual() sesion: UsuarioSesion,
    @Param('id') id: string,
    @Body() cuerpo: EditarResenaDto,
  ): Promise<RespuestaUno<Resena>> {
    return respuestaUno(await this.servicio.editar(sesion.id, id, cuerpo));
  }

  @Delete('resenas/:id')
  @HttpCode(204)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Borrar mi reseña',
    description: 'Sólo el autor. 204 sin cuerpo. Recalcula el puntaje del comercio.',
  })
  @ApiParam({ name: 'id', example: 'res-2210' })
  @ApiResponse({ status: 204 })
  @DocErrores('NO_AUTENTICADO', 'SIN_PERMISO', 'RESENA_NO_ENCONTRADA')
  async borrar(@UsuarioActual() sesion: UsuarioSesion, @Param('id') id: string): Promise<void> {
    await this.servicio.borrar(sesion.id, id);
  }

  @Post('resenas/:id/reportes')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Reportar una reseña como ofensiva',
    description:
      'Cualquier cuenta con sesión, menos el autor. Una vez por usuario (repetirlo no cambia nada). ' +
      'Devuelve la `Resena` con `reportada: true`; sigue visible en el listado.',
  })
  @ApiParam({ name: 'id', example: 'res-2210' })
  @ApiResponse({
    status: 200,
    example: { datos: { ...EJEMPLO_RESENA, reportada: true }, meta: null },
  })
  @DocErrores('NO_AUTENTICADO', 'RESENA_NO_ENCONTRADA', 'REPORTE_PROPIO')
  async reportar(
    @UsuarioActual() sesion: UsuarioSesion,
    @Param('id') id: string,
  ): Promise<RespuestaUno<Resena>> {
    return respuestaUno(await this.servicio.reportar(sesion.id, id));
  }

  @Post('resenas/:id/respuesta')
  @HttpCode(200)
  @Roles('comercio')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Responder una reseña',
    description:
      'Sólo la cuenta del comercio reseñado, y una sola vez. `{ respuesta }`. Devuelve la `Resena` con su `respuesta`.',
  })
  @ApiParam({ name: 'id', example: 'res-2210' })
  @ApiResponse({ status: 200, example: { datos: EJEMPLO_RESENA, meta: null } })
  @DocErrores(
    'VALIDACION_FALLIDA',
    'NO_AUTENTICADO',
    'SIN_PERMISO',
    'RESENA_NO_ENCONTRADA',
    'RESENA_YA_RESPONDIDA',
  )
  async responder(
    @UsuarioActual() sesion: UsuarioSesion,
    @Param('id') id: string,
    @Body() cuerpo: ResponderResenaDto,
  ): Promise<RespuestaUno<Resena>> {
    return respuestaUno(await this.servicio.responder(sesion.id, id, cuerpo.respuesta));
  }
}
