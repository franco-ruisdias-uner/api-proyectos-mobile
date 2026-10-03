import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { RespuestaUno, Sesion } from '../../../contrato/api.js';
import { Publico } from '../../comun/auth/decoradores.js';
import { respuestaUno } from '../../comun/respuesta/respuesta.js';
import { DocErrores } from '../../swagger/doc-errores.js';
import { AuthServicio } from './auth.servicio.js';
import { IngresoDto } from './dto/ingreso.dto.js';
import { RegistroDto } from './dto/registro.dto.js';
import { EJEMPLO_USUARIO } from './ejemplos.js';

const EJEMPLO_SESION = {
  datos: {
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…',
    usuario: { ...EJEMPLO_USUARIO, favoritos: [], rubrosDeInteres: [] },
  },
  meta: null,
};

@ApiTags('Cuenta')
@Controller('auth')
export class AuthControlador {
  constructor(private readonly auth: AuthServicio) {}

  @Post('registro')
  @Publico()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Crear una cuenta de vecino',
    description:
      'Público. Siempre crea una cuenta `vecino`; las de comercio las crea el Centro Comercial. ' +
      'El token dura 30 días: guardalo en expo-secure-store y mandalo en `Authorization: Bearer <token>`.',
  })
  @ApiResponse({ status: 201, example: EJEMPLO_SESION })
  @DocErrores('VALIDACION_FALLIDA', 'EMAIL_YA_REGISTRADO')
  async registrar(@Body() cuerpo: RegistroDto): Promise<RespuestaUno<Sesion>> {
    return respuestaUno(await this.auth.registrar(cuerpo));
  }

  @Post('ingreso')
  @Publico()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Ingresar',
    description: 'Público. Email (sin distinguir mayúsculas) y contraseña.',
  })
  @ApiResponse({ status: 200, example: EJEMPLO_SESION })
  @DocErrores('VALIDACION_FALLIDA', 'CREDENCIALES_INVALIDAS')
  async ingresar(@Body() cuerpo: IngresoDto): Promise<RespuestaUno<Sesion>> {
    return respuestaUno(await this.auth.ingresar(cuerpo));
  }
}
