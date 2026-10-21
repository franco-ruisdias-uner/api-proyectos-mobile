import { AlmacenNoDisponible } from '../../src/common/files/file-storage.js';
import { AlmacenS3 } from '../../src/common/files/s3-storage.js';
import type { ConfiguracionS3 } from '../../src/common/files/providers.js';
import { levantarS3Falso } from '../utilities/fake-s3.js';
import { contratoAlmacen } from './storage-contract.js';

const config = (endpoint: string): ConfiguracionS3 => ({
  endpoint,
  region: 'us-east-1',
  forcePathStyle: true,
  bucket: 'archivos',
  accessKeyId: 'de-mentira',
  secretAccessKey: 'de-mentira',
  crearBucket: true,
  checksumsSoloSiHaceFalta: true,
});

// Siempre: contra un S3 falso en memoria (sin Docker).
contratoAlmacen('S3 (servidor falso en memoria)', async () => {
  const s3 = await levantarS3Falso();
  return {
    almacen: new AlmacenS3('s3proxy', config(s3.endpoint), 1),
    cerrar: s3.cerrar,
  };
});

// En la matriz: contra S3Proxy de verdad (compose.matriz.yaml).
const real = process.env.S3_PRUEBAS_ENDPOINT;
if (real) {
  contratoAlmacen('S3 (S3Proxy real)', () =>
    Promise.resolve({
      almacen: new AlmacenS3('s3proxy', config(real), 15),
      cerrar: () => Promise.resolve(),
    }),
  );
}

describe('AGENTS §17.1 — el almacén S3 informa cuando el proveedor no responde', () => {
  it('prepararse falla con un mensaje en castellano que nombra el bucket', async () => {
    const almacen = new AlmacenS3('s3proxy', config('http://127.0.0.1:1'), 1);
    await expect(almacen.prepararse()).rejects.toThrow(/bucket «archivos»/);
  });
  it('leer con el proveedor caído tira AlmacenNoDisponible', async () => {
    const almacen = new AlmacenS3('s3proxy', config('http://127.0.0.1:1'), 1);
    await expect(almacen.leer('imagenes/2026/09/x.jpg')).rejects.toBeInstanceOf(
      AlmacenNoDisponible,
    );
  });
});
