// Genera las imágenes de muestra de las semillas (src/semillas/medios/*.png): un PNG liso de
// cada color, sin derechos de terceros. Uso: node scripts/generar-medios.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (b) => (b.reduce((c, x) => CRC[(c ^ x) & 0xff] ^ (c >>> 8), 0xffffffff) ^ 0xffffffff) >>> 0;

function trozo(tipo, datos) {
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'latin1'), datos]);
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([largo, cuerpo, crc]);
}

function png(ancho, alto, [r, g, b]) {
  const cabecera = Buffer.alloc(13);
  cabecera.writeUInt32BE(ancho, 0);
  cabecera.writeUInt32BE(alto, 4);
  cabecera.set([8, 2, 0, 0, 0], 8); // 8 bits, RGB
  const fila = Buffer.concat([Buffer.from([0]), Buffer.from(Array(ancho).fill([r, g, b]).flat())]);
  const crudo = Buffer.concat(Array(alto).fill(fila));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo('IHDR', cabecera),
    trozo('IDAT', deflateSync(crudo)),
    trozo('IEND', Buffer.alloc(0)),
  ]);
}

const COLORES = { fachada: [196, 90, 60], vidriera: [60, 120, 170], interior: [90, 150, 100] };
for (const [nombre, color] of Object.entries(COLORES)) {
  writeFileSync(join(import.meta.dirname, '../src/semillas/medios', `${nombre}.png`), png(320, 200, color));
}
