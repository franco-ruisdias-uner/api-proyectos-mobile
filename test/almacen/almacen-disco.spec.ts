import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ArchivoNoEncontrado } from '../../src/comun/archivos/almacen-archivos.js';
import { AlmacenDisco } from '../../src/comun/archivos/almacen-disco.js';
import { contratoAlmacen } from './contrato-almacen.js';

contratoAlmacen('local (disco)', () => {
  const directorio = mkdtempSync(join(tmpdir(), 'almacen-'));
  return Promise.resolve({
    almacen: new AlmacenDisco(directorio),
    cerrar: () =>
      Promise.resolve(rmSync(directorio, { recursive: true, force: true })),
  });
});

describe('Almacén en disco — no deja salir de su carpeta', () => {
  it('una clave con ../ no existe', async () => {
    const directorio = mkdtempSync(join(tmpdir(), 'almacen-'));
    const almacen = new AlmacenDisco(directorio);
    await expect(almacen.leer('../../etc/passwd')).rejects.toBeInstanceOf(
      ArchivoNoEncontrado,
    );
    rmSync(directorio, { recursive: true, force: true });
  });
});
