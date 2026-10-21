import { codigoQrDe, leerCodigoQr } from './qr.js';

describe('D5 — El QR de un lugar es «COLON:<lugarId>»', () => {
  it('arma el código', () => {
    expect(codigoQrDe('lug-004')).toBe('COLON:lug-004');
  });

  it.each([
    ['COLON:lug-004', 'lug-004'],
    ['  COLON:lug-004\n', 'lug-004'],
    ['COLON:lug-a1b2c3d4e5f6', 'lug-a1b2c3d4e5f6'],
  ])('R6 — «%s» → %s', (texto, id) => {
    expect(leerCodigoQr(texto)).toBe(id);
  });

  it.each([
    '',
    'COLON:',
    'COLON:lug-',
    'colon:lug-004',
    'COLON:LUG-004',
    'COLON: lug-004',
    'COLON:cat-museos',
    'COLON:lug-004:extra',
    'COLON:lug-004 lug-005',
    'https://qr.consultora.com.ar/colon?id=4',
    'WIFI:S:MiRed;T:WPA;P:clave;;',
    '📍',
    'COLON:lug-' + 'x'.repeat(37),
  ])('R6 — «%s» no es un QR de Mi Ciudad', (texto) => {
    expect(leerCodigoQr(texto)).toBeNull();
  });
});
