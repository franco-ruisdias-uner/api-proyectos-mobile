import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AlmacenDisco } from '../../src/common/files/local-storage.js';
import { probarContratoAlmacen } from './storage-contract.js';

probarContratoAlmacen('disco (local)', async () => {
  const directorio = mkdtempSync(join(tmpdir(), 'almacen-disco-'));
  return {
    almacen: new AlmacenDisco(directorio),
    limpiar: async () => rmSync(directorio, { recursive: true, force: true }),
  };
});

describe('AlmacenDisco — no sale de su carpeta', () => {
  it('rechaza una clave con ..', async () => {
    const directorio = mkdtempSync(join(tmpdir(), 'almacen-disco-'));
    const almacen = new AlmacenDisco(directorio);
    await expect(
      almacen.guardar('../afuera.jpg', Buffer.from('x'), 'image/jpeg'),
    ).rejects.toThrow();
    rmSync(directorio, { recursive: true, force: true });
  });
});
