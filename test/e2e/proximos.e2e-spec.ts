import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { FeriadoEntidad } from '../../src/modulos/horarios/feriado.entidad.js';
import { crearFeriado, crearHorarios } from '../utilidades/horarios.js';
import { crearLinea, crearParada } from '../utilidades/red.js';

interface HorarioJson {
  lineaId: string;
  tipoDeDia: string;
  hora: string;
}
const resumen = (r: { body: { datos: HorarioJson[] } }) =>
  r.body.datos.map((h) => `${h.lineaId}@${h.hora}/${h.tipoDeDia}`);

// 2026-09-19 es sábado.
const SABADO_1030 = '2026-09-19T10:30:00-03:00';

describe('Espec. M2 — GET /paradas/:id/proximos (R8, PRD §3)', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp({ ahora: SABADO_1030 });
    await crearParada(ctx, { id: 'par-101' });
    await crearLinea(ctx, {
      id: 'lin-05',
      numero: '5',
      recorridos: [{ sentido: 'ida', paradaIds: ['par-101'] }],
    });
    await crearLinea(ctx, {
      id: 'lin-14',
      numero: '14',
      recorridos: [{ sentido: 'ida', paradaIds: ['par-101'] }],
    });
    await crearLinea(ctx, { id: 'lin-02', numero: '2' });
    const base = { paradaId: 'par-101', sentido: 'ida' as const };
    await crearHorarios(ctx, { ...base, lineaId: 'lin-05', tipoDeDia: 'sabado' }, [
      '05:20',
      '10:00',
      '10:30',
      '10:50',
      '11:10',
      '11:30',
      '21:00',
    ]);
    await crearHorarios(ctx, { ...base, lineaId: 'lin-05', tipoDeDia: 'domingo' }, [
      '06:00',
      '07:00',
    ]);
    await crearHorarios(ctx, { ...base, lineaId: 'lin-14', tipoDeDia: 'sabado' }, [
      '10:40',
      '21:00',
    ]);
    await crearHorarios(ctx, { ...base, lineaId: 'lin-14', tipoDeDia: 'domingo' }, ['06:10']);
    await crearHorarios(ctx, { ...base, lineaId: 'lin-14', tipoDeDia: 'habil' }, ['05:00']);
  });
  afterAll(() => ctx.cerrar());
  afterEach(() => ctx.reloj.fijar(SABADO_1030));

  it('por defecto, los 3 siguientes de cada línea, en orden cronológico', async () => {
    const r = await ctx.http.get('/paradas/par-101/proximos').expect(200);
    esperarContrato(r.body, 'Horario');
    expect(resumen(r)).toEqual([
      'lin-05@10:30/sabado',
      'lin-14@10:40/sabado',
      'lin-05@10:50/sabado',
      'lin-05@11:10/sabado',
      'lin-14@21:00/sabado',
      'lin-14@06:10/domingo',
    ]);
    expect(r.body.meta).toMatchObject({ total: 6, pagina: 1 });
  });

  it('cantidad limita por línea', async () => {
    const r = await ctx.http.get('/paradas/par-101/proximos?cantidad=1').expect(200);
    expect(resumen(r)).toEqual(['lin-05@10:30/sabado', 'lin-14@10:40/sabado']);
  });

  it('lineaId deja sólo esa línea', async () => {
    const r = await ctx.http.get('/paradas/par-101/proximos?lineaId=lin-14&cantidad=2').expect(200);
    esperarContrato(r.body, 'Horario');
    expect(resumen(r)).toEqual(['lin-14@10:40/sabado', 'lin-14@21:00/sabado']);
  });

  it('R8 — los de mañana usan el tipo de día de mañana (hoy sábado → domingo)', async () => {
    ctx.reloj.fijar('2026-09-19T21:30:00-03:00');
    const r = await ctx.http.get('/paradas/par-101/proximos?cantidad=2').expect(200);
    expect(resumen(r)).toEqual([
      'lin-05@06:00/domingo',
      'lin-14@06:10/domingo',
      'lin-05@07:00/domingo',
    ]);
  });

  it('R8 — mañana completa lo que hoy no alcanza: 20:30 con cantidad 2', async () => {
    ctx.reloj.fijar('2026-09-19T20:30:00-03:00');
    const r = await ctx.http.get('/paradas/par-101/proximos?cantidad=2').expect(200);
    expect(resumen(r)).toEqual([
      'lin-05@21:00/sabado',
      'lin-14@21:00/sabado',
      'lin-05@06:00/domingo',
      'lin-14@06:10/domingo',
    ]);
  });

  it('R6 — un feriado usa la tabla de feriado', async () => {
    await crearFeriado(ctx, '2026-09-19', 'Feriado de prueba');
    await crearHorarios(ctx, { paradaId: 'par-101', lineaId: 'lin-05', tipoDeDia: 'feriado' }, [
      '12:00',
    ]);
    const r = await ctx.http.get('/paradas/par-101/proximos?lineaId=lin-05&cantidad=1').expect(200);
    expect(resumen(r)).toEqual(['lin-05@12:00/feriado']);
    await ctx.dataSource.getRepository(FeriadoEntidad).clear();
  });

  it('el día se calcula en Buenos Aires: 02:00 UTC del domingo es sábado 23:00, y mañana es domingo', async () => {
    ctx.reloj.fijar('2026-09-20T02:00:00Z');
    const r = await ctx.http.get('/paradas/par-101/proximos?lineaId=lin-14&cantidad=1').expect(200);
    // En UTC sería domingo (y mañana lunes, hábil, 05:00): acá mañana es domingo.
    expect(resumen(r)).toEqual(['lin-14@06:10/domingo']);
  });

  it('una parada existente sin horarios da lista vacía', async () => {
    const p = await crearParada(ctx);
    const r = await ctx.http.get(`/paradas/${p.id}/proximos`).expect(200);
    expect(r.body.datos).toEqual([]);
    expect(r.body.meta.total).toBe(0);
  });

  it('una línea que no para ahí da lista vacía', async () => {
    const r = await ctx.http.get('/paradas/par-101/proximos?lineaId=lin-02').expect(200);
    expect(r.body.datos).toEqual([]);
  });

  describe('errores', () => {
    it('404 PARADA_NO_ENCONTRADA', async () => {
      esperarError(await ctx.http.get('/paradas/par-999/proximos'), 404, 'PARADA_NO_ENCONTRADA');
      esperarError(await ctx.http.get('/paradas/xx/proximos'), 404, 'PARADA_NO_ENCONTRADA');
    });

    it.each([
      ['cantidad=0'],
      ['cantidad=11'],
      ['cantidad=-1'],
      ['cantidad=2.5'],
      ['cantidad=abc'],
      ['cantidad='],
      ['lineaId=par-101'],
      ['lineaId='],
      ['pagina=2'],
    ])('?%s → 400 VALIDACION_FALLIDA', async (consulta) => {
      esperarError(
        await ctx.http.get(`/paradas/par-101/proximos?${consulta}`),
        400,
        'VALIDACION_FALLIDA',
      );
    });
  });

  it('cantidad=10 es válido', async () => {
    const r = await ctx.http
      .get('/paradas/par-101/proximos?cantidad=10&lineaId=lin-05')
      .expect(200);
    expect(r.body.datos).toHaveLength(7); // 5 del sábado que quedan + 2 del domingo
  });
});
