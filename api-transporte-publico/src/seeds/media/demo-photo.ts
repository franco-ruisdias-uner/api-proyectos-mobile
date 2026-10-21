import { crc32, deflateSync } from 'node:zlib';

/**
 * Foto de muestra de un reporte de demora: un PNG válido de 160×90 generado acá (un degradé
 * celeste), sin derechos de terceros. Se sube por el puerto de archivos al sembrar.
 */
export const CLAVE_DE_LA_FOTO_DE_DEMO = 'imagenes/2026/09/demora3394demo.png';

const ANCHO = 160;
const ALTO = 90;

function trozo(tipo: string, datos: Buffer): Buffer {
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'latin1'), datos]);
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const control = Buffer.alloc(4);
  control.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([largo, cuerpo, control]);
}

export function fotoDeDemo(): Buffer {
  const cabecera = Buffer.alloc(13);
  cabecera.writeUInt32BE(ANCHO, 0);
  cabecera.writeUInt32BE(ALTO, 4);
  cabecera[8] = 8; // bits por canal
  cabecera[9] = 2; // color RGB
  const filas = Buffer.alloc((ANCHO * 3 + 1) * ALTO);
  for (let y = 0; y < ALTO; y++) {
    const inicio = y * (ANCHO * 3 + 1); // el primer byte de cada fila es el filtro (0)
    for (let x = 0; x < ANCHO; x++) {
      filas[inicio + 1 + x * 3] = 40 + Math.floor((x * 80) / ANCHO);
      filas[inicio + 2 + x * 3] = 120 + Math.floor((y * 90) / ALTO);
      filas[inicio + 3 + x * 3] = 200;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo('IHDR', cabecera),
    trozo('IDAT', deflateSync(filas)),
    trozo('IEND', Buffer.alloc(0)),
  ]);
}
