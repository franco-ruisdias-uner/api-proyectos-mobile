import { createHash } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import {
  CallHandler,
  Controller,
  ExecutionContext,
  Get,
  Inject,
  HttpException,
  Injectable,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { ArchivoSubido, RespuestaUno } from '../../../contract/api.js';
import { ENTORNO } from '../../config/environment.module.js';
import type { Entorno } from '../../config/environment.js';
import { AlmacenArchivos } from './file-storage.js';
import { Publico } from '../auth/decorators.js';
import { ErrorApi } from '../errors/catalog.js';
import { respuestaUno } from '../response/response.js';
import {
  DocConSesion,
  DocErrores,
  DocRespuestaUno,
} from '../swagger/documentation.js';
import { ArchivoSubidoDoc } from '../swagger/models.js';
import { ServicioArchivos, type ArchivoRecibido } from './files.service.js';
import { parsearRango } from './range.js';
import { LIMITE_MAXIMO } from './file-types.js';

export const CAMPO_ARCHIVO = 'archivo';

const InterceptorMulter = FileInterceptor(CAMPO_ARCHIVO, {
  limits: { fileSize: LIMITE_MAXIMO, files: 1 },
});

/** Multer con un mensaje que se entiende cuando el archivo viene mal (otro campo, varios). */
@Injectable()
class InterceptorSubida extends InterceptorMulter {
  async intercept(ctx: ExecutionContext, next: CallHandler) {
    try {
      return await super.intercept(ctx, next);
    } catch (e) {
      if (e instanceof HttpException && e.getStatus() === 400) {
        throw new ErrorApi(
          'VALIDACION_FALLIDA',
          `Mandá un solo archivo, en el campo «${CAMPO_ARCHIVO}».`,
        );
      }
      throw e;
    }
  }
}

@ApiTags('Archivos')
@Controller('archivos')
export class ControladorArchivos {
  constructor(
    private readonly archivos: ServicioArchivos,
    private readonly almacen: AlmacenArchivos,
    @Inject(ENTORNO) private readonly entorno: Entorno,
  ) {}

  @Post()
  @DocConSesion()
  @UseInterceptors(InterceptorSubida)
  @ApiOperation({
    summary: 'Subir una foto, un audio o un video',
    description:
      'Primero se sube el archivo y después se manda su `url` en el recurso. Imagen jpeg/png/webp hasta 5 MB; audio m4a/aac/mp3 hasta 10 MB; video mp4 hasta 30 MB. Se reconoce por el contenido, no por la extensión.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { [CAMPO_ARCHIVO]: { type: 'string', format: 'binary' } },
      required: [CAMPO_ARCHIVO],
    },
  })
  @DocRespuestaUno(201, ArchivoSubidoDoc, 'El archivo quedó guardado.')
  @DocErrores(
    'VALIDACION_FALLIDA',
    'ARCHIVO_DEMASIADO_GRANDE',
    'TIPO_DE_ARCHIVO_NO_PERMITIDO',
    'ALMACEN_NO_DISPONIBLE',
  )
  async subir(
    @UploadedFile() archivo: ArchivoRecibido | undefined,
  ): Promise<RespuestaUno<ArchivoSubido>> {
    if (!archivo)
      throw new ErrorApi(
        'VALIDACION_FALLIDA',
        `Falta el archivo: mandalo en el campo «${CAMPO_ARCHIVO}».`,
      );
    return respuestaUno(await this.archivos.subir(archivo));
  }

  @Get('*clave')
  @Publico()
  @ApiOperation({
    summary: 'Bajar un archivo',
    description:
      'Es la `url` que devolvió la subida. Acepta `Range: bytes=…` (responde 206), que es lo que usan expo-audio y expo-video para adelantar.',
  })
  @ApiProduces(
    'image/jpeg',
    'image/png',
    'image/webp',
    'audio/mp4',
    'audio/aac',
    'audio/mpeg',
    'video/mp4',
  )
  @ApiResponse({ status: 200, description: 'El archivo completo.' })
  @ApiResponse({ status: 206, description: 'La parte pedida con Range.' })
  @DocErrores(
    'ARCHIVO_NO_ENCONTRADO',
    'RANGO_NO_SATISFACIBLE',
    'ALMACEN_NO_DISPONIBLE',
  )
  async bajar(
    @Param('clave') partes: string[] | string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const clave = Array.isArray(partes) ? partes.join('/') : partes;
    // ARCHIVOS_REDIRIGIR: el archivo lo baja el teléfono directo del proveedor (15 minutos).
    if (this.entorno.ARCHIVOS_REDIRIGIR && this.almacen.urlFirmada) {
      const url = await this.archivos.urlFirmada(clave, 15 * 60);
      res.redirect(302, url);
      return;
    }
    const total = await this.archivos.tamano(clave);
    const rango = parsearRango(req.headers.range, total);
    if (rango === 'insatisfacible') {
      throw new ErrorApi('RANGO_NO_SATISFACIBLE', undefined, {
        'Content-Range': `bytes */${total}`,
      });
    }

    const lectura = await this.archivos.leer(
      clave,
      rango === 'entero' ? undefined : rango,
    );
    res.setHeader('Content-Type', lectura.tipoMime);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    // La clave no cambia nunca: su hash y el tamaño identifican el contenido.
    res.setHeader(
      'ETag',
      `"${createHash('sha1').update(clave).digest('hex').slice(0, 16)}-${total}"`,
    );
    if (rango === 'entero') {
      res.status(200).setHeader('Content-Length', String(total));
    } else {
      res.status(206);
      res.setHeader(
        'Content-Range',
        `bytes ${rango.inicio}-${rango.fin}/${total}`,
      );
      res.setHeader('Content-Length', String(rango.fin - rango.inicio + 1));
    }
    await pipeline(lectura.flujo, res).catch(() => {
      // El teléfono cortó la descarga (pasa al adelantar un audio): no es un error.
    });
  }
}
