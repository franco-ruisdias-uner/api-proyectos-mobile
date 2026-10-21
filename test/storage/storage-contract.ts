import type { Readable } from 'node:stream';
import { type AlmacenArchivos, ArchivoNoEncontrado } from '../../src/common/files/file-storage.js';

async function leerTodo(flujo: Readable): Promise<Buffer> {
  const partes: Buffer[] = [];
  for await (const parte of flujo) partes.push(Buffer.from(parte as Buffer));
  return Buffer.concat(partes);
}

/**
 * AGENTS §17.4 — La misma suite para todos los adaptadores del puerto `AlmacenArchivos`.
 * `crear` devuelve un almacén vacío y ya preparado.
 */
export function contratoAlmacen(
  nombre: string,
  crear: () => Promise<AlmacenArchivos>,
  limpiar?: () => Promise<void>,
): void {
  describe(`AGENTS §17.4 — Contrato del puerto AlmacenArchivos (${nombre})`, () => {
    let almacen: AlmacenArchivos;
    const contenido = Buffer.from(Array.from({ length: 100 }, (_, i) => i));

    beforeAll(async () => {
      almacen = await crear();
    });
    afterAll(async () => {
      await limpiar?.();
    });

    it('guardar y leer devuelve los mismos bytes y el mismo tipo', async () => {
      await almacen.guardar('imagenes/2026/11/prueba00001.png', contenido, 'image/png');
      const lectura = await almacen.leer('imagenes/2026/11/prueba00001.png');
      expect(Buffer.compare(await leerTodo(lectura.flujo), contenido)).toBe(0);
      expect(lectura.bytesTotales).toBe(100);
      expect(lectura.tipoMime).toBe('image/png');
    });

    it('un rango (bytes 10 a 19) devuelve esos 10 bytes con bytesTotales correcto', async () => {
      await almacen.guardar('audios/2026/11/prueba00002.m4a', contenido, 'audio/mp4');
      const lectura = await almacen.leer('audios/2026/11/prueba00002.m4a', { inicio: 10, fin: 19 });
      expect([...(await leerTodo(lectura.flujo))]).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
      expect(lectura.bytesTotales).toBe(100);
    });

    it('el último byte', async () => {
      await almacen.guardar('audios/2026/11/prueba00003.m4a', contenido, 'audio/mp4');
      const lectura = await almacen.leer('audios/2026/11/prueba00003.m4a', { inicio: 99, fin: 99 });
      expect([...(await leerTodo(lectura.flujo))]).toEqual([99]);
    });

    it('una clave que no existe tira ArchivoNoEncontrado', async () => {
      await expect(almacen.leer('imagenes/2026/11/noexiste0000.png')).rejects.toBeInstanceOf(
        ArchivoNoEncontrado,
      );
      await expect(almacen.describir('imagenes/2026/11/noexiste0000.png')).rejects.toBeInstanceOf(
        ArchivoNoEncontrado,
      );
    });

    it('existe y borrar', async () => {
      const clave = 'videos/2026/11/prueba00004.mp4';
      expect(await almacen.existe(clave)).toBe(false);
      await almacen.guardar(clave, contenido, 'video/mp4');
      expect(await almacen.existe(clave)).toBe(true);
      await almacen.borrar(clave);
      expect(await almacen.existe(clave)).toBe(false);
      await almacen.borrar(clave); // borrar algo que no está no falla
    });

    it('claves con varias /', async () => {
      const clave = 'imagenes/2027/01/otra0000005.webp';
      await almacen.guardar(clave, contenido, 'image/webp');
      expect((await almacen.describir(clave)).bytesTotales).toBe(100);
    });

    it('un archivo de 5 MB', async () => {
      const grande = Buffer.alloc(5 * 1024 * 1024, 9);
      grande[grande.length - 1] = 1;
      await almacen.guardar('imagenes/2026/11/grande00006.jpg', grande, 'image/jpeg');
      const lectura = await almacen.leer('imagenes/2026/11/grande00006.jpg');
      const leido = await leerTodo(lectura.flujo);
      expect(leido.length).toBe(grande.length);
      expect(leido[leido.length - 1]).toBe(1);
    });
  });
}
