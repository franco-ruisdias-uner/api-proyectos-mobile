/**
 * Video de muestra de los avisos de demo. Es un contenedor MP4 mínimo generado acá (una caja
 * `ftyp` y relleno determinístico), sin derechos de terceros: pasa el chequeo de firma de la
 * API y se sirve con `Range`, pero no trae imagen que reproducir. Para una demo con imagen real,
 * se reemplaza este contenido por un clip propio (módulo M7).
 */
export const CLAVE_DEL_VIDEO_DE_DEMO = 'videos/2026/09/desvio088demo.mp4';

const BYTES_DE_RELLENO = 64 * 1024;

export function videoDeDemo(): Buffer {
  const ftyp = Buffer.alloc(24);
  ftyp.writeUInt32BE(24, 0);
  ftyp.write('ftyp', 4, 'latin1');
  ftyp.write('isom', 8, 'latin1');
  ftyp.writeUInt32BE(512, 12);
  ftyp.write('isom', 16, 'latin1');
  ftyp.write('iso2', 20, 'latin1');
  const libre = Buffer.alloc(BYTES_DE_RELLENO);
  libre.writeUInt32BE(BYTES_DE_RELLENO, 0);
  libre.write('free', 4, 'latin1');
  for (let i = 8; i < libre.length; i++) libre[i] = (i * 31) % 251;
  return Buffer.concat([ftyp, libre]);
}
