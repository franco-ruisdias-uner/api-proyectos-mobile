import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { RespuestaUno } from '../../../contrato/api.js';
import type { Usuario } from '../../../contrato/tipos.js';
import {
  SesionActual,
  type UsuarioSesion,
} from '../../comun/auth/decoradores.js';
import { respuestaUno } from '../../comun/respuesta/respuesta.js';
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
}
