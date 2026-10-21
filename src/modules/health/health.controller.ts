import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { RespuestaUno, Salud } from '../../../contract/api.js';
import { AlmacenArchivos } from '../../common/files/file-storage.js';
import { Publico } from '../../common/auth/decorators.js';
import { respuestaUno } from '../../common/response/response.js';
import { ENTORNO } from '../../config/environment.module.js';
import type { Entorno } from '../../config/environment.js';
import { VERSION } from '../../config/version.js';

@ApiTags('Salud')
@Controller('salud')
export class SaludControlador {
  constructor(
    @Inject(ENTORNO) private readonly entorno: Entorno,
    private readonly almacen: AlmacenArchivos,
  ) {}

  @Publico()
  @Get()
  @ApiOperation({
    summary: '¿Anda la API?',
    description:
      'Público. Lo primero que conviene probar desde el teléfono: `http://<IP de la compu>:3000/salud`.',
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        datos: { estado: 'ok', motor: 'better-sqlite3', almacen: 'local', version: '0.2.0' },
        meta: null,
      },
    },
  })
  salud(): RespuestaUno<Salud> {
    return respuestaUno({
      estado: 'ok',
      motor: this.entorno.DB_MOTOR,
      almacen: this.almacen.proveedor,
      version: VERSION,
    });
  }
}
