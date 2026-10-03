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

// Video de muestra: un contenedor MP4 mínimo y válido por dentro (ftyp + moov/mvhd + mdat), sin
// pistas de imagen ni de sonido. Sirve para probar la URL, el tipo y los rangos; no se reproduce.
function caja(tipo, ...partes) {
  const cuerpo = Buffer.concat(partes);
  const cabecera = Buffer.alloc(8);
  cabecera.writeUInt32BE(cuerpo.length + 8);
  cabecera.write(tipo, 4, 'latin1');
  return Buffer.concat([cabecera, cuerpo]);
}
const mvhd = Buffer.alloc(100);
mvhd.writeUInt32BE(1000, 12); // timescale
mvhd.writeUInt32BE(3000, 16); // duración: 3 s
mvhd.writeUInt32BE(0x00010000, 20); // velocidad 1.0
mvhd.writeUInt16BE(0x0100, 24); // volumen 1.0
mvhd.writeUInt32BE(0x00010000, 36); // matriz identidad
mvhd.writeUInt32BE(0x00010000, 52);
mvhd.writeUInt32BE(0x40000000, 68);
mvhd.writeUInt32BE(2, 96); // próximo id de pista
const ftyp = caja('ftyp', Buffer.from('isom'), Buffer.from([0, 0, 2, 0]), Buffer.from('isomiso2mp41'));
const mp4 = Buffer.concat([ftyp, caja('moov', caja('mvhd', mvhd)), caja('mdat', Buffer.alloc(2048))]);
writeFileSync(join(import.meta.dirname, '../src/semillas/medios', 'muestra.mp4'), mp4);
