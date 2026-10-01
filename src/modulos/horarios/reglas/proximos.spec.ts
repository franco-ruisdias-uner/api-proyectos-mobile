import type { Horario, TipoDeDia } from '../../../../contrato/tipos.js';
import { proximosPasos } from './proximos.js';

let n = 0;
const h = (lineaId: string, hora: string, tipoDeDia: TipoDeDia = 'habil'): Horario => ({
  id: `hor-${++n}`,
  lineaId,
  paradaId: 'par-101',
  sentido: 'ida',
  tipoDeDia,
  hora,
});
const resumen = (hs: Horario[]) => hs.map((x) => `${x.lineaId}@${x.hora}/${x.tipoDeDia}`);
const SIN_FERIADOS = new Set<string>();

// 2026-09-18 es viernes; 2026-09-19, sábado; 2026-09-20, domingo.
const viernes = (hhmm: string) => new Date(`2026-09-18T${hhmm}:00-03:00`);

describe('Espec. R8 — próximos horarios de una parada', () => {
  const tabla = [
    h('lin-05', '05:20'),
    h('lin-05', '10:00'),
    h('lin-05', '10:20'),
    h('lin-05', '10:40'),
    h('lin-05', '11:00'),
    h('lin-14', '10:30'),
    h('lin-14', '22:00'),
    h('lin-05', '05:20', 'sabado'),
    h('lin-05', '06:00', 'sabado'),
    h('lin-14', '06:10', 'sabado'),
  ];

  it('devuelve, por línea, los siguientes a ahora en orden cronológico', () => {
    const r = proximosPasos({
      ahora: viernes('10:15'),
      horarios: tabla,
      feriados: SIN_FERIADOS,
      cantidad: 2,
    });
    expect(resumen(r)).toEqual([
      'lin-05@10:20/habil',
      'lin-14@10:30/habil',
      'lin-05@10:40/habil',
      'lin-14@22:00/habil',
    ]);
  });

  it('un servicio que sale justo en el minuto actual todavía cuenta', () => {
    const r = proximosPasos({
      ahora: viernes('10:20'),
      horarios: tabla,
      feriados: SIN_FERIADOS,
      cantidad: 1,
    });
    expect(resumen(r)).toEqual(['lin-05@10:20/habil', 'lin-14@10:30/habil']);
  });

  it('cuenta los segundos como parte del minuto actual', () => {
    const r = proximosPasos({
      ahora: new Date('2026-09-18T10:20:59-03:00'),
      horarios: tabla,
      feriados: SIN_FERIADOS,
      cantidad: 1,
    });
    expect(r[0].hora).toBe('10:20');
  });

  it('si no alcanzan, completa con los de mañana y con el tipo de día de MAÑANA', () => {
    const r = proximosPasos({
      ahora: viernes('10:50'),
      horarios: tabla,
      feriados: SIN_FERIADOS,
      cantidad: 3,
    });
    // lin-05: 11:00 (hoy) + 05:20 y 06:00 del sábado. lin-14: 22:00 (hoy) + 06:10 del sábado.
    expect(resumen(r)).toEqual([
      'lin-05@11:00/habil',
      'lin-14@22:00/habil',
      'lin-05@05:20/sabado',
      'lin-05@06:00/sabado',
      'lin-14@06:10/sabado',
    ]);
  });

  it('los de mañana van después de los de hoy, aunque su hora sea menor', () => {
    const r = proximosPasos({
      ahora: viernes('22:30'),
      horarios: tabla,
      feriados: SIN_FERIADOS,
      cantidad: 1,
    });
    expect(resumen(r)).toEqual(['lin-05@05:20/sabado', 'lin-14@06:10/sabado']);
  });

  it('a las 23:59 sólo hay servicio de mañana; a las 00:00 ya es el día siguiente', () => {
    const a = proximosPasos({
      ahora: viernes('23:59'),
      horarios: tabla,
      feriados: SIN_FERIADOS,
      cantidad: 1,
    });
    expect(resumen(a)).toEqual(['lin-05@05:20/sabado', 'lin-14@06:10/sabado']);
    const b = proximosPasos({
      ahora: new Date('2026-09-19T00:00:00-03:00'),
      horarios: tabla,
      feriados: SIN_FERIADOS,
      cantidad: 1,
    });
    expect(resumen(b)).toEqual(['lin-05@05:20/sabado', 'lin-14@06:10/sabado']);
  });

  it('usa la tabla de feriado cuando hoy o mañana son feriado', () => {
    const feriados = new Set(['2026-09-19']);
    const conFeriado = [...tabla, h('lin-05', '07:00', 'feriado')];
    const r = proximosPasos({
      ahora: viernes('23:00'),
      horarios: conFeriado,
      feriados,
      cantidad: 1,
    });
    expect(resumen(r)).toEqual(['lin-05@07:00/feriado']);
  });

  it('una línea sin servicio ni hoy ni mañana no aparece', () => {
    const r = proximosPasos({
      ahora: viernes('10:00'),
      horarios: [h('lin-05', '10:10'), h('lin-09', '08:00', 'domingo')],
      feriados: SIN_FERIADOS,
      cantidad: 3,
    });
    expect(resumen(r)).toEqual(['lin-05@10:10/habil']);
  });

  it('el último día del año completa con el primero del siguiente (feriado)', () => {
    const feriados = new Set(['2027-01-01']);
    const t = [h('lin-05', '21:00'), h('lin-05', '08:00', 'feriado')];
    const r = proximosPasos({
      ahora: new Date('2026-12-31T21:30:00-03:00'),
      horarios: t,
      feriados,
      cantidad: 2,
    });
    expect(resumen(r)).toEqual(['lin-05@08:00/feriado']);
  });

  it('el día se calcula en Buenos Aires, no en UTC', () => {
    // 01:30 UTC del sábado es todavía viernes 22:30 en Paraná.
    const r = proximosPasos({
      ahora: new Date('2026-09-19T01:30:00Z'),
      horarios: tabla,
      feriados: SIN_FERIADOS,
      cantidad: 1,
    });
    expect(resumen(r)).toEqual(['lin-05@05:20/sabado', 'lin-14@06:10/sabado']);
  });

  it('con una tabla vacía no devuelve nada', () => {
    expect(
      proximosPasos({ ahora: viernes('10:00'), horarios: [], feriados: SIN_FERIADOS, cantidad: 3 }),
    ).toEqual([]);
  });

  it('nunca inventa horas: todo lo que devuelve está en la tabla (R9)', () => {
    const r = proximosPasos({
      ahora: viernes('10:15'),
      horarios: tabla,
      feriados: SIN_FERIADOS,
      cantidad: 10,
    });
    for (const x of r) expect(tabla).toContain(x);
  });
});

describe('Espec. R8 — desempate del orden cronológico', () => {
  it('a la misma hora, por lineaId (no por id de la fila)', () => {
    const t = [h('lin-14', '10:00'), h('lin-05', '10:00'), h('lin-09', '10:00')];
    const r = proximosPasos({
      ahora: viernes('09:00'),
      horarios: t,
      feriados: SIN_FERIADOS,
      cantidad: 1,
    });
    expect(resumen(r)).toEqual(['lin-05@10:00/habil', 'lin-09@10:00/habil', 'lin-14@10:00/habil']);
  });
});
