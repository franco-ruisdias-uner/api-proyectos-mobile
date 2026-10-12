/// <reference types="multer" />
import {
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { ArchivoSubido, RespuestaUno } from '../../../contrato/api.js';
import { Publico } from '../auth/decoradores.js';
import { ErrorApi } from '../errores/error-api.js';
import { Doc } from '../respuesta/documentacion.js';
import { respuestaUno } from '../respuesta/respuesta.js';
import { ArchivosServicio } from './archivos.servicio.js';
import { LIMITE_BYTES, leerRango } from './reglas.js';

@ApiTags('Archivos')
@Controller('archivos')
export class ArchivosControlador {
  constructor(private readonly archivos: ArchivosServicio) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('archivo', {
      limits: { fileSize: LIMITE_BYTES.video, files: 1 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['archivo'],
      properties: { archivo: { type: 'string', format: 'binary' } },
    },
  })
  @Doc({
    resumen: 'Sube una foto, un audio o un video',
    descripcion:
      'Campo `archivo` en `multipart/form-data`. Imagen jpeg/png/webp hasta 5 MB; audio m4a/aac/mp3 hasta 10 MB; ' +
      'video mp4 hasta 30 MB. Se mira el contenido del archivo, no la extensión. Devuelve la URL que después ' +
      'se manda en el recurso (por ejemplo, en `fotoUri`).',
    roles: [],
    estado: 201,
    ejemplo: {
      url: 'http://192.168.0.10:3000/archivos/imagenes/2026/09/3f9c0d1e2a4b5c6d7e8f9a0b.jpg',
      tipo: 'imagen',
      bytes: 284113,
    },
    errores: [
      'VALIDACION_FALLIDA',
      'ARCHIVO_DEMASIADO_GRANDE',
      'TIPO_DE_ARCHIVO_NO_PERMITIDO',
      'ALMACEN_NO_DISPONIBLE',
    ],
  })
  async subir(
    @UploadedFile() archivo: Express.Multer.File | undefined,
  ): Promise<RespuestaUno<ArchivoSubido>> {
    if (!archivo) throw new ErrorApi('VALIDACION_FALLIDA', 'Falta el archivo.');
    return respuestaUno(await this.archivos.subir(archivo.buffer));
  }

  @Get('*clave')
  @Publico()
  @Doc({
    resumen: 'Descarga un archivo',
    descripcion:
      'Admite `Range` (responde 206), para que el audio y el video se puedan adelantar y reproducir mientras bajan. ' +
      'Es público: las URLs llevan una clave imposible de adivinar.',
    roles: null,
    errores: [
      'ARCHIVO_NO_ENCONTRADO',
      'RANGO_NO_VALIDO',
      'ALMACEN_NO_DISPONIBLE',
    ],
  })
  async descargar(
    @Param('clave') partes: string | string[],
    @Req() pedido: Request,
    @Res() respuesta: Response,
  ): Promise<void> {
    const clave = Array.isArray(partes) ? partes.join('/') : partes;
    // Primero se averigua el tamaño (y que exista) para poder validar el rango.
    const completo = await this.archivos.leer(clave);
    completo.flujo.destroy();
    const total = completo.bytesTotales;
    const rango = leerRango(pedido.get('range'), total);
    if (rango === null) {
      respuesta.setHeader('Content-Range', `bytes */${total}`);
      throw new ErrorApi('RANGO_NO_VALIDO');
    }
    const lectura = rango
      ? await this.archivos.leer(clave, rango)
      : await this.archivos.leer(clave);

    respuesta.setHeader('Accept-Ranges', 'bytes');
    respuesta.setHeader('Content-Type', lectura.tipoMime);
    respuesta.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    respuesta.setHeader(
      'ETag',
      `"${clave.slice(clave.lastIndexOf('/') + 1)}-${total}"`,
    );
    if (rango) {
      respuesta.status(206);
      respuesta.setHeader(
        'Content-Range',
        `bytes ${rango.inicio}-${rango.fin}/${total}`,
      );
      respuesta.setHeader(
        'Content-Length',
        String(rango.fin - rango.inicio + 1),
      );
    } else {
      respuesta.status(200);
      respuesta.setHeader('Content-Length', String(total));
    }
    lectura.flujo.on('error', () => respuesta.destroy());
    lectura.flujo.pipe(respuesta);
  }
}
