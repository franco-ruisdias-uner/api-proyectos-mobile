import { bimestreDe, MOTIVOS_NOVEDAD, resumirNovedades } from './novedades.js';

describe('R19 — resumen de novedades por motivo y zona', () => {
  const n = (
    motivo: Parameters<typeof resumirNovedades>[0][0]['motivo'],
    zona: string,
  ) => ({
    motivo,
    zona,
  });

  it('cuenta por motivo y zona, y sólo trae los grupos con al menos una', () => {
    const r = resumirNovedades([
      n('perro_suelto', 'Brasil'),
      n('perro_suelto', 'Brasil'),
      n('perro_suelto', 'Quintas'),
      n('pasto_alto', 'Brasil'),
    ]);
    expect(r).toEqual([
      { motivo: 'perro_suelto', zona: 'Brasil', cantidad: 2 },
      { motivo: 'pasto_alto', zona: 'Brasil', cantidad: 1 },
      { motivo: 'perro_suelto', zona: 'Quintas', cantidad: 1 },
    ]);
  });

  it('ordena por cantidad descendente, después motivo y zona', () => {
    const r = resumirNovedades([
      n('pasto_alto', 'B'),
      n('deshabitada', 'B'),
      n('deshabitada', 'A'),
      n('pasto_alto', 'A'),
      n('pasto_alto', 'A'),
    ]);
    expect(r.map((x) => `${x.motivo}/${x.zona}/${x.cantidad}`)).toEqual([
      'pasto_alto/A/2',
      'deshabitada/A/1',
      'deshabitada/B/1',
      'pasto_alto/B/1',
    ]);
  });

  it('sin novedades devuelve una lista vacía', () => {
    expect(resumirNovedades([])).toEqual([]);
  });
});

describe('D9 — bimestre de una fecha (en hora argentina)', () => {
  it.each([
    ['2026-01-15T12:00:00-03:00', '2026-01'],
    ['2026-02-28T23:59:59-03:00', '2026-01'],
    ['2026-03-01T00:00:00-03:00', '2026-02'],
    ['2026-09-15T09:00:00-03:00', '2026-05'],
    ['2026-12-31T23:59:59-03:00', '2026-06'],
    // 31/12 a las 22:00 argentinas ya es 1/1 en UTC: manda la hora argentina.
    ['2026-12-31T22:00:00-03:00', '2026-06'],
    ['2026-02-28T22:00:00-03:00', '2026-01'],
  ])('%s → %s', (instante, esperado) => {
    expect(bimestreDe(new Date(instante))).toBe(esperado);
  });
});

describe('PRD §3 — motivos de novedad', () => {
  it('son los siete del PRD', () => {
    expect(MOTIVOS_NOVEDAD).toEqual([
      'perro_suelto',
      'porton_cerrado',
      'pasto_alto',
      'medidor_tapado',
      'medidor_roto',
      'deshabitada',
      'no_se_encuentra',
    ]);
  });
});
