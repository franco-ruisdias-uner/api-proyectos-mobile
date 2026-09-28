import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { RespuestaUno, Sesion } from '../../../contrato/api.js';
import { Publico } from '../../comun/auth/decoradores.js';
import { respuestaUno } from '../../comun/respuesta/respuesta.js';
import { IngresoDto, RegistroDto } from './dto/registro.dto.js';
import { UsuariosServicio } from './usuarios.servicio.js';
import { EJEMPLO_SESION, ejemploError } from '../../comun/swagger/ejemplos.js';

@ApiTags('Cuenta')
@Controller('auth')
export class AuthControlador {
  constructor(private readonly usuarios: UsuariosServicio) {}

  @Publico()
  @Post('registro')
  @ApiOperation({
    summary: 'Crear una cuenta de turista',
    description: 'Público. Devuelve el token (vence a los 30 días) y el `Usuario`.',
  })
  @ApiResponse({
    status: 201,
    description: 'Cuenta creada.',
    schema: { example: { datos: EJEMPLO_SESION, meta: null } },
  })
  @ApiResponse({ status: 400, description: 'VALIDACION_FALLIDA', schema: ejemploError('VALIDACION_FALLIDA') })
  @ApiResponse({
    status: 409,
    description: 'EMAIL_YA_REGISTRADO',
    schema: ejemploError('EMAIL_YA_REGISTRADO'),
  })
  async registro(@Body() dto: RegistroDto): Promise<RespuestaUno<Sesion>> {
    return respuestaUno(await this.usuarios.registrar(dto));
  }

  @Publico()
  @Post('ingreso')
  @HttpCode(200)
  @ApiOperation({ summary: 'Ingresar con email y contraseña', description: 'Público.' })
  @ApiResponse({
    status: 200,
    description: 'Sesión iniciada.',
    schema: { example: { datos: EJEMPLO_SESION, meta: null } },
  })
  @ApiResponse({ status: 400, description: 'VALIDACION_FALLIDA', schema: ejemploError('VALIDACION_FALLIDA') })
  @ApiResponse({
    status: 401,
    description: 'CREDENCIALES_INVALIDAS',
    schema: ejemploError('CREDENCIALES_INVALIDAS'),
  })
  async ingreso(@Body() dto: IngresoDto): Promise<RespuestaUno<Sesion>> {
    return respuestaUno(await this.usuarios.ingresar(dto));
  }
}
