import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { RespuestaUno } from '../../../contrato/api.js';
import type { Usuario } from '../../../contrato/tipos.js';
import {
  SesionActual,
  type UsuarioSesion,
} from '../../comun/auth/decoradores.js';
import { respuestaUno } from '../../comun/respuesta/respuesta.js';
import { ActualizarYoDto } from './dto/actualizar-yo.dto.js';
import { UsuariosServicio } from './usuarios.servicio.js';

@ApiTags('Cuenta')
@ApiBearerAuth()
@Controller('yo')
export class YoControlador {
  constructor(private readonly usuarios: UsuariosServicio) {}

  @Get()
  @ApiOperation({
    summary: 'Mi usuario',
    description: 'Con sesión.\n\nErrores: NO_AUTENTICADO (401).',
  })
  async yo(
    @SesionActual() sesion: UsuarioSesion,
  ): Promise<RespuestaUno<Usuario>> {
    return respuestaUno(await this.usuarios.yo(sesion.id));
  }

  @Patch()
  @ApiOperation({
    summary: 'Cambiar mi nombre o mi teléfono',
    description:
      'Con sesión. Los dos campos son opcionales; el email, el rol y los contadores no se pueden cambiar.\n\n' +
      'Errores: VALIDACION_FALLIDA (400), NO_AUTENTICADO (401).',
  })
  async actualizar(
    @SesionActual() sesion: UsuarioSesion,
    @Body() dto: ActualizarYoDto,
  ): Promise<RespuestaUno<Usuario>> {
    return respuestaUno(await this.usuarios.actualizar(sesion.id, dto));
  }

  @Put('espacios-favoritos/:espacioId')
  @ApiOperation({
    summary: 'Agregar un espacio a mis favoritos',
    description:
      'Con sesión. Idempotente: si ya era favorito, responde 200 igual. Devuelve el Usuario.\n\n' +
      'Errores: NO_AUTENTICADO (401), ESPACIO_NO_ENCONTRADO (404).',
  })
  async agregarFavorito(
    @SesionActual() sesion: UsuarioSesion,
    @Param('espacioId') espacioId: string,
  ): Promise<RespuestaUno<Usuario>> {
    return respuestaUno(
      await this.usuarios.agregarFavorito(sesion.id, espacioId),
    );
  }

  @Delete('espacios-favoritos/:espacioId')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Sacar un espacio de mis favoritos',
    description:
      'Con sesión. 204 sin cuerpo, también si no era favorito.\n\n' +
      'Errores: NO_AUTENTICADO (401).',
  })
  async quitarFavorito(
    @SesionActual() sesion: UsuarioSesion,
    @Param('espacioId') espacioId: string,
  ): Promise<void> {
    await this.usuarios.quitarFavorito(sesion.id, espacioId);
  }
}
