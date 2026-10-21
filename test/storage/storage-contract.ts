// AGENTS §17.4 — Suite de contrato del puerto AlmacenArchivos: la misma para todos los adaptadores.
import type { Readable } from 'node:stream';
import {
  ArchivoNoEncontrado,
  type AlmacenArchivos,
} from '../../src/common/files/file-storage.js';

async function leerTodo(flujo: Readable): Promise<Buffer> {
  const partes: Buffer[] = [];
  for await (const parte of flujo) partes.push(Buffer.from(parte as Buffer));
  return Buffer.concat(partes);
}

const numerado = (bytes: number): Buffer => {
  const b = Buffer.alloc(bytes);
  for (let i = 0; i < bytes; i++) b[i] = i % 251;
  return b;
};

let n = 0;
const clave = (ext = 'jpg', carpeta = 'imagenes') =>
  `${carpeta}/2026/09/prueba${String(++n).padStart(4, '0')}${Math.random().toString(36).slice(2, 12).padEnd(10, '0')}.${ext}`;

export function probarContratoAlmacen(
  nombre: string,
  crear: () => Promise<{
    almacen: AlmacenArchivos;
    limpiar: () => Promise<void>;
  }>,
): void {
  describe(`AGENTS §17.4 — Contrato de AlmacenArchivos: ${nombre}`, () => {
    let almacen: AlmacenArchivos;
    let limpiar: () => Promise<void>;

    beforeAll(async () => {
      ({ almacen, limpiar } = await crear());
      await almacen.prepararse();
    });
    afterAll(() => limpiar());

    it('guardar y leer devuelve los mismos bytes y el mismo tipo', async () => {
      const k = clave();
      const contenido = numerado(1000);
      await almacen.guardar(k, contenido, 'image/jpeg');
      const lectura = await almacen.leer(k);
      expect(lectura.bytesTotales).toBe(1000);
      expect(lectura.tipoMime).toBe('image/jpeg');
      expect(Buffer.compare(await leerTodo(lectura.flujo), contenido)).toBe(0);
    });

    it('un rango (bytes 10 a 19) devuelve esos 10 bytes con bytesTotales correcto', async () => {
      const k = clave();
      const contenido = numerado(1000);
      await almacen.guardar(k, contenido, 'image/jpeg');
      const lectura = await almacen.leer(k, { inicio: 10, fin: 19 });
      expect(lectura.bytesTotales).toBe(1000);
      expect(
        Buffer.compare(
          await leerTodo(lectura.flujo),
          contenido.subarray(10, 20),
        ),
      ).toBe(0);
    });

    it('el último byte', async () => {
      const k = clave('m4a', 'audios');
      const contenido = numerado(500);
      await almacen.guardar(k, contenido, 'audio/mp4');
      const lectura = await almacen.leer(k, { inicio: 499, fin: 499 });
      expect([...(await leerTodo(lectura.flujo))]).toEqual([contenido[499]]);
      expect(lectura.tipoMime).toBe('audio/mp4');
    });

    it('una clave que no existe tira ArchivoNoEncontrado', async () => {
      await expect(almacen.leer(clave())).rejects.toBeInstanceOf(
        ArchivoNoEncontrado,
      );
    });

    it('existe', async () => {
      const k = clave();
      expect(await almacen.existe(k)).toBe(false);
      await almacen.guardar(k, numerado(10), 'image/jpeg');
      expect(await almacen.existe(k)).toBe(true);
    });

    it('borrar', async () => {
      const k = clave();
      await almacen.guardar(k, numerado(10), 'image/jpeg');
      await almacen.borrar(k);
      expect(await almacen.existe(k)).toBe(false);
      await expect(almacen.leer(k)).rejects.toBeInstanceOf(ArchivoNoEncontrado);
    });

    it('claves con varias / en distintas carpetas', async () => {
      const a = clave('mp4', 'videos');
      const b = clave('png', 'imagenes');
      await almacen.guardar(a, numerado(20), 'video/mp4');
      await almacen.guardar(b, numerado(30), 'image/png');
      expect((await almacen.leer(a)).bytesTotales).toBe(20);
      expect((await almacen.leer(b)).bytesTotales).toBe(30);
    });

    it('un archivo de 5 MB', async () => {
      const k = clave();
      const contenido = numerado(5 * 1024 * 1024);
      await almacen.guardar(k, contenido, 'image/jpeg');
      const leido = await leerTodo((await almacen.leer(k)).flujo);
      expect(leido.length).toBe(contenido.length);
      expect(Buffer.compare(leido, contenido)).toBe(0);
    });
  });
}
