import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { RespuestaUno, Salud } from '../../../contrato/api.js';
import { AlmacenArchivos } from '../../comun/archivos/almacen-archivos.js';
import { Publico } from '../../comun/auth/decoradores.js';
import { respuestaUno } from '../../comun/respuesta/respuesta.js';
import { ENTORNO } from '../../config/entorno.modulo.js';
import type { Entorno } from '../../config/entorno.js';
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
        datos: { estado: 'ok', motor: 'better-sqlite3', almacen: 'local', version: '0.1.0' },
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
