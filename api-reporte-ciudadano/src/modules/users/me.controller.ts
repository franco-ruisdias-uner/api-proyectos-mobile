import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { RespuestaUno } from '../../../contract/api.js';
import type { Usuario as UsuarioContrato } from '../../../contract/types.js';
import { UsuarioActual } from '../../common/auth/decorators.js';
import { respuestaUno } from '../../common/response/response.js';
import {
  DocConSesion,
  DocErrores,
  DocRespuestaUno,
} from '../../common/swagger/documentation.js';
import { UsuarioDoc } from '../../common/swagger/models.js';
import { ActualizarYoDto } from './dto/update-me.dto.js';
import { Usuario } from './user.entity.js';
import { aUsuario } from './users.mapper.js';
import { ServicioUsuarios } from './users.service.js';

@ApiTags('Cuenta')
@Controller('yo')
@DocConSesion()
export class ControladorYo {
  constructor(private readonly usuarios: ServicioUsuarios) {}

  @Get()
  @ApiOperation({ summary: 'Mi cuenta' })
  @DocRespuestaUno(200, UsuarioDoc, 'El usuario de la sesión.')
  ver(@UsuarioActual() usuario: Usuario): RespuestaUno<UsuarioContrato> {
    return respuestaUno(aUsuario(usuario));
  }

  @Patch()
  @ApiOperation({
    summary: 'Cambiar mi nombre, teléfono o avisos',
    description:
      'Sólo cambia lo que mandes. El email y el rol no se pueden cambiar.',
  })
  @DocRespuestaUno(200, UsuarioDoc, 'El usuario actualizado.')
  @DocErrores('VALIDACION_FALLIDA')
  async actualizar(
    @UsuarioActual() usuario: Usuario,
    @Body() dto: ActualizarYoDto,
  ): Promise<RespuestaUno<UsuarioContrato>> {
    return respuestaUno(aUsuario(await this.usuarios.actualizar(usuario, dto)));
  }
}
