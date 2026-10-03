import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { RespuestaUno } from '../../../contrato/api.js';
import type { Usuario as UsuarioContrato } from '../../../contrato/tipos.js';
import { Roles, UsuarioActual, type UsuarioSesion } from '../../comun/auth/decoradores.js';
import { respuestaUno } from '../../comun/respuesta/respuesta.js';
import { DocErrores } from '../../swagger/doc-errores.js';
import { EJEMPLO_USUARIO } from '../auth/ejemplos.js';
import { ActualizarYoDto } from './dto/actualizar-yo.dto.js';
import { UsuariosServicio } from './usuarios.servicio.js';

@ApiTags('Cuenta')
@ApiBearerAuth()
@Controller('yo')
export class YoControlador {
  constructor(private readonly usuarios: UsuariosServicio) {}

  @Get()
  @ApiOperation({ summary: 'Mi cuenta', description: 'Con sesión. Devuelve tu `Usuario`.' })
  @ApiResponse({ status: 200, example: { datos: EJEMPLO_USUARIO, meta: null } })
  @DocErrores('NO_AUTENTICADO')
  async ver(@UsuarioActual() sesion: UsuarioSesion): Promise<RespuestaUno<UsuarioContrato>> {
    return respuestaUno(await this.usuarios.verYo(sesion.id));
  }

  @Patch()
  @ApiOperation({
    summary: 'Cambiar datos de mi cuenta',
    description:
      'Con sesión. `{ nombre?, rubrosDeInteres?, avisosActivos? }`. Lo que no mandás queda como estaba. `rubrosDeInteres` reemplaza la lista entera.',
  })
  @ApiResponse({ status: 200, example: { datos: EJEMPLO_USUARIO, meta: null } })
  @DocErrores('VALIDACION_FALLIDA', 'NO_AUTENTICADO', 'RUBRO_NO_ENCONTRADO')
  async actualizar(
    @UsuarioActual() sesion: UsuarioSesion,
    @Body() cuerpo: ActualizarYoDto,
  ): Promise<RespuestaUno<UsuarioContrato>> {
    return respuestaUno(await this.usuarios.actualizar(sesion.id, cuerpo));
  }

  @Put('favoritos/:comercioId')
  @Roles('vecino')
  @ApiOperation({
    summary: 'Agregar un favorito',
    description:
      'Sólo vecinos. Idempotente: si ya era favorito, devuelve lo mismo. Devuelve tu `Usuario`.',
  })
  @ApiResponse({ status: 200, example: { datos: EJEMPLO_USUARIO, meta: null } })
  @DocErrores('NO_AUTENTICADO', 'SIN_PERMISO', 'COMERCIO_NO_ENCONTRADO')
  async agregarFavorito(
    @UsuarioActual() sesion: UsuarioSesion,
    @Param('comercioId') comercioId: string,
  ): Promise<RespuestaUno<UsuarioContrato>> {
    return respuestaUno(await this.usuarios.agregarFavorito(sesion.id, comercioId));
  }

  @Delete('favoritos/:comercioId')
  @Roles('vecino')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Quitar un favorito',
    description: 'Sólo vecinos. 204 sin cuerpo, también si no era favorito.',
  })
  @ApiResponse({ status: 204 })
  @DocErrores('NO_AUTENTICADO', 'SIN_PERMISO')
  async quitarFavorito(
    @UsuarioActual() sesion: UsuarioSesion,
    @Param('comercioId') comercioId: string,
  ): Promise<void> {
    await this.usuarios.quitarFavorito(sesion.id, comercioId);
  }
}
