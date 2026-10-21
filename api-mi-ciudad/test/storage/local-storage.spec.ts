import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AlmacenDisco } from '../../src/common/files/local-storage.js';
import { contratoAlmacen } from './storage-contract.js';

let directorio: string;

contratoAlmacen(
  'local',
  async () => {
    directorio = await mkdtemp(join(tmpdir(), 'almacen-disco-'));
    const almacen = new AlmacenDisco(join(directorio, 'archivos'));
    await almacen.prepararse();
    return almacen;
  },
  () => rm(directorio, { recursive: true, force: true }),
);

describe('AGENTS §17.1 — AlmacenDisco', () => {
  it('informa el proveedor local', () => {
    expect(new AlmacenDisco('x').proveedor).toBe('local');
  });
});
