// Medios de muestra generados por código (sin derechos de terceros, sin archivos en el repo):
// fotos PNG de colores y un audio MP3 de silencio. Se suben por el puerto AlmacenArchivos.
import { crc32, deflateSync } from 'node:zlib';

const FIRMA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function trozo(tipo: string, datos: Buffer): Buffer {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'latin1'), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([largo, cuerpo, crc]);
}

/** Foto de muestra: degradé del color dado, con una banda diagonal clara. 96×72 px. */
export function fotoDeMuestra(color: [number, number, number]): Buffer {
  const ancho = 96;
  const alto = 72;
  const filas: Buffer[] = [];
  for (let y = 0; y < alto; y++) {
    const fila = Buffer.alloc(1 + ancho * 3); // filtro 0 + RGB
    for (let x = 0; x < ancho; x++) {
      const banda = Math.abs(x - y * (ancho / alto) - ancho / 3) < 6;
      const luz = banda ? 1.6 : 0.6 + (0.6 * y) / alto;
      for (let c = 0; c < 3; c++) {
        fila[1 + x * 3 + c] = Math.min(255, Math.round(color[c] * luz));
      }
    }
    filas.push(fila);
  }
  const cabecera = Buffer.alloc(13);
  cabecera.writeUInt32BE(ancho, 0);
  cabecera.writeUInt32BE(alto, 4);
  cabecera[8] = 8; // bits por canal
  cabecera[9] = 2; // RGB
  return Buffer.concat([
    FIRMA_PNG,
    trozo('IHDR', cabecera),
    trozo('IDAT', deflateSync(Buffer.concat(filas))),
    trozo('IEND', Buffer.alloc(0)),
  ]);
}

/** Un segundo de silencio en MPEG-1 Layer III (128 kbps, 44,1 kHz): 39 tramas de 417 bytes. */
export function audioDeMuestra(): Buffer {
  const trama = Buffer.alloc(417);
  trama.set([0xff, 0xfb, 0x90, 0x00]);
  return Buffer.concat(Array.from({ length: 39 }, () => trama));
}
