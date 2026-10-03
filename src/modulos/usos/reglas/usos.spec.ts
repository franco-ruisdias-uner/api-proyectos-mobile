import {
  ALFABETO_DE_CODIGOS,
  codigoDeUsoValido,
  generarCodigoDeUso,
  motivoDeNoUso,
  normalizarCodigo,
} from './usos.js';

const base = { id: 'pro-1', activa: true };
const ahora = new Date('2026-10-03T15:00:00Z');
const dia = 24 * 60 * 60 * 1000;

describe('PRD §3 / D8 — Formato del código de uso: CCU-XXXX-XXXX sin caracteres ambiguos', () => {
  it('el alfabeto no tiene 0, O, 1 ni I', () => {
    for (const c of '0O1I') expect(ALFABETO_DE_CODIGOS).not.toContain(c);
    expect(ALFABETO_DE_CODIGOS).toHaveLength(32);
  });

  it.each([
    [0, 'CCU-AAAA-AAAA'],
    [31, 'CCU-9999-9999'],
  ])('con un azar fijo en %i da %s', (n, esperado) => {
    const codigo = generarCodigoDeUso(() => n);
    expect(codigo.replace(/[AB9]/g, (x) => (x === 'A' ? 'A' : '9'))).toBe(esperado);
  });

  it('todo código generado es válido', () => {
    for (let i = 0; i < 200; i++) expect(codigoDeUsoValido(generarCodigoDeUso())).toBe(true);
  });

  it.each([
    ['CCU-0000-AAAA', false],
    ['CCU-AAAA-AAAI', false],
    ['CCU-AAAA-AAA', false],
    ['ccu-aaaa-aaaa', false],
    ['CCU-AAAA-AAAA', true],
    ['', false],
  ])('codigoDeUsoValido(%s) → %s', (texto, esperado) => {
    expect(codigoDeUsoValido(texto)).toBe(esperado);
  });

  it('normalizarCodigo recorta espacios y pasa a mayúsculas', () => {
    expect(normalizarCodigo('  ccu-ab2c-9xyz \n')).toBe('CCU-AB2C-9XYZ');
  });
});

describe('PRD §3 / R11 — Una promo sólo da código si está vigente', () => {
  it.each([
    ['vigente', { desde: new Date(+ahora - dia), hasta: new Date(+ahora + dia) }, null],
    [
      'vencida',
      { desde: new Date(+ahora - 3 * dia), hasta: new Date(+ahora - dia) },
      'PROMO_VENCIDA',
    ],
    [
      'no empezó',
      { desde: new Date(+ahora + dia), hasta: new Date(+ahora + 3 * dia) },
      'PROMO_NO_EMPEZO',
    ],
    ['hasta == ahora', { desde: new Date(+ahora - dia), hasta: ahora }, null],
    ['desde == ahora', { desde: ahora, hasta: new Date(+ahora + dia) }, null],
  ])('%s', (_n, fechas, esperado) => {
    expect(motivoDeNoUso({ ...base, ...fechas }, ahora)).toBe(esperado);
  });

  it('una dada de baja ya no sirve: PROMO_VENCIDA', () => {
    const p = {
      ...base,
      activa: false,
      desde: new Date(+ahora - dia),
      hasta: new Date(+ahora + dia),
    };
    expect(motivoDeNoUso(p, ahora)).toBe('PROMO_VENCIDA');
  });
});
