import { randomBytes } from 'node:crypto';
import { AlmacenS3 } from '../../src/common/files/s3-storage.js';
import { AlmacenNoDisponible } from '../../src/common/files/file-storage.js';
import { s3ConfigFromEnv } from '../../src/common/files/providers.js';
import { contratoDelAlmacen } from '../storage/storage-contract.js';
import { ENTORNO_S3PROXY } from './s3-environment.js';

function configuracion(extra: Record<string, string> = {}) {
  const c = s3ConfigFromEnv({ ...ENTORNO_S3PROXY, ...extra });
  if (c === null || 'problems' in c) throw new Error('config S3 inválida');
  return c;
}

contratoDelAlmacen(
  's3 (S3Proxy)',
  async () =>
    new AlmacenS3(
      configuracion({ S3_BUCKET: `c-${randomBytes(4).toString('hex')}` }),
    ),
);

describe('AGENTS §17 — AlmacenS3: errores', () => {
  it('un bucket que no existe y no hay que crear: no arranca y dice cuál', async () => {
    const almacen = new AlmacenS3(
      configuracion({
        S3_CREATE_BUCKET: 'false',
        S3_BUCKET: 'no-existe-nunca',
      }),
      2,
    );
    await expect(almacen.prepararse()).rejects.toThrow(/no-existe-nunca/);
  });

  it('un proveedor que no responde: AlmacenNoDisponible', async () => {
    const almacen = new AlmacenS3(
      configuracion({ S3_ENDPOINT: 'http://127.0.0.1:1' }),
      1,
    );
    await expect(almacen.prepararse()).rejects.toBeInstanceOf(
      AlmacenNoDisponible,
    );
  });
});
