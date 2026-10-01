import {
  AlmacenNoDisponible,
  ArchivoNoEncontrado,
} from '../../src/comun/archivos/almacen-archivos.js';
import { AlmacenS3 } from '../../src/comun/archivos/almacen-s3.js';
import { bucketNuevo, configuracionS3DePrueba } from '../utilidades/s3.js';
import { probarContratoDeAlmacen } from './contrato-almacen.js';

probarContratoDeAlmacen('s3 (S3Proxy)', async () => new AlmacenS3(configuracionS3DePrueba()));

describe('AlmacenS3 — arranque y errores', () => {
  it('con crearBucket, crea el bucket que falta y después se puede usar', async () => {
    const almacen = new AlmacenS3(configuracionS3DePrueba(bucketNuevo()));
    await almacen.prepararse();
    await almacen.guardar('imagenes/2026/09/a.jpg', Buffer.from('hola mundo!!'), 'image/jpeg');
    expect(await almacen.existe('imagenes/2026/09/a.jpg')).toBe(true);
    await almacen.prepararse(); // el bucket ya existe: no falla
  });

  it('sin crearBucket y con el bucket inexistente, no arranca y dice qué revisar', async () => {
    const almacen = new AlmacenS3(
      { ...configuracionS3DePrueba(bucketNuevo()), crearBucket: false },
      1,
    );
    await expect(almacen.prepararse()).rejects.toThrow(/No existe el bucket.*S3_BUCKET/);
  });

  it('con el servidor caído, prepararse explica qué revisar', async () => {
    const almacen = new AlmacenS3(
      { ...configuracionS3DePrueba(), endpoint: 'http://127.0.0.1:1' },
      1,
    );
    await expect(almacen.prepararse()).rejects.toThrow(/No se pudo conectar con el almacén/);
  });

  it('con el servidor caído, guardar y leer tiran AlmacenNoDisponible (no ArchivoNoEncontrado)', async () => {
    const almacen = new AlmacenS3(
      { ...configuracionS3DePrueba(), endpoint: 'http://127.0.0.1:1' },
      1,
    );
    await expect(
      almacen.guardar('imagenes/2026/09/a.jpg', Buffer.from('x'), 'image/jpeg'),
    ).rejects.toBeInstanceOf(AlmacenNoDisponible);
    await expect(almacen.leer('imagenes/2026/09/a.jpg')).rejects.toBeInstanceOf(
      AlmacenNoDisponible,
    );
    await expect(almacen.existe('imagenes/2026/09/a.jpg')).rejects.toBeInstanceOf(
      AlmacenNoDisponible,
    );
  });

  it('un bucket que no existe al leer no se confunde con una clave que no existe', async () => {
    const almacen = new AlmacenS3(
      { ...configuracionS3DePrueba(bucketNuevo()), crearBucket: false },
      1,
    );
    const error = await almacen.leer('imagenes/2026/09/a.jpg').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AlmacenNoDisponible);
    expect(error).not.toBeInstanceOf(ArchivoNoEncontrado);
  });

  it('urlFirmada devuelve una URL que baja el archivo', async () => {
    const almacen = new AlmacenS3(configuracionS3DePrueba());
    await almacen.prepararse();
    await almacen.guardar('imagenes/2026/09/f.jpg', Buffer.from('contenido firmado'), 'image/jpeg');
    const url = await almacen.urlFirmada('imagenes/2026/09/f.jpg');
    expect(url).toMatch(/X-Amz-Expires=900/);
    expect(await (await fetch(url)).text()).toBe('contenido firmado');
  });
});
