import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { RespuestaUno, Sesion } from '../../../contract/api.js';
import { Publico } from '../../common/auth/decorators.js';
import { Ejemplo, ErroresPosibles } from '../../common/documentation/swagger.js';
import { respuestaUno } from '../../common/response/response.js';
import { IngresoDto } from './dto/login.dto.js';
import { RegistroDto } from './dto/register.dto.js';
import { SESION_DE_EJEMPLO } from './examples.js';
import { UsuariosServicio } from './users.service.js';

@ApiTags('Cuenta')
@Controller('auth')
export class AuthControlador {
  constructor(private readonly usuarios: UsuariosServicio) {}

  @Post('registro')
  @Publico()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Crear una cuenta de pasajero',
    description:
      'Público. Crea siempre una cuenta de pasajero, sin favoritos, con los avisos activos y el ' +
      'tema "sistema". Devuelve el token (dura 30 días) y el usuario.',
  })
  @Ejemplo(201, 'Cuenta creada', {
    datos: {
      ...SESION_DE_EJEMPLO,
      usuario: { ...SESION_DE_EJEMPLO.usuario, lineasFavoritas: [], paradasFavoritas: [] },
    },
    meta: null,
  })
  @ErroresPosibles('VALIDACION_FALLIDA', 'EMAIL_YA_REGISTRADO')
  async registrar(@Body() dto: RegistroDto): Promise<RespuestaUno<Sesion>> {
    return respuestaUno(await this.usuarios.registrar(dto));
  }

  @Post('ingreso')
  @Publico()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Ingresar con email y contraseña',
    description: 'Público. Devuelve el token (dura 30 días) y el usuario.',
  })
  @Ejemplo(200, 'Sesión iniciada', { datos: SESION_DE_EJEMPLO, meta: null })
  @ErroresPosibles('VALIDACION_FALLIDA', 'CREDENCIALES_INVALIDAS')
  async ingresar(@Body() dto: IngresoDto): Promise<RespuestaUno<Sesion>> {
    return respuestaUno(await this.usuarios.ingresar(dto));
  }
}
