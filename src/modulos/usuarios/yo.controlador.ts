import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { RespuestaUno } from '../../../contrato/api.js';
import type { Usuario } from '../../../contrato/tipos.js';
import { UsuarioActual, type UsuarioDeSesion } from '../../comun/auth/decoradores.js';
import { Ejemplo, ErroresPosibles } from '../../comun/documentacion/swagger.js';
import { respuestaUno } from '../../comun/respuesta/respuesta.js';
import { ActualizarYoDto } from './dto/actualizar-yo.dto.js';
import { USUARIO_DE_EJEMPLO } from './ejemplos.js';
import { UsuariosServicio } from './usuarios.servicio.js';

@ApiTags('Cuenta')
@ApiBearerAuth()
@Controller('yo')
export class YoControlador {
  constructor(private readonly usuarios: UsuariosServicio) {}

  @Get()
  @ApiOperation({ summary: 'Mi cuenta', description: 'Con sesión. El `Usuario` del PRD.' })
  @Ejemplo(200, 'El usuario de la sesión', { datos: USUARIO_DE_EJEMPLO, meta: null })
  @ErroresPosibles('NO_AUTENTICADO')
  async obtener(@UsuarioActual() usuario: UsuarioDeSesion): Promise<RespuestaUno<Usuario>> {
    return respuestaUno(await this.usuarios.obtener(usuario.id));
  }

  @Patch()
  @ApiOperation({
    summary: 'Cambiar mi nombre, los avisos o el tema',
    description:
      'Con sesión. Parcial: sólo cambia lo que viene. El resto de los datos no se edita.',
  })
  @Ejemplo(200, 'El usuario actualizado', { datos: USUARIO_DE_EJEMPLO, meta: null })
  @ErroresPosibles('VALIDACION_FALLIDA', 'NO_AUTENTICADO')
  async actualizar(
    @UsuarioActual() usuario: UsuarioDeSesion,
    @Body() cambios: ActualizarYoDto,
  ): Promise<RespuestaUno<Usuario>> {
    return respuestaUno(await this.usuarios.actualizar(usuario.id, cambios));
  }

  @Put('lineas-favoritas/:lineaId')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Agregar una línea a favoritas',
    description: 'Con sesión. Idempotente: si ya era favorita no cambia nada. Se agrega al final.',
  })
  @ApiParam({ name: 'lineaId', example: 'lin-05' })
  @Ejemplo(200, 'El usuario con la línea agregada', { datos: USUARIO_DE_EJEMPLO, meta: null })
  @ErroresPosibles('LINEA_NO_ENCONTRADA', 'NO_AUTENTICADO')
  async agregarLinea(
    @UsuarioActual() usuario: UsuarioDeSesion,
    @Param('lineaId') lineaId: string,
  ): Promise<RespuestaUno<Usuario>> {
    return respuestaUno(await this.usuarios.agregarLineaFavorita(usuario.id, lineaId));
  }

  @Delete('lineas-favoritas/:lineaId')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Quitar una línea de favoritas',
    description: 'Con sesión. 204 sin cuerpo; idempotente (también si no era favorita).',
  })
  @ApiParam({ name: 'lineaId', example: 'lin-05' })
  @ErroresPosibles('NO_AUTENTICADO')
  async quitarLinea(
    @UsuarioActual() usuario: UsuarioDeSesion,
    @Param('lineaId') lineaId: string,
  ): Promise<void> {
    await this.usuarios.quitarLineaFavorita(usuario.id, lineaId);
  }

  @Put('paradas-favoritas/:paradaId')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Agregar una parada a favoritas',
    description: 'Con sesión. Idempotente: si ya era favorita no cambia nada. Se agrega al final.',
  })
  @ApiParam({ name: 'paradaId', example: 'par-101' })
  @Ejemplo(200, 'El usuario con la parada agregada', { datos: USUARIO_DE_EJEMPLO, meta: null })
  @ErroresPosibles('PARADA_NO_ENCONTRADA', 'NO_AUTENTICADO')
  async agregarParada(
    @UsuarioActual() usuario: UsuarioDeSesion,
    @Param('paradaId') paradaId: string,
  ): Promise<RespuestaUno<Usuario>> {
    return respuestaUno(await this.usuarios.agregarParadaFavorita(usuario.id, paradaId));
  }

  @Delete('paradas-favoritas/:paradaId')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Quitar una parada de favoritas',
    description: 'Con sesión. 204 sin cuerpo; idempotente (también si no era favorita).',
  })
  @ApiParam({ name: 'paradaId', example: 'par-101' })
  @ErroresPosibles('NO_AUTENTICADO')
  async quitarParada(
    @UsuarioActual() usuario: UsuarioDeSesion,
    @Param('paradaId') paradaId: string,
  ): Promise<void> {
    await this.usuarios.quitarParadaFavorita(usuario.id, paradaId);
  }
}
