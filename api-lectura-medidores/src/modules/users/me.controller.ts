import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { RespuestaUno } from '../../../contract/api.js';
import type { Usuario } from '../../../contract/types.js';
import { Sesion } from '../../common/auth/decorators.js';
import type { SesionActual } from '../../common/auth/current-session.js';
import { Doc } from '../../common/response/documentation.js';
import { respuestaUno } from '../../common/response/response.js';
import { ActualizarYoDto } from './dto/users.dto.js';
import { EJEMPLO_USUARIO } from './examples.js';
import { UsuariosServicio } from './users.service.js';

@ApiTags('Sesión')
@Controller('yo')
export class YoControlador {
  constructor(private readonly usuarios: UsuariosServicio) {}

  @Get()
  @Doc({
    resumen: 'El usuario de la sesión',
    roles: [],
    ejemplo: EJEMPLO_USUARIO,
  })
  async obtener(
    @Sesion() sesion: SesionActual,
  ): Promise<RespuestaUno<Usuario>> {
    const usuario = await this.usuarios.buscar(sesion.usuarioId);
    return respuestaUno(await this.usuarios.contratoDe(usuario));
  }

  @Patch()
  @Doc({
    resumen: 'Cambia la preferencia de huella o la contraseña propia',
    descripcion:
      'Cuerpo: `{ biometriaActiva?, contrasenaActual?, contrasenaNueva? }`. Para cambiar la contraseña hay que mandar la actual. ' +
      'Cambiar la contraseña propia no cierra la sesión en curso.',
    roles: [],
    ejemplo: EJEMPLO_USUARIO,
    errores: ['VALIDACION_FALLIDA', 'CREDENCIALES_INVALIDAS'],
  })
  async actualizar(
    @Sesion() sesion: SesionActual,
    @Body() dto: ActualizarYoDto,
  ): Promise<RespuestaUno<Usuario>> {
    const usuario = await this.usuarios.actualizarPropio(sesion.usuarioId, dto);
    return respuestaUno(await this.usuarios.contratoDe(usuario));
  }
}
