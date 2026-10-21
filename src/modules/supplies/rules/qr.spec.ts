import { codigoQrDe } from './qr.js';

describe('PRD §2 — El código QR del medidor es COOP-CHJ:<medidorId>', () => {
  it.each([
    ['med-A88413', 'COOP-CHJ:med-A88413'],
    ['med-004136', 'COOP-CHJ:med-004136'],
    ['med-Q008001', 'COOP-CHJ:med-Q008001'],
  ])('codigoQrDe(%j) → %j', (id, esperado) => {
    expect(codigoQrDe(id)).toBe(esperado);
  });
});
