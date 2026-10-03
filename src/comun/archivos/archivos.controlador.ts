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
import { MAX_BYTES_SUBIDA } from './reglas/tipos-archivo.js';
import { DocErrores } from '../../swagger/doc-errores.js';

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
      'Con sesión. `multipart/form-data` con el campo `archivo`. Imagen JPG/PNG/WEBP hasta 5 MB; ' +
      'audio M4A/AAC/MP3 hasta 10 MB; video MP4 hasta 30 MB. Se reconoce el tipo por el contenido, ' +
      'no por el nombre. Devuelve la URL para mandar después en el recurso.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['archivo'],
      properties: { archivo: { type: 'string', format: 'binary' } },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Archivo guardado',
    example: {
      datos: {
        url: 'http://192.168.0.10:3000/archivos/imagenes/2026/10/k3j9x0m2a7qzp1b4.jpg',
        tipo: 'imagen',
        bytes: 245112,
      },
      meta: null,
    },
  })
  @DocErrores(
    'VALIDACION_FALLIDA',
    'NO_AUTENTICADO',
    'ARCHIVO_DEMASIADO_GRANDE',
    'TIPO_DE_ARCHIVO_NO_PERMITIDO',
    'ALMACEN_NO_DISPONIBLE',
  )
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: MAX_BYTES_SUBIDA, files: 1 } }))
  async subir(
    @UploadedFile() archivo: Express.Multer.File | undefined,
  ): Promise<RespuestaUno<ArchivoSubido>> {
    if (!archivo) {
      throw new ErrorApi('VALIDACION_FALLIDA', 'Falta el archivo. Mandalo en el campo «archivo».');
    }
    return respuestaUno(await this.archivos.subir(archivo.buffer));
  }

  @Get('*clave')
  @Publico()
  @ApiOperation({
    summary: 'Descargar un archivo',
    description:
      'Público. Soporta `Range` (responde 206), que es lo que usan expo-audio y expo-video ' +
      'para adelantar y reproducir mientras descargan.',
  })
  @ApiResponse({ status: 200, description: 'El archivo completo' })
  @ApiResponse({ status: 206, description: 'La parte pedida con Range' })
  @ApiResponse({
    status: 302,
    description: 'Con ARCHIVOS_REDIRIGIR=true y un proveedor en la nube: URL firmada de 15 minutos',
  })
  @DocErrores('ARCHIVO_NO_ENCONTRADO', 'RANGO_NO_SATISFACIBLE', 'ALMACEN_NO_DISPONIBLE')
  async descargar(
    @Param('clave') partes: string[] | string,
    @Headers('range') rango: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const clave = Array.isArray(partes) ? partes.join('/') : partes;
    const redireccion = await this.archivos.urlDeRedireccion(clave);
    if (redireccion) {
      res.redirect(302, redireccion);
      return;
    }
    let descarga;
    try {
      descarga = await this.archivos.descargar(clave, rango);
    } catch (error) {
      if (error instanceof ErrorApi && error.codigo === 'RANGO_NO_SATISFACIBLE') {
        const total = (error as ErrorApi & { bytesTotales?: number }).bytesTotales ?? 0;
        res.setHeader('Content-Range', `bytes */${total}`);
      }
      throw error;
    }

    const { flujo, bytesTotales, tipoMime } = descarga;
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', tipoMime);
    // La clave no cambia nunca: el contenido tampoco.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('ETag', `"${clave.slice(clave.lastIndexOf('/') + 1)}-${bytesTotales}"`);
    if (descarga.rango) {
      const { inicio, fin } = descarga.rango;
      res.status(206);
      res.setHeader('Content-Range', `bytes ${inicio}-${fin}/${bytesTotales}`);
      res.setHeader('Content-Length', String(fin - inicio + 1));
    } else {
      res.status(200);
      res.setHeader('Content-Length', String(bytesTotales));
    }
    flujo.on('error', () => res.destroy());
    flujo.pipe(res);
  }
}
