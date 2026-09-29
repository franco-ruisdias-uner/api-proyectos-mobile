import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { RespuestaUno, Sesion } from '../../../contrato/api.js';
import { Publico } from '../../comun/auth/decoradores.js';
import { respuestaUno } from '../../comun/respuesta/respuesta.js';
import {
  DocErrores,
  DocRespuestaUno,
} from '../../comun/swagger/documentacion.js';
import { SesionDoc } from '../../comun/swagger/modelos.js';
import { ServicioAuth } from './auth.servicio.js';
import { IngresoDto } from './dto/ingreso.dto.js';
import { RegistroDto } from './dto/registro.dto.js';

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
