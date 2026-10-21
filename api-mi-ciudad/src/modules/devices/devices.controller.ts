import { Body, Controller, Delete, HttpCode, Param, Post, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { Dispositivo, PruebaNotificacion, RespuestaUno } from '../../../contract/api.js';
import { UsuarioActual, type UsuarioAutenticado } from '../../common/auth/decorators.js';
import { respuestaUno } from '../../common/response/response.js';
import { ejemploError } from '../../common/swagger/examples.js';
import { DispositivosServicio } from './devices.service.js';
import { RegistrarDispositivoDto } from './dto/register-device.dto.js';

const EJEMPLO = { tokenExpo: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]', plataforma: 'android' };

@ApiTags('Notificaciones')
@ApiBearerAuth()
@Controller('dispositivos')
export class DispositivosControlador {
  constructor(private readonly dispositivos: DispositivosServicio) {}

  @Post()
  @ApiOperation({
    summary: 'Registrar el teléfono para recibir notificaciones (lo completan ustedes)',
    description:
      'Con sesión. Se llama con el token de `expo-notifications`. Es idempotente: 201 si es nuevo, 200 si ya estaba. ' +
      'Si el token era de otra cuenta, pasa a la actual.',
  })
  @ApiResponse({ status: 201, schema: { example: { datos: EJEMPLO, meta: null } } })
  @ApiResponse({
    status: 200,
    description: 'Ya estaba registrado.',
    schema: { example: { datos: EJEMPLO, meta: null } },
  })
  @ApiResponse({ status: 400, description: 'VALIDACION_FALLIDA', schema: ejemploError('VALIDACION_FALLIDA') })
  @ApiResponse({ status: 401, description: 'NO_AUTENTICADO', schema: ejemploError('NO_AUTENTICADO') })
  @ApiResponse({
    status: 501,
    description: 'NO_IMPLEMENTADO: esta parte la completan ustedes (docs/NOTIFICATIONS.md).',
    schema: ejemploError('NO_IMPLEMENTADO'),
  })
  async registrar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: RegistrarDispositivoDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RespuestaUno<Dispositivo>> {
    const { dispositivo, nuevo } = await this.dispositivos.registrar(usuario.id, dto);
    res.status(nuevo ? 201 : 200);
    return respuestaUno(dispositivo);
  }

  @Post('prueba')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Mandarme una notificación de prueba (lo completan ustedes)',
    description: 'Con sesión. Manda una push a todos mis teléfonos registrados y dice a cuántos.',
  })
  @ApiResponse({ status: 200, schema: { example: { datos: { enviadas: 1 }, meta: null } } })
  @ApiResponse({ status: 401, description: 'NO_AUTENTICADO', schema: ejemploError('NO_AUTENTICADO') })
  @ApiResponse({
    status: 501,
    description: 'NO_IMPLEMENTADO: esta parte la completan ustedes (docs/NOTIFICATIONS.md).',
    schema: ejemploError('NO_IMPLEMENTADO'),
  })
  async prueba(@UsuarioActual() usuario: UsuarioAutenticado): Promise<RespuestaUno<PruebaNotificacion>> {
    return respuestaUno(await this.dispositivos.prueba(usuario.id));
  }

  @Delete(':tokenExpo')
  @HttpCode(204)
  @ApiParam({ name: 'tokenExpo', description: 'El token, codificado para URL.' })
  @ApiOperation({
    summary: 'Dejar de recibir notificaciones en este teléfono (lo completan ustedes)',
    description: 'Con sesión. 204 siempre, también si el token no estaba (idempotente).',
  })
  @ApiResponse({ status: 204, description: 'Listo.' })
  @ApiResponse({ status: 401, description: 'NO_AUTENTICADO', schema: ejemploError('NO_AUTENTICADO') })
  @ApiResponse({
    status: 501,
    description: 'NO_IMPLEMENTADO: esta parte la completan ustedes (docs/NOTIFICATIONS.md).',
    schema: ejemploError('NO_IMPLEMENTADO'),
  })
  async darDeBaja(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('tokenExpo') tokenExpo: string,
  ): Promise<void> {
    await this.dispositivos.darDeBaja(usuario.id, tokenExpo);
  }
}
