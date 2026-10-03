import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { RespuestaUno } from '../../../contrato/api.js';
import type { Usuario as UsuarioContrato } from '../../../contrato/tipos.js';
import { UsuarioActual, type UsuarioSesion } from '../../comun/auth/decoradores.js';
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
    description: 'Con sesión. Por ahora, `{ nombre? }`. Lo que no mandás queda como estaba.',
  })
  @ApiResponse({ status: 200, example: { datos: EJEMPLO_USUARIO, meta: null } })
  @DocErrores('VALIDACION_FALLIDA', 'NO_AUTENTICADO')
  async actualizar(
    @UsuarioActual() sesion: UsuarioSesion,
    @Body() cuerpo: ActualizarYoDto,
  ): Promise<RespuestaUno<UsuarioContrato>> {
    return respuestaUno(await this.usuarios.actualizar(sesion.id, cuerpo));
  }
}
