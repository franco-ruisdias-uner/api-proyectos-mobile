import { AlmacenS3 } from '../../src/common/files/s3-storage.js';
import { AlmacenNoDisponible } from '../../src/common/files/file-storage.js';
import { configuracionS3 } from '../../src/common/files/providers.js';
import { entornoS3Prueba, hayS3 } from '../utilities/fake-s3.js';
import { contratoAlmacen } from './storage-contract.js';

function crearAlmacen(bucket: string, extra: Record<string, string> = {}): AlmacenS3 {
  const config = configuracionS3('s3proxy', { ...entornoS3Prueba(bucket), ...extra });
  if ('error' in config) throw new Error(config.error);
  return new AlmacenS3(config);
}

// La misma suite de contrato que el adaptador de disco, contra S3Proxy (AGENTS §17.4).
describe.runIf(hayS3)('AGENTS §17.4 — AlmacenS3 contra S3Proxy', () => {
  let almacen: AlmacenS3;
  contratoAlmacen(
    's3proxy',
    async () => {
      almacen = crearAlmacen('contrato-almacen');
      await almacen.prepararse();
      return almacen;
    },
    async () => almacen.cerrar(),
  );

  it('informa el proveedor', () => {
    expect(crearAlmacen('proveedor-prueba').proveedor).toBe('s3proxy');
  });

  it('prepararse crea el bucket si no existe (emulador) y es idempotente', async () => {
    const a = crearAlmacen(`nuevo-${Date.now()}`);
    await a.prepararse();
    await a.prepararse();
    await a.guardar('imagenes/2026/11/prueba00009.png', Buffer.from([1, 2, 3]), 'image/png');
    expect(await a.existe('imagenes/2026/11/prueba00009.png')).toBe(true);
    a.cerrar();
  });

  it('sin crear el bucket, uno que no existe da un error que dice qué revisar', async () => {
    const a = crearAlmacen('no-existe-este-bucket', { ARCHIVOS_CREAR_BUCKET: 'false' });
    await expect(a.prepararse(1)).rejects.toThrow(/el bucket no existe.*S3_BUCKET/);
    a.cerrar();
  });

  it('un servicio que no responde: AlmacenNoDisponible en castellano', async () => {
    const a = crearAlmacen('x-bucket', { S3_ENDPOINT: 'http://127.0.0.1:1' });
    const falla = await a.prepararse(1).catch((e: unknown) => e);
    expect(falla).toBeInstanceOf(AlmacenNoDisponible);
    expect((falla as Error).message).toMatch(/el servicio no responde/);
    a.cerrar();
  });

  it('urlFirmada devuelve una URL del endpoint con firma', async () => {
    const a = crearAlmacen('contrato-almacen');
    await a.prepararse();
    const url = await a.urlFirmada('imagenes/2026/11/prueba00001.png');
    expect(url).toMatch(
      /^http:\/\/127\.0\.0\.1:\d+\/contrato-almacen\/imagenes\/2026\/11\/prueba00001\.png\?/,
    );
    expect(url).toContain('X-Amz-Signature=');
    a.cerrar();
  });
});
