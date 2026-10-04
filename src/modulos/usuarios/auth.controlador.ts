import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { RespuestaUno, Sesion } from '../../../contrato/api.js';
import { Publico } from '../../comun/auth/decoradores.js';
import { respuestaUno } from '../../comun/respuesta/respuesta.js';
import { IngresoDto } from './dto/ingreso.dto.js';
import { RegistroDto } from './dto/registro.dto.js';
import { UsuariosServicio } from './usuarios.servicio.js';

const EJEMPLO_USUARIO = {
  id: 'usr-207',
  nombre: 'Emiliano Ruiz',
  email: 'emiliano@mail.com',
  telefono: '3455-401122',
  rol: 'jugador',
  espaciosFavoritos: ['esp-02'],
  cancelacionesTardias: 1,
  ausencias: 0,
};

@ApiTags('Cuenta')
@Controller('auth')
export class AuthControlador {
  constructor(private readonly usuarios: UsuariosServicio) {}

  @Post('registro')
  @Publico()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Crear una cuenta de jugador',
    description:
      'Público. Siempre crea el rol `jugador`. El teléfono es obligatorio. Devuelve el token (vale 30 días) y el usuario.\n\n' +
      'Errores: VALIDACION_FALLIDA (400), EMAIL_YA_REGISTRADO (409).',
  })
  @ApiResponse({
    status: 201,
    schema: {
      example: {
        datos: { token: 'eyJhbGciOi…', usuario: EJEMPLO_USUARIO },
        meta: null,
      },
    },
  })
  async registro(@Body() dto: RegistroDto): Promise<RespuestaUno<Sesion>> {
    return respuestaUno(await this.usuarios.registrar(dto));
  }

  @Post('ingreso')
  @Publico()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Ingresar con email y contraseña',
    description:
      'Público. Devuelve el token (vale 30 días) y el usuario.\n\nErrores: VALIDACION_FALLIDA (400), CREDENCIALES_INVALIDAS (401).',
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        datos: { token: 'eyJhbGciOi…', usuario: EJEMPLO_USUARIO },
        meta: null,
      },
    },
  })
  async ingreso(@Body() dto: IngresoDto): Promise<RespuestaUno<Sesion>> {
    return respuestaUno(await this.usuarios.ingresar(dto));
  }
}
