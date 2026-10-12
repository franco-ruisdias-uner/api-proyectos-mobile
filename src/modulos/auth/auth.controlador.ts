import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type {
  RespuestaUno,
  Sesion as SesionContrato,
} from '../../../contrato/api.js';
import { Publico, Sesion } from '../../comun/auth/decoradores.js';
import type { SesionActual } from '../../comun/auth/sesion-actual.js';
import { Doc } from '../../comun/respuesta/documentacion.js';
import { respuestaUno } from '../../comun/respuesta/respuesta.js';
import { EJEMPLO_USUARIO } from '../usuarios/ejemplos.js';
import { AuthServicio } from './auth.servicio.js';
import { IngresoDto } from './dto/ingreso.dto.js';

@ApiTags('Sesión')
@Controller('auth')
export class AuthControlador {
  constructor(private readonly auth: AuthServicio) {}

  @Post('ingreso')
  @Publico()
  @HttpCode(200)
  @Doc({
    resumen: 'Ingresar con legajo y contraseña',
    descripcion:
      'El legajo se compara sin distinguir mayúsculas. El token dura 12 horas y va en ' +
      '`Authorization: Bearer <token>`. No hay registro público.',
    roles: null,
    ejemplo: {
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…',
      usuario: EJEMPLO_USUARIO,
    },
    errores: ['VALIDACION_FALLIDA', 'CREDENCIALES_INVALIDAS'],
  })
  async ingresar(
    @Body() dto: IngresoDto,
  ): Promise<RespuestaUno<SesionContrato>> {
    return respuestaUno(await this.auth.ingresar(dto.legajo, dto.contrasena));
  }

  @Post('salida')
  @HttpCode(204)
  @Doc({
    resumen: 'Salir: cierra todas las sesiones del usuario',
    descripcion:
      'Invalida todos los tokens de ese usuario, en este teléfono y en cualquier otro (los teléfonos se comparten entre turnos).',
    roles: [],
    estado: 204,
    sinCuerpo: true,
  })
  async salir(@Sesion() sesion: SesionActual): Promise<void> {
    await this.auth.salir(sesion.usuarioId);
  }
}
