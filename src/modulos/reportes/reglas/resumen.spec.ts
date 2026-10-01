import { resumirReportes, type FilaDeReporte } from './resumen.js';

const fila = (
  lineaId: string,
  paradaId: string,
  confirmaciones: number,
  fechaHora: string,
): FilaDeReporte => ({ lineaId, paradaId, confirmaciones, fechaHora: new Date(fechaHora) });

const FILAS = [
  fila('lin-05', 'par-101', 2, '2026-09-30T14:00:00Z'),
  fila('lin-05', 'par-101', 0, '2026-09-30T14:30:00Z'),
  fila('lin-05', 'par-102', 1, '2026-09-30T13:00:00Z'),
  fila('lin-07', 'par-101', 5, '2026-09-30T12:00:00Z'),
];

describe('D8 — resumen de reportes para la Dirección', () => {
  it('por línea: paradaId es null y suma cantidad y confirmaciones', () => {
    expect(resumirReportes(FILAS, 'linea')).toEqual([
      {
        lineaId: 'lin-05',
        paradaId: null,
        cantidad: 3,
        confirmaciones: 3,
        ultimo: new Date('2026-09-30T14:30:00Z'),
      },
      {
        lineaId: 'lin-07',
        paradaId: null,
        cantidad: 1,
        confirmaciones: 5,
        ultimo: new Date('2026-09-30T12:00:00Z'),
      },
    ]);
  });

  it('por parada: un grupo por línea y parada', () => {
    const r = resumirReportes(FILAS, 'parada');
    expect(r.map((g) => [g.lineaId, g.paradaId, g.cantidad])).toEqual([
      ['lin-05', 'par-101', 2],
      ['lin-05', 'par-102', 1],
      ['lin-07', 'par-101', 1],
    ]);
  });

  it('ordena por cantidad descendente y desempata por línea y parada', () => {
    const r = resumirReportes(
      [
        fila('lin-09', 'par-1', 0, '2026-09-30T10:00:00Z'),
        fila('lin-02', 'par-1', 0, '2026-09-30T10:00:00Z'),
      ],
      'linea',
    );
    expect(r.map((g) => g.lineaId)).toEqual(['lin-02', 'lin-09']);
  });

  it('sin reportes, lista vacía', () => {
    expect(resumirReportes([], 'linea')).toEqual([]);
  });
});
