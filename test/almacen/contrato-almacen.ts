// Suite de contrato del puerto AlmacenArchivos (AGENTS §17.4): la misma para todos
// los adaptadores.
import type { Readable } from 'node:stream';
import {
  type AlmacenArchivos,
  ArchivoNoEncontrado,
} from '../../src/comun/archivos/almacen-archivos.js';

async function leerTodo(flujo: Readable): Promise<Buffer> {
  const partes: Buffer[] = [];
  for await (const parte of flujo) partes.push(Buffer.from(parte as Buffer));
  return Buffer.concat(partes);
}

export function contratoAlmacen(
  nombre: string,
  crear: () => Promise<{
    almacen: AlmacenArchivos;
    cerrar: () => Promise<void>;
  }>,
): void {
  describe(`AGENTS §17.4 — Contrato del almacén de archivos: ${nombre}`, () => {
    let almacen: AlmacenArchivos;
    let cerrar: () => Promise<void>;
    const contenido = Buffer.from(Array.from({ length: 100 }, (_, i) => i));

    beforeAll(async () => {
      ({ almacen, cerrar } = await crear());
      await almacen.prepararse();
    });
    afterAll(() => cerrar());

    it('guardar y leer devuelve los mismos bytes y el mismo tipo', async () => {
      await almacen.guardar(
        'imagenes/2026/09/entero.jpg',
        contenido,
        'image/jpeg',
      );
      const l = await almacen.leer('imagenes/2026/09/entero.jpg');
      expect(await leerTodo(l.flujo)).toEqual(contenido);
      expect(l.bytesTotales).toBe(100);
      expect(l.tipoMime).toBe('image/jpeg');
    });

    it('un rango (bytes 10 a 19) devuelve esos 10 bytes y el total correcto', async () => {
      await almacen.guardar('audios/2026/09/rango.m4a', contenido, 'audio/mp4');
      const l = await almacen.leer('audios/2026/09/rango.m4a', {
        inicio: 10,
        fin: 19,
      });
      expect(await leerTodo(l.flujo)).toEqual(contenido.subarray(10, 20));
      expect(l.bytesTotales).toBe(100);
    });

    it('el último byte', async () => {
      await almacen.guardar(
        'videos/2026/09/ultimo.mp4',
        contenido,
        'video/mp4',
      );
      const l = await almacen.leer('videos/2026/09/ultimo.mp4', {
        inicio: 99,
        fin: 99,
      });
      expect(await leerTodo(l.flujo)).toEqual(Buffer.from([99]));
    });

    it('una clave que no existe tira ArchivoNoEncontrado', async () => {
      await expect(
        almacen.leer('imagenes/2026/09/no-existe.jpg'),
      ).rejects.toBeInstanceOf(ArchivoNoEncontrado);
    });

    it('existe y borrar', async () => {
      await almacen.guardar(
        'imagenes/2026/09/borrar.png',
        contenido,
        'image/png',
      );
      expect(await almacen.existe('imagenes/2026/09/borrar.png')).toBe(true);
      await almacen.borrar('imagenes/2026/09/borrar.png');
      expect(await almacen.existe('imagenes/2026/09/borrar.png')).toBe(false);
      await expect(
        almacen.leer('imagenes/2026/09/borrar.png'),
      ).rejects.toBeInstanceOf(ArchivoNoEncontrado);
    });

    it('claves con varias barras', async () => {
      await almacen.guardar('a/b/c/d/e.jpg', contenido, 'image/jpeg');
      expect(await almacen.existe('a/b/c/d/e.jpg')).toBe(true);
    });

    it('un archivo de 5 MB', async () => {
      const grande = Buffer.alloc(5 * 1024 * 1024, 7);
      await almacen.guardar(
        'imagenes/2026/09/grande.jpg',
        grande,
        'image/jpeg',
      );
      const l = await almacen.leer('imagenes/2026/09/grande.jpg');
      expect((await leerTodo(l.flujo)).equals(grande)).toBe(true);
    });
  });
}
