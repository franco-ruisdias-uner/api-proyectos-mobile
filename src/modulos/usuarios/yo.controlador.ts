import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { RespuestaUno } from '../../../contrato/api.js';
import type { Usuario } from '../../../contrato/tipos.js';
import { Sesion } from '../../comun/auth/decoradores.js';
import type { SesionActual } from '../../comun/auth/sesion-actual.js';
import { Doc } from '../../comun/respuesta/documentacion.js';
import { respuestaUno } from '../../comun/respuesta/respuesta.js';
import { ActualizarYoDto } from './dto/usuarios.dto.js';
import { EJEMPLO_USUARIO } from './ejemplos.js';
import { UsuariosServicio } from './usuarios.servicio.js';

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
