// Suite de contrato del puerto AlmacenArchivos (AGENTS §17.4): la misma para todos los
// adaptadores. Cada adaptador la corre con su propia fábrica.
import { randomBytes } from 'node:crypto';
import type { Readable } from 'node:stream';
import {
  type AlmacenArchivos,
  ArchivoNoEncontrado,
} from '../../src/comun/archivos/almacen-archivos.js';

async function leerTodo(flujo: Readable): Promise<Buffer> {
  const partes: Buffer[] = [];
  for await (const parte of flujo) partes.push(Buffer.from(parte as Uint8Array));
  return Buffer.concat(partes);
}

let contador = 0;
const claveNueva = (extension = 'jpg') =>
  `imagenes/2026/09/prueba${Date.parse('2026-09-01') + ++contador}${randomBytes(4).toString('hex')}.${extension}`;

export function probarContratoDeAlmacen(
  nombre: string,
  crear: () => Promise<AlmacenArchivos>,
): void {
  describe(`AGENTS §17.4 — contrato del almacén de archivos (${nombre})`, () => {
    let almacen: AlmacenArchivos;

    beforeAll(async () => {
      almacen = await crear();
      await almacen.prepararse();
    });

    it('guardar y leer devuelve los mismos bytes y el mismo tipo', async () => {
      const clave = claveNueva('png');
      const contenido = randomBytes(1000);
      await almacen.guardar(clave, contenido, 'image/png');
      const lectura = await almacen.leer(clave);
      expect(lectura.bytesTotales).toBe(1000);
      expect(lectura.tipoMime).toBe('image/png');
      expect((await leerTodo(lectura.flujo)).equals(contenido)).toBe(true);
    });

    it('un rango (bytes 10 a 19) devuelve esos 10 bytes con el total correcto', async () => {
      const clave = claveNueva();
      const contenido = randomBytes(100);
      await almacen.guardar(clave, contenido, 'image/jpeg');
      const lectura = await almacen.leer(clave, { inicio: 10, fin: 19 });
      expect(lectura.bytesTotales).toBe(100);
      expect((await leerTodo(lectura.flujo)).equals(contenido.subarray(10, 20))).toBe(true);
    });

    it('el último byte', async () => {
      const clave = claveNueva();
      const contenido = randomBytes(50);
      await almacen.guardar(clave, contenido, 'image/jpeg');
      const lectura = await almacen.leer(clave, { inicio: 49, fin: 49 });
      expect([...(await leerTodo(lectura.flujo))]).toEqual([contenido[49]]);
    });

    it('una clave que no existe tira ArchivoNoEncontrado', async () => {
      await expect(almacen.leer(claveNueva())).rejects.toBeInstanceOf(ArchivoNoEncontrado);
    });

    it('existe', async () => {
      const clave = claveNueva();
      expect(await almacen.existe(clave)).toBe(false);
      await almacen.guardar(clave, Buffer.from('x'), 'image/jpeg');
      expect(await almacen.existe(clave)).toBe(true);
    });

    it('borrar', async () => {
      const clave = claveNueva();
      await almacen.guardar(clave, Buffer.from('x'), 'image/jpeg');
      await almacen.borrar(clave);
      expect(await almacen.existe(clave)).toBe(false);
      await expect(almacen.leer(clave)).rejects.toBeInstanceOf(ArchivoNoEncontrado);
    });

    it('claves con varias /', async () => {
      const clave = `videos/2026/12/a/b/c/${randomBytes(8).toString('hex')}.mp4`;
      await almacen.guardar(clave, Buffer.from('video'), 'video/mp4');
      const lectura = await almacen.leer(clave);
      expect(lectura.tipoMime).toBe('video/mp4');
      expect((await leerTodo(lectura.flujo)).toString()).toBe('video');
    });

    it('un archivo de 5 MB', async () => {
      const clave = claveNueva();
      const contenido = randomBytes(5 * 1024 * 1024);
      await almacen.guardar(clave, contenido, 'image/jpeg');
      const lectura = await almacen.leer(clave);
      expect(lectura.bytesTotales).toBe(contenido.length);
      expect((await leerTodo(lectura.flujo)).equals(contenido)).toBe(true);
    });
  });
}
