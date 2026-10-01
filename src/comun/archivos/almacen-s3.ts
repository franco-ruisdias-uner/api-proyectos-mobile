import { extname } from 'node:path';
import type { Readable } from 'node:stream';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  type AlmacenArchivos,
  AlmacenNoDisponible,
  ArchivoNoEncontrado,
  type LecturaArchivo,
} from './almacen-archivos.js';
import { MIME_POR_EXTENSION } from './firma.js';
import type { ConfiguracionS3 } from './proveedores.js';
import type { Rango } from './rango.js';

const VIGENCIA_URL_FIRMADA_SEGUNDOS = 15 * 60;

const nombreDe = (error: unknown): string =>
  typeof error === 'object' && error !== null ? String((error as { name?: unknown }).name) : '';

const estadoDe = (error: unknown): number | undefined =>
  typeof error === 'object' && error !== null
    ? (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
    : undefined;

/** NoSuchKey (GET) y NotFound (HEAD). NoSuchBucket no: eso es un almacén mal configurado. */
const faltaLaClave = (error: unknown) =>
  nombreDe(error) === 'NoSuchKey' ||
  nombreDe(error) === 'NotFound' ||
  (estadoDe(error) === 404 && nombreDe(error) !== 'NoSuchBucket');

const esperar = (ms: number) => new Promise((listo) => setTimeout(listo, ms));

/** Adaptador de cualquier servicio compatible con S3 (AGENTS §17). */
export class AlmacenS3 implements AlmacenArchivos {
  readonly proveedor: ConfiguracionS3['proveedor'];
  private readonly cliente: S3Client;

  constructor(
    private readonly config: ConfiguracionS3,
    private readonly reintentosAlPrepararse = 10,
  ) {
    this.proveedor = config.proveedor;
    this.cliente = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials: config.credenciales,
      ...(config.checksumsSoloSiHaceFalta
        ? {
            requestChecksumCalculation: 'WHEN_REQUIRED' as const,
            responseChecksumValidation: 'WHEN_REQUIRED' as const,
          }
        : {}),
    });
  }

  async prepararse(): Promise<void> {
    let ultimo: unknown;
    for (let intento = 1; intento <= this.reintentosAlPrepararse; intento++) {
      try {
        await this.cliente.send(new HeadBucketCommand({ Bucket: this.config.bucket }));
        return;
      } catch (error) {
        ultimo = error;
        if (estadoDe(error) === 404 || nombreDe(error) === 'NotFound') {
          if (!this.config.crearBucket) break;
          try {
            await this.cliente.send(new CreateBucketCommand({ Bucket: this.config.bucket }));
            return;
          } catch (errorAlCrear) {
            ultimo = errorAlCrear;
            if (['BucketAlreadyOwnedByYou', 'BucketAlreadyExists'].includes(nombreDe(errorAlCrear)))
              return;
          }
        }
        // Credenciales o permisos mal puestos no se arreglan reintentando.
        if ([401, 403].includes(estadoDe(error) ?? 0)) break;
      }
      if (intento < this.reintentosAlPrepararse) await esperar(2000);
    }
    throw new Error(this.explicar(ultimo), { cause: ultimo });
  }

  private explicar(error: unknown): string {
    const bucket = this.config.bucket;
    const estado = estadoDe(error);
    const donde = `${this.config.proveedor}${this.config.endpoint ? ` (${this.config.endpoint})` : ''}`;
    if (estado === 404) {
      return `No existe el bucket "${bucket}" en ${donde}. Revisá S3_BUCKET: tiene que ser el nombre de un bucket que ya creaste en el panel del proveedor.`;
    }
    if (estado === 401 || estado === 403) {
      return `El proveedor de archivos rechazó las credenciales para el bucket "${bucket}". Revisá S3_ACCESS_KEY_ID y S3_SECRET_ACCESS_KEY, y que esa clave tenga permiso sobre el bucket.`;
    }
    return `No se pudo conectar con el almacén de archivos ${donde}. Revisá S3_REGION, S3_ENDPOINT y la conexión a internet (${nombreDe(error) || 'sin detalle'}).`;
  }

  async guardar(clave: string, contenido: Buffer, tipoMime: string): Promise<void> {
    try {
      await this.cliente.send(
        new PutObjectCommand({
          Bucket: this.config.bucket,
          Key: clave,
          Body: contenido,
          ContentType: tipoMime,
          ContentLength: contenido.length,
        }),
      );
    } catch (error) {
      throw new AlmacenNoDisponible(error);
    }
  }

  async leer(clave: string, rango?: Rango): Promise<LecturaArchivo> {
    let respuesta;
    try {
      respuesta = await this.cliente.send(
        new GetObjectCommand({
          Bucket: this.config.bucket,
          Key: clave,
          Range: rango ? `bytes=${rango.inicio}-${rango.fin}` : undefined,
        }),
      );
    } catch (error) {
      if (faltaLaClave(error)) throw new ArchivoNoEncontrado(clave);
      throw new AlmacenNoDisponible(error);
    }
    if (!respuesta.Body)
      throw new AlmacenNoDisponible(new Error('El almacén respondió sin contenido'));
    // Con rango, el total viene en Content-Range ("bytes 10-19/100"); ContentLength es lo pedido.
    const total = respuesta.ContentRange?.match(/\/(\d+)$/)?.[1];
    const bytesTotales = total !== undefined ? Number(total) : (respuesta.ContentLength ?? 0);
    const porExtension = MIME_POR_EXTENSION[extname(clave).slice(1).toLowerCase()];
    return {
      flujo: respuesta.Body as Readable,
      bytesTotales,
      tipoMime: porExtension ?? respuesta.ContentType ?? 'application/octet-stream',
    };
  }

  async existe(clave: string): Promise<boolean> {
    try {
      await this.cliente.send(new HeadObjectCommand({ Bucket: this.config.bucket, Key: clave }));
      return true;
    } catch (error) {
      if (faltaLaClave(error)) return false;
      throw new AlmacenNoDisponible(error);
    }
  }

  async borrar(clave: string): Promise<void> {
    try {
      await this.cliente.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: clave }));
    } catch (error) {
      throw new AlmacenNoDisponible(error);
    }
  }

  /** URL firmada de lectura, válida 15 minutos (ARCHIVOS_REDIRIGIR). */
  async urlFirmada(clave: string): Promise<string> {
    try {
      return await getSignedUrl(
        this.cliente,
        new GetObjectCommand({ Bucket: this.config.bucket, Key: clave }),
        { expiresIn: VIGENCIA_URL_FIRMADA_SEGUNDOS },
      );
    } catch (error) {
      throw new AlmacenNoDisponible(error);
    }
  }

  cerrar(): void {
    this.cliente.destroy();
  }
}
