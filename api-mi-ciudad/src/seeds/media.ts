import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AlmacenArchivos } from '../common/files/file-storage.js';
import { detectarTipoArchivo } from '../common/files/signatures.js';

/**
 * Los medios de las semillas (imágenes y audioguías generados por `scripts/generate-media.mjs`).
 * En desarrollo están al lado de este archivo; compilado (`dist/src/seeds`) y en Docker, en
 * `src/seeds/media` de la raíz.
 */
const CARPETAS = [
  join(import.meta.dirname, 'media'),
  join(import.meta.dirname, '../../../src/seeds/media'),
];

function carpetaDeMedios(): string {
  const carpeta = CARPETAS.find((c) => existsSync(join(c, 'museums-1.png')));
  if (!carpeta)
    throw new Error(`No encuentro los medios de las semillas (busqué en ${CARPETAS.join(' y ')}).`);
  return carpeta;
}

const CARPETA_DEL_TIPO = { imagen: 'imagenes', audio: 'audios', video: 'videos' } as const;

/**
 * Sube cada medio una sola vez por el puerto de archivos (AGENTS §17.4: así existen en
 * cualquier proveedor) y devuelve su clave.
 */
export class MediosSemilla {
  private readonly claves = new Map<string, string>();
  private readonly carpeta = carpetaDeMedios();

  constructor(
    private readonly almacen: AlmacenArchivos,
    private readonly ahora: Date,
  ) {}

  leer(archivo: string): Buffer {
    return readFileSync(join(this.carpeta, archivo));
  }

  async subir(archivo: string): Promise<string> {
    const ya = this.claves.get(archivo);
    if (ya) return ya;
    const contenido = this.leer(archivo);
    const tipo = detectarTipoArchivo(contenido);
    if (!tipo) throw new Error(`El medio ${archivo} no es de un tipo permitido.`);
    const anio = this.ahora.getUTCFullYear();
    const mes = String(this.ahora.getUTCMonth() + 1).padStart(2, '0');
    const nombre = archivo.slice(0, archivo.lastIndexOf('.'));
    const clave = `${CARPETA_DEL_TIPO[tipo.tipo]}/${anio}/${mes}/semilla-${nombre}.${tipo.extension}`;
    await this.almacen.guardar(clave, contenido, tipo.mime);
    this.claves.set(archivo, clave);
    return clave;
  }
}

const BITRATES_KBPS = {
  mpeg1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  mpeg2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
};
const FRECUENCIAS = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] } as const;

/**
 * Duración en segundos de un MP3 (capa III), recorriendo los cuadros. R20: la duración de cada
 * audioguía sembrada sale del archivo, no se escribe a mano.
 */
export function duracionMp3(mp3: Buffer): number {
  let i = 0;
  if (mp3.subarray(0, 3).toString('latin1') === 'ID3') {
    i = 10 + ((mp3[6] << 21) | (mp3[7] << 14) | (mp3[8] << 7) | mp3[9]);
  }
  let segundos = 0;
  while (i + 4 <= mp3.length) {
    const version = (mp3[i + 1] >> 3) & 0b11; // 3 = MPEG-1, 2 = MPEG-2, 0 = MPEG-2.5
    const capa = (mp3[i + 1] >> 1) & 0b11; // 1 = capa III
    if (mp3[i] !== 0xff || (mp3[i + 1] & 0xe0) !== 0xe0 || capa !== 1 || version === 1) {
      throw new Error(`Cuadro MP3 inválido en el byte ${i}`);
    }
    const kbps = (version === 3 ? BITRATES_KBPS.mpeg1 : BITRATES_KBPS.mpeg2)[mp3[i + 2] >> 4];
    const frecuencia = FRECUENCIAS[version as 0 | 2 | 3][(mp3[i + 2] >> 2) & 0b11];
    if (!kbps || !frecuencia) throw new Error(`Cuadro MP3 inválido en el byte ${i}`);
    const muestras = version === 3 ? 1152 : 576;
    const relleno = (mp3[i + 2] >> 1) & 1;
    i += Math.floor(((muestras / 8) * kbps * 1000) / frecuencia) + relleno;
    segundos += muestras / frecuencia;
  }
  return segundos;
}
