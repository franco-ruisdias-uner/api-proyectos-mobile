import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AlmacenDisco } from '../../src/comun/archivos/almacen-disco.js';
import { ArchivoNoEncontrado } from '../../src/comun/archivos/almacen-archivos.js';
import { contratoDelAlmacen } from './contrato-almacen.js';

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
