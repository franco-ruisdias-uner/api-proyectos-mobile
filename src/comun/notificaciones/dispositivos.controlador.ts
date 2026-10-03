import { Body, Controller, Delete, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Dispositivo, PruebaPush, RespuestaUno } from '../../../contrato/api.js';
import { UsuarioActual, type UsuarioSesion } from '../auth/decoradores.js';
import { ErrorApi } from '../errores/error-api.js';
import { respuestaUno } from '../respuesta/respuesta.js';
import { DocErrores } from '../../swagger/doc-errores.js';
import { DispositivosServicio } from './dispositivos.servicio.js';
import { FORMATO_TOKEN_EXPO, RegistrarDispositivoDto } from './dto/registrar-dispositivo.dto.js';

@ApiTags('Notificaciones')
@ApiBearerAuth()
@Controller('dispositivos')
export class DispositivosControlador {
  constructor(private readonly dispositivos: DispositivosServicio) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Registrar el teléfono para recibir push',
    description:
      'Con sesión. Manda el token de `expo-notifications`. Repetirlo no duplica nada; si el token ' +
      'era de otra cuenta (se cambió de usuario en el teléfono), pasa a la tuya.',
  })
  @ApiResponse({
    status: 201,
    example: {
      datos: { tokenExpo: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]', plataforma: 'android' },
      meta: null,
    },
  })
  @DocErrores('VALIDACION_FALLIDA', 'NO_AUTENTICADO')
  async registrar(
    @UsuarioActual() usuario: UsuarioSesion,
    @Body() cuerpo: RegistrarDispositivoDto,
  ): Promise<RespuestaUno<Dispositivo>> {
    return respuestaUno(
      await this.dispositivos.registrar(usuario.id, cuerpo.tokenExpo, cuerpo.plataforma),
    );
  }

  @Post('prueba')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Mandarme una push de prueba',
    description:
      'Con sesión. Manda una notificación a todos tus teléfonos registrados. Sirve para depurar.',
  })
  @ApiResponse({ status: 200, example: { datos: { dispositivos: 1 }, meta: null } })
  @DocErrores('NO_AUTENTICADO')
  async probar(@UsuarioActual() usuario: UsuarioSesion): Promise<RespuestaUno<PruebaPush>> {
    return respuestaUno(await this.dispositivos.probar(usuario.id));
  }

  @Delete(':tokenExpo')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Dar de baja el teléfono',
    description:
      'Con sesión. Al cerrar sesión. Si el token no estaba registrado, igual responde 204.',
  })
  @ApiResponse({ status: 204, description: 'Dado de baja (sin cuerpo)' })
  @DocErrores('VALIDACION_FALLIDA', 'NO_AUTENTICADO')
  async darDeBaja(
    @UsuarioActual() usuario: UsuarioSesion,
    @Param('tokenExpo') tokenExpo: string,
  ): Promise<void> {
    if (!FORMATO_TOKEN_EXPO.test(tokenExpo)) {
      throw new ErrorApi('VALIDACION_FALLIDA', 'El token de notificaciones no es válido.');
    }
    await this.dispositivos.darDeBaja(usuario.id, tokenExpo);
  }
}
