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
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { ArchivoSubido, RespuestaUno } from '../../../contrato/api.js';
import { Publico } from '../auth/decoradores.js';
import { ErrorApi } from '../errores/error-api.js';
import { respuestaUno } from '../respuesta/respuesta.js';
import { ArchivosServicio } from './archivos.servicio.js';
import { esClaveValida } from './claves.js';
import { leerRango } from './rango.js';
import { LIMITE_MAXIMO_BYTES } from './tipos-de-archivo.js';

@ApiTags('Archivos')
@Controller('archivos')
export class ArchivosControlador {
  constructor(private readonly archivos: ArchivosServicio) {}

  @Post()
  @HttpCode(201)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Subir una foto, un audio o un video',
    description:
      'Con sesión. multipart/form-data con el campo `archivo`. Imagen jpeg/png/webp hasta 5 MB; ' +
      'audio m4a/aac/mp3 hasta 10 MB; video mp4 hasta 30 MB. Devuelve la URL para usar en el recurso.\n\n' +
      'Errores: VALIDACION_FALLIDA (400), NO_AUTENTICADO (401), ARCHIVO_DEMASIADO_GRANDE (413), ' +
      'TIPO_DE_ARCHIVO_NO_PERMITIDO (415), ALMACEN_NO_DISPONIBLE (503).',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { archivo: { type: 'string', format: 'binary' } },
    },
  })
  @ApiResponse({
    status: 201,
    schema: {
      example: {
        datos: {
          url: 'http://192.168.0.10:3000/archivos/imagenes/2026/09/k3x9qm2abc4def5ghi6j.jpg',
          tipo: 'imagen',
          bytes: 48211,
        },
        meta: null,
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('archivo', {
      limits: { fileSize: LIMITE_MAXIMO_BYTES, files: 1 },
    }),
  )
  async subir(
    @UploadedFile() archivo: Express.Multer.File | undefined,
  ): Promise<RespuestaUno<ArchivoSubido>> {
    if (!archivo)
      throw new ErrorApi(
        'VALIDACION_FALLIDA',
        'Falta el archivo: mandalo en el campo «archivo».',
      );
    return respuestaUno(await this.archivos.subir(archivo.buffer));
  }

  @Get('*clave')
  @Publico()
  @ApiOperation({
    summary: 'Bajar un archivo',
    description:
      'Público. Admite la cabecera Range (responde 206) para adelantar audio y video.\n\n' +
      'Errores: ARCHIVO_NO_ENCONTRADO (404), RANGO_NO_VALIDO (416), ALMACEN_NO_DISPONIBLE (503).',
  })
  async bajar(
    @Param('clave') partes: string | string[],
    @Headers('range') cabeceraRango: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const clave = Array.isArray(partes) ? partes.join('/') : partes;
    if (!esClaveValida(clave)) throw new ErrorApi('ARCHIVO_NO_ENCONTRADO');

    const total = await this.archivos.tamano(clave);
    const rango = leerRango(cabeceraRango, total);
    if (rango === 'insatisfacible') {
      res.setHeader('Content-Range', `bytes */${total}`);
      throw new ErrorApi('RANGO_NO_VALIDO');
    }
    const lectura = await this.archivos.leer(clave, rango ?? undefined);

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', lectura.tipoMime);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader(
      'ETag',
      `"${createHash('sha1').update(`${clave}:${total}`).digest('hex')}"`,
    );
    if (rango) {
      res.status(206);
      res.setHeader(
        'Content-Range',
        `bytes ${rango.inicio}-${rango.fin}/${total}`,
      );
      res.setHeader('Content-Length', String(rango.fin - rango.inicio + 1));
    } else {
      res.status(200);
      res.setHeader('Content-Length', String(total));
    }
    lectura.flujo.on('error', () => res.destroy());
    lectura.flujo.pipe(res);
  }
}
