import { randomBytes } from 'node:crypto';
import type { ConfiguracionS3 } from '../../src/common/files/providers.js';

/** S3Proxy de compose.matriz.yaml (AGENTS §17.3). */
export const ENDPOINT_S3_DE_PRUEBA = process.env.S3_PRUEBA_ENDPOINT ?? 'http://127.0.0.1:58080';

/** Un bucket nuevo por archivo de tests, para que no se pisen. */
export const bucketNuevo = () => `prueba-${randomBytes(5).toString('hex')}`;

export const configuracionS3DePrueba = (bucket = bucketNuevo()): ConfiguracionS3 => ({
  proveedor: 's3proxy',
  endpoint: ENDPOINT_S3_DE_PRUEBA,
  region: 'us-east-1',
  forcePathStyle: true,
  bucket,
  credenciales: { accessKeyId: 'clave-de-mentira', secretAccessKey: 'secreto-de-mentira' },
  crearBucket: true,
  checksumsSoloSiHaceFalta: true,
});

/** Variables de entorno equivalentes, para crearApp(). */
export const entornoS3DePrueba = (bucket = bucketNuevo()): Record<string, string> => ({
  ARCHIVOS_PROVEEDOR: 's3proxy',
  S3_ENDPOINT: ENDPOINT_S3_DE_PRUEBA,
  S3_BUCKET: bucket,
});
