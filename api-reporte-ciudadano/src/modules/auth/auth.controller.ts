import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { RespuestaUno, Sesion } from '../../../contract/api.js';
import { Publico } from '../../common/auth/decorators.js';
import { respuestaUno } from '../../common/response/response.js';
import {
  DocErrores,
  DocRespuestaUno,
} from '../../common/swagger/documentation.js';
import { SesionDoc } from '../../common/swagger/models.js';
import { ServicioAuth } from './auth.service.js';
import { IngresoDto } from './dto/login.dto.js';
import { RegistroDto } from './dto/register.dto.js';

@ApiTags('Cuenta')
@Controller('auth')
export class ControladorAuth {
  constructor(private readonly auth: ServicioAuth) {}

  @Post('registro')
  @Publico()
  @ApiOperation({
    summary: 'Crear una cuenta de vecino',
    description:
      'Crea siempre un vecino, sin zona y con avisos activos. Las cuentas de operador se cargan con las semillas.',
  })
  @DocRespuestaUno(201, SesionDoc, 'La cuenta quedó creada y ya tiene sesión.')
  @DocErrores('VALIDACION_FALLIDA', 'EMAIL_YA_REGISTRADO')
  async registrar(@Body() dto: RegistroDto): Promise<RespuestaUno<Sesion>> {
    return respuestaUno(await this.auth.registrar(dto));
  }

  @Post('ingreso')
  @Publico()
  @HttpCode(200)
  @ApiOperation({ summary: 'Ingresar con email y contraseña' })
  @DocRespuestaUno(200, SesionDoc, 'Sesión iniciada.')
  @DocErrores('VALIDACION_FALLIDA', 'CREDENCIALES_INVALIDAS')
  async ingresar(@Body() dto: IngresoDto): Promise<RespuestaUno<Sesion>> {
    return respuestaUno(await this.auth.ingresar(dto));
  }
}
