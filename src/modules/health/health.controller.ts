import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { RespuestaUno, Salud } from '../../../contract/api.js';
import { ALMACEN_ARCHIVOS, type AlmacenArchivos } from '../../common/files/file-storage.js';
import { Publico } from '../../common/auth/decorators.js';
import { respuestaUno } from '../../common/response/response.js';
import { ENTORNO, type Entorno } from '../../config/environment.js';
import { versionDeLaApi } from '../../config/version.js';

@ApiTags('Salud')
@Controller('salud')
export class SaludControlador {
  private readonly version = versionDeLaApi();

  constructor(
    @Inject(ENTORNO) private readonly entorno: Entorno,
    @Inject(ALMACEN_ARCHIVOS) private readonly almacen: AlmacenArchivos,
  ) {}

  @Get()
  @Publico()
  @ApiOperation({
    summary: '¿Anda la API?',
    description:
      'Público. Lo primero que conviene probar desde el teléfono: http://<IP de la compu>:3000/salud. ' +
      '`almacen` dice dónde se guardan los archivos: local, aws, supabase, r2, b2, s3proxy o localstack.',
  })
  @ApiResponse({
    status: 200,
    example: {
      datos: { estado: 'ok', motor: 'better-sqlite3', almacen: 'local', version: '0.1.0' },
      meta: null,
    },
  })
  ver(): RespuestaUno<Salud> {
    return respuestaUno({
      estado: 'ok',
      motor: this.entorno.dbMotor,
      almacen: this.almacen.proveedor,
      version: this.version,
    });
  }
}
