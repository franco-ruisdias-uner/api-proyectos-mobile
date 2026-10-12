import { randomBytes } from 'node:crypto';
import type { Readable } from 'node:stream';
import {
  type AlmacenArchivos,
  ArchivoNoEncontrado,
} from '../../src/comun/archivos/almacen-archivos.js';

async function leerTodo(flujo: Readable): Promise<Buffer> {
  const partes: Buffer[] = [];
  for await (const parte of flujo) partes.push(parte as Buffer);
  return Buffer.concat(partes);
}

/** La misma suite para todos los adaptadores del puerto (AGENTS §17.4). */
export function contratoDelAlmacen(
  nombre: string,
  crear: () => Promise<AlmacenArchivos>,
): void {
  describe(`AGENTS §17.4 — Contrato del almacén de archivos: ${nombre}`, () => {
    let almacen: AlmacenArchivos;
    const contenido = Buffer.from(Array.from({ length: 100 }, (_, i) => i));

    beforeAll(async () => {
      almacen = await crear();
      await almacen.prepararse();
    });

    it('guardar y leer devuelve los mismos bytes y el mismo tipo', async () => {
      await almacen.guardar(
        'imagenes/2026/09/aaaa1111.jpg',
        contenido,
        'image/jpeg',
      );
      const lectura = await almacen.leer('imagenes/2026/09/aaaa1111.jpg');
      expect(await leerTodo(lectura.flujo)).toEqual(contenido);
      expect(lectura.bytesTotales).toBe(100);
      expect(lectura.tipoMime).toBe('image/jpeg');
    });

    it('un rango (bytes 10 a 19) devuelve esos 10 bytes y el total', async () => {
      await almacen.guardar(
        'audios/2026/09/bbbb2222.m4a',
        contenido,
        'audio/mp4',
      );
      const lectura = await almacen.leer('audios/2026/09/bbbb2222.m4a', {
        inicio: 10,
        fin: 19,
      });
      expect(await leerTodo(lectura.flujo)).toEqual(contenido.subarray(10, 20));
      expect(lectura.bytesTotales).toBe(100);
    });

    it('el último byte', async () => {
      await almacen.guardar(
        'videos/2026/09/cccc3333.mp4',
        contenido,
        'video/mp4',
      );
      const lectura = await almacen.leer('videos/2026/09/cccc3333.mp4', {
        inicio: 99,
        fin: 99,
      });
      expect(await leerTodo(lectura.flujo)).toEqual(Buffer.from([99]));
    });

    it('una clave que no existe tira ArchivoNoEncontrado', async () => {
      await expect(
        almacen.leer('imagenes/2026/09/noexiste.jpg'),
      ).rejects.toBeInstanceOf(ArchivoNoEncontrado);
    });

    it('existe y borrar', async () => {
      await almacen.guardar(
        'imagenes/2026/09/dddd4444.png',
        contenido,
        'image/png',
      );
      expect(await almacen.existe('imagenes/2026/09/dddd4444.png')).toBe(true);
      await almacen.borrar('imagenes/2026/09/dddd4444.png');
      expect(await almacen.existe('imagenes/2026/09/dddd4444.png')).toBe(false);
      expect(await almacen.existe('imagenes/2026/09/nunca.png')).toBe(false);
    });

    it('claves con varias barras', async () => {
      await almacen.guardar(
        'imagenes/2027/01/eeee5555.webp',
        contenido,
        'image/webp',
      );
      expect(await almacen.existe('imagenes/2027/01/eeee5555.webp')).toBe(true);
    });

    it('un archivo de 5 MB', async () => {
      const grande = randomBytes(5 * 1024 * 1024);
      await almacen.guardar(
        'imagenes/2026/09/ffff6666.jpg',
        grande,
        'image/jpeg',
      );
      const lectura = await almacen.leer('imagenes/2026/09/ffff6666.jpg');
      expect((await leerTodo(lectura.flujo)).equals(grande)).toBe(true);
      expect(lectura.bytesTotales).toBe(grande.length);
    });
  });
}
