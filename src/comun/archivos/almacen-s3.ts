// Adaptador S3: sirve para AWS, Supabase, R2, B2 y los emuladores (los presets completan
// endpoint, región y estilo de ruta; ver proveedores.ts).
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
  type RangoBytes,
} from './almacen-archivos.js';
import { mimeDeClave } from './claves.js';
import type { ConfiguracionS3 } from './proveedores.js';

const estado = (e: unknown): number | undefined =>
  (e as { $metadata?: { httpStatusCode?: number } } | null)?.$metadata
    ?.httpStatusCode;
const nombre = (e: unknown): string | undefined =>
  (e as { name?: string } | null)?.name;

const noExiste = (e: unknown) =>
  estado(e) === 404 ||
  ['NoSuchKey', 'NotFound', 'NoSuchBucket'].includes(nombre(e) ?? '');

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class AlmacenS3 extends AlmacenArchivos {
  readonly proveedor: ConfiguracionS3['proveedor'];
  private readonly cliente: S3Client;

  constructor(
    private readonly config: ConfiguracionS3,
    private readonly reintentosAlPrepararse = 10,
  ) {
    super();
    this.proveedor = config.proveedor;
    this.cliente = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      // Desde 2025 el SDK calcula y valida checksums por defecto, y R2, B2 y los emuladores
      // los rechazan o los calculan distinto.
      ...(config.checksumsSoloSiHaceFalta
        ? {
            requestChecksumCalculation: 'WHEN_REQUIRED' as const,
            responseChecksumValidation: 'WHEN_REQUIRED' as const,
          }
        : {}),
    });
  }

  /** Verifica el acceso al bucket (reintenta unos segundos); con un emulador lo crea. */
  async prepararse(): Promise<void> {
    let ultimo: unknown;
    for (let intento = 0; intento < this.reintentosAlPrepararse; intento++) {
      try {
        await this.cliente.send(
          new HeadBucketCommand({ Bucket: this.config.bucket }),
        );
        return;
      } catch (e) {
        ultimo = e;
        if (noExiste(e) && this.config.crearBucket) {
          try {
            await this.cliente.send(
              new CreateBucketCommand({ Bucket: this.config.bucket }),
            );
            return;
          } catch (creando) {
            // Otro arranque pudo haberlo creado a la vez.
            if (
              ['BucketAlreadyOwnedByYou', 'BucketAlreadyExists'].includes(
                nombre(creando) ?? '',
              )
            )
              return;
            ultimo = creando;
          }
        }
        // Credenciales, bucket o región equivocados no se arreglan esperando.
        if (
          [401, 403].includes(estado(e) ?? 0) ||
          (noExiste(e) && !this.config.crearBucket)
        )
          break;
        await dormir(1000);
      }
    }
    throw new AlmacenNoDisponible(ultimo);
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
    } catch (e) {
      throw new AlmacenNoDisponible(e);
    }
  }

  async leer(clave: string, rango?: RangoBytes): Promise<LecturaArchivo> {
    try {
      const r = await this.cliente.send(
        new GetObjectCommand({
          Bucket: this.config.bucket,
          Key: clave,
          ...(rango ? { Range: `bytes=${rango.inicio}-${rango.fin}` } : {}),
        }),
      );
      // Con Range, el total viene en Content-Range ("bytes 10-19/1000").
      const total = r.ContentRange
        ? Number(r.ContentRange.split('/')[1])
        : (r.ContentLength ?? 0);
      return {
        flujo: r.Body as Readable,
        bytesTotales: total,
        tipoMime:
          r.ContentType && r.ContentType !== 'binary/octet-stream'
            ? r.ContentType
            : mimeDeClave(clave),
      };
    } catch (e) {
      if (noExiste(e)) throw new ArchivoNoEncontrado(clave);
      throw new AlmacenNoDisponible(e);
    }
  }

  async existe(clave: string): Promise<boolean> {
    try {
      await this.cliente.send(
        new HeadObjectCommand({ Bucket: this.config.bucket, Key: clave }),
      );
      return true;
    } catch (e) {
      if (noExiste(e)) return false;
      throw new AlmacenNoDisponible(e);
    }
  }

  async borrar(clave: string): Promise<void> {
    try {
      await this.cliente.send(
        new DeleteObjectCommand({ Bucket: this.config.bucket, Key: clave }),
      );
    } catch (e) {
      throw new AlmacenNoDisponible(e);
    }
  }

  override async urlFirmada(clave: string, segundos: number): Promise<string> {
    try {
      return await getSignedUrl(
        this.cliente,
        new GetObjectCommand({ Bucket: this.config.bucket, Key: clave }),
        { expiresIn: segundos },
      );
    } catch (e) {
      throw new AlmacenNoDisponible(e);
    }
  }
}
