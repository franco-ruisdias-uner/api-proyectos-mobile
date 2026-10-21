import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AlmacenLocal } from '../../src/common/files/local-storage.js';
import { ArchivoNoEncontrado } from '../../src/common/files/file-storage.js';
import { probarContratoDeAlmacen } from './storage-contract.js';

probarContratoDeAlmacen(
  'local',
  async () => new AlmacenLocal(await mkdtemp(join(tmpdir(), 'almacen-'))),
);

describe('AlmacenLocal — no sale de su carpeta', () => {
  it('una clave con .. no se puede leer', async () => {
    const almacen = new AlmacenLocal(await mkdtemp(join(tmpdir(), 'almacen-')));
    await expect(almacen.leer('../../etc/passwd')).rejects.toBeInstanceOf(ArchivoNoEncontrado);
    expect(await almacen.existe('../../etc/passwd')).toBe(false);
  });
});
