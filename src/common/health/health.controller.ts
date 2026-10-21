import { Controller, Get, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import type { RespuestaUno, Salud } from '../../../contract/api.js';
import type { AppConfigService } from '../../config/configuration.js';
import { AlmacenArchivos } from '../files/file-storage.js';
import { Publico } from '../auth/decorators.js';
import { Doc } from '../response/documentation.js';
import { respuestaUno } from '../response/response.js';
import { apiVersion } from './version.js';

@ApiTags('Salud')
@Controller('salud')
export class HealthControlador {
  private readonly version = apiVersion();

  constructor(
    @Inject(ConfigService) private readonly config: AppConfigService,
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
      motor: this.config.get('database.engine', { infer: true }),
      almacen: this.almacen.proveedor,
      version: this.version,
    });
  }
}
