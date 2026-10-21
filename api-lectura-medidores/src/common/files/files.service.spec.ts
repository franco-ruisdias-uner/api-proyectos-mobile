import { RelojFijo } from '../clock/clock.js';
import {
  AlmacenArchivos,
  ArchivoNoEncontrado,
  type LecturaArchivo,
} from './file-storage.js';
import { ArchivosServicio } from './files.service.js';

class AlmacenCaido extends AlmacenArchivos {
  readonly proveedor = 'local' as const;
  async prepararse(): Promise<void> {}
  async guardar(_clave: string): Promise<void> {
    throw new Error('ECONNREFUSED');
  }
  async leer(clave: string): Promise<LecturaArchivo> {
    if (clave.includes('noexiste')) throw new ArchivoNoEncontrado(clave);
    throw new Error('ECONNREFUSED');
  }
  async existe(): Promise<boolean> {
    return false;
  }
  async borrar(): Promise<void> {}
}

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

describe('AGENTS §17.1 — Si el proveedor de archivos no responde: 503 ALMACEN_NO_DISPONIBLE', () => {
  const servicio = new ArchivosServicio(
    new AlmacenCaido(),
    new RelojFijo('2026-09-15T08:00:00-03:00'),
  );

  it('al subir', async () => {
    await expect(servicio.subir(jpeg)).rejects.toMatchObject({
      codigo: 'ALMACEN_NO_DISPONIBLE',
      estado: 503,
    });
  });

  it('al leer', async () => {
    await expect(
      servicio.leer('imagenes/2026/09/abcdef12.jpg'),
    ).rejects.toMatchObject({ codigo: 'ALMACEN_NO_DISPONIBLE' });
  });

  it('pero un archivo que no existe sigue siendo 404 ARCHIVO_NO_ENCONTRADO', async () => {
    await expect(
      servicio.leer('imagenes/2026/09/noexiste1.jpg'),
    ).rejects.toMatchObject({ codigo: 'ARCHIVO_NO_ENCONTRADO', estado: 404 });
  });
});

describe('AGENTS §17.1 — Clave imagenes|audios|videos/AAAA/MM/<id>.<ext> con el mes de Argentina', () => {
  it('el 31/12 a las 23:30 en Chajarí todavía es diciembre', async () => {
    const guardadas: string[] = [];
    class AlmacenOk extends AlmacenCaido {
      async guardar(clave: string): Promise<void> {
        guardadas.push(clave);
      }
    }
    const s = new ArchivosServicio(
      new AlmacenOk(),
      new RelojFijo('2027-01-01T02:30:00Z'),
    );
    await s.subir(jpeg);
    expect(guardadas[0]).toMatch(/^imagenes\/2026\/12\/[a-f0-9]{24}\.jpg$/);
  });
});
