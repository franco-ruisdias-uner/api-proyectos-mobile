import { generarNovedades } from './issues.js';
import { generarSuministrosYMedidores } from './supplies.js';
import { INDICES_CON_LECTURA } from './readings.js';
import { MOTIVOS_NOVEDAD } from '../../modules/issues/rules/issues.js';

describe('ESPECIFICACION §8 — Semillas de novedades', () => {
  const { suministros } = generarSuministrosYMedidores();
  const novedades = generarNovedades(suministros);

  it('son las 20 de la app de clase, con ids y suministros distintos', () => {
    expect(novedades).toHaveLength(20);
    expect(new Set(novedades.map((n) => n.id)).size).toBe(20);
    expect(new Set(novedades.map((n) => n.suministroId)).size).toBe(20);
  });

  it('nov-3312 es la del PRD: sum-004150, perro suelto, con nota de voz y sin comentario', () => {
    expect(novedades.find((n) => n.id === 'nov-3312')).toMatchObject({
      suministroId: 'sum-004150',
      motivo: 'perro_suelto',
      comentario: null,
      conAudio: true,
      fechaHora: new Date('2026-09-15T08:31:00-03:00'),
    });
  });

  it('hay al menos una novedad de cada motivo', () => {
    expect(new Set(novedades.map((n) => n.motivo))).toEqual(
      new Set(MOTIVOS_NOVEDAD),
    );
  });

  it('R13: ninguna cae en un suministro que tiene lectura', () => {
    const conLectura = new Set(
      INDICES_CON_LECTURA.map((i) => suministros[i].id),
    );
    expect(novedades.filter((n) => conLectura.has(n.suministroId))).toEqual([]);
  });
});
