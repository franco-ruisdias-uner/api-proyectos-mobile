import { Body, Controller, Delete, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { Dispositivo, PruebaDePush, RespuestaUno } from '../../../contract/api.js';
import { UsuarioActual, type UsuarioDeSesion } from '../../common/auth/decorators.js';
import { Ejemplo, ErroresPosibles } from '../../common/documentation/swagger.js';
import { respuestaUno } from '../../common/response/response.js';
import { Avisos } from '../../common/notifications/notices.js';
import { AlmacenTokensPush } from '../../common/notifications/ports.js';
import { RegistrarDispositivoDto } from './dto/register-device.dto.js';

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
    summary: 'Registrar el token de push del teléfono',
    description:
      '**Lo completan ustedes** (docs/NOTIFICATIONS.md): hasta entonces responde 501. ' +
      'Con sesión. Idempotente: registrar el mismo token otra vez no duplica nada. Si el token ' +
      'era de otra cuenta (se cambió de usuario en el mismo teléfono), pasa a la actual.',
  })
  @Ejemplo(201, 'Dispositivo registrado', {
    datos: { tokenExpo: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]', plataforma: 'android' },
    meta: null,
  })
  @ErroresPosibles('VALIDACION_FALLIDA', 'NO_AUTENTICADO', 'NO_IMPLEMENTADO')
  async registrar(
    @UsuarioActual() usuario: UsuarioDeSesion,
    @Body() dto: RegistrarDispositivoDto,
  ): Promise<RespuestaUno<Dispositivo>> {
    await this.almacen.guardar(usuario.id, dto.tokenExpo, dto.plataforma);
    return respuestaUno({ tokenExpo: dto.tokenExpo, plataforma: dto.plataforma });
  }

  @Post('prueba')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Mandarme una push de prueba',
    description:
      '**Lo completan ustedes** (docs/NOTIFICATIONS.md): hasta entonces responde 501. ' +
      'Con sesión. Manda una notificación a los teléfonos registrados de la cuenta (si tiene ' +
      'los avisos activos). `enviadas` dice a cuántos teléfonos se mandó.',
  })
  @Ejemplo(200, 'Prueba enviada', { datos: { enviadas: 1 }, meta: null })
  @ErroresPosibles('NO_AUTENTICADO', 'NO_IMPLEMENTADO')
  async probar(@UsuarioActual() usuario: UsuarioDeSesion): Promise<RespuestaUno<PruebaDePush>> {
    return respuestaUno({ enviadas: await this.avisos.probar(usuario.id) });
  }

  @Delete(':tokenExpo')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Dar de baja el token de push del teléfono',
    description:
      '**Lo completan ustedes** (docs/NOTIFICATIONS.md): hasta entonces responde 501. ' +
      'Con sesión. 204 sin cuerpo, exista o no el token (idempotente).',
  })
  @ApiParam({ name: 'tokenExpo', example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]' })
  @ErroresPosibles('NO_AUTENTICADO', 'NO_IMPLEMENTADO')
  async darDeBaja(
    @UsuarioActual() usuario: UsuarioDeSesion,
    @Param('tokenExpo') tokenExpo: string,
  ): Promise<void> {
    // Sólo se borra el token si es de quien lo pide.
    if ((await this.almacen.tokensDe([usuario.id])).includes(tokenExpo)) {
      await this.almacen.borrar(tokenExpo);
    }
  }
}
