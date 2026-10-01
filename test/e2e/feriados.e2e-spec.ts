import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { crearFeriado } from '../utilidades/horarios.js';

describe('Espec. M2 — GET /feriados (D2)', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp({ ahora: '2026-09-19T10:30:00-03:00' });
    await crearFeriado(ctx, '2026-12-25', 'Navidad');
    await crearFeriado(ctx, '2026-05-25', 'Día de la Revolución de Mayo');
    await crearFeriado(ctx, '2027-01-01', 'Año nuevo');
  });
  afterAll(() => ctx.cerrar());

  it('sin anio, los del año actual (en Buenos Aires), por fecha', async () => {
    const r = await ctx.http.get('/feriados').expect(200);
    esperarContrato(r.body, 'Feriado');
    expect(r.body.datos).toEqual([
      { fecha: '2026-05-25', nombre: 'Día de la Revolución de Mayo' },
      { fecha: '2026-12-25', nombre: 'Navidad' },
    ]);
    expect(r.body.meta.total).toBe(2);
  });

  it('con anio, los de ese año', async () => {
    const r = await ctx.http.get('/feriados?anio=2027').expect(200);
    esperarContrato(r.body, 'Feriado');
    expect(r.body.datos).toEqual([{ fecha: '2027-01-01', nombre: 'Año nuevo' }]);
  });

  it('un año sin feriados cargados da lista vacía', async () => {
    const r = await ctx.http.get('/feriados?anio=2030').expect(200);
    expect(r.body).toEqual({ datos: [], meta: { total: 0, pagina: 1, porPagina: 20 } });
  });

  it('el año actual se calcula en Buenos Aires: 01:00 UTC del 1/1 todavía es el año anterior', async () => {
    ctx.reloj.fijar('2027-01-01T01:00:00Z');
    const r = await ctx.http.get('/feriados').expect(200);
    expect(r.body.datos.map((f: { fecha: string }) => f.fecha)).toEqual([
      '2026-05-25',
      '2026-12-25',
    ]);
    ctx.reloj.fijar('2026-09-19T10:30:00-03:00');
  });

  it('paginación', async () => {
    const r = await ctx.http.get('/feriados?porPagina=1&pagina=2').expect(200);
    expect(r.body.datos).toEqual([{ fecha: '2026-12-25', nombre: 'Navidad' }]);
    expect(r.body.meta).toEqual({ total: 2, pagina: 2, porPagina: 1 });
  });

  it.each([['anio=abc'], ['anio=1800'], ['anio=2026.5'], ['anio='], ['anio=99999'], ['mes=1']])(
    '?%s → 400 VALIDACION_FALLIDA',
    async (consulta) => {
      esperarError(await ctx.http.get(`/feriados?${consulta}`), 400, 'VALIDACION_FALLIDA');
    },
  );
});
