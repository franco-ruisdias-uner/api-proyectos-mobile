// Adaptador S3: sirve para AWS y para todo servicio compatible (Supabase, R2, B2,
// emuladores). Las diferencias entre proveedores están en proveedores.ts.
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
import type { ProveedorArchivos } from '../../config/configuracion.js';
import {
  AlmacenArchivos,
  AlmacenNoDisponible,
  ArchivoNoEncontrado,
  type LecturaArchivo,
  type RangoBytes,
} from './almacen-archivos.js';
import type { ConfiguracionS3 } from './proveedores.js';

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

function codigo(error: unknown): string {
  const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e.$metadata?.httpStatusCode === 404 ? 'NoSuchKey' : (e.name ?? '');
}

export class AlmacenS3 extends AlmacenArchivos {
  private readonly cliente: S3Client;

  constructor(
    readonly proveedor: ProveedorArchivos,
    private readonly cfg: ConfiguracionS3,
    private readonly reintentos = 10,
  ) {
    super();
    this.cliente = new S3Client({
      endpoint: cfg.endpoint,
      region: cfg.region,
      forcePathStyle: cfg.forcePathStyle,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
      ...(cfg.checksumsSoloSiHaceFalta
        ? {
            requestChecksumCalculation: 'WHEN_REQUIRED' as const,
            responseChecksumValidation: 'WHEN_REQUIRED' as const,
          }
        : {}),
    });
  }

  async prepararse(): Promise<void> {
    let ultimo: unknown;
    for (let i = 0; i < this.reintentos; i++) {
      try {
        try {
          await this.cliente.send(
            new HeadBucketCommand({ Bucket: this.cfg.bucket }),
          );
        } catch (error) {
          if (
            this.cfg.crearBucket &&
            codigo(error) !== 'AccessDenied' &&
            (error as { $metadata?: { httpStatusCode?: number } }).$metadata
              ?.httpStatusCode === 404
          ) {
            await this.cliente.send(
              new CreateBucketCommand({ Bucket: this.cfg.bucket }),
            );
          } else throw error;
        }
        return;
      } catch (error) {
        ultimo = error;
        if (i < this.reintentos - 1) await esperar(2000);
      }
    }
    throw new AlmacenNoDisponible(
      `No se pudo acceder al bucket «${this.cfg.bucket}» (${this.proveedor}): ${(ultimo as Error).message}. ` +
        'Revisá S3_BUCKET, S3_REGION y las claves S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY.',
    );
  }

  async guardar(
    clave: string,
    contenido: Buffer,
    tipoMime: string,
  ): Promise<void> {
    await this.cliente.send(
      new PutObjectCommand({
        Bucket: this.cfg.bucket,
        Key: clave,
        Body: contenido,
        ContentType: tipoMime,
      }),
    );
  }

  async leer(clave: string, rango?: RangoBytes): Promise<LecturaArchivo> {
    try {
      const r = await this.cliente.send(
        new GetObjectCommand({
          Bucket: this.cfg.bucket,
          Key: clave,
          ...(rango ? { Range: `bytes=${rango.inicio}-${rango.fin}` } : {}),
        }),
      );
      // Con rango, el total viene en Content-Range ("bytes 10-19/100").
      const total = rango
        ? Number(r.ContentRange?.split('/')[1])
        : (r.ContentLength ?? 0);
      return {
        flujo: r.Body as Readable,
        bytesTotales: total,
        tipoMime: r.ContentType ?? 'application/octet-stream',
      };
    } catch (error) {
      if (['NoSuchKey', 'NotFound'].includes(codigo(error)))
        throw new ArchivoNoEncontrado(clave);
      throw new AlmacenNoDisponible((error as Error).message);
    }
  }

  async existe(clave: string): Promise<boolean> {
    try {
      await this.cliente.send(
        new HeadObjectCommand({ Bucket: this.cfg.bucket, Key: clave }),
      );
      return true;
    } catch (error) {
      if (['NoSuchKey', 'NotFound'].includes(codigo(error))) return false;
      throw new AlmacenNoDisponible((error as Error).message);
    }
  }

  async borrar(clave: string): Promise<void> {
    await this.cliente.send(
      new DeleteObjectCommand({ Bucket: this.cfg.bucket, Key: clave }),
    );
  }
}
