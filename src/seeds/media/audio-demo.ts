// Nota de voz de demo: un contenedor M4A mínimo (ftyp «M4A » + mdat con relleno determinístico de
// unos 8 KB), generado acá y sin derechos de terceros. Sirve para probar la subida, el `Range` y la
// URL de `audioUri`; no tiene sonido reproducible. La cátedra puede reemplazarla por una real.

const TAMANO_RELLENO = 8 * 1024;

export function notaDeVozDeDemo(): Buffer {
  const ftyp = Buffer.alloc(24);
  ftyp.writeUInt32BE(24, 0);
  ftyp.write('ftyp', 4, 'latin1');
  ftyp.write('M4A ', 8, 'latin1');
  ftyp.write('M4A mp42isom', 12, 'latin1');
  const cabecera = Buffer.alloc(8);
  cabecera.writeUInt32BE(8 + TAMANO_RELLENO, 0);
  cabecera.write('mdat', 4, 'latin1');
  const relleno = Buffer.alloc(TAMANO_RELLENO);
  for (let i = 0; i < relleno.length; i++) relleno[i] = (i * 31 + 7) % 251;
  return Buffer.concat([ftyp, cabecera, relleno]);
}
