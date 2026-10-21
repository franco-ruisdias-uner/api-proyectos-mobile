import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { RespuestaUno, Salud } from '../../../contract/api.js';
import { ArchivosServicio } from '../../common/files/files.service.js';
import { Publico } from '../../common/auth/decorators.js';
import { Ejemplo } from '../../common/documentation/swagger.js';
import { respuestaUno } from '../../common/response/response.js';
import { CONFIGURACION, type Configuracion } from '../../config/environment.js';
import { VERSION } from './version.js';

@ApiTags('Salud')
@Controller('salud')
export class SaludControlador {
  constructor(
    @Inject(CONFIGURACION) private readonly config: Configuracion,
    private readonly archivos: ArchivosServicio,
  ) {}

  @Get()
  @Publico()
  @ApiOperation({
    summary: '¿Anda la API?',
    description:
      'Público. Lo primero que conviene probar desde el teléfono: si esto responde, el teléfono ' +
      'llega a la computadora. Dice qué base de datos y qué almacenamiento de archivos se usan.',
  })
  @Ejemplo(200, 'La API anda', {
    datos: { estado: 'ok', motor: 'better-sqlite3', almacen: 'local', version: VERSION },
    meta: null,
  })
  salud(): RespuestaUno<Salud> {
    return respuestaUno({
      estado: 'ok',
      motor: this.config.db.motor,
      almacen: this.archivos.proveedor,
      version: VERSION,
    });
  }
}
