import {
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { createHash } from 'node:crypto';
import type { Response } from 'express';
import type { ArchivoSubido, RespuestaUno } from '../../../contract/api.js';
import {
  AlmacenArchivos,
  AlmacenNoDisponible,
  ArchivoNoEncontrado,
} from '../../common/files/file-storage.js';
import { esClaveValida, nuevaClave } from '../../common/files/keys.js';
import { detectarTipoArchivo, LIMITE_MAXIMO_BYTES, LIMITES_BYTES } from '../../common/files/signatures.js';
import { leerRango } from '../../common/files/range.js';
import { urlDeArchivo } from '../../common/files/urls.js';
import { Publico } from '../../common/auth/decorators.js';
import { ErrorApi } from '../../common/errors/error-api.js';
import { respuestaUno } from '../../common/response/response.js';
import { Reloj } from '../../common/clock/clock.js';
import { ejemploError } from '../../common/swagger/examples.js';
import { ENTORNO } from '../../config/environment.module.js';
import type { Entorno } from '../../config/environment.js';

@ApiTags('Archivos')
@Controller('archivos')
export class ArchivosControlador {
  constructor(
    private readonly almacen: AlmacenArchivos,
    private readonly reloj: Reloj,
    @Inject(ENTORNO) private readonly entorno: Entorno,
  ) {}

  @Post()
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: LIMITE_MAXIMO_BYTES, files: 1 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { archivo: { type: 'string', format: 'binary' } } } })
  @ApiOperation({
    summary: 'Subir una foto, un audio o un video',
    description:
      'Con sesión. `multipart/form-data` con el campo `archivo`. Imagen jpeg/png/webp hasta 5 MB; ' +
      'audio m4a/aac/mp3 hasta 10 MB; video mp4 hasta 30 MB. Devuelve la URL para mandar después en el recurso.',
  })
  @ApiResponse({
    status: 201,
    schema: {
      example: {
        datos: {
          url: 'http://192.168.0.10:3000/archivos/imagenes/2026/09/abc123def456.jpg',
          tipo: 'imagen',
          bytes: 184512,
        },
        meta: null,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'VALIDACION_FALLIDA (falta el archivo)',
    schema: ejemploError('VALIDACION_FALLIDA'),
  })
  @ApiResponse({ status: 401, description: 'NO_AUTENTICADO', schema: ejemploError('NO_AUTENTICADO') })
  @ApiResponse({
    status: 413,
    description: 'ARCHIVO_DEMASIADO_GRANDE',
    schema: ejemploError('ARCHIVO_DEMASIADO_GRANDE'),
  })
  @ApiResponse({
    status: 415,
    description: 'TIPO_DE_ARCHIVO_NO_PERMITIDO',
    schema: ejemploError('TIPO_DE_ARCHIVO_NO_PERMITIDO'),
  })
  @ApiResponse({
    status: 503,
    description: 'ALMACEN_NO_DISPONIBLE',
    schema: ejemploError('ALMACEN_NO_DISPONIBLE'),
  })
  async subir(
    @UploadedFile() archivo: Express.Multer.File | undefined,
  ): Promise<RespuestaUno<ArchivoSubido>> {
    if (!archivo) {
      throw new ErrorApi('VALIDACION_FALLIDA', 'Falta el archivo: mandalo en el campo «archivo».');
    }
    const detectado = detectarTipoArchivo(archivo.buffer);
    if (!detectado) throw new ErrorApi('TIPO_DE_ARCHIVO_NO_PERMITIDO');
    if (archivo.size > LIMITES_BYTES[detectado.tipo]) {
      const mb = LIMITES_BYTES[detectado.tipo] / 1024 / 1024;
      throw new ErrorApi(
        'ARCHIVO_DEMASIADO_GRANDE',
        `El archivo es demasiado grande: puede pesar hasta ${mb} MB.`,
      );
    }
    const clave = nuevaClave(detectado, this.reloj.ahora());
    try {
      await this.almacen.guardar(clave, archivo.buffer, detectado.mime);
    } catch (error) {
      throw new ErrorApi('ALMACEN_NO_DISPONIBLE', undefined, error);
    }
    return respuestaUno({ url: urlDeArchivo(clave), tipo: detectado.tipo, bytes: archivo.size });
  }

  @Publico()
  @Get('*clave')
  @ApiOperation({
    summary: 'Bajar un archivo',
    description:
      'Público. Soporta `Range` (responde 206), para adelantar audios y videos y reproducir mientras bajan.',
  })
  @ApiResponse({ status: 200, description: 'El archivo entero.' })
  @ApiResponse({ status: 206, description: 'La parte pedida con `Range`.' })
  @ApiResponse({
    status: 302,
    description:
      'Con `ARCHIVOS_REDIRIGIR=true` (sólo servicios en la nube): a una URL firmada de 15 minutos.',
  })
  @ApiResponse({
    status: 404,
    description: 'ARCHIVO_NO_ENCONTRADO',
    schema: ejemploError('ARCHIVO_NO_ENCONTRADO'),
  })
  @ApiResponse({
    status: 416,
    description: 'RANGO_NO_SATISFACIBLE',
    schema: ejemploError('RANGO_NO_SATISFACIBLE'),
  })
  async bajar(
    @Param('clave') partes: string[] | string,
    @Headers('range') cabeceraRango: string | undefined,
    @Headers('if-none-match') siNoCoincide: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const clave = Array.isArray(partes) ? partes.join('/') : partes;
    if (!esClaveValida(clave)) throw new ErrorApi('ARCHIVO_NO_ENCONTRADO');
    try {
      const { bytesTotales, tipoMime } = await this.almacen.describir(clave);
      if (this.entorno.ALMACEN_S3?.redirigir) {
        // Una URL firmada de 15 minutos: no se cachea, porque vence.
        const firmada = await this.almacen.urlFirmada(clave);
        if (firmada) {
          res.setHeader('Cache-Control', 'no-store');
          res.redirect(302, firmada);
          return;
        }
      }
      const etiqueta = `"${createHash('sha1').update(`${clave}:${bytesTotales}`).digest('hex')}"`;
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('ETag', etiqueta);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      if (siNoCoincide === etiqueta) {
        res.status(304).end();
        return;
      }
      const rango = leerRango(cabeceraRango, bytesTotales);
      if (rango === 'insatisfacible') {
        res.setHeader('Content-Range', `bytes */${bytesTotales}`);
        throw new ErrorApi('RANGO_NO_SATISFACIBLE');
      }
      const lectura = await this.almacen.leer(clave, rango);
      res.setHeader('Content-Type', tipoMime);
      if (rango) {
        res.status(206);
        res.setHeader('Content-Range', `bytes ${rango.inicio}-${rango.fin}/${bytesTotales}`);
        res.setHeader('Content-Length', String(rango.fin - rango.inicio + 1));
      } else {
        res.status(200);
        res.setHeader('Content-Length', String(bytesTotales));
      }
      lectura.flujo.on('error', () => res.destroy());
      lectura.flujo.pipe(res);
    } catch (error) {
      if (error instanceof ErrorApi) throw error;
      if (error instanceof ArchivoNoEncontrado) throw new ErrorApi('ARCHIVO_NO_ENCONTRADO');
      if (error instanceof AlmacenNoDisponible) throw new ErrorApi('ALMACEN_NO_DISPONIBLE', undefined, error);
      throw error;
    }
  }
}
