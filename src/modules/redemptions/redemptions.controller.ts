import { Body, Controller, Get, HttpCode, Param, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { RespuestaLista, RespuestaUno } from '../../../contract/api.js';
import type { UsoDePromocion } from '../../../contract/types.js';
import { Roles, UsuarioActual, type UsuarioSesion } from '../../common/auth/decorators.js';
import { metaDe, PaginacionDto } from '../../common/response/pagination.dto.js';
import { respuestaLista, respuestaUno } from '../../common/response/response.js';
import { DocErrores } from '../../swagger/error-docs.js';
import { ValidarUsoDto } from './dto/validate-redemption.dto.js';
import { EJEMPLO_USO } from './redemptions.examples.js';
import { UsosServicio } from './redemptions.service.js';

@ApiTags('Uso de promociones')
@ApiBearerAuth()
@Controller()
export class UsosControlador {
  constructor(private readonly servicio: UsosServicio) {}

  @Post('promociones/:id/usos')
  @Roles('vecino')
  @ApiOperation({
    summary: 'Generar mi código de una promoción',
    description:
      'Sólo vecinos. Sólo para promociones `soloApp` y vigentes. Un código por vecino y promoción: ' +
      '201 la primera vez y 200 con el mismo código si lo vuelve a pedir sin haberlo usado. ' +
      'El comercio lo valida en el mostrador. Si ya lo usó, 409 `PROMO_YA_USADA`.',
  })
  @ApiParam({ name: 'id', example: 'pro-441' })
  @ApiResponse({ status: 201, example: { datos: EJEMPLO_USO, meta: null } })
  @ApiResponse({ status: 200, description: 'Ya tenía un código sin validar: es ese.' })
  @DocErrores(
    'NO_AUTENTICADO',
    'SIN_PERMISO',
    'PROMOCION_NO_ENCONTRADA',
    'PROMO_SIN_CODIGO',
    'PROMO_VENCIDA',
    'PROMO_NO_EMPEZO',
    'PROMO_YA_USADA',
  )
  async generar(
    @UsuarioActual() sesion: UsuarioSesion,
    @Param('id') promocionId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RespuestaUno<UsoDePromocion>> {
    const { uso, creado } = await this.servicio.generar(sesion.id, promocionId);
    res.status(creado ? 201 : 200);
    return respuestaUno(uso);
  }

  @Get('yo/usos')
  @ApiOperation({
    summary: 'Mis códigos de promociones',
    description:
      'Con sesión. Los códigos del usuario, validados o no, los más nuevos primero. Una cuenta de ' +
      'comercio recibe la lista vacía.',
  })
  @ApiResponse({
    status: 200,
    example: { datos: [EJEMPLO_USO], meta: { total: 1, pagina: 1, porPagina: 20 } },
  })
  @DocErrores('VALIDACION_FALLIDA', 'NO_AUTENTICADO')
  async mios(
    @UsuarioActual() sesion: UsuarioSesion,
    @Query() p: PaginacionDto,
  ): Promise<RespuestaLista<UsoDePromocion>> {
    const { datos, total } = await this.servicio.listarDe(sesion.id, p);
    return respuestaLista(datos, metaDe(p, total));
  }

  @Post('mi-comercio/usos/validar')
  @Roles('comercio')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Validar el código de un cliente',
    description:
      'Sólo cuentas de comercio. `{ codigo }`: registra el uso, devuelve el `UsoDePromocion` con ' +
      '`validadoEn` y recalcula `usos` de la promoción. El código tiene que ser de una promoción de ' +
      'este comercio, no haberse usado y estar vigente. Dos escaneos simultáneos: uno da 200 y el ' +
      'otro 409.',
  })
  @ApiResponse({
    status: 200,
    example: { datos: { ...EJEMPLO_USO, validadoEn: '2026-10-03T12:00:00-03:00' }, meta: null },
  })
  @DocErrores(
    'VALIDACION_FALLIDA',
    'NO_AUTENTICADO',
    'SIN_PERMISO',
    'CODIGO_INVALIDO',
    'PROMO_DE_OTRO_COMERCIO',
    'CODIGO_YA_VALIDADO',
    'PROMO_VENCIDA',
    'PROMO_NO_EMPEZO',
  )
  async validar(
    @UsuarioActual() sesion: UsuarioSesion,
    @Body() cuerpo: ValidarUsoDto,
  ): Promise<RespuestaUno<UsoDePromocion>> {
    return respuestaUno(await this.servicio.validar(sesion.id, cuerpo.codigo));
  }
}
