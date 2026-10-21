import { randomBytes } from 'node:crypto';

/** Contenidos mínimos con la firma correcta de cada formato. */
export function jpeg(bytes = 1024): Buffer {
  const b = randomBytes(bytes);
  b[0] = 0xff;
  b[1] = 0xd8;
  b[2] = 0xff;
  b[3] = 0xe0;
  return b;
}

export function png(bytes = 1024): Buffer {
  const b = randomBytes(bytes);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b);
  return b;
}

function ftyp(marca: string, bytes: number): Buffer {
  const b = randomBytes(bytes);
  b.writeUInt32BE(24, 0);
  b.write('ftyp', 4, 'latin1');
  b.write(marca, 8, 'latin1');
  return b;
}

export const mp4 = (bytes = 2048) => ftyp('isom', bytes);
export const m4a = (bytes = 2048) => ftyp('M4A ', bytes);

export function mp3(bytes = 2048): Buffer {
  const b = randomBytes(bytes);
  b.write('ID3', 0, 'latin1');
  return b;
}
