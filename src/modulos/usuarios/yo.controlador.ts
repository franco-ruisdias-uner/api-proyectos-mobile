import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { RespuestaUno } from '../../../contrato/api.js';
import type { Usuario as UsuarioContrato } from '../../../contrato/tipos.js';
import { UsuarioActual } from '../../comun/auth/decoradores.js';
import { respuestaUno } from '../../comun/respuesta/respuesta.js';
import {
  DocConSesion,
  DocErrores,
  DocRespuestaUno,
} from '../../comun/swagger/documentacion.js';
import { UsuarioDoc } from '../../comun/swagger/modelos.js';
import { ActualizarYoDto } from './dto/actualizar-yo.dto.js';
import { Usuario } from './usuario.entidad.js';
import { aUsuario } from './usuarios.mapeador.js';
import { ServicioUsuarios } from './usuarios.servicio.js';

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
