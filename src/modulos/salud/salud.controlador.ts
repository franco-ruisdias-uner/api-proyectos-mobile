import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { RespuestaUno, Salud } from '../../../contrato/api.js';
import { AlmacenArchivos } from '../../comun/archivos/almacen-archivos.js';
import { Publico } from '../../comun/auth/decoradores.js';
import { respuestaUno } from '../../comun/respuesta/respuesta.js';
import { DocRespuestaUno } from '../../comun/swagger/documentacion.js';
import { SaludDoc } from '../../comun/swagger/modelos.js';
import { ENTORNO } from '../../config/entorno.modulo.js';
import type { Entorno } from '../../config/entorno.js';

/** Versión de package.json (sube desde src/ o dist/src/ hasta encontrarlo). */
function leerVersion(): string {
  let dir = import.meta.dirname;
  for (let i = 0; i < 6; i++) {
    const ruta = join(dir, 'package.json');
    if (existsSync(ruta))
      return (JSON.parse(readFileSync(ruta, 'utf8')) as { version: string })
        .version;
    dir = dirname(dir);
  }
  return '0.0.0';
}

const VERSION = leerVersion();

@ApiTags('Salud')
@Controller('salud')
export class ControladorSalud {
  constructor(
    @Inject(ENTORNO) private readonly entorno: Entorno,
    private readonly almacen: AlmacenArchivos,
  ) {}

  @Get()
  @Publico()
  @ApiOperation({
    summary: '¿La API está andando?',
    description:
      'Lo primero que conviene probar desde el teléfono: abrí http://<IP de la compu>:3000/salud.',
  })
  @DocRespuestaUno(200, SaludDoc, 'La API está andando.')
  ver(): RespuestaUno<Salud> {
    return respuestaUno({
      estado: 'ok',
      motor: this.entorno.DB_MOTOR,
      almacen: this.almacen.proveedor,
      version: VERSION,
    });
  }
}
