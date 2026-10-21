// Genera los medios de las semillas (src/seeds/media/): imágenes PNG y audioguías MP3.
// Son generados por código, sin material de terceros. Sin dependencias: sólo Node.
//   node scripts/generate-media.mjs
// Los archivos quedan versionados; este script es para rehacerlos si cambia la lista.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';

const DESTINO = join(import.meta.dirname, '..', 'src', 'seeds', 'media');

/** Imágenes: dos por categoría, con su color. */
const IMAGENES = {
  beaches: [0x2e, 0x86, 0xc1],
  'hot-springs': [0x16, 0xa0, 0x85],
  museums: [0x8e, 0x5a, 0x4a],
  gastronomy: [0xd3, 0x54, 0x00],
  crafts: [0x8e, 0x44, 0xad],
  nature: [0x27, 0xae, 0x60],
  lodging: [0x34, 0x49, 0x5e],
};

/** Audioguías (PRD §6): duración en segundos, de 3 a 5 minutos. La del molino es la del PRD. */
const AUDIOGUIAS = {
  mill: 252,
  'culture-house': 198,
  'old-port': 225,
  church: 184,
  'san-jose-palace': 296,
  'san-jose-museum': 241,
  palmar: 287,
  'interpretation-center': 213,
};

// ── PNG ──────────────────────────────────────────────────────────────────────
function bloque(tipo, datos) {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'latin1'), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([largo, cuerpo, crc]);
}

/** 480×320: degradé del color de la categoría, con un sol (variante 1) o un río (variante 2). */
function png([r, g, b], variante) {
  const ancho = 480;
  const alto = 320;
  const filas = [];
  for (let y = 0; y < alto; y++) {
    const fila = Buffer.alloc(1 + ancho * 3);
    for (let x = 0; x < ancho; x++) {
      const luz = 1.25 - (y / alto) * 0.6;
      let [pr, pg, pb] = [r * luz, g * luz, b * luz];
      const sol = variante === 1 && (x - 360) ** 2 + (y - 90) ** 2 < 45 ** 2;
      const rio = variante === 2 && Math.abs(y - (230 + 18 * Math.sin(x / 40))) < 14;
      if (sol) [pr, pg, pb] = [250, 215, 90];
      if (rio) [pr, pg, pb] = [200, 225, 240];
      const i = 1 + x * 3;
      fila[i] = Math.min(255, pr);
      fila[i + 1] = Math.min(255, pg);
      fila[i + 2] = Math.min(255, pb);
    }
    filas.push(fila);
  }
  const cabecera = Buffer.alloc(13);
  cabecera.writeUInt32BE(ancho, 0);
  cabecera.writeUInt32BE(alto, 4);
  cabecera[8] = 8; // bits por canal
  cabecera[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloque('IHDR', cabecera),
    bloque('IDAT', deflateSync(Buffer.concat(filas), { level: 9 })),
    bloque('IEND', Buffer.alloc(0)),
  ]);
}

// ── MP3 ──────────────────────────────────────────────────────────────────────
// Silencio en MPEG-2 capa III, mono, 16 kHz, 8 kbps: cada cuadro son 576 muestras (36 ms) en
// 36 bytes (cabecera FF F3 18 C0 y el resto en cero, que se decodifica como silencio).
const CUADRO = Buffer.concat([Buffer.from([0xff, 0xf3, 0x18, 0xc0]), Buffer.alloc(32)]);
const SEGUNDOS_POR_CUADRO = 576 / 16000;

function mp3(segundos) {
  const cuadros = Math.round(segundos / SEGUNDOS_POR_CUADRO);
  return Buffer.concat(Array.from({ length: cuadros }, () => CUADRO));
}

mkdirSync(DESTINO, { recursive: true });
for (const [nombre, color] of Object.entries(IMAGENES)) {
  for (const variante of [1, 2]) writeFileSync(join(DESTINO, `${nombre}-${variante}.png`), png(color, variante));
}
for (const [nombre, segundos] of Object.entries(AUDIOGUIAS)) {
  writeFileSync(join(DESTINO, `audio-guide-${nombre}.mp3`), mp3(segundos));
}
console.log(`Medios generados en ${DESTINO}`);
