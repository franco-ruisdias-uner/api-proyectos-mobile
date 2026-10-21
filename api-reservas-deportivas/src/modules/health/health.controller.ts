import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { RespuestaUno, Salud } from '../../../contract/api.js';
import { Publico } from '../../common/auth/decorators.js';
import { AlmacenArchivos } from '../../common/files/file-storage.js';
import { respuestaUno } from '../../common/response/response.js';
import { Configuracion } from '../../config/environment.js';

/** Versión de package.json, buscándolo hacia arriba (sirve desde src/ y desde dist/). */
function leerVersion(): string {
  let carpeta = import.meta.dirname;
  for (let i = 0; i < 6; i++) {
    const ruta = join(carpeta, 'package.json');
    if (existsSync(ruta))
      return (JSON.parse(readFileSync(ruta, 'utf8')) as { version: string })
        .version;
    carpeta = dirname(carpeta);
  }
  return 'desconocida';
}

const VERSION = leerVersion();

@ApiTags('Salud')
@Controller('salud')
export class SaludControlador {
  constructor(
    private readonly config: Configuracion,
    private readonly almacen: AlmacenArchivos,
  ) {}

  @Get()
  @Publico()
  @ApiOperation({
    summary: '¿Anda la API?',
    description:
      'Público. Lo primero que conviene probar desde el teléfono: http://<IP de la compu>:3000/salud',
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        datos: {
          estado: 'ok',
          motor: 'better-sqlite3',
          almacen: 'local',
          version: '0.1.0',
        },
        meta: null,
      },
    },
  })
  salud(): RespuestaUno<Salud> {
    return respuestaUno({
      estado: 'ok',
      motor: this.config.db.motor,
      almacen: this.almacen.proveedor,
      version: VERSION,
    });
  }
}
