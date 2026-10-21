import { AlmacenNoDisponible } from '../../src/common/files/file-storage.js';
import { AlmacenS3 } from '../../src/common/files/s3-storage.js';
import { configuracionS3 } from '../../src/common/files/providers.js';
import { levantarS3Falso, type S3Falso } from '../utilities/fake-s3.js';
import { contratoAlmacen } from './storage-contract.js';

function configuracion(endpoint: string, extra: Record<string, string> = {}) {
  const r = configuracionS3({
    ARCHIVOS_PROVEEDOR: 's3proxy',
    S3_ENDPOINT: endpoint,
    S3_BUCKET: 'archivos',
    ...extra,
  });
  if ('errores' in r) throw new Error(r.errores.join(' '));
  return r.config;
}

// Mismo contrato que el disco, contra un servidor con el protocolo de S3 (SDK real, por HTTP).
let falso: S3Falso;
beforeAll(async () => {
  falso = await levantarS3Falso();
});
afterAll(() => falso.cerrar());

contratoAlmacen(
  'S3 (servidor de pruebas)',
  async () => new AlmacenS3(configuracion(falso.endpoint)),
);

// La misma suite contra S3Proxy de verdad: la matriz levanta compose.matriz.yaml y define S3PROXY_URL.
describe.runIf(process.env.S3PROXY_URL)('S3Proxy (matriz)', () => {
  contratoAlmacen(
    'S3 (S3Proxy)',
    async () =>
      new AlmacenS3(configuracion(process.env.S3PROXY_URL!, { S3_BUCKET: 'archivos-test' })),
  );
});

describe('AlmacenS3 — arranque', () => {
  it('con un emulador crea el bucket si no existe', async () => {
    const almacen = new AlmacenS3(configuracion(falso.endpoint, { S3_BUCKET: 'nuevo' }));
    await almacen.prepararse();
    expect(falso.buckets.has('nuevo')).toBe(true);
  });

  it('sin crear bucket y con el bucket inexistente, falla en castellano y sin reintentar', async () => {
    const config = {
      ...configuracion(falso.endpoint, { S3_BUCKET: 'no-hay' }),
      crearBucket: false,
    };
    await expect(new AlmacenS3(config, 3, 1).prepararse()).rejects.toThrow(
      /el bucket no existe.*S3_BUCKET/,
    );
  });

  it('si el servicio no responde, falla diciendo que revise la dirección', async () => {
    const config = configuracion('http://127.0.0.1:1');
    await expect(new AlmacenS3(config, 2, 1).prepararse()).rejects.toThrow(/S3_ENDPOINT/);
  });

  it('un servicio caído en guardar/leer sale como AlmacenNoDisponible', async () => {
    const almacen = new AlmacenS3(configuracion('http://127.0.0.1:1'));
    const clave = 'imagenes/2026/10/x.jpg';
    await expect(almacen.guardar(clave, Buffer.from('a'), 'image/jpeg')).rejects.toBeInstanceOf(
      AlmacenNoDisponible,
    );
    await expect(almacen.leer(clave)).rejects.toBeInstanceOf(AlmacenNoDisponible);
  });
});
