import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { RespuestaLista, RespuestaUno } from '../../../contract/api.js';
import type { Usuario } from '../../../contract/types.js';
import { Roles } from '../../common/auth/decorators.js';
import { IdPipe } from '../../common/ids/id.pipe.js';
import { Doc } from '../../common/response/documentation.js';
import {
  respuestaLista,
  respuestaUno,
} from '../../common/response/response.js';
import {
  ActualizarUsuarioDto,
  CrearUsuarioDto,
  ListarUsuariosDto,
} from './dto/users.dto.js';
import { EJEMPLO_USUARIO } from './examples.js';
import { UsuariosServicio } from './users.service.js';

@ApiTags('Usuarios')
@Controller('usuarios')
@Roles('administracion')
export class UsuariosControlador {
  constructor(private readonly usuarios: UsuariosServicio) {}

  @Get()
  @Doc({
    resumen: 'Lista los usuarios',
    descripcion:
      'Filtros: `rol` y `buscar` (parte del legajo o del nombre, sin importar mayúsculas ni tildes). Orden por legajo.',
    roles: ['administracion'],
    ejemplo: EJEMPLO_USUARIO,
    lista: true,
    errores: ['VALIDACION_FALLIDA'],
  })
  async listar(
    @Query() filtros: ListarUsuariosDto,
  ): Promise<RespuestaLista<Usuario>> {
    const { datos, meta } = await this.usuarios.listar(filtros);
    return respuestaLista(datos, meta);
  }

  @Post()
  @Doc({
    resumen: 'Da de alta un usuario',
    descripcion:
      'No hay registro público: las cuentas las crea la administración.',
    roles: ['administracion'],
    estado: 201,
    ejemplo: {
      ...EJEMPLO_USUARIO,
      id: 'usr-4k2j9x0a1b2c',
      legajo: 'L-031',
      nombre: 'Julia Ríos',
      biometriaActiva: false,
      rutasAsignadas: [],
    },
    errores: ['VALIDACION_FALLIDA', 'LEGAJO_YA_REGISTRADO'],
  })
  async crear(@Body() dto: CrearUsuarioDto): Promise<RespuestaUno<Usuario>> {
    const usuario = await this.usuarios.crear(dto);
    return respuestaUno(await this.usuarios.contratoDe(usuario));
  }

  @Patch(':id')
  @Doc({
    resumen: 'Cambia el nombre o blanquea la contraseña de un usuario',
    descripcion:
      'Blanquear la contraseña cierra todas las sesiones de ese usuario.',
    roles: ['administracion'],
    ejemplo: EJEMPLO_USUARIO,
    errores: ['VALIDACION_FALLIDA', 'USUARIO_NO_ENCONTRADO'],
  })
  async actualizar(
    @Param('id', new IdPipe('usr')) id: string,
    @Body() dto: ActualizarUsuarioDto,
  ): Promise<RespuestaUno<Usuario>> {
    const usuario = await this.usuarios.actualizar(id, dto);
    return respuestaUno(await this.usuarios.contratoDe(usuario));
  }
}
