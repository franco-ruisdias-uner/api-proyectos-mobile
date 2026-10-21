// Contenidos mínimos con la firma correcta de cada tipo de archivo.
export const JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
  Buffer.from('JFIF', 'latin1'),
  Buffer.alloc(200, 7),
]);

export const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(100, 3),
]);

export const M4A = Buffer.concat([
  Buffer.from([0, 0, 0, 0x20]),
  Buffer.from('ftypM4A ', 'latin1'),
  Buffer.alloc(300, 1),
]);

export const MP4 = Buffer.concat([
  Buffer.from([0, 0, 0, 0x20]),
  Buffer.from('ftypisom', 'latin1'),
  Buffer.alloc(300, 2),
]);

export const PDF = Buffer.concat([
  Buffer.from('%PDF-1.7\n', 'latin1'),
  Buffer.alloc(100, 5),
]);

/** Un JPEG de `bytes` bytes (con la firma correcta). */
export const jpegDe = (bytes: number): Buffer =>
  Buffer.concat([
    JPEG.subarray(0, 10),
    Buffer.alloc(Math.max(0, bytes - 10), 9),
  ]);

/** Contenido con bytes distintos en cada posición, para probar rangos. */
export const jpegNumerado = (bytes: number): Buffer => {
  const b = Buffer.alloc(bytes);
  for (let i = 0; i < bytes; i++) b[i] = i % 251;
  JPEG.copy(b, 0, 0, 4);
  return b;
};
