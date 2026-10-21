import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type {
  RespuestaUno,
  Sesion as SesionContrato,
} from '../../../contract/api.js';
import { LoginRateLimit } from '../../common/http/rate-limit.js';
import { Publico } from '../../common/auth/decorators.js';
import { Doc } from '../../common/response/documentation.js';
import { respuestaUno } from '../../common/response/response.js';
import { EJEMPLO_USUARIO } from '../users/examples.js';
import { AuthServicio } from './auth.service.js';
import { IngresoDto } from './dto/login.dto.js';
import { RefrescoDto } from './dto/refresh.dto.js';

@ApiTags('Sesión')
@Controller('auth')
export class AuthControlador {
  constructor(private readonly auth: AuthServicio) {}

  @Post('ingreso')
  @Publico()
  @LoginRateLimit()
  @HttpCode(200)
  @Doc({
    resumen: 'Ingresar con legajo y contraseña',
    descripcion:
      'El legajo se compara sin distinguir mayúsculas. El token dura 12 horas y va en ' +
      '`Authorization: Bearer <token>`. También devuelve `refreshToken` (30 días): se cambia por ' +
      'una sesión nueva en `POST /auth/refresco`. No hay registro público.',
    roles: null,
    ejemplo: {
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…',
      refreshToken: 'dGhpcy1pcy1hLXJlZnJlc2gtdG9rZW4',
      usuario: EJEMPLO_USUARIO,
    },
    errores: ['VALIDACION_FALLIDA', 'CREDENCIALES_INVALIDAS'],
  })
  async ingresar(
    @Body() dto: IngresoDto,
  ): Promise<RespuestaUno<SesionContrato>> {
    return respuestaUno(await this.auth.ingresar(dto.legajo, dto.contrasena));
  }

  @Post('refresco')
  @Publico()
  @HttpCode(200)
  @Doc({
    resumen: 'Renovar la sesión con el token de refresco',
    descripcion:
      'Devuelve un token de acceso nuevo (otras 12 horas) y un token de refresco nuevo. ' +
      'El token de refresco que mandaste deja de servir. Si venció, ya se usó, o la sesión ' +
      'se cerró (blanqueo de contraseña), hay que ingresar de nuevo con legajo y contraseña.',
    roles: null,
    ejemplo: {
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…',
      refreshToken: 'b3Ryby10b2tlbi1kZS1yZWZyZXNjbw',
      usuario: EJEMPLO_USUARIO,
    },
    errores: ['VALIDACION_FALLIDA', 'NO_AUTENTICADO'],
  })
  async refrescar(
    @Body() dto: RefrescoDto,
  ): Promise<RespuestaUno<SesionContrato>> {
    return respuestaUno(await this.auth.refrescar(dto.refreshToken));
  }
}
