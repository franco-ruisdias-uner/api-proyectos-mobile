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
import type { RespuestaLista, RespuestaUno } from '../../../contrato/api.js';
import type { Comercio, Promocion } from '../../../contrato/tipos.js';
import { Roles, UsuarioActual, type UsuarioSesion } from '../../comun/auth/decoradores.js';
import { metaDe, PaginacionDto } from '../../comun/respuesta/paginacion.dto.js';
import { respuestaLista, respuestaUno } from '../../comun/respuesta/respuesta.js';
import { DocErrores } from '../../swagger/doc-errores.js';
import { EJEMPLO_COMERCIO } from '../comercios/comercios.ejemplos.js';
import { EJEMPLO_PROMOCION } from '../promociones/promociones.ejemplos.js';
import { ActualizarComercioDto } from './dto/actualizar-comercio.dto.js';
import { CrearPromocionDto, EditarPromocionDto } from './dto/promocion.dto.js';
import { PanelComercioServicio } from './panel-comercio.servicio.js';

@ApiTags('Panel del comercio')
@ApiBearerAuth()
@Roles('comercio')
@Controller('mi-comercio')
export class PanelComercioControlador {
  constructor(private readonly servicio: PanelComercioServicio) {}

  @Get()
  @ApiOperation({
    summary: 'Mi comercio',
    description:
      'Sólo cuentas de comercio. Devuelve el `Comercio` de la sesión, también si está dado de baja.',
  })
  @ApiResponse({ status: 200, example: { datos: EJEMPLO_COMERCIO, meta: null } })
  @DocErrores('NO_AUTENTICADO', 'SIN_PERMISO', 'COMERCIO_NO_ENCONTRADO')
  async ver(@UsuarioActual() sesion: UsuarioSesion): Promise<RespuestaUno<Comercio>> {
    return respuestaUno(await this.servicio.verComercio(sesion.id));
  }

  @Patch()
  @ApiOperation({
    summary: 'Editar mi comercio',
    description:
      'Sólo cuentas de comercio. Datos, horarios, fotos, video y medios de pago; lo que no mandás queda como estaba ' +
      '(`horarios`, `imagenes` y `mediosDePago` se reemplazan enteros). `horarios` lleva un elemento por tramo ' +
      '(`HH:MM`, abre antes de cerrar, sin pisarse el mismo día). `mediosDePago` de: efectivo, debito, credito, ' +
      'transferencia, billetera_virtual. Fotos y video son URLs de `POST /archivos`. `cerradoHasta` (`AAAA-MM-DD`) ' +
      'marca el cierre por vacaciones: mientras dura, el comercio sale con `horarios: []`. `activo`, `puntaje`, ' +
      'el rubro y el resto no se tocan desde acá.',
  })
  @ApiResponse({ status: 200, example: { datos: EJEMPLO_COMERCIO, meta: null } })
  @DocErrores(
    'VALIDACION_FALLIDA',
    'NO_AUTENTICADO',
    'SIN_PERMISO',
    'COMERCIO_NO_ENCONTRADO',
    'HORARIOS_SUPERPUESTOS',
    'ARCHIVO_NO_SUBIDO',
  )
  async editar(
    @UsuarioActual() sesion: UsuarioSesion,
    @Body() cuerpo: ActualizarComercioDto,
  ): Promise<RespuestaUno<Comercio>> {
    return respuestaUno(await this.servicio.editarComercio(sesion.id, cuerpo));
  }

  @Get('promociones')
  @ApiOperation({
    summary: 'Mis promociones',
    description:
      'Sólo cuentas de comercio. **Todas** las del comercio, incluidas las vencidas y las dadas de baja, ' +
      'con `usos`. Las más nuevas primero (por `desde`).',
  })
  @ApiResponse({
    status: 200,
    example: { datos: [EJEMPLO_PROMOCION], meta: { total: 1, pagina: 1, porPagina: 20 } },
  })
  @DocErrores('VALIDACION_FALLIDA', 'NO_AUTENTICADO', 'SIN_PERMISO')
  async listarPromociones(
    @UsuarioActual() sesion: UsuarioSesion,
    @Query() p: PaginacionDto,
  ): Promise<RespuestaLista<Promocion>> {
    const { datos, total } = await this.servicio.listarPromociones(sesion.id, p);
    return respuestaLista(datos, metaDe(p, total));
  }

  @Post('promociones')
  @ApiOperation({
    summary: 'Crear una promoción',
    description:
      'Sólo cuentas de comercio. `{ titulo, detalle, descuento?, desde?, hasta, imagenUrl?, soloApp? }`. ' +
      '`descuento` es un entero de 1 a 100 o `null`; `hasta` tiene que ser posterior a `desde` y a este momento. ' +
      'Nace activa y con 0 usos. Manda una push a quienes tienen al comercio en favoritos o su rubro en ' +
      'rubros de interés (con avisos activos, una sola por persona; el comercio no se avisa a sí mismo).',
  })
  @ApiResponse({ status: 201, example: { datos: EJEMPLO_PROMOCION, meta: null } })
  @DocErrores(
    'VALIDACION_FALLIDA',
    'NO_AUTENTICADO',
    'SIN_PERMISO',
    'COMERCIO_NO_ENCONTRADO',
    'PROMO_VENCIDA',
    'ARCHIVO_NO_SUBIDO',
  )
  async crearPromocion(
    @UsuarioActual() sesion: UsuarioSesion,
    @Body() cuerpo: CrearPromocionDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RespuestaUno<Promocion>> {
    const promo = await this.servicio.crearPromocion(sesion.id, cuerpo);
    res.status(201);
    return respuestaUno(promo);
  }

  @Patch('promociones/:id')
  @ApiOperation({
    summary: 'Editar una promoción',
    description:
      'Sólo cuentas de comercio, y una promoción propia no vencida. Lo que no mandás queda como estaba. ' +
      'Una vencida da 422 `PROMO_VENCIDA`; una de otro comercio, 403.',
  })
  @ApiParam({ name: 'id', example: 'pro-441' })
  @ApiResponse({ status: 200, example: { datos: EJEMPLO_PROMOCION, meta: null } })
  @DocErrores(
    'VALIDACION_FALLIDA',
    'NO_AUTENTICADO',
    'SIN_PERMISO',
    'PROMOCION_NO_ENCONTRADA',
    'PROMO_VENCIDA',
    'ARCHIVO_NO_SUBIDO',
  )
  async editarPromocion(
    @UsuarioActual() sesion: UsuarioSesion,
    @Param('id') id: string,
    @Body() cuerpo: EditarPromocionDto,
  ): Promise<RespuestaUno<Promocion>> {
    return respuestaUno(await this.servicio.editarPromocion(sesion.id, id, cuerpo));
  }

  @Delete('promociones/:id')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Dar de baja una promoción',
    description:
      'Sólo cuentas de comercio, y una promoción propia. La baja es lógica (`activa: false`): deja de verse en ' +
      '`/promociones` pero sigue en `GET /mi-comercio/promociones` con sus usos. Repetirla da 204.',
  })
  @ApiParam({ name: 'id', example: 'pro-441' })
  @ApiResponse({ status: 204 })
  @DocErrores('NO_AUTENTICADO', 'SIN_PERMISO', 'PROMOCION_NO_ENCONTRADA')
  async darDeBaja(@UsuarioActual() sesion: UsuarioSesion, @Param('id') id: string): Promise<void> {
    await this.servicio.darDeBajaPromocion(sesion.id, id);
  }
}
