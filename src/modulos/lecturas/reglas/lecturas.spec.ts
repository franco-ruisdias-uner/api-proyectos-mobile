import {
  calcularConsumo,
  elegirVigente,
  evaluarRango,
  valorPosible,
} from './lecturas.js';

describe('R14 — consumo = (valor − anterior) × multiplicador', () => {
  it.each([
    [1302, 1284, 1, 18],
    [1302, 1284, 10, 180],
    [500, null, 1, 500],
    [500, null, 10, 5000],
    [100, 900, 1, -800],
    [0, 0, 1, 0],
  ])('valor %i, anterior %s, ×%i → %i', (valor, anterior, mult, esperado) => {
    expect(calcularConsumo(valor, anterior, mult)).toBe(esperado);
  });
});

describe('R16 — fuera de rango (D4)', () => {
  it.each([
    ['el ejemplo del PRD: 3236 contra un promedio de 18', 3236, 18, true],
    ['18 contra 18', 18, 18, false],
    ['54 contra 18: justo el límite', 54, 18, false],
    ['55 contra 18', 55, 18, true],
    ['promedio 0 y consumo 15 (piso de 5)', 15, 0, false],
    ['promedio 0 y consumo 16', 16, 0, true],
    ['sin promedio y 60', 60, null, false],
    ['sin promedio y 61', 61, null, true],
    ['negativo', -1, 18, true],
    ['cero', 0, 18, false],
  ])('%s', (_caso, consumo, promedio, esperado) => {
    expect(evaluarRango(consumo, promedio)).toBe(esperado);
  });
});

describe('R12 — el valor tiene que caber en el medidor', () => {
  it.each([
    [0, 5, true],
    [99999, 5, true],
    [100000, 5, false],
    [-1, 5, false],
    [1.5, 5, false],
    [9999, 4, true],
    [10000, 4, false],
  ])('valor %d en %d dígitos → %s', (valor, digitos, esperado) => {
    expect(valorPosible(valor, digitos)).toBe(esperado);
  });
});

describe('R13 — un solo resultado vigente por suministro', () => {
  const r = (id: string, hora: number) => ({
    id,
    suministroId: 'sum-1',
    fechaHora: new Date(Date.UTC(2026, 8, 15, hora)),
  });

  it('novedad de las 9 y lectura de las 11 → la lectura', () => {
    const v = elegirVigente([r('lec-a', 11)], [r('nov-a', 9)]);
    expect(v).toMatchObject({ tipo: 'lectura', resultado: { id: 'lec-a' } });
  });
  it('lectura de las 9 y novedad de las 10 → sigue la lectura', () => {
    const v = elegirVigente([r('lec-a', 9)], [r('nov-a', 10)]);
    expect(v).toMatchObject({ tipo: 'lectura', resultado: { id: 'lec-a' } });
  });
  it('lectura de las 9 y de las 10 que llegó antes → la de las 10', () => {
    const v = elegirVigente([r('lec-b', 10), r('lec-a', 9)], []);
    expect(v).toMatchObject({ resultado: { id: 'lec-b' } });
  });
  it('dos novedades → la más reciente', () => {
    const v = elegirVigente([], [r('nov-a', 9), r('nov-b', 10)]);
    expect(v).toMatchObject({ tipo: 'novedad', resultado: { id: 'nov-b' } });
  });
  it('empate de hora → desempata por id', () => {
    const v = elegirVigente([r('lec-a', 9), r('lec-b', 9)], []);
    expect(v).toMatchObject({ resultado: { id: 'lec-b' } });
  });
  it('sin nada → null', () => {
    expect(elegirVigente([], [])).toBeNull();
  });
});
