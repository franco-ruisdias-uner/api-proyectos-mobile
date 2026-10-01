import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { crearHorario, crearHorarios } from '../utilidades/horarios.js';
import { crearLinea, crearParada } from '../utilidades/red.js';

interface HorarioJson {
  id: string;
  lineaId: string;
  paradaId: string;
  sentido: string;
  tipoDeDia: string;
  hora: string;
}
const horas = (r: { body: { datos: HorarioJson[] } }) => r.body.datos.map((h) => h.hora);

describe('Espec. M2 — GET /horarios (PRD §3, tipo Horario)', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
  });
  afterAll(() => ctx.cerrar());

  it('devuelve el Horario del PRD, exacto: hor-4410, 10:42 hábil', async () => {
    const parada = await crearParada(ctx, { id: 'par-101' });
    await crearLinea(ctx, {
      id: 'lin-05',
      recorridos: [{ sentido: 'ida', paradaIds: [parada.id] }],
    });
    await crearHorario(ctx, {
      id: 'hor-4410',
      lineaId: 'lin-05',
      paradaId: 'par-101',
      sentido: 'ida',
      tipoDeDia: 'habil',
      hora: '10:42',
    });
    const r = await ctx.http.get('/horarios?paradaId=par-101').expect(200);
    esperarContrato(r.body, 'Horario');
    expect(r.body.datos).toEqual([
      {
        id: 'hor-4410',
        lineaId: 'lin-05',
        paradaId: 'par-101',
        sentido: 'ida',
        tipoDeDia: 'habil',
        hora: '10:42',
      },
    ]);
    expect(r.body.meta).toEqual({ total: 1, pagina: 1, porPagina: 20 });
  });

  describe('R7 — exige lineaId o paradaId', () => {
    it.each([
      ['/horarios'],
      ['/horarios?sentido=ida'],
      ['/horarios?tipoDeDia=habil'],
      ['/horarios?sentido=ida&tipoDeDia=sabado&pagina=2'],
    ])('%s → 400 VALIDACION_FALLIDA', async (ruta) => {
      const r = await ctx.http.get(ruta);
      esperarError(r, 400, 'VALIDACION_FALLIDA');
      expect(r.body.error.mensaje).toMatch(/lineaId|paradaId/);
    });
  });

  describe('validaciones', () => {
    it.each([
      ['lineaId=par-101', 'lineaId'],
      ['lineaId=cualquiera', 'lineaId'],
      ['paradaId=lin-05', 'paradaId'],
      ['paradaId=par-101&sentido=lateral', 'sentido'],
      ['paradaId=par-101&tipoDeDia=lunes', 'tipoDeDia'],
      ['paradaId=par-101&pagina=0', 'pagina'],
      ['paradaId=par-101&porPagina=5001', 'porPagina'],
      ['paradaId=par-101&porPagina=0', 'porPagina'],
      ['paradaId=par-101&otra=1', 'otra'],
    ])('?%s → 400 VALIDACION_FALLIDA', async (consulta) => {
      esperarError(await ctx.http.get(`/horarios?${consulta}`), 400, 'VALIDACION_FALLIDA');
    });
  });

  describe('filtros', () => {
    let l1: string;
    let l2: string;
    let p1: string;
    let p2: string;
    beforeAll(async () => {
      p1 = (await crearParada(ctx, { sentido: 'ida' })).id;
      p2 = (await crearParada(ctx, { sentido: 'vuelta' })).id;
      l1 = (await crearLinea(ctx)).id;
      l2 = (await crearLinea(ctx)).id;
      await crearHorarios(ctx, { lineaId: l1, paradaId: p1, sentido: 'ida', tipoDeDia: 'habil' }, [
        '08:00',
        '07:00',
      ]);
      await crearHorarios(ctx, { lineaId: l1, paradaId: p1, sentido: 'ida', tipoDeDia: 'sabado' }, [
        '09:00',
      ]);
      await crearHorarios(
        ctx,
        { lineaId: l1, paradaId: p2, sentido: 'vuelta', tipoDeDia: 'habil' },
        ['07:30'],
      );
      await crearHorarios(
        ctx,
        { lineaId: l2, paradaId: p1, sentido: 'ida', tipoDeDia: 'domingo' },
        ['10:00'],
      );
    });

    it('por lineaId', async () => {
      const r = await ctx.http.get(`/horarios?lineaId=${l1}`).expect(200);
      esperarContrato(r.body, 'Horario');
      expect(r.body.meta.total).toBe(4);
      expect(new Set(r.body.datos.map((h: HorarioJson) => h.lineaId))).toEqual(new Set([l1]));
    });

    it('por paradaId', async () => {
      const r = await ctx.http.get(`/horarios?paradaId=${p1}`).expect(200);
      expect(r.body.meta.total).toBe(4);
    });

    it('por sentido', async () => {
      const r = await ctx.http.get(`/horarios?lineaId=${l1}&sentido=vuelta`).expect(200);
      esperarContrato(r.body, 'Horario');
      expect(horas(r)).toEqual(['07:30']);
    });

    it('por tipoDeDia', async () => {
      const r = await ctx.http.get(`/horarios?paradaId=${p1}&tipoDeDia=sabado`).expect(200);
      expect(horas(r)).toEqual(['09:00']);
      const d = await ctx.http.get(`/horarios?paradaId=${p1}&tipoDeDia=feriado`).expect(200);
      expect(d.body).toEqual({ datos: [], meta: { total: 0, pagina: 1, porPagina: 20 } });
    });

    it('combinando lineaId y paradaId', async () => {
      const r = await ctx.http.get(`/horarios?lineaId=${l2}&paradaId=${p1}`).expect(200);
      expect(horas(r)).toEqual(['10:00']);
      const vacio = await ctx.http.get(`/horarios?lineaId=${l2}&paradaId=${p2}`).expect(200);
      expect(vacio.body.datos).toEqual([]);
    });

    it('un lineaId o paradaId que no existe da lista vacía, no error', async () => {
      const r = await ctx.http.get('/horarios?lineaId=lin-99999').expect(200);
      expect(r.body).toEqual({ datos: [], meta: { total: 0, pagina: 1, porPagina: 20 } });
    });

    it('orden: hora, lineaId, paradaId (y después id)', async () => {
      const r = await ctx.http.get(`/horarios?paradaId=${p1}`).expect(200);
      expect(horas(r)).toEqual(['07:00', '08:00', '09:00', '10:00']);
    });
  });

  it('orden: si la hora empata, desempata por lineaId, paradaId y id', async () => {
    const otra = await crearApp();
    try {
      await crearParada(otra, { id: 'par-901' });
      await crearParada(otra, { id: 'par-902' });
      const filas: [string, string, string, string][] = [
        ['hor-4', 'lin-02', 'par-902', '05:20'],
        ['hor-3', 'lin-02', 'par-901', '05:20'],
        ['hor-2', 'lin-01', 'par-902', '05:20'],
        ['hor-1', 'lin-01', 'par-901', '05:20'],
        ['hor-0', 'lin-01', 'par-901', '05:20'],
        ['hor-9', 'lin-02', 'par-901', '05:19'],
      ];
      for (const [id, lineaId, paradaId, hora] of filas) {
        await crearHorario(otra, { id, lineaId, paradaId, hora });
      }
      const r = await otra.http.get('/horarios?paradaId=par-901&porPagina=100').expect(200);
      expect(r.body.datos.map((h: HorarioJson) => h.id)).toEqual([
        'hor-9',
        'hor-0',
        'hor-1',
        'hor-3',
      ]);
      const todos = await Promise.all(
        ['lin-01', 'lin-02'].map((l) => otra.http.get(`/horarios?lineaId=${l}`).expect(200)),
      );
      expect(todos[0].body.datos.map((h: HorarioJson) => h.id)).toEqual([
        'hor-0',
        'hor-1',
        'hor-2',
      ]);
    } finally {
      await otra.cerrar();
    }
  });

  describe('paginación (AGENTS §4.2)', () => {
    let ctx2: AppDePrueba;
    beforeAll(async () => {
      ctx2 = await crearApp();
      await crearParada(ctx2, { id: 'par-701' });
      await crearLinea(ctx2, { id: 'lin-70' });
      await crearHorarios(ctx2, { lineaId: 'lin-70', paradaId: 'par-701' }, [
        '05:00',
        '06:00',
        '07:00',
        '08:00',
        '09:00',
      ]);
    });
    afterAll(() => ctx2.cerrar());

    it('páginas con meta del total filtrado', async () => {
      const r = await ctx2.http.get('/horarios?paradaId=par-701&porPagina=2&pagina=2').expect(200);
      expect(horas(r)).toEqual(['07:00', '08:00']);
      expect(r.body.meta).toEqual({ total: 5, pagina: 2, porPagina: 2 });
    });

    it('una página fuera de rango da datos: [] con el total correcto', async () => {
      const r = await ctx2.http.get('/horarios?paradaId=par-701&porPagina=2&pagina=9').expect(200);
      expect(r.body).toEqual({ datos: [], meta: { total: 5, pagina: 9, porPagina: 2 } });
    });

    it('porPagina llega a 5000 (para guardar la tabla en el teléfono)', async () => {
      const r = await ctx2.http.get('/horarios?paradaId=par-701&porPagina=5000').expect(200);
      expect(r.body.meta.porPagina).toBe(5000);
      expect(r.body.datos).toHaveLength(5);
    });
  });

  it('es público: anda sin token', async () => {
    await ctx.http.get('/horarios?lineaId=lin-05').expect(200);
  });

  it('R17 — la respuesta lleva la cabecera Date', async () => {
    const r = await ctx.http.get('/horarios?lineaId=lin-05').expect(200);
    expect(r.headers.date).toBeTruthy();
  });

  it('R5 — hora siempre HH:MM con cero adelante', async () => {
    await crearHorario(ctx, { lineaId: 'lin-81', paradaId: 'par-81', hora: '05:20' });
    const r = await ctx.http.get('/horarios?lineaId=lin-81').expect(200);
    for (const h of r.body.datos as HorarioJson[])
      expect(h.hora).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
  });
});
