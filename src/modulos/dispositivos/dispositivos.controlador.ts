import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type {
  Dispositivo,
  PruebaPush,
  RespuestaUno,
} from '../../../contrato/api.js';
import { Sesion } from '../../comun/auth/decoradores.js';
import type { SesionActual } from '../../comun/auth/sesion-actual.js';
import { ErrorApi } from '../../comun/errores/error-api.js';
import { Avisos } from '../../comun/notificaciones/avisos.js';
import { AlmacenTokensPush } from '../../comun/notificaciones/puertos.js';
import { Doc } from '../../comun/respuesta/documentacion.js';
import { respuestaUno } from '../../comun/respuesta/respuesta.js';
import {
  PATRON_TOKEN_EXPO,
  RegistrarDispositivoDto,
} from './dto/dispositivo.dto.js';

const TOKEN_EJEMPLO = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';

@ApiTags('Notificaciones')
@Controller('dispositivos')
export class DispositivosControlador {
  constructor(
    private readonly almacen: AlmacenTokensPush,
    private readonly avisos: Avisos,
  ) {}

  @Post()
  @HttpCode(201)
  @Doc({
    resumen: 'Registra el token de Expo del teléfono (lo completan ustedes)',
    descripcion:
      '**Esta parte la programan los alumnos** (hoy responde 501 `NO_IMPLEMENTADO`; ver docs/NOTIFICACIONES.md). ' +
      'Idempotente por token: mandarlo dos veces deja un solo registro. Si el token lo tenía otro usuario ' +
      '(teléfono compartido entre turnos), pasa al de la sesión.',
    roles: [],
    estado: 201,
    ejemplo: { tokenExpo: TOKEN_EJEMPLO, plataforma: 'android' },
    errores: ['VALIDACION_FALLIDA', 'NO_IMPLEMENTADO'],
  })
  async registrar(
    @Sesion() sesion: SesionActual,
    @Body() dto: RegistrarDispositivoDto,
  ): Promise<RespuestaUno<Dispositivo>> {
    await this.almacen.guardar(sesion.usuarioId, dto.tokenExpo, dto.plataforma);
    return respuestaUno({
      tokenExpo: dto.tokenExpo,
      plataforma: dto.plataforma,
    });
  }

  @Post('prueba')
  @HttpCode(200)
  @Doc({
    resumen:
      'Manda una push de prueba a los teléfonos del usuario (lo completan ustedes)',
    descripcion:
      '**Esta parte la programan los alumnos** (hoy responde 501 `NO_IMPLEMENTADO`). ' +
      'Para depurar: devuelve a cuántos dispositivos registrados se mandó.',
    roles: [],
    ejemplo: { dispositivos: 1 },
    errores: ['NO_IMPLEMENTADO'],
  })
  async probar(
    @Sesion() sesion: SesionActual,
  ): Promise<RespuestaUno<PruebaPush>> {
    const dispositivos = await this.avisos.enviarAhora(
      [sesion.usuarioId],
      {
        titulo: 'Prueba de avisos',
        cuerpo: 'Si ves esto, las notificaciones andan.',
        datos: { tipo: 'prueba' },
      },
      { propagarPendiente: true },
    );
    return respuestaUno({ dispositivos });
  }

  @Delete(':tokenExpo')
  @HttpCode(204)
  @Doc({
    resumen: 'Da de baja el token de Expo del teléfono (lo completan ustedes)',
    descripcion:
      '**Esta parte la programan los alumnos** (hoy responde 501 `NO_IMPLEMENTADO`). ' +
      'Por ejemplo, al salir. Si el token no estaba registrado, responde igual 204.',
    roles: [],
    estado: 204,
    sinCuerpo: true,
    errores: ['VALIDACION_FALLIDA', 'NO_IMPLEMENTADO'],
  })
  async borrar(@Param('tokenExpo') tokenExpo: string): Promise<void> {
    if (!PATRON_TOKEN_EXPO.test(tokenExpo)) {
      throw new ErrorApi(
        'VALIDACION_FALLIDA',
        'El token de notificaciones no es válido.',
      );
    }
    await this.almacen.borrar(tokenExpo);
  }
}
