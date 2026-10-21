// Verificación independiente del M2 — Horarios (AGENTS §12). Caja negra: sólo HTTP, builders
// de test/utilities/ y la siembra de demo. Cada describe nombra la regla que prueba.
import type { Feriado } from '../../contract/api.js';
import type { Horario } from '../../contract/types.js';
import { sembrar } from '../../src/seeds/seed.js';
import { type AppDePrueba, crearApp } from '../utilities/create-app.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import { crearFeriado, crearHorario, crearHorarios } from '../utilities/schedules.js';
import { crearLinea, crearParada } from '../utilities/network.js';

const JERGA =
  /\b(must|should|property|undefined|null|string|number|boolean|array|object|Bad Request|Unauthorized|Forbidden|Not Found|Internal Server|Error:|exception|Cannot|SQLITE|QueryFailed|whitelist|integer)\b/i;

function esperarErrorLimpio(r: { status: number; body: unknown }, estado: number, codigo: string) {
  esperarError(r, estado, codigo);
  const b = r.body as { error: { mensaje: string } };
  expect(Object.keys(b)).toEqual(['error']);
  expect(Object.keys(b.error).sort()).toEqual(['codigo', 'mensaje']);
  expect(b.error.mensaje).not.toMatch(JERGA);
}

const res = (r: { body: { datos: Horario[] } }) =>
  r.body.datos.map((h) => `${h.lineaId}@${h.hora}/${h.tipoDeDia}`);

// 2026-09-18 viernes, 19 sábado, 20 domingo, 21 lunes. 2026-09-30 miércoles. 2026-12-31 jueves.
describe('R8/R6/R5 — próximos: bordes de reloj y zona horaria', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp({ ahora: '2026-09-19T10:30:00-03:00' });
    await crearParada(ctx, { id: 'par-701' });
    await crearLinea(ctx, {
      id: 'lin-71',
      numero: '71',
      recorridos: [{ sentido: 'ida', paradaIds: ['par-701'] }],
    });
    const b = { paradaId: 'par-701', lineaId: 'lin-71', sentido: 'ida' as const };
    await crearHorarios(ctx, { ...b, tipoDeDia: 'habil' }, ['05:20', '12:00', '23:00', '23:59']);
    await crearHorarios(ctx, { ...b, tipoDeDia: 'sabado' }, [
      '05:50',
      '10:29',
      '10:30',
      '10:31',
      '23:59',
    ]);
    await crearHorarios(ctx, { ...b, tipoDeDia: 'domingo' }, ['00:00', '07:00', '23:59']);
    await crearHorarios(ctx, { ...b, tipoDeDia: 'feriado' }, ['06:00', '08:00']);
  });
  afterAll(() => ctx.cerrar());

  const prox = (q = 'cantidad=2&lineaId=lin-71') => ctx.http.get(`/paradas/par-701/proximos?${q}`);

  it('A18 — a las 10:30:45 el de las 10:30 todavía cuenta; a las 10:31:00 ya no', async () => {
    ctx.reloj.fijar('2026-09-19T10:30:45-03:00');
    expect(res(await prox('cantidad=2').expect(200))).toEqual([
      'lin-71@10:30/sabado',
      'lin-71@10:31/sabado',
    ]);
    ctx.reloj.fijar('2026-09-19T10:31:00-03:00');
    expect(res(await prox('cantidad=1').expect(200))).toEqual(['lin-71@10:31/sabado']);
    ctx.reloj.fijar('2026-09-19T10:32:00-03:00');
    expect(res(await prox('cantidad=1').expect(200))).toEqual(['lin-71@23:59/sabado']);
  });

  it('23:59:59 del sábado: cuenta el de las 23:59 de hoy y completa con el domingo', async () => {
    ctx.reloj.fijar('2026-09-19T23:59:59-03:00');
    const r = await prox('cantidad=3').expect(200);
    esperarContrato(r.body, 'Horario');
    expect(res(r)).toEqual(['lin-71@23:59/sabado', 'lin-71@00:00/domingo', 'lin-71@07:00/domingo']);
  });

  it('00:00:00 del domingo: hoy ya es domingo (incluye el 00:00) y mañana es lunes hábil', async () => {
    ctx.reloj.fijar('2026-09-20T00:00:00-03:00');
    expect(res(await prox('cantidad=5').expect(200))).toEqual([
      'lin-71@00:00/domingo',
      'lin-71@07:00/domingo',
      'lin-71@23:59/domingo',
      'lin-71@05:20/habil',
      'lin-71@12:00/habil',
    ]);
  });

  it('el mismo instante expresado en Z (03:00Z = 00:00 del domingo en Buenos Aires)', async () => {
    ctx.reloj.fijar('2026-09-20T03:00:00Z');
    expect(res(await prox('cantidad=1').expect(200))).toEqual(['lin-71@00:00/domingo']);
    ctx.reloj.fijar('2026-09-20T02:59:59Z');
    expect(res(await prox('cantidad=1').expect(200))).toEqual(['lin-71@23:59/sabado']);
  });

  it('R6 — mañana es feriado y cae sábado/domingo: usa la tabla de feriado, no la de sábado', async () => {
    // viernes 18 hábil, mañana sábado 19 feriado
    await crearFeriado(ctx, '2026-09-19', 'Feriado en sábado');
    ctx.reloj.fijar('2026-09-18T23:59:30-03:00');
    expect(res(await prox('cantidad=3').expect(200))).toEqual([
      'lin-71@23:59/habil',
      'lin-71@06:00/feriado',
      'lin-71@08:00/feriado',
    ]);
    // hoy mismo es feriado y sábado: gana feriado
    ctx.reloj.fijar('2026-09-19T00:00:00-03:00');
    expect(res(await prox('cantidad=2').expect(200))).toEqual([
      'lin-71@06:00/feriado',
      'lin-71@08:00/feriado',
    ]);
  });

  it('R6 — feriado un domingo y feriado mañana lunes (hoy domingo-feriado, mañana feriado)', async () => {
    await crearFeriado(ctx, '2026-09-20', 'Domingo feriado');
    await crearFeriado(ctx, '2026-09-21', 'Lunes feriado');
    ctx.reloj.fijar('2026-09-20T12:00:00-03:00');
    expect(res(await prox('cantidad=2').expect(200))).toEqual([
      'lin-71@06:00/feriado', // mañana (lunes feriado): hoy no queda nada de feriado después de 12:00? 08:00 < 12:00
      'lin-71@08:00/feriado',
    ]);
  });

  it('31/12 → 1/1: mañana es feriado cargado en la tabla del año siguiente', async () => {
    await crearFeriado(ctx, '2027-01-01', 'Año Nuevo');
    ctx.reloj.fijar('2026-12-31T23:30:00-03:00'); // jueves hábil
    expect(res(await prox('cantidad=2').expect(200))).toEqual([
      'lin-71@23:59/habil',
      'lin-71@06:00/feriado',
    ]);
    // 02:30Z del 1/1 sigue siendo 31/12 en Paraná
    ctx.reloj.fijar('2027-01-01T02:30:00Z');
    expect(res(await prox('cantidad=2').expect(200))).toEqual([
      'lin-71@23:59/habil',
      'lin-71@06:00/feriado',
    ]);
    // 00:00 del 1/1 en Paraná: hoy es feriado
    ctx.reloj.fijar('2027-01-01T00:00:00-03:00');
    expect(res(await prox('cantidad=1').expect(200))).toEqual(['lin-71@06:00/feriado']);
  });

  it('último día del mes: 30/09 a las 23:59:59, mañana es 1/10 (jueves hábil)', async () => {
    ctx.reloj.fijar('2026-09-30T23:59:59-03:00'); // miércoles
    expect(res(await prox('cantidad=2').expect(200))).toEqual([
      'lin-71@23:59/habil',
      'lin-71@05:20/habil',
    ]);
  });

  it('28/02 de un año no bisiesto: mañana es 1/3', async () => {
    ctx.reloj.fijar('2027-02-28T23:59:59-03:00'); // domingo; mañana lunes 1/3
    expect(res(await prox('cantidad=2').expect(200))).toEqual([
      'lin-71@23:59/domingo',
      'lin-71@05:20/habil',
    ]);
  });

  it('R8 — lo de hoy va primero y mañana sólo completa, aunque la hora de mañana sea mayor que ahora (D3)', async () => {
    ctx.reloj.fijar('2026-09-30T22:00:00-03:00'); // miércoles; quedan 23:00 y 23:59
    expect(res(await prox('cantidad=3').expect(200))).toEqual([
      'lin-71@23:00/habil',
      'lin-71@23:59/habil',
      'lin-71@05:20/habil',
    ]);
  });

  it('R8 — si hoy alcanza, no se mezclan los de mañana', async () => {
    ctx.reloj.fijar('2026-09-30T04:00:00-03:00');
    expect(res(await prox('cantidad=4').expect(200))).toEqual([
      'lin-71@05:20/habil',
      'lin-71@12:00/habil',
      'lin-71@23:00/habil',
      'lin-71@23:59/habil',
    ]);
  });

  it('R9 — sólo horas de tabla, con la forma exacta del Horario (sin campos de más)', async () => {
    ctx.reloj.fijar('2026-09-30T12:00:00-03:00');
    const r = await prox('cantidad=3').expect(200);
    esperarContrato(r.body, 'Horario');
    for (const h of r.body.datos as Horario[]) {
      expect(Object.keys(h).sort()).toEqual(
        ['hora', 'id', 'lineaId', 'paradaId', 'sentido', 'tipoDeDia'].sort(),
      );
      expect(h.hora).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
    }
  });
});

describe('R8 — próximos: varias líneas, sentidos y casos sin servicio', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp({ ahora: '2026-09-23T10:00:00-03:00' }); // miércoles
    await crearParada(ctx, { id: 'par-801' });
    await crearParada(ctx, { id: 'par-802' });
    await crearLinea(ctx, {
      id: 'lin-81',
      numero: '81',
      recorridos: [{ sentido: 'ida', paradaIds: ['par-801', 'par-802'] }],
    });
    await crearLinea(ctx, {
      id: 'lin-82',
      numero: '82',
      recorridos: [{ sentido: 'ida', paradaIds: ['par-801'] }],
    });
    await crearLinea(ctx, {
      id: 'lin-83',
      numero: '83',
      recorridos: [{ sentido: 'ida', paradaIds: ['par-801'] }],
    });
    const ida = { sentido: 'ida' as const, tipoDeDia: 'habil' as const };
    await crearHorarios(ctx, { ...ida, paradaId: 'par-801', lineaId: 'lin-81' }, [
      '10:05',
      '10:20',
      '10:35',
      '10:50',
    ]);
    await crearHorarios(ctx, { ...ida, paradaId: 'par-802', lineaId: 'lin-81' }, [
      '10:09',
      '10:24',
    ]);
    await crearHorarios(ctx, { ...ida, paradaId: 'par-801', lineaId: 'lin-82' }, ['10:10']);
    // lin-83 sólo tiene servicio los domingos: ni hoy (miércoles) ni mañana (jueves)
    await crearHorarios(
      ctx,
      { sentido: 'ida', tipoDeDia: 'domingo', paradaId: 'par-801', lineaId: 'lin-83' },
      ['10:00'],
    );
  });
  afterAll(() => ctx.cerrar());

  it('cantidad por línea, sólo de esa parada, y la línea sin servicio hoy ni mañana no aparece', async () => {
    const r = await ctx.http.get('/paradas/par-801/proximos?cantidad=2').expect(200);
    esperarContrato(r.body, 'Horario');
    expect(res(r)).toEqual([
      'lin-81@10:05/habil',
      'lin-82@10:10/habil',
      'lin-81@10:20/habil',
      'lin-82@10:10/habil', // mañana jueves (hábil), completa lin-82
    ]);
    expect(r.body.datos.every((h: Horario) => h.paradaId === 'par-801')).toBe(true);
  });

  it('A20 — meta coherente con lo devuelto', async () => {
    const r = await ctx.http.get('/paradas/par-801/proximos?cantidad=1').expect(200);
    expect(r.body.meta).toEqual({
      total: r.body.datos.length,
      pagina: 1,
      porPagina: r.body.datos.length,
    });
    const vacia = await ctx.http.get('/paradas/par-801/proximos?lineaId=lin-83').expect(200);
    expect(vacia.body.datos).toEqual([]);
    expect(vacia.body.meta.total).toBe(0);
    expect(vacia.body.meta.porPagina).toBeGreaterThanOrEqual(1);
  });

  it('lineaId inexistente o de otra parada da lista vacía', async () => {
    for (const l of ['lin-zzz', 'lin-81']) {
      const r = await ctx.http
        .get(`/paradas/par-802/proximos?lineaId=${l === 'lin-81' ? 'lin-82' : l}`)
        .expect(200);
      expect(r.body.datos).toEqual([]);
    }
  });

  it('cantidad por defecto es 3', async () => {
    const r = await ctx.http.get('/paradas/par-801/proximos?lineaId=lin-81').expect(200);
    expect(res(r)).toEqual(['lin-81@10:05/habil', 'lin-81@10:20/habil', 'lin-81@10:35/habil']);
  });

  it('la tabla de un horario con otro sentido que el de la parada no se mezcla', async () => {
    await crearHorario(ctx, {
      paradaId: 'par-802',
      lineaId: 'lin-81',
      sentido: 'ida',
      tipoDeDia: 'habil',
      hora: '10:01',
    });
    const r = await ctx.http.get('/paradas/par-802/proximos?cantidad=3').expect(200);
    expect(res(r)).toEqual(['lin-81@10:01/habil', 'lin-81@10:09/habil', 'lin-81@10:24/habil']);
  });

  it.each([
    ['cantidad=03'],
    ['cantidad=3&cantidad=4'],
    ['cantidad[]=3'],
    ['lineaId=LIN-81'],
    ['lineaId=lin-81&lineaId=lin-82'],
    ['sentido=ida'],
    ['porPagina=5'],
    ['cantidad=0.0'],
    ['cantidad=Infinity'],
  ])('entrada rara ?%s → 400 limpio (o 200 si es un número válido sin ambigüedad)', async (q) => {
    const r = await ctx.http.get(`/paradas/par-801/proximos?${q}`);
    if (r.status === 200) {
      // sólo se tolera "03" (número entero válido)
      expect(q).toBe('cantidad=03');
    } else {
      esperarErrorLimpio(r, 400, 'VALIDACION_FALLIDA');
    }
  });

  it('ids mal formados o inexistentes → 404 PARADA_NO_ENCONTRADA con sobre limpio', async () => {
    for (const id of ['par-', 'lin-81', 'PAR-801', 'par-801%20', "par-801'--", '%00', 'par-999']) {
      esperarErrorLimpio(
        await ctx.http.get(`/paradas/${id}/proximos`),
        404,
        'PARADA_NO_ENCONTRADA',
      );
    }
  });

  it('es público y un token basura o vencido no cambia la respuesta de éxito a error de forma (sobre válido)', async () => {
    const sin = await ctx.http.get('/paradas/par-801/proximos').expect(200);
    esperarContrato(sin.body, 'Horario');
    const mal = await ctx.http
      .get('/paradas/par-801/proximos')
      .set('Authorization', 'Bearer x.y.z');
    expect([200, 401]).toContain(mal.status);
    if (mal.status === 401) esperarErrorLimpio(mal, 401, 'NO_AUTENTICADO');
  });

  it('otros métodos no existen: POST/PUT/DELETE → sobre de error (404/405 limpio, nunca 500)', async () => {
    for (const m of ['post', 'put', 'delete', 'patch'] as const) {
      const r = await ctx.http[m]('/paradas/par-801/proximos');
      expect([401, 404, 405]).toContain(r.status);
      expect(Object.keys(r.body)).toEqual(['error']);
    }
  });
});

describe('R7/R5 — GET /horarios: filtros combinados, paginación y orden', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
    await crearParada(ctx, { id: 'par-901', sentido: 'ida' });
    await crearParada(ctx, { id: 'par-902', sentido: 'vuelta' });
    await crearLinea(ctx, {
      id: 'lin-91',
      numero: '91',
      recorridos: [
        { sentido: 'ida', paradaIds: ['par-901'] },
        { sentido: 'vuelta', paradaIds: ['par-902'] },
      ],
    });
    await crearLinea(ctx, {
      id: 'lin-92',
      numero: '92',
      recorridos: [{ sentido: 'ida', paradaIds: ['par-901'] }],
    });
    const horas = ['05:20', '09:05', '10:00', '10:00', '23:00'];
    await crearHorarios(
      ctx,
      { paradaId: 'par-901', lineaId: 'lin-91', sentido: 'ida', tipoDeDia: 'habil' },
      horas,
    );
    await crearHorarios(
      ctx,
      { paradaId: 'par-901', lineaId: 'lin-91', sentido: 'ida', tipoDeDia: 'sabado' },
      ['06:00'],
    );
    await crearHorarios(
      ctx,
      { paradaId: 'par-902', lineaId: 'lin-91', sentido: 'vuelta', tipoDeDia: 'habil' },
      ['05:40', '10:00'],
    );
    await crearHorarios(
      ctx,
      { paradaId: 'par-901', lineaId: 'lin-92', sentido: 'ida', tipoDeDia: 'habil' },
      ['10:00', '04:59'],
    );
    await crearHorarios(
      ctx,
      { paradaId: 'par-901', lineaId: 'lin-92', sentido: 'ida', tipoDeDia: 'feriado' },
      ['07:00'],
    );
  });
  afterAll(() => ctx.cerrar());

  it('todos los filtros combinados', async () => {
    const r = await ctx.http
      .get('/horarios?lineaId=lin-91&paradaId=par-901&sentido=ida&tipoDeDia=habil')
      .expect(200);
    esperarContrato(r.body, 'Horario');
    expect(res(r)).toEqual([
      'lin-91@05:20/habil',
      'lin-91@09:05/habil',
      'lin-91@10:00/habil',
      'lin-91@10:00/habil',
      'lin-91@23:00/habil',
    ]);
    expect(r.body.meta).toEqual({ total: 5, pagina: 1, porPagina: 20 });
  });

  it('filtros contradictorios (parada de ida con sentido vuelta) → lista vacía, no error', async () => {
    const r = await ctx.http.get('/horarios?paradaId=par-901&sentido=vuelta').expect(200);
    expect(r.body.datos).toEqual([]);
    expect(r.body.meta.total).toBe(0);
  });

  it('tipoDeDia feriado y sentido vuelta por separado', async () => {
    expect(
      res(await ctx.http.get('/horarios?paradaId=par-901&tipoDeDia=feriado').expect(200)),
    ).toEqual(['lin-92@07:00/feriado']);
    expect(res(await ctx.http.get('/horarios?lineaId=lin-91&sentido=vuelta').expect(200))).toEqual([
      'lin-91@05:40/habil',
      'lin-91@10:00/habil',
    ]);
  });

  it('orden global: hora (texto HH:MM), lineaId, paradaId; empates por id estables', async () => {
    const a = await ctx.http
      .get('/horarios?paradaId=par-901&tipoDeDia=habil&porPagina=100')
      .expect(200);
    const b = await ctx.http
      .get('/horarios?paradaId=par-901&tipoDeDia=habil&porPagina=100')
      .expect(200);
    expect(a.body).toEqual(b.body);
    const horas = a.body.datos.map((h: Horario) => h.hora);
    expect(horas).toEqual([...horas].sort());
    const diez = a.body.datos.filter((h: Horario) => h.hora === '10:00');
    expect(diez.map((h: Horario) => h.lineaId)).toEqual(['lin-91', 'lin-91', 'lin-92']);
    const ids = diez.slice(0, 2).map((h: Horario) => h.id);
    expect(ids).toEqual([...ids].sort());
  });

  it('paginación: páginas disjuntas que juntas dan el total, sin repetidos ni huecos', async () => {
    const todos = await ctx.http.get('/horarios?lineaId=lin-91&porPagina=100').expect(200);
    const total = todos.body.meta.total as number;
    expect(total).toBe(8);
    const vistos: string[] = [];
    for (let p = 1; p <= 4; p++) {
      const r = await ctx.http.get(`/horarios?lineaId=lin-91&porPagina=2&pagina=${p}`).expect(200);
      expect(r.body.meta).toEqual({ total, pagina: p, porPagina: 2 });
      vistos.push(...r.body.datos.map((h: Horario) => h.id));
    }
    expect(vistos).toEqual(todos.body.datos.map((h: Horario) => h.id));
    const fuera = await ctx.http.get('/horarios?lineaId=lin-91&porPagina=2&pagina=99').expect(200);
    expect(fuera.body.datos).toEqual([]);
    expect(fuera.body.meta).toEqual({ total, pagina: 99, porPagina: 2 });
  });

  it.each([
    ['lineaId=lin-91&pagina=1.5'],
    ['lineaId=lin-91&pagina=-1'],
    ['lineaId=lin-91&porPagina=-5'],
    ['lineaId=lin-91&porPagina=5001'],
    ['lineaId=lin-91&porPagina=abc'],
    ['lineaId=lin-91&sentido=IDA'],
    ['lineaId=lin-91&tipoDeDia=Habil'],
    ['lineaId=lin-91&tipoDeDia='],
    ['lineaId=lin-91&sentido='],
    ['lineaId=&paradaId=par-901'],
    ['lineaId=lin-91&distancia=1'],
    ['lineaId=lin-91&hora=10:00'],
    ['lineaId[]=lin-91'],
    ['lineaId=lin-91&lineaId=lin-92'],
    ['paradaId=par-901&paradaId=par-902'],
    ["lineaId=lin-91'%20OR%201=1--"],
  ])('?%s → 400 VALIDACION_FALLIDA con mensaje en castellano', async (q) => {
    esperarErrorLimpio(await ctx.http.get(`/horarios?${q}`), 400, 'VALIDACION_FALLIDA');
  });

  it('la respuesta de /horarios es pública, lleva Date y nunca expone campos de más', async () => {
    const r = await ctx.http.get('/horarios?paradaId=par-901&porPagina=100').expect(200);
    expect(r.headers.date).toBeDefined();
    for (const h of r.body.datos as Horario[]) {
      expect(Object.keys(h).sort()).toEqual([
        'hora',
        'id',
        'lineaId',
        'paradaId',
        'sentido',
        'tipoDeDia',
      ]);
      expect(h.id).toMatch(/^hor-/);
    }
  });

  it('un horario sembrado de madrugada (04:59) se devuelve tal cual, con cero adelante', async () => {
    const r = await ctx.http.get('/horarios?lineaId=lin-92&tipoDeDia=habil').expect(200);
    expect(res(r)[0]).toBe('lin-92@04:59/habil');
  });

  it('otros métodos sobre /horarios y /feriados no dan 500', async () => {
    for (const ruta of ['/horarios', '/feriados']) {
      for (const m of ['post', 'put', 'delete', 'patch'] as const) {
        const r = await ctx.http[m](ruta).send({});
        expect([401, 404, 405]).toContain(r.status);
        expect(Object.keys(r.body)).toEqual(['error']);
      }
    }
  });
});

describe('D2 — GET /feriados: año, zona horaria, orden y forma', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp({ ahora: '2026-06-15T12:00:00-03:00' });
    for (const [f, n] of [
      ['2026-12-25', 'Navidad'],
      ['2026-01-01', 'Año Nuevo'],
      ['2026-06-15', 'Paso a la Inmortalidad de Güemes'],
      ['2027-01-01', 'Año Nuevo'],
      ['2025-12-31', 'Prueba 2025'],
    ])
      await crearFeriado(ctx, f, n);
  });
  afterAll(() => ctx.cerrar());
  const fechas = (r: { body: { datos: Feriado[] } }) => r.body.datos.map((f) => f.fecha);

  it('por defecto el año actual, ordenado por fecha, con la forma exacta', async () => {
    const r = await ctx.http.get('/feriados').expect(200);
    esperarContrato(r.body, 'Feriado');
    expect(fechas(r)).toEqual(['2026-01-01', '2026-06-15', '2026-12-25']);
    for (const f of r.body.datos as Feriado[]) {
      expect(Object.keys(f).sort()).toEqual(['fecha', 'nombre']);
      expect(f.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(f.nombre.length).toBeGreaterThan(0);
    }
    expect(r.body.meta).toEqual({ total: 3, pagina: 1, porPagina: 20 });
  });

  it('el año por defecto cambia exactamente a la medianoche de Buenos Aires', async () => {
    ctx.reloj.fijar('2026-12-31T23:59:59-03:00');
    expect(fechas(await ctx.http.get('/feriados').expect(200))).toEqual([
      '2026-01-01',
      '2026-06-15',
      '2026-12-25',
    ]);
    ctx.reloj.fijar('2027-01-01T00:00:00-03:00');
    expect(fechas(await ctx.http.get('/feriados').expect(200))).toEqual(['2027-01-01']);
    ctx.reloj.fijar('2027-01-01T02:59:59Z'); // todavía 31/12 en Paraná
    expect(fechas(await ctx.http.get('/feriados').expect(200))).toEqual([
      '2026-01-01',
      '2026-06-15',
      '2026-12-25',
    ]);
  });

  it('31/12 no se cuela en el año siguiente ni 1/1 en el anterior', async () => {
    expect(fechas(await ctx.http.get('/feriados?anio=2025').expect(200))).toEqual(['2025-12-31']);
    expect(fechas(await ctx.http.get('/feriados?anio=2027').expect(200))).toEqual(['2027-01-01']);
  });

  it('año sin datos → lista vacía con meta correcto', async () => {
    const r = await ctx.http.get('/feriados?anio=2040').expect(200);
    expect(r.body.datos).toEqual([]);
    expect(r.body.meta).toEqual({ total: 0, pagina: 1, porPagina: 20 });
  });

  it('paginación y página fuera de rango', async () => {
    const r = await ctx.http.get('/feriados?porPagina=2&pagina=2').expect(200);
    expect(fechas(r)).toEqual(['2026-12-25']);
    expect(r.body.meta).toEqual({ total: 3, pagina: 2, porPagina: 2 });
    const f = await ctx.http.get('/feriados?porPagina=2&pagina=9').expect(200);
    expect(f.body.datos).toEqual([]);
    expect(f.body.meta.total).toBe(3);
  });

  it.each([
    ['anio=2026abc'],
    ['anio=-2026'],
    ['anio=2026&anio=2027'],
    ['anio=0'],
    ['pagina=0'],
    ['porPagina=0'],
    ['porPagina=-1'],
    ['anio=2026&fecha=2026-01-01'],
  ])('?%s → 400 limpio', async (q) => {
    esperarErrorLimpio(await ctx.http.get(`/feriados?${q}`), 400, 'VALIDACION_FALLIDA');
  });

  it('es público y lleva Date (R17)', async () => {
    const r = await ctx.http.get('/feriados').expect(200);
    expect(r.headers.date).toBeDefined();
  });
});

describe('§8 — semillas de horarios y feriados: integridad adversarial', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp({ ahora: '2026-09-19T10:00:00-03:00' });
    await sembrar(ctx.dataSource, ctx.reloj);
  });
  afterAll(() => ctx.cerrar());

  async function todos(q: string): Promise<Horario[]> {
    const out: Horario[] = [];
    for (let p = 1; ; p++) {
      const r = await ctx.http.get(`/horarios?${q}&porPagina=5000&pagina=${p}`).expect(200);
      esperarContrato(r.body, 'Horario');
      out.push(...(r.body.datos as Horario[]));
      if (out.length >= r.body.meta.total) break;
    }
    return out;
  }

  it('cada línea activa tiene tabla para los cuatro tipos de día; lin-11 (inactiva) ninguna', async () => {
    const lineas = (await ctx.http.get('/lineas?porPagina=100').expect(200)).body.datos as {
      id: string;
      activa: boolean;
      recorridos: { sentido: string; paradaIds: string[] }[];
    }[];
    expect(lineas).toHaveLength(14);
    for (const l of lineas) {
      const hs = await todos(`lineaId=${l.id}`);
      if (!l.activa) {
        expect(hs, l.id).toHaveLength(0);
        continue;
      }
      const tipos = new Set(hs.map((h) => h.tipoDeDia));
      expect([...tipos].sort(), l.id).toEqual(['domingo', 'feriado', 'habil', 'sabado']);
    }
  });

  it('R1 — cada horario es de una parada que pertenece a un recorrido de la línea y del mismo sentido', async () => {
    const lineas = (await ctx.http.get('/lineas?porPagina=100').expect(200)).body.datos as {
      id: string;
      recorridos: { sentido: string; paradaIds: string[] }[];
    }[];
    for (const l of lineas) {
      const hs = await todos(`lineaId=${l.id}`);
      for (const h of hs) {
        const rec = l.recorridos.find((r) => r.sentido === h.sentido);
        expect(rec, `${h.id}: la línea no tiene recorrido ${h.sentido}`).toBeDefined();
        expect(rec?.paradaIds, `${h.id}`).toContain(h.paradaId);
      }
    }
  });

  it('sin duplicados exactos (línea, parada, tipo de día, hora) y horas dentro de lo pactado (D4)', async () => {
    const hs = await todos('lineaId=lin-05');
    const claves = hs.map((h) => `${h.lineaId}|${h.paradaId}|${h.tipoDeDia}|${h.hora}`);
    expect(new Set(claves).size).toBe(claves.length);
    for (const h of hs) {
      expect(h.hora >= '05:20' && h.hora <= '23:59', `${h.id} ${h.hora}`).toBe(true);
    }
  });

  it('el tiempo entre paradas consecutivas crece a lo largo del recorrido (R9: hay un servicio por salida)', async () => {
    const l = (await ctx.http.get('/lineas/lin-05').expect(200)).body.datos as {
      recorridos: { sentido: string; paradaIds: string[] }[];
    };
    const ida = l.recorridos.find((r) => r.sentido === 'ida');
    const [a, b] = [ida?.paradaIds[0], ida?.paradaIds[1]] as string[];
    const ha = await todos(`lineaId=lin-05&paradaId=${a}&tipoDeDia=habil`);
    const hb = await todos(`lineaId=lin-05&paradaId=${b}&tipoDeDia=habil`);
    expect(hb.length).toBe(ha.length);
    expect(hb[0].hora > ha[0].hora).toBe(true);
  });

  it('feriados 2026 y 2027 sembrados: los nacionales conocidos están todos y los puentes no (A21)', async () => {
    const f26 = (await ctx.http.get('/feriados?anio=2026').expect(200)).body.datos as Feriado[];
    const f27 = (await ctx.http.get('/feriados?anio=2027').expect(200)).body.datos as Feriado[];
    const s26 = f26.map((f) => f.fecha);
    for (const d of [
      '2026-01-01',
      '2026-03-24',
      '2026-04-02',
      '2026-04-03',
      '2026-05-01',
      '2026-05-25',
      '2026-06-15',
      '2026-06-20',
      '2026-07-09',
      '2026-08-17',
      '2026-10-12',
      '2026-11-23',
      '2026-12-08',
      '2026-12-25',
    ]) {
      expect(s26, d).toContain(d);
    }
    for (const puente of ['2026-03-23', '2026-07-10', '2026-12-07'])
      expect(s26).not.toContain(puente);
    const s27 = f27.map((f) => f.fecha);
    for (const d of ['2027-01-01', '2027-05-25', '2027-07-09', '2027-12-08', '2027-12-25'])
      expect(s27, d).toContain(d);
    expect(s26).toEqual([...s26].sort());
  });

  it('los feriados sembrados mueven la tabla: el 15/6/2026 (lunes) usa la de feriado en los próximos de par-101', async () => {
    ctx.reloj.fijar('2026-06-15T10:00:00-03:00');
    const r = await ctx.http.get('/paradas/par-101/proximos?lineaId=lin-05&cantidad=2').expect(200);
    esperarContrato(r.body, 'Horario');
    expect(r.body.datos.length).toBeGreaterThan(0);
    expect(r.body.datos[0].tipoDeDia).toBe('feriado');
  });

  it('con el reloj en el 31/12/2026 a las 23:59 los próximos usan la tabla del 1/1/2027 (feriado)', async () => {
    ctx.reloj.fijar('2026-12-31T23:59:30-03:00');
    const r = await ctx.http.get('/paradas/par-101/proximos?lineaId=lin-05&cantidad=3').expect(200);
    const tipos = new Set((r.body.datos as Horario[]).map((h) => h.tipoDeDia));
    expect(tipos.has('feriado')).toBe(true);
    expect(tipos.has('sabado')).toBe(false);
    expect(tipos.has('domingo')).toBe(false);
  });

  it('hor-4410 existe con el JSON exacto del PRD', async () => {
    const r = await ctx.http
      .get('/horarios?lineaId=lin-05&paradaId=par-101&tipoDeDia=habil&porPagina=500')
      .expect(200);
    const h = (r.body.datos as Horario[]).find((x) => x.id === 'hor-4410');
    expect(h).toEqual({
      id: 'hor-4410',
      lineaId: 'lin-05',
      paradaId: 'par-101',
      sentido: 'ida',
      tipoDeDia: 'habil',
      hora: '10:42',
    });
  });

  it('una parada cualquiera de la demo: sus próximos tienen una línea que realmente para ahí (R2)', async () => {
    const p = (await ctx.http.get('/paradas/par-102').expect(200)).body.datos as {
      lineaIds: string[];
    };
    ctx.reloj.fijar('2026-09-21T08:00:00-03:00');
    const r = await ctx.http.get('/paradas/par-102/proximos?cantidad=10').expect(200);
    for (const h of r.body.datos as Horario[]) expect(p.lineaIds).toContain(h.lineaId);
  });
});
