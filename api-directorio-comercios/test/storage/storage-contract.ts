import type { Readable } from 'node:stream';
import { type AlmacenArchivos, ArchivoNoEncontrado } from '../../src/common/files/file-storage.js';

async function leerTodo(flujo: Readable): Promise<Buffer> {
  const partes: Buffer[] = [];
  for await (const parte of flujo) partes.push(Buffer.from(parte as Buffer));
  return Buffer.concat(partes);
}

/**
 * Suite de contrato del puerto AlmacenArchivos (AGENTS §17.4). Es la misma para todos los
 * adaptadores: si un adaptador nuevo la pasa, el resto de la API no se entera del cambio.
 */
export function contratoAlmacen(nombre: string, crear: () => Promise<AlmacenArchivos>) {
  describe(`AGENTS §17.4 — Contrato del almacén de archivos: ${nombre}`, () => {
    let almacen: AlmacenArchivos;
    const contenido = Buffer.from(Array.from({ length: 100 }, (_, i) => i));
    const clave = (n: string) => `imagenes/2026/10/${n.padEnd(16, '0')}.jpg`;

    beforeAll(async () => {
      almacen = await crear();
      await almacen.prepararse();
    });

    it('guardar y leer devuelve los mismos bytes y el tipo', async () => {
      await almacen.guardar(clave('a'), contenido, 'image/jpeg');
      const lectura = await almacen.leer(clave('a'));
      expect(await leerTodo(lectura.flujo)).toEqual(contenido);
      expect(lectura.bytesTotales).toBe(100);
      expect(lectura.tipoMime).toBe('image/jpeg');
    });

    it('un rango (bytes 10 a 19) devuelve esos 10 bytes con el total correcto', async () => {
      await almacen.guardar(clave('b'), contenido, 'image/jpeg');
      const lectura = await almacen.leer(clave('b'), { inicio: 10, fin: 19 });
      const bytes = await leerTodo(lectura.flujo);
      expect(bytes.length).toBe(10);
      expect([...bytes]).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
      expect(lectura.bytesTotales).toBe(100);
    });

    it('el último byte', async () => {
      await almacen.guardar(clave('c'), contenido, 'image/jpeg');
      const lectura = await almacen.leer(clave('c'), { inicio: 99, fin: 99 });
      expect([...(await leerTodo(lectura.flujo))]).toEqual([99]);
    });

    it('una clave que no existe tira ArchivoNoEncontrado', async () => {
      await expect(almacen.leer(clave('noexiste'))).rejects.toBeInstanceOf(ArchivoNoEncontrado);
    });

    it('existe y borrar', async () => {
      await almacen.guardar(clave('d'), contenido, 'image/jpeg');
      expect(await almacen.existe(clave('d'))).toBe(true);
      await almacen.borrar(clave('d'));
      expect(await almacen.existe(clave('d'))).toBe(false);
      await expect(almacen.leer(clave('d'))).rejects.toBeInstanceOf(ArchivoNoEncontrado);
    });

    it('claves con varias barras conviven', async () => {
      const otra = 'videos/2027/01/zzzzzzzzzzzzzzzz.mp4';
      await almacen.guardar(otra, Buffer.from('video'), 'video/mp4');
      await almacen.guardar(clave('e'), Buffer.from('foto'), 'image/jpeg');
      expect((await leerTodo((await almacen.leer(otra)).flujo)).toString()).toBe('video');
      expect((await almacen.leer(otra)).tipoMime).toBe('video/mp4');
      expect((await leerTodo((await almacen.leer(clave('e'))).flujo)).toString()).toBe('foto');
    });

    it('un archivo de 5 MB', async () => {
      const grande = Buffer.alloc(5 * 1024 * 1024, 7);
      await almacen.guardar(clave('f'), grande, 'image/jpeg');
      const lectura = await almacen.leer(clave('f'));
      expect(lectura.bytesTotales).toBe(grande.length);
      expect((await leerTodo(lectura.flujo)).equals(grande)).toBe(true);
    });
  });
}
