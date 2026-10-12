import { Controller, Get, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import type { RespuestaUno, Salud } from '../../../contrato/api.js';
import { type Configuracion, valor } from '../../config/configuracion.js';
import { AlmacenArchivos } from '../archivos/almacen-archivos.js';
import { Publico } from '../auth/decoradores.js';
import { Doc } from '../respuesta/documentacion.js';
import { respuestaUno } from '../respuesta/respuesta.js';
import { versionDeLaApi } from './version.js';

@ApiTags('Salud')
@Controller('salud')
export class SaludControlador {
  private readonly version = versionDeLaApi();

  constructor(
    @Inject(ConfigService) private readonly config: Configuracion,
    private readonly almacen: AlmacenArchivos,
  ) {}

  @Get()
  @Publico()
  @Doc({
    resumen: '¿Anda la API?',
    descripcion: 'Lo primero que conviene probar desde el teléfono.',
    roles: null,
    ejemplo: {
      estado: 'ok',
      motor: 'better-sqlite3',
      almacen: 'local',
      version: '0.1.0',
    },
  })
  salud(): RespuestaUno<Salud> {
    return respuestaUno({
      estado: 'ok',
      motor: valor(this.config, 'DB_MOTOR'),
      almacen: this.almacen.proveedor,
      version: this.version,
    });
  }
}
