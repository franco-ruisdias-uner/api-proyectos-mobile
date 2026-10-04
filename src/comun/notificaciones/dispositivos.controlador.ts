import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type {
  Dispositivo,
  PruebaDePush,
  RespuestaUno,
} from '../../../contrato/api.js';
import { SesionActual, type UsuarioSesion } from '../auth/decoradores.js';
import { ErrorApi } from '../errores/error-api.js';
import { respuestaUno } from '../respuesta/respuesta.js';
import { Avisos } from './avisos.servicio.js';
import {
  FORMATO_TOKEN_EXPO,
  RegistrarDispositivoDto,
} from './dispositivos.dto.js';
import { AlmacenTokensPush } from './puertos.js';

@ApiTags('Notificaciones')
@ApiBearerAuth()
@Controller('dispositivos')
export class DispositivosControlador {
  constructor(
    private readonly almacen: AlmacenTokensPush,
    private readonly avisos: Avisos,
  ) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Anotar el teléfono para recibir push',
    description:
      'Con sesión. Idempotente por token: si el token ya estaba (incluso de otro usuario), queda a tu nombre.\n\n' +
      'Errores: VALIDACION_FALLIDA (400), NO_AUTENTICADO (401).',
  })
  @ApiResponse({
    status: 201,
    schema: {
      example: {
        datos: {
          tokenExpo: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
          plataforma: 'android',
        },
        meta: null,
      },
    },
  })
  async registrar(
    @SesionActual() sesion: UsuarioSesion,
    @Body() dto: RegistrarDispositivoDto,
  ): Promise<RespuestaUno<Dispositivo>> {
    await this.almacen.guardar(sesion.id, dto.tokenExpo, dto.plataforma);
    return respuestaUno({
      tokenExpo: dto.tokenExpo,
      plataforma: dto.plataforma,
    });
  }

  @Post('prueba')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Mandarme una push de prueba',
    description:
      'Con sesión. Manda una notificación a todos tus teléfonos anotados y dice a cuántos.\n\n' +
      'Errores: NO_AUTENTICADO (401).',
  })
  @ApiResponse({
    status: 200,
    schema: { example: { datos: { dispositivos: 1 }, meta: null } },
  })
  async prueba(
    @SesionActual() sesion: UsuarioSesion,
  ): Promise<RespuestaUno<PruebaDePush>> {
    const tokens = await this.almacen.tokensDe([sesion.id]);
    this.avisos.avisar([sesion.id], {
      titulo: 'Notificación de prueba',
      cuerpo: 'Si ves esto, las notificaciones andan.',
      datos: { tipo: 'prueba' },
    });
    return respuestaUno({ dispositivos: tokens.length });
  }

  @Delete(':tokenExpo')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Dejar de recibir push en este teléfono',
    description:
      'Con sesión. 204 sin cuerpo, aunque el token no estuviera anotado. Sólo da de baja tus propios teléfonos.\n\nErrores: VALIDACION_FALLIDA (400), NO_AUTENTICADO (401).',
  })
  async borrar(
    @SesionActual() sesion: UsuarioSesion,
    @Param('tokenExpo') tokenExpo: string,
  ): Promise<void> {
    if (!FORMATO_TOKEN_EXPO.test(tokenExpo)) {
      throw new ErrorApi(
        'VALIDACION_FALLIDA',
        'El token de notificaciones del teléfono no es válido.',
      );
    }
    // Sólo se borra un token propio. Uno ajeno también da 204, sin tocarlo ni revelar de quién es.
    const propios = await this.almacen.tokensDe([sesion.id]);
    if (propios.includes(tokenExpo)) await this.almacen.borrar(tokenExpo);
  }
}
