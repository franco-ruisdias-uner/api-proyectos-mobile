import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AlmacenLocal } from '../../src/common/files/local-storage.js';
import { ArchivoNoEncontrado } from '../../src/common/files/file-storage.js';
import { contratoAlmacen } from './storage-contract.js';

let carpeta: string;
afterAll(async () => {
  if (carpeta) await rm(carpeta, { recursive: true, force: true });
});

contratoAlmacen('local (disco)', async () => {
  carpeta = await mkdtemp(join(tmpdir(), 'almacen-'));
  return new AlmacenLocal(carpeta);
});

describe('AlmacenLocal — no sale de su carpeta', () => {
  it('una clave con .. no lee fuera de la raíz', async () => {
    const raiz = await mkdtemp(join(tmpdir(), 'almacen-'));
    const almacen = new AlmacenLocal(join(raiz, 'adentro'));
    await almacen.prepararse();
    await expect(almacen.leer('../../etc/passwd')).rejects.toBeInstanceOf(ArchivoNoEncontrado);
    await rm(raiz, { recursive: true, force: true });
  });
});
