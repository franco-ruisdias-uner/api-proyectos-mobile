import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { RespuestaUno } from '../../../contract/api.js';
import type { Usuario } from '../../../contract/types.js';
import { UsuarioActual, type UsuarioAutenticado } from '../../common/auth/decorators.js';
import { respuestaUno } from '../../common/response/response.js';
import { EJEMPLO_USUARIO, ejemploError } from '../../common/swagger/examples.js';
import { ActualizarYoDto } from './dto/update-me.dto.js';
import { UsuariosServicio } from './users.service.js';

@ApiTags('Cuenta')
@ApiBearerAuth()
@Controller('yo')
export class YoControlador {
  constructor(private readonly usuarios: UsuariosServicio) {}

  @Get()
  @ApiOperation({ summary: 'Mi usuario', description: 'Con sesión.' })
  @ApiResponse({ status: 200, schema: { example: { datos: EJEMPLO_USUARIO, meta: null } } })
  @ApiResponse({ status: 401, description: 'NO_AUTENTICADO', schema: ejemploError('NO_AUTENTICADO') })
  async yo(@UsuarioActual() usuario: UsuarioAutenticado): Promise<RespuestaUno<Usuario>> {
    return respuestaUno(await this.usuarios.yo(usuario.id));
  }

  @Patch()
  @ApiOperation({
    summary: 'Cambiar mi nombre, mi foto o mis preferencias',
    description:
      'Con sesión. Todo es opcional; `preferencias` se mezcla campo a campo. `radioAvisoMetros` es 100, 250 o 500. ' +
      '`avatarUrl` tiene que ser una URL devuelta por `POST /archivos` (o `null` para sacarla).',
  })
  @ApiResponse({ status: 200, schema: { example: { datos: EJEMPLO_USUARIO, meta: null } } })
  @ApiResponse({ status: 400, description: 'VALIDACION_FALLIDA', schema: ejemploError('VALIDACION_FALLIDA') })
  @ApiResponse({ status: 401, description: 'NO_AUTENTICADO', schema: ejemploError('NO_AUTENTICADO') })
  @ApiResponse({
    status: 422,
    description: 'CATEGORIA_NO_ENCONTRADA o ARCHIVO_NO_SUBIDO',
    schema: ejemploError('CATEGORIA_NO_ENCONTRADA'),
  })
  async actualizar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: ActualizarYoDto,
  ): Promise<RespuestaUno<Usuario>> {
    return respuestaUno(await this.usuarios.actualizar(usuario.id, dto));
  }
}
