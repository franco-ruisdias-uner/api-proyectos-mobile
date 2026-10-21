/** Archivos mínimos con la firma correcta de cada formato. */
export function jpeg(bytes = 1000): Buffer {
  const b = Buffer.alloc(bytes, 0x11);
  b.set([0xff, 0xd8, 0xff, 0xe0], 0);
  return b;
}

export function png(bytes = 1000): Buffer {
  const b = Buffer.alloc(bytes, 0x22);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  return b;
}

export function mp4(bytes = 1000): Buffer {
  const b = Buffer.alloc(bytes, 0x33);
  b.set([0, 0, 0, 0x20], 0);
  b.write('ftypisom', 4, 'latin1');
  return b;
}

export function m4a(bytes = 1000): Buffer {
  const b = Buffer.alloc(bytes, 0x44);
  b.set([0, 0, 0, 0x20], 0);
  b.write('ftypM4A ', 4, 'latin1');
  return b;
}

/** Bytes 0..n-1 (mod 256), para comprobar rangos. */
export function conPatron(base: Buffer): Buffer {
  for (let i = 16; i < base.length; i++) base[i] = i % 256;
  return base;
}
