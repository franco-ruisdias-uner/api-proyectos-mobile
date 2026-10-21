import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { RespuestaUno } from '../../../contract/api.js';
import type { Usuario } from '../../../contract/types.js';
import { Roles } from '../../common/auth/decorators.js';
import { respuestaUno } from '../../common/response/response.js';
import { UsuariosServicio } from './users.service.js';

@ApiTags('Ingreso y agenda')
@ApiBearerAuth()
@Controller('usuarios')
export class UsuariosControlador {
  constructor(private readonly usuarios: UsuariosServicio) {}

  @Get(':id')
  @Roles('encargado', 'administrador')
  @ApiOperation({
    summary: 'Un usuario, con su teléfono',
    description:
      'Encargado o administrador: sirve para avisarle a quien no vino.\n\n' +
      'Errores: NO_AUTENTICADO (401), SIN_PERMISO (403), USUARIO_NO_ENCONTRADO (404).',
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        datos: {
          id: 'usr-207',
          nombre: 'Emiliano Ruiz',
          email: 'emiliano@mail.com',
          telefono: '3455-401122',
          rol: 'jugador',
          espaciosFavoritos: ['esp-02'],
          cancelacionesTardias: 1,
          ausencias: 0,
        },
        meta: null,
      },
    },
  })
  async ver(@Param('id') id: string): Promise<RespuestaUno<Usuario>> {
    return respuestaUno(await this.usuarios.porId(id));
  }
}
