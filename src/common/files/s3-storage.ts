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
} from './file-storage.js';
import { mimeDeClave } from './keys.js';
import type { ConfiguracionS3 } from './providers.js';

const ESPERA_ENTRE_INTENTOS_MS = 1500;

function estadoHttp(error: unknown): number | undefined {
  return (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
}

function nombreDe(error: unknown): string {
  return (error as { name?: string }).name ?? '';
}

const esNoExiste = (error: unknown) =>
  estadoHttp(error) === 404 || ['NoSuchKey', 'NotFound', 'NoSuchBucket'].includes(nombreDe(error));

/** Adaptador de S3 (y de todo lo que hable su protocolo): AWS, Supabase, R2, B2 y emuladores. */
export class AlmacenS3 extends AlmacenArchivos {
  readonly proveedor: ConfiguracionS3['proveedor'];
  private readonly cliente: S3Client;

  constructor(private readonly config: ConfiguracionS3) {
    super();
    this.proveedor = config.proveedor;
    this.cliente = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials: config.credenciales,
      // Desde 2025 el SDK calcula y valida checksums por defecto, y los servicios compatibles
      // con S3 (R2, B2, emuladores) los rechazan o los calculan distinto.
      ...(config.checksumsSoloSiHacenFalta
        ? { requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED' }
        : {}),
    });
  }

  async prepararse(intentos = 5): Promise<void> {
    let ultimo: unknown;
    for (let i = 1; i <= intentos; i++) {
      try {
        await this.verificarBucket();
        return;
      } catch (error) {
        ultimo = error;
        if (this.esErrorDeConfiguracion(error)) break;
        if (i < intentos) await new Promise((r) => setTimeout(r, ESPERA_ENTRE_INTENTOS_MS));
      }
    }
    throw new AlmacenNoDisponible(this.explicar(ultimo), { cause: ultimo });
  }

  private async verificarBucket(): Promise<void> {
    try {
      await this.cliente.send(new HeadBucketCommand({ Bucket: this.config.bucket }));
    } catch (error) {
      if (esNoExiste(error) && this.config.crearBucket) {
        await this.cliente.send(new CreateBucketCommand({ Bucket: this.config.bucket }));
        return;
      }
      throw error;
    }
  }

  private esErrorDeConfiguracion(error: unknown): boolean {
    const estado = estadoHttp(error);
    return estado === 401 || estado === 403 || (estado === 404 && !this.config.crearBucket);
  }

  /** Dice en castellano qué salió mal al conectarse, y qué variable revisar. */
  explicar(error: unknown): string {
    const { proveedor, bucket } = this.config;
    const estado = estadoHttp(error);
    const nombre = nombreDe(error);
    const codigo = String((error as { code?: unknown }).code ?? '');
    const inicio = `No se pudo usar el almacén de archivos (${proveedor}, bucket «${bucket}»)`;
    if (
      estado === 403 ||
      estado === 401 ||
      /InvalidAccessKeyId|SignatureDoesNotMatch|AccessDenied|InvalidToken/.test(nombre)
    ) {
      return `${inicio}: el servicio rechazó las credenciales. Revisá S3_ACCESS_KEY_ID y S3_SECRET_ACCESS_KEY, y que tengan permiso sobre el bucket.`;
    }
    if (estado === 404 || nombre === 'NoSuchBucket') {
      return `${inicio}: el bucket no existe. Revisá S3_BUCKET (y S3_REGION) o creá el bucket en el panel del proveedor.`;
    }
    if (/ENOTFOUND|EAI_AGAIN/.test(codigo)) {
      return `${inicio}: no se encontró el servidor${this.config.endpoint ? ` (${this.config.endpoint})` : ''}. Revisá la región, la variable del proyecto o cuenta y tu conexión a internet.`;
    }
    if (/ECONNREFUSED|ETIMEDOUT|ECONNRESET/.test(codigo)) {
      return `${inicio}: el servicio no responde${this.config.endpoint ? ` en ${this.config.endpoint}` : ''}. Si es un emulador de Docker, ¿está levantado?`;
    }
    const detalle = error instanceof Error ? error.message : String(error);
    return `${inicio}: ${detalle}`;
  }

  async guardar(clave: string, contenido: Buffer, tipoMime: string): Promise<void> {
    try {
      await this.cliente.send(
        new PutObjectCommand({
          Bucket: this.config.bucket,
          Key: clave,
          Body: contenido,
          ContentType: tipoMime,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
    } catch (error) {
      throw new AlmacenNoDisponible(this.explicar(error), { cause: error });
    }
  }

  async describir(clave: string): Promise<{ bytesTotales: number; tipoMime: string }> {
    try {
      const cabeza = await this.cliente.send(
        new HeadObjectCommand({ Bucket: this.config.bucket, Key: clave }),
      );
      return {
        bytesTotales: cabeza.ContentLength ?? 0,
        tipoMime:
          cabeza.ContentType && cabeza.ContentType !== 'binary/octet-stream'
            ? cabeza.ContentType
            : mimeDeClave(clave),
      };
    } catch (error) {
      if (esNoExiste(error)) throw new ArchivoNoEncontrado(clave);
      throw new AlmacenNoDisponible(this.explicar(error), { cause: error });
    }
  }

  async leer(clave: string, rango?: RangoBytes): Promise<LecturaArchivo> {
    const { bytesTotales, tipoMime } = await this.describir(clave);
    try {
      const respuesta = await this.cliente.send(
        new GetObjectCommand({
          Bucket: this.config.bucket,
          Key: clave,
          ...(rango ? { Range: `bytes=${rango.inicio}-${rango.fin}` } : {}),
        }),
      );
      return { flujo: respuesta.Body as Readable, bytesTotales, tipoMime };
    } catch (error) {
      if (esNoExiste(error)) throw new ArchivoNoEncontrado(clave);
      throw new AlmacenNoDisponible(this.explicar(error), { cause: error });
    }
  }

  async existe(clave: string): Promise<boolean> {
    try {
      await this.describir(clave);
      return true;
    } catch (error) {
      if (error instanceof ArchivoNoEncontrado) return false;
      throw error;
    }
  }

  async borrar(clave: string): Promise<void> {
    try {
      await this.cliente.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: clave }));
    } catch (error) {
      if (esNoExiste(error)) return;
      throw new AlmacenNoDisponible(this.explicar(error), { cause: error });
    }
  }

  override async urlFirmada(clave: string, segundos = 15 * 60): Promise<string> {
    try {
      return await getSignedUrl(
        this.cliente,
        new GetObjectCommand({ Bucket: this.config.bucket, Key: clave }),
        {
          expiresIn: segundos,
        },
      );
    } catch (error) {
      throw new AlmacenNoDisponible(this.explicar(error), { cause: error });
    }
  }

  cerrar(): void {
    this.cliente.destroy();
  }
}
