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
} from './file-storage.js';
import type { ConfiguracionS3 } from './providers.js';

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

function nombreDeError(error: unknown): string {
  const e = error as { name?: string; Code?: string; $metadata?: { httpStatusCode?: number } };
  return e.name ?? e.Code ?? '';
}

function noExiste(error: unknown): boolean {
  const e = error as { $metadata?: { httpStatusCode?: number } };
  return (
    ['NoSuchKey', 'NotFound', 'NoSuchBucket'].includes(nombreDeError(error)) ||
    e.$metadata?.httpStatusCode === 404
  );
}

/** Archivos en cualquier servicio compatible con S3 (AWS, Supabase, R2, B2, S3Proxy, LocalStack). */
export class AlmacenS3 implements AlmacenArchivos {
  readonly proveedor: ConfiguracionS3['proveedor'];
  private readonly cliente: S3Client;

  constructor(
    private readonly config: ConfiguracionS3,
    private readonly intentos = 5,
    private readonly pausaMs = 1000,
  ) {
    this.proveedor = config.proveedor;
    this.cliente = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      // Desde 2025 el SDK calcula checksums por defecto y varios servicios compatibles los
      // rechazan (AGENTS §17.2): sólo AWS los recibe.
      ...(config.checksumsSoloSiHaceFalta
        ? {
            requestChecksumCalculation: 'WHEN_REQUIRED' as const,
            responseChecksumValidation: 'WHEN_REQUIRED' as const,
          }
        : {}),
    });
  }

  async prepararse(): Promise<void> {
    const { bucket } = this.config;
    let ultimo: unknown;
    for (let i = 0; i < this.intentos; i++) {
      try {
        await this.cliente.send(new HeadBucketCommand({ Bucket: bucket }));
        return;
      } catch (error) {
        ultimo = error;
        if (noExiste(error) && this.config.crearBucket) {
          try {
            await this.cliente.send(new CreateBucketCommand({ Bucket: bucket }));
            return;
          } catch (errorAlCrear) {
            ultimo = errorAlCrear;
          }
        } else if (noExiste(error)) {
          break; // El bucket no existe y no hay que crearlo: reintentar no ayuda.
        }
        if (i < this.intentos - 1) await espera(this.pausaMs);
      }
    }
    throw new Error(explicarFalla(ultimo, this.config));
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
      throw new AlmacenNoDisponible((error as Error).message);
    }
  }

  async leer(clave: string, rango?: { inicio: number; fin: number }): Promise<LecturaArchivo> {
    try {
      const r = await this.cliente.send(
        new GetObjectCommand({
          Bucket: this.config.bucket,
          Key: clave,
          Range: rango ? `bytes=${rango.inicio}-${rango.fin}` : undefined,
        }),
      );
      const deContenido = /\/(\d+)$/.exec(r.ContentRange ?? '');
      const bytesTotales = deContenido ? Number(deContenido[1]) : (r.ContentLength ?? 0);
      return {
        flujo: r.Body as Readable,
        bytesTotales,
        tipoMime: r.ContentType ?? 'application/octet-stream',
      };
    } catch (error) {
      if (noExiste(error)) throw new ArchivoNoEncontrado(clave);
      throw new AlmacenNoDisponible((error as Error).message);
    }
  }

  async existe(clave: string): Promise<boolean> {
    try {
      await this.cliente.send(new HeadObjectCommand({ Bucket: this.config.bucket, Key: clave }));
      return true;
    } catch (error) {
      if (noExiste(error)) return false;
      throw new AlmacenNoDisponible((error as Error).message);
    }
  }

  async borrar(clave: string): Promise<void> {
    try {
      await this.cliente.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: clave }));
    } catch (error) {
      throw new AlmacenNoDisponible((error as Error).message);
    }
  }

  /** URL firmada de 15 minutos (ARCHIVOS_REDIRIGIR). */
  async urlFirmada(clave: string): Promise<string> {
    return getSignedUrl(
      this.cliente,
      new GetObjectCommand({ Bucket: this.config.bucket, Key: clave }),
      { expiresIn: 15 * 60 },
    );
  }
}

/** Traduce el error del SDK a algo que entienda quien configura (sin jerga). */
export function explicarFalla(error: unknown, config: ConfiguracionS3): string {
  const nombre = nombreDeError(error);
  const base = `No se pudo usar el almacén de archivos «${config.proveedor}» (bucket «${config.bucket}»)`;
  if (
    ['InvalidAccessKeyId', 'SignatureDoesNotMatch', 'AccessDenied', 'Forbidden'].includes(nombre)
  ) {
    return `${base}: las claves no sirven o no tienen permiso. Revisá S3_ACCESS_KEY_ID y S3_SECRET_ACCESS_KEY.`;
  }
  if (nombre === 'NoSuchBucket' || nombre === 'NotFound') {
    return `${base}: el bucket no existe. Creálo en el panel del proveedor y revisá S3_BUCKET.`;
  }
  if (nombre === 'AuthorizationHeaderMalformed' || nombre === 'PermanentRedirect') {
    return `${base}: la región no coincide con la del bucket. Revisá S3_REGION.`;
  }
  const detalle = (error as Error | undefined)?.message ?? 'sin detalle';
  return `${base}: no hay conexión con el servicio (${detalle}). Revisá la dirección (S3_ENDPOINT o el preset) y tu conexión a internet.`;
}
