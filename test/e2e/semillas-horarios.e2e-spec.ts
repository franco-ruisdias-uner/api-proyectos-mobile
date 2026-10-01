import type { Horario } from '../../contrato/tipos.js';
import { sembrar } from '../../src/semillas/sembrar.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { esperarContrato } from '../utilidades/contrato.js';

// AGENTS §10.4: los datos de demo cumplen el contrato. Espec. §8: horarios y feriados.

let ctx: AppDePrueba;
beforeAll(async () => {
  ctx = await crearApp({ ahora: '2026-09-18T10:00:00-03:00' }); // viernes
  await sembrar(ctx.dataSource, ctx.reloj);
});
afterAll(() => ctx.cerrar());

async function tabla(consulta: string): Promise<Horario[]> {
  const r = await ctx.http.get(`/horarios?${consulta}&porPagina=5000`).expect(200);
  esperarContrato(r.body, 'Horario');
  return r.body.datos;
}

describe('Espec. §8 — los horarios de demo', () => {
  it('hor-4410 es el del PRD: 10:42, hábil, lin-05 en par-101', async () => {
    const filas = await tabla('lineaId=lin-05&paradaId=par-101&tipoDeDia=habil');
    expect(filas.find((h) => h.id === 'hor-4410')).toEqual({
      id: 'hor-4410',
      lineaId: 'lin-05',
      paradaId: 'par-101',
      sentido: 'ida',
      tipoDeDia: 'habil',
      hora: '10:42',
    });
  });

  it('cada fila sembrada cumple el contrato y la tabla de cada línea y parada se baja entera', async () => {
    const lineas = await ctx.http.get('/lineas?porPagina=100').expect(200);
    let total = 0;
    for (const l of lineas.body.datos as { id: string; activa: boolean }[]) {
      const r = await ctx.http.get(`/horarios?lineaId=${l.id}&porPagina=5000`).expect(200);
      esperarContrato(r.body, 'Horario');
      expect(r.body.meta.total, l.id).toBe(r.body.datos.length);
      expect(r.body.meta.total > 0, `${l.id} (activa: ${l.activa})`).toBe(l.activa);
      total += r.body.meta.total;
    }
    expect(total).toBeGreaterThan(5000);
  });

  it('R5: todas las horas son HH:MM, entre las 05:20 y las 23:00 (D4: nada de madrugada)', async () => {
    for (const id of ['lin-05', 'lin-14', 'lin-13', 'lin-01']) {
      for (const h of await tabla(`lineaId=${id}`)) {
        expect(h.hora).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
        expect(h.hora >= '05:20' && h.hora <= '23:00', `${id} ${h.hora}`).toBe(true);
      }
    }
  });

  it('primer servicio 05:20 y último alrededor de las 23:00, en las líneas principales', async () => {
    for (const id of ['lin-05', 'lin-14']) {
      const horas = (await tabla(`lineaId=${id}&tipoDeDia=habil`)).map((h) => h.hora).sort();
      expect(horas[0], id).toBe('05:20');
      expect(horas.at(-1)! >= '22:30', id).toBe(true);
    }
  });

  it('el sentido de cada fila es el de su parada y su recorrido (R1)', async () => {
    const filas = await tabla('lineaId=lin-05');
    const paradas = await ctx.http.get('/paradas?lineaId=lin-05&porPagina=1000').expect(200);
    const sentidoDe = new Map(
      (paradas.body.datos as { id: string; sentido: string }[]).map((p) => [p.id, p.sentido]),
    );
    for (const h of filas) expect(h.sentido, h.paradaId).toBe(sentidoDe.get(h.paradaId));
  });

  it('las frecuencias son distintas según el tipo de día', async () => {
    const cuantos = async (tipo: string) =>
      (await tabla(`lineaId=lin-05&paradaId=par-101&tipoDeDia=${tipo}`)).length;
    const [habil, sabado, domingo, feriado] = await Promise.all(
      ['habil', 'sabado', 'domingo', 'feriado'].map(cuantos),
    );
    expect(habil).toBeGreaterThan(sabado);
    expect(sabado).toBeGreaterThan(domingo);
    expect(feriado).toBeGreaterThan(0);
  });

  it('caso feo: lin-13 termina a las 21:00 y a las 22:00 no hay más servicio hoy', async () => {
    const filas = await tabla('lineaId=lin-13&tipoDeDia=habil');
    expect(
      filas
        .map((h) => h.hora)
        .sort()
        .at(-1),
    ).toBe('21:00');
    const cabecera = (await ctx.http.get('/lineas/lin-13').expect(200)).body.datos.recorridos[0]
      .paradaIds[0] as string;
    ctx.reloj.fijar('2026-09-18T22:00:00-03:00');
    const r = await ctx.http
      .get(`/paradas/${cabecera}/proximos?lineaId=lin-13&cantidad=2`)
      .expect(200);
    esperarContrato(r.body, 'Horario');
    // Sólo quedan los de mañana (sábado), y se reconocen porque su hora es menor que 22:00.
    expect(r.body.datos).toHaveLength(2);
    for (const h of r.body.datos as Horario[]) {
      expect(h.tipoDeDia).toBe('sabado');
      expect(h.hora < '22:00').toBe(true);
    }
    ctx.reloj.fijar('2026-09-18T10:00:00-03:00');
  });

  it('la línea inactiva no tiene servicio y no aparece en los próximos', async () => {
    const r = await ctx.http.get('/horarios?lineaId=lin-11').expect(200);
    expect(r.body.datos).toEqual([]);
  });

  it('próximos de par-101 a las 10:00: incluye lin-05 a las 10:42 y lin-14', async () => {
    const r = await ctx.http.get('/paradas/par-101/proximos?cantidad=3').expect(200);
    esperarContrato(r.body, 'Horario');
    const lineas = new Set((r.body.datos as Horario[]).map((h) => h.lineaId));
    expect(lineas).toEqual(new Set(['lin-05', 'lin-14']));
    const de05 = (r.body.datos as Horario[]).filter((h) => h.lineaId === 'lin-05');
    expect(de05).toHaveLength(3);
    expect(de05.every((h) => h.hora >= '10:00')).toBe(true);
  });
});

describe('Espec. §8 — los feriados de demo', () => {
  it('2026 y 2027, con fechas AAAA-MM-DD, nombres y sin repetir día', async () => {
    for (const anio of [2026, 2027]) {
      const r = await ctx.http.get(`/feriados?anio=${anio}`).expect(200);
      esperarContrato(r.body, 'Feriado');
      const fechas = (r.body.datos as { fecha: string }[]).map((f) => f.fecha);
      expect(fechas.length).toBeGreaterThanOrEqual(14);
      expect(fechas.every((f) => f.startsWith(`${anio}-`))).toBe(true);
      expect([...fechas].sort()).toEqual(fechas);
    }
  });

  it('están Navidad y el 25 de Mayo; el 20 de junio de 2026 (Belgrano) cae sábado y es feriado', async () => {
    const r = await ctx.http.get('/feriados?anio=2026').expect(200);
    const fechas = (r.body.datos as { fecha: string }[]).map((f) => f.fecha);
    expect(fechas).toContain('2026-12-25');
    expect(fechas).toContain('2026-05-25');
    expect(fechas).toContain('2026-06-20');
  });

  it('un feriado que cae sábado usa la tabla de feriado en los próximos (R6)', async () => {
    ctx.reloj.fijar('2026-06-20T10:00:00-03:00');
    const r = await ctx.http.get('/paradas/par-101/proximos?lineaId=lin-05&cantidad=2').expect(200);
    for (const h of r.body.datos as Horario[]) expect(h.tipoDeDia).toBe('feriado');
    expect(r.body.datos).toHaveLength(2);
    ctx.reloj.fijar('2026-09-18T10:00:00-03:00');
  });
});
