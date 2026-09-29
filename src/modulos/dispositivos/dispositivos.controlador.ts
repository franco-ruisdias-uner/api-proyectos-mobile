import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type {
  Dispositivo,
  PruebaDePush,
  RespuestaUno,
} from '../../../contrato/api.js';
import { UsuarioActual } from '../../comun/auth/decoradores.js';
import { respuestaUno } from '../../comun/respuesta/respuesta.js';
import {
  DocConSesion,
  DocErrores,
  DocRespuestaUno,
} from '../../comun/swagger/documentacion.js';
import {
  DispositivoDoc,
  PruebaDePushDoc,
} from '../../comun/swagger/modelos.js';
import type { Usuario } from '../usuarios/usuario.entidad.js';
import { aDispositivo } from './dispositivos.mapeador.js';
import { ServicioDispositivos } from './dispositivos.servicio.js';
import { RegistrarDispositivoDto } from './dto/registrar-dispositivo.dto.js';

@ApiTags('Notificaciones')
@Controller('dispositivos')
@DocConSesion()
export class ControladorDispositivos {
  constructor(private readonly dispositivos: ServicioDispositivos) {}

  @Post()
  @ApiOperation({
    summary: 'Registrar el token de push de este teléfono',
    description:
      'Llamalo después de ingresar. Se puede repetir: si ya estaba registrado responde 200. Si el token era de otra cuenta, pasa a la tuya.',
  })
  @DocRespuestaUno(201, DispositivoDoc, 'Registrado.')
  @DocRespuestaUno(200, DispositivoDoc, 'Ya estaba registrado.')
  @DocErrores('VALIDACION_FALLIDA')
  async registrar(
    @UsuarioActual() usuario: Usuario,
    @Body() dto: RegistrarDispositivoDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RespuestaUno<Dispositivo>> {
    const { dispositivo, creado } = await this.dispositivos.registrar(
      usuario,
      dto,
    );
    res.status(creado ? 201 : 200);
    return respuestaUno(aDispositivo(dispositivo));
  }

  @Post('prueba')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Mandarme una push de prueba',
    description:
      'Le manda una notificación a cada teléfono registrado de tu cuenta. Sirve para depurar.',
  })
  @DocRespuestaUno(
    200,
    PruebaDePushDoc,
    'A cuántos dispositivos se mandó (0 si tenés los avisos apagados).',
  )
  async probar(
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaUno<PruebaDePush>> {
    return respuestaUno({ enviadas: await this.dispositivos.probar(usuario) });
  }

  @Delete(':tokenExpo')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Dar de baja el token de este teléfono',
    description:
      'Llamalo al cerrar sesión. Si ya no estaba, también responde 204.',
  })
  @ApiNoContentResponse({ description: 'Dado de baja (sin cuerpo).' })
  async darDeBaja(
    @UsuarioActual() usuario: Usuario,
    @Param('tokenExpo') tokenExpo: string,
  ): Promise<void> {
    await this.dispositivos.darDeBaja(usuario, tokenExpo);
  }
}
