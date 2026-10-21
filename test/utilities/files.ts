/** Archivos mínimos con la firma correcta, para subir en los tests. */
export function jpeg(bytes = 1024): Buffer {
  const b = Buffer.alloc(bytes, 7);
  b.set([0xff, 0xd8, 0xff, 0xe0], 0);
  return b;
}

export function m4a(bytes = 2048): Buffer {
  const b = Buffer.alloc(bytes, 3);
  b.write('\x00\x00\x00\x20ftypM4A ', 0, 'latin1');
  return b;
}

export function mp4(bytes = 4096): Buffer {
  const b = Buffer.alloc(bytes, 5);
  b.write('\x00\x00\x00\x20ftypisom', 0, 'latin1');
  return b;
}
