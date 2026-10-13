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
  AlmacenArchivos,
  AlmacenNoDisponible,
  ArchivoNoEncontrado,
  type LecturaArchivo,
  MIME_POR_EXTENSION,
  type Rango,
} from './almacen-archivos.js';
import type { ConfiguracionS3 } from './proveedores.js';

function nombreDeError(error: unknown): string {
  return (error as { name?: string }).name ?? '';
}
function estadoHttp(error: unknown): number | undefined {
  return (error as { $metadata?: { httpStatusCode?: number } }).$metadata
    ?.httpStatusCode;
}
function noExiste(error: unknown): boolean {
  return (
    ['NoSuchKey', 'NotFound'].includes(nombreDeError(error)) ||
    estadoHttp(error) === 404
  );
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Archivos en cualquier servicio compatible con S3 (AWS, Supabase, R2, B2, S3Proxy, LocalStack). */
export class AlmacenS3 extends AlmacenArchivos {
  readonly proveedor: ConfiguracionS3['proveedor'];
  private readonly cliente: S3Client;

  constructor(
    private readonly config: ConfiguracionS3,
    private readonly intentos = 10,
  ) {
    super();
    this.proveedor = config.proveedor;
    // Con cualquier proveedor que no sea AWS, el SDK no tiene que calcular ni validar checksums
    // por defecto: R2, B2 y los emuladores los rechazan o los calculan distinto.
    const noAws = config.proveedor !== 'aws';
    this.cliente = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials: config.credenciales,
      ...(noAws
        ? {
            requestChecksumCalculation: 'WHEN_REQUIRED' as const,
            responseChecksumValidation: 'WHEN_REQUIRED' as const,
          }
        : {}),
    });
  }

  async prepararse(): Promise<void> {
    let ultimo: unknown;
    for (let intento = 1; intento <= this.intentos; intento++) {
      try {
        await this.cliente.send(
          new HeadBucketCommand({ Bucket: this.config.bucket }),
        );
        return;
      } catch (error) {
        ultimo = error;
        if (noExiste(error) && this.config.crearBucket) {
          try {
            await this.cliente.send(
              new CreateBucketCommand({ Bucket: this.config.bucket }),
            );
            return;
          } catch (e) {
            if (
              ['BucketAlreadyOwnedByYou', 'BucketAlreadyExists'].includes(
                nombreDeError(e),
              )
            )
              return;
            ultimo = e;
          }
        } else if (noExiste(error)) {
          break; // el bucket no existe y no hay que crearlo: reintentar no sirve
        }
        if (intento < this.intentos) await esperar(1000);
      }
    }
    throw new AlmacenNoDisponible(this.explicar(ultimo));
  }

  private explicar(error: unknown): string {
    const nombre = nombreDeError(error);
    const estado = estadoHttp(error);
    const c = this.config;
    if (noExiste(error))
      return `No existe el bucket "${c.bucket}" en ${c.proveedor}. Revisá S3_BUCKET (o creá el bucket en el panel del proveedor).`;
    if (
      estado === 403 ||
      ['InvalidAccessKeyId', 'SignatureDoesNotMatch', 'AccessDenied'].includes(
        nombre,
      )
    )
      return `${c.proveedor} rechazó las credenciales. Revisá S3_ACCESS_KEY_ID y S3_SECRET_ACCESS_KEY (y que tengan permiso sobre el bucket "${c.bucket}").`;
    if (
      nombre === 'AuthorizationHeaderMalformed' ||
      nombre === 'PermanentRedirect'
    )
      return `La región no coincide con la del bucket. Revisá S3_REGION (ahora es "${c.region}").`;
    return `No se pudo conectar con los archivos de ${c.proveedor}${c.endpoint ? ` (${c.endpoint})` : ''}: ${nombre || String(error)}. Revisá el endpoint, la región y tu conexión.`;
  }

  async guardar(
    clave: string,
    contenido: Buffer,
    tipoMime: string,
  ): Promise<void> {
    try {
      await this.cliente.send(
        new PutObjectCommand({
          Bucket: this.config.bucket,
          Key: clave,
          Body: contenido,
          ContentType: tipoMime,
        }),
      );
    } catch (error) {
      throw new AlmacenNoDisponible(this.explicar(error));
    }
  }

  async leer(clave: string, rango?: Rango): Promise<LecturaArchivo> {
    try {
      const r = await this.cliente.send(
        new GetObjectCommand({
          Bucket: this.config.bucket,
          Key: clave,
          Range: rango ? `bytes=${rango.inicio}-${rango.fin}` : undefined,
        }),
      );
      // ContentRange "bytes 10-19/100" → total 100; sin rango, ContentLength es el total.
      const total = r.ContentRange
        ? Number(r.ContentRange.split('/')[1])
        : (r.ContentLength ?? 0);
      const extension = clave.slice(clave.lastIndexOf('.') + 1);
      return {
        flujo: r.Body as Readable,
        bytesTotales: total,
        tipoMime:
          r.ContentType && r.ContentType !== 'binary/octet-stream'
            ? r.ContentType
            : (MIME_POR_EXTENSION[extension] ?? 'application/octet-stream'),
      };
    } catch (error) {
      if (noExiste(error)) throw new ArchivoNoEncontrado(clave);
      throw new AlmacenNoDisponible(this.explicar(error));
    }
  }

  async existe(clave: string): Promise<boolean> {
    try {
      await this.cliente.send(
        new HeadObjectCommand({ Bucket: this.config.bucket, Key: clave }),
      );
      return true;
    } catch (error) {
      if (noExiste(error)) return false;
      throw new AlmacenNoDisponible(this.explicar(error));
    }
  }

  async borrar(clave: string): Promise<void> {
    try {
      await this.cliente.send(
        new DeleteObjectCommand({ Bucket: this.config.bucket, Key: clave }),
      );
    } catch (error) {
      throw new AlmacenNoDisponible(this.explicar(error));
    }
  }

  async urlFirmada(clave: string, segundos: number): Promise<string> {
    return getSignedUrl(
      this.cliente,
      new GetObjectCommand({ Bucket: this.config.bucket, Key: clave }),
      { expiresIn: segundos },
    );
  }
}
