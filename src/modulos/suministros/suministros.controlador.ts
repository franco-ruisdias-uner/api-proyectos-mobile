import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { RespuestaLista, RespuestaUno } from '../../../contrato/api.js';
import type { Suministro } from '../../../contrato/tipos.js';
import { Roles, Sesion } from '../../comun/auth/decoradores.js';
import type { SesionActual } from '../../comun/auth/sesion-actual.js';
import { IdPipe } from '../../comun/ids/id.pipe.js';
import { Doc } from '../../comun/respuesta/documentacion.js';
import {
  respuestaLista,
  respuestaUno,
} from '../../comun/respuesta/respuesta.js';
import { ListarSuministrosDto } from './dto/suministros.dto.js';
import { EJEMPLO_SUMINISTRO } from './ejemplos.js';
import { SuministrosServicio } from './suministros.servicio.js';

@ApiTags('Suministros')
@Controller('suministros')
export class SuministrosControlador {
  constructor(private readonly suministros: SuministrosServicio) {}

  @Get()
  @Roles('administracion')
  @Doc({
    resumen: 'Lista los suministros',
    descripcion:
      'Filtros: `numero` (exacto, con ceros), `buscar` (parte del titular o de la dirección, sin importar ' +
      'mayúsculas ni tildes), `categoria` y `activo`. Orden por `numero`. Los lectores usan la descarga de su ruta.',
    roles: ['administracion'],
    ejemplo: EJEMPLO_SUMINISTRO,
    lista: true,
    errores: ['VALIDACION_FALLIDA'],
  })
  async listar(
    @Query() filtros: ListarSuministrosDto,
  ): Promise<RespuestaLista<Suministro>> {
    const { datos, meta } = await this.suministros.listar(filtros);
    return respuestaLista(datos, meta);
  }

  @Get(':id')
  @Doc({
    resumen: 'Un suministro',
    descripcion:
      'Un lector sólo puede ver los suministros que están en una de sus rutas; administración, todos.',
    roles: [],
    ejemplo: EJEMPLO_SUMINISTRO,
    errores: ['VALIDACION_FALLIDA', 'SIN_PERMISO', 'SUMINISTRO_NO_ENCONTRADO'],
  })
  async obtener(
    @Param('id', new IdPipe('sum')) id: string,
    @Sesion() sesion: SesionActual,
  ): Promise<RespuestaUno<Suministro>> {
    return respuestaUno(await this.suministros.obtener(id, sesion));
  }
}
