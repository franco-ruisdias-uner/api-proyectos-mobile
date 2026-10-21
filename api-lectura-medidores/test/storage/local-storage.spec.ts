import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AlmacenDisco } from '../../src/common/files/local-storage.js';
import { ArchivoNoEncontrado } from '../../src/common/files/file-storage.js';
import { contratoDelAlmacen } from './storage-contract.js';

contratoDelAlmacen(
  'local (disco)',
  async () => new AlmacenDisco(mkdtempSync(join(tmpdir(), 'almacen-disco-'))),
);

describe('AlmacenDisco — no sale de su carpeta', () => {
  it('una clave con ".." no lee fuera del directorio', async () => {
    const almacen = new AlmacenDisco(
      mkdtempSync(join(tmpdir(), 'almacen-disco-')),
    );
    await expect(almacen.leer('../../etc/passwd')).rejects.toBeInstanceOf(
      ArchivoNoEncontrado,
    );
  });
});
