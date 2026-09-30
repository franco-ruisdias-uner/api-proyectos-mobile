import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { RespuestaUno } from '../../../contrato/api.js';
import type { Usuario } from '../../../contrato/tipos.js';
import { UsuarioActual, type UsuarioDeSesion } from '../../comun/auth/decoradores.js';
import { Ejemplo, ErroresPosibles } from '../../comun/documentacion/swagger.js';
import { respuestaUno } from '../../comun/respuesta/respuesta.js';
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
}
