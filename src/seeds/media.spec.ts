import { duracionMp3 } from './media.js';

describe('R20 — Duración de un MP3 leída del archivo', () => {
  const cuadro = Buffer.concat([Buffer.from([0xff, 0xf3, 0x18, 0xc0]), Buffer.alloc(32)]); // MPEG-2, 16 kHz, 8 kbps

  it('suma 36 ms por cuadro', () => {
    expect(duracionMp3(Buffer.concat(Array.from({ length: 7000 }, () => cuadro)))).toBeCloseTo(252, 6);
  });

  it('saltea la etiqueta ID3 del principio', () => {
    const id3 = Buffer.concat([
      Buffer.from('ID3', 'latin1'),
      Buffer.from([3, 0, 0, 0, 0, 0, 5]),
      Buffer.alloc(5),
    ]);
    expect(duracionMp3(Buffer.concat([id3, cuadro, cuadro]))).toBeCloseTo(0.072, 6);
  });

  it('un archivo que no es MP3 es un error', () => {
    expect(() => duracionMp3(Buffer.from('no es un mp3'))).toThrow();
  });
});
