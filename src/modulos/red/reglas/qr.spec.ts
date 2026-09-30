import { codigoQrDe, paradaIdDeQr } from './qr.js';

describe('Espec. R4 — el QR de una parada es PARANA:<paradaId> (D5)', () => {
  it('arma el código', () => {
    expect(codigoQrDe('par-101')).toBe('PARANA:par-101');
  });

  it('lo vuelve a leer', () => {
    expect(paradaIdDeQr('PARANA:par-101')).toBe('par-101');
  });

  it.each([
    [''],
    ['par-101'],
    ['parana:par-101'],
    ['PARANA:'],
    ['PARANA:lin-05'],
    ['PARANA:par-101 '],
    ['PARANA:par-101\u0000'],
    ['PARANA:par-101:otro'],
    ['https://ejemplo.com/PARANA:par-101'],
    ['PARANA:par-' + 'x'.repeat(40)],
    ['PARANA:par-1/../../etc'],
  ])('no reconoce %j', (texto) => {
    expect(paradaIdDeQr(texto)).toBeNull();
  });
});
