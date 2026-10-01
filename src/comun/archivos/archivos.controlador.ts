import { createHash } from 'node:crypto';
import {
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { ArchivoSubido, RespuestaUno } from '../../../contrato/api.js';
import { Publico } from '../auth/decoradores.js';
import { Ejemplo, ErroresPosibles } from '../documentacion/swagger.js';
import { ErrorDeApi } from '../errores/error-de-api.js';
import { respuestaUno } from '../respuesta/respuesta.js';
import { ArchivosServicio } from './archivos.servicio.js';
import { LIMITE_MAXIMO_DE_BYTES } from './firma.js';
import { interpretarRango } from './rango.js';

@ApiTags('Archivos')
@Controller('archivos')
export class ArchivosControlador {
  constructor(private readonly archivos: ArchivosServicio) {}

  @Post()
  @HttpCode(201)
  @ApiBearerAuth()
  @UseInterceptors(
    FileInterceptor('archivo', { limits: { fileSize: LIMITE_MAXIMO_DE_BYTES, files: 1 } }),
  )
  @ApiOperation({
    summary: 'Subir una foto, un audio o un video',
    description:
      'Con sesión. `multipart/form-data` con el campo `archivo`. Imagen jpeg/png/webp hasta 5 MB; ' +
      'audio m4a/aac/mp3 hasta 10 MB; video mp4 hasta 30 MB. Se mira el contenido, no la extensión. ' +
      'Devuelve la URL que después se manda en el recurso (por ejemplo, la foto de un reporte).',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['archivo'],
      properties: { archivo: { type: 'string', format: 'binary' } },
    },
  })
  @Ejemplo(201, 'Archivo guardado', {
    datos: {
      url: 'http://192.168.0.10:3000/archivos/imagenes/2026/09/k3j9x0q2m5n8p1r4t7v0w3y6.jpg',
      tipo: 'imagen',
      bytes: 482113,
    },
    meta: null,
  })
  @ErroresPosibles(
    'VALIDACION_FALLIDA',
    'NO_AUTENTICADO',
    'ARCHIVO_DEMASIADO_GRANDE',
    'TIPO_DE_ARCHIVO_NO_PERMITIDO',
    'ALMACEN_NO_DISPONIBLE',
  )
  async subir(
    @UploadedFile() archivo: Express.Multer.File | undefined,
  ): Promise<RespuestaUno<ArchivoSubido>> {
    if (!archivo) {
      throw new ErrorDeApi(
        'VALIDACION_FALLIDA',
        'Falta el archivo: mandalo en el campo «archivo».',
      );
    }
    return respuestaUno(await this.archivos.subir(archivo.buffer));
  }

  @Get('*clave')
  @Publico()
  @ApiOperation({
    summary: 'Descargar un archivo',
    description:
      'Público. Admite la cabecera `Range` (responde 206), que es lo que usan `expo-audio` y ' +
      '`expo-video` para adelantar y reproducir mientras descargan. Con `ARCHIVOS_REDIRIGIR=true` y un ' +
      'proveedor en la nube, responde 302 a una URL firmada de 15 minutos.',
  })
  @ErroresPosibles('ARCHIVO_NO_ENCONTRADO', 'RANGO_NO_VALIDO', 'ALMACEN_NO_DISPONIBLE')
  async descargar(
    @Param('clave') partes: string[] | string,
    @Headers('range') cabeceraRango: string | undefined,
    @Res() respuesta: Response,
  ): Promise<void> {
    const clave = Array.isArray(partes) ? partes.join('/') : partes;
    const total = await this.archivos.tamanio(clave);
    const firmada = await this.archivos.urlFirmada(clave);
    if (firmada) {
      respuesta.redirect(302, firmada);
      return;
    }
    const rango = interpretarRango(cabeceraRango, total);
    if (rango === 'invalido') {
      respuesta.setHeader('Content-Range', `bytes */${total}`);
      throw new ErrorDeApi('RANGO_NO_VALIDO');
    }
    const lectura = await this.archivos.leer(clave, rango ?? undefined);
    const etiqueta = createHash('sha1').update(clave).digest('hex').slice(0, 20);

    respuesta.setHeader('Accept-Ranges', 'bytes');
    respuesta.setHeader('Content-Type', lectura.tipoMime);
    respuesta.setHeader('ETag', `"${etiqueta}-${lectura.bytesTotales}"`);
    respuesta.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    if (rango) {
      respuesta.status(206);
      respuesta.setHeader(
        'Content-Range',
        `bytes ${rango.inicio}-${rango.fin}/${lectura.bytesTotales}`,
      );
      respuesta.setHeader('Content-Length', String(rango.fin - rango.inicio + 1));
    } else {
      respuesta.status(200);
      respuesta.setHeader('Content-Length', String(lectura.bytesTotales));
    }
    lectura.flujo.on('error', () => respuesta.destroy());
    lectura.flujo.pipe(respuesta);
  }
}
