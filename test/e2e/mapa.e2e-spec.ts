import { crearApp, type AppDePrueba } from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import {
  crearTipo,
  crearZona,
  cuadradoAlrededorDe,
} from '../utilidades/catalogos.js';
import { crearVecino, type UsuarioDePrueba } from '../utilidades/usuarios.js';
import { crearReporte, ROCAMORA } from '../utilidades/reportes.js';
import type { EstadoReporte } from '../../contrato/tipos.js';
import { CambioDeEstado } from '../../src/modulos/reportes/cambio-de-estado.entidad.js';
import { FotoDeReporte } from '../../src/modulos/reportes/foto.entidad.js';
import { Reporte } from '../../src/modulos/reportes/reporte.entidad.js';

let ctx: AppDePrueba;
let vecino: UsuarioDePrueba;
let bache: string;
let luz: string;
let zonaA: string;
let zonaB: string;

/** Grados de latitud por metro (aprox.). */
const M = 1 / 111_195;

const en = (norteMetros: number, esteMetros = 0) => ({
  latitud: ROCAMORA.latitud + norteMetros * M,
  longitud: ROCAMORA.longitud + esteMetros * M * 1.19,
});

beforeAll(async () => {
  ctx = await crearApp();
  vecino = await crearVecino(ctx);
  bache = (await crearTipo(ctx, { id: 'tip-bache' })).id;
  luz = (await crearTipo(ctx, { id: 'tip-luminaria', nombre: 'Luminaria' })).id;
  zonaA = (
    await crearZona(ctx, {
      id: 'zon-aaa',
      limite: cuadradoAlrededorDe(ROCAMORA.latitud, ROCAMORA.longitud),
    })
  ).id;
  zonaB = (
    await crearZona(ctx, {
      id: 'zon-bbb',
      nombre: 'Otra',
      limite: cuadradoAlrededorDe(ROCAMORA.latitud - 1, ROCAMORA.longitud),
    })
  ).id;
});
afterAll(() => ctx.cerrar());

beforeEach(async () => {
  await ctx.dataSource.getRepository(CambioDeEstado).clear();
  await ctx.dataSource.getRepository(FotoDeReporte).clear();
  await ctx.dataSource.getRepository(Reporte).clear();
});

const nuevo = (
  extra: Partial<Reporte> & { estado?: EstadoReporte } = {},
  fotos = 1,
) =>
  crearReporte(
    ctx,
    { autorId: vecino.usuario.id, tipoId: bache, zonaId: zonaA, ...extra },
    { fotos },
  );

const mapa = (query = '') => ctx.http().get(`/reportes${query}`);
const ids = (res: { body: { datos: { id: string }[] } }) =>
  res.body.datos.map((r) => r.id);

describe('GET /reportes — el mapa de la ciudad', () => {
  it('M3 — es público, devuelve Reporte[] con la forma del PRD y meta de paginación', async () => {
    const r = await nuevo();
    const res = await mapa();
    expect(res.status).toBe(200);
    esperarContrato(res, 'Reporte');
    expect(ids(res)).toEqual([r.id]);
    expect(res.body.meta).toEqual({ total: 1, pagina: 1, porPagina: 20 });
    expect(res.body.datos[0].fotos).toHaveLength(1);
  });

  it('lista vacía', async () => {
    const res = await mapa();
    expect(res.status).toBe(200);
    expect(res.body.datos).toEqual([]);
    expect(res.body.meta).toEqual({ total: 0, pagina: 1, porPagina: 20 });
  });

  it('D10 — sin filtro de estado no incluye los rechazados, pero sí los resueltos', async () => {
    const abierto = await nuevo({ estado: 'recibido' });
    const resuelto = await nuevo({ estado: 'resuelto' });
    await nuevo({ estado: 'rechazado' });
    const res = await mapa();
    expect(ids(res).sort()).toEqual([abierto.id, resuelto.id].sort());
    expect(res.body.meta.total).toBe(2);
  });

  it('estado: uno, varios separados por coma, y rechazado si se pide', async () => {
    const a = await nuevo({ estado: 'recibido' });
    const b = await nuevo({ estado: 'asignado' });
    const c = await nuevo({ estado: 'rechazado' });
    await nuevo({ estado: 'resuelto' });
    expect(ids(await mapa('?estado=asignado'))).toEqual([b.id]);
    expect(ids(await mapa('?estado=recibido,asignado')).sort()).toEqual(
      [a.id, b.id].sort(),
    );
    expect(ids(await mapa('?estado=rechazado'))).toEqual([c.id]);
  });

  it('tipoId y zonaId', async () => {
    const a = await nuevo({ tipoId: bache, zonaId: zonaA });
    const b = await nuevo({ tipoId: luz, zonaId: zonaB });
    expect(ids(await mapa(`?tipoId=${luz}`))).toEqual([b.id]);
    expect(ids(await mapa(`?zonaId=${zonaA}`))).toEqual([a.id]);
    expect(ids(await mapa(`?zonaId=${zonaA}&tipoId=${luz}`))).toEqual([]);
    expect(ids(await mapa('?tipoId=tip-inexistente'))).toEqual([]);
  });

  it('caja visible del mapa: norte, sur, este, oeste', async () => {
    const dentro = await nuevo({ ...en(0, 0) });
    await nuevo({ ...en(500, 0) });
    await nuevo({ ...en(0, 500) });
    const c = en(0, 0);
    const caja = `norte=${c.latitud + 0.001}&sur=${c.latitud - 0.001}&este=${c.longitud + 0.001}&oeste=${c.longitud - 0.001}`;
    const res = await mapa(`?${caja}`);
    expect(res.status).toBe(200);
    expect(ids(res)).toEqual([dentro.id]);
    expect(res.body.meta.total).toBe(1);
  });

  it('radio: latitud + longitud + radioMetros, del más cercano al más lejano', async () => {
    const lejos = await nuevo({ ...en(90) });
    const cerca = await nuevo({ ...en(10) });
    const medio = await nuevo({ ...en(0, 40) });
    await nuevo({ ...en(300) });
    const res = await mapa(
      `?latitud=${ROCAMORA.latitud}&longitud=${ROCAMORA.longitud}&radioMetros=100`,
    );
    expect(res.status).toBe(200);
    expect(ids(res)).toEqual([cerca.id, medio.id, lejos.id]);
    expect(res.body.meta.total).toBe(3);
  });

  it('el radio pagina sobre el total filtrado', async () => {
    for (let i = 1; i <= 5; i++) await nuevo({ ...en(i * 10) });
    await nuevo({ ...en(1000) });
    const q = `latitud=${ROCAMORA.latitud}&longitud=${ROCAMORA.longitud}&radioMetros=100`;
    const p2 = await mapa(`?${q}&pagina=2&porPagina=2`);
    expect(p2.body.datos).toHaveLength(2);
    expect(p2.body.meta).toEqual({ total: 5, pagina: 2, porPagina: 2 });
    const p9 = await mapa(`?${q}&pagina=9&porPagina=2`);
    expect(p9.body.datos).toEqual([]);
    expect(p9.body.meta.total).toBe(5);
  });

  it('paginación: desde el más nuevo, con total filtrado y página fuera de rango vacía', async () => {
    const viejo = await nuevo({ creadoEn: new Date('2026-09-01T12:00:00Z') });
    const medio = await nuevo({ creadoEn: new Date('2026-09-05T12:00:00Z') });
    const nuevito = await nuevo({ creadoEn: new Date('2026-09-10T12:00:00Z') });
    const p1 = await mapa('?porPagina=2');
    expect(ids(p1)).toEqual([nuevito.id, medio.id]);
    expect(p1.body.meta).toEqual({ total: 3, pagina: 1, porPagina: 2 });
    expect(ids(await mapa('?porPagina=2&pagina=2'))).toEqual([viejo.id]);
    const fuera = await mapa('?porPagina=2&pagina=7');
    expect(fuera.body.datos).toEqual([]);
    expect(fuera.body.meta.total).toBe(3);
  });

  it('porPagina admite hasta 500 (y no más)', async () => {
    expect((await mapa('?porPagina=500')).status).toBe(200);
    esperarError(await mapa('?porPagina=501'), 400, 'VALIDACION_FALLIDA');
  });

  it('el orden empata por id', async () => {
    const creadoEn = new Date('2026-09-01T12:00:00Z');
    const a = await nuevo({ creadoEn });
    const b = await nuevo({ creadoEn });
    expect(ids(await mapa())).toEqual([a.id, b.id].sort().reverse());
  });

  it.each([
    '?estado=cerrado',
    '?estado=',
    '?estado=recibido,',
    '?latitud=-33',
    '?longitud=-58',
    `?latitud=-33&longitud=-58`,
    `?latitud=-33&radioMetros=100`,
    '?latitud=abc&longitud=-58&radioMetros=100',
    '?latitud=&longitud=-58&radioMetros=100',
    '?latitud=91&longitud=-58&radioMetros=100',
    '?latitud=-33&longitud=-58&radioMetros=0',
    '?latitud=-33&longitud=-58&radioMetros=-5',
    '?norte=-33&sur=-34&este=-58',
    '?norte=-33&sur=-34&oeste=-59',
    '?norte=-34&sur=-33&este=-58&oeste=-59',
    '?norte=-33&sur=-34&este=-59&oeste=-58',
    '?norte=x&sur=-34&este=-58&oeste=-59',
    '?zonaId=norte',
    '?tipoId=bache',
    '?tipoId=a&tipoId=b',
    '?pagina=0',
    '?campoExtra=1',
  ])('400 con %s', async (query) => {
    const res = await mapa(query);
    esperarError(res, 400, 'VALIDACION_FALLIDA');
  });

  it('un reporte sin duplicado y uno duplicado (rechazado) siguen la misma regla del estado', async () => {
    const original = await nuevo();
    await nuevo({ estado: 'rechazado', duplicadoDe: original.id });
    expect(ids(await mapa())).toEqual([original.id]);
  });
});

describe('GET /reportes/cercanos', () => {
  const cercanos = (query = '') =>
    ctx
      .http()
      .get(
        `/reportes/cercanos?latitud=${ROCAMORA.latitud}&longitud=${ROCAMORA.longitud}${query}`,
      );

  it('R9 — público; los abiertos a menos de 50 m, del más cercano al más lejano', async () => {
    const c30 = await nuevo({ ...en(30) });
    const c5 = await nuevo({ ...en(0, 5) });
    const c45 = await nuevo({ ...en(-45) });
    await nuevo({ ...en(80) });
    const res = await cercanos();
    expect(res.status).toBe(200);
    esperarContrato(res, 'Reporte');
    expect(ids(res)).toEqual([c5.id, c30.id, c45.id]);
    expect(res.body.meta).toEqual({ total: 3, pagina: 1, porPagina: 20 });
  });

  it('R9 — sólo recibido, en_revision y asignado', async () => {
    const a = await nuevo({ estado: 'recibido', ...en(5) });
    const b = await nuevo({ estado: 'en_revision', ...en(6) });
    const c = await nuevo({ estado: 'asignado', ...en(7) });
    await nuevo({ estado: 'resuelto', ...en(8) });
    await nuevo({ estado: 'rechazado', ...en(9) });
    expect(ids(await cercanos())).toEqual([a.id, b.id, c.id]);
  });

  it('R9 — excluye los marcados como duplicado', async () => {
    const original = await nuevo({ ...en(5) });
    await nuevo({ ...en(6), duplicadoDe: original.id });
    expect(ids(await cercanos())).toEqual([original.id]);
  });

  it('D9 — cualquier tipo; tipoId filtra', async () => {
    const b = await nuevo({ tipoId: bache, ...en(5) });
    const l = await nuevo({ tipoId: luz, ...en(6) });
    expect(ids(await cercanos())).toEqual([b.id, l.id]);
    expect(ids(await cercanos(`&tipoId=${luz}`))).toEqual([l.id]);
    expect(ids(await cercanos('&tipoId=tip-otro'))).toEqual([]);
  });

  it('radioMetros: hasta 200', async () => {
    const lejos = await nuevo({ ...en(150) });
    expect(ids(await cercanos())).toEqual([]);
    expect(ids(await cercanos('&radioMetros=200'))).toEqual([lejos.id]);
    expect(ids(await cercanos('&radioMetros=100'))).toEqual([]);
    esperarError(await cercanos('&radioMetros=201'), 400, 'VALIDACION_FALLIDA');
  });

  it('lista vacía y paginación', async () => {
    expect((await cercanos()).body).toEqual({
      datos: [],
      meta: { total: 0, pagina: 1, porPagina: 20 },
    });
    for (let i = 1; i <= 4; i++) await nuevo({ ...en(i) });
    const res = await cercanos('&porPagina=3&pagina=2');
    expect(res.body.datos).toHaveLength(1);
    expect(res.body.meta).toEqual({ total: 4, pagina: 2, porPagina: 3 });
    esperarError(await cercanos('&porPagina=101'), 400, 'VALIDACION_FALLIDA');
  });

  it.each([
    '/reportes/cercanos',
    '/reportes/cercanos?latitud=-33',
    '/reportes/cercanos?longitud=-58',
    '/reportes/cercanos?latitud=x&longitud=-58',
    '/reportes/cercanos?latitud=-33&longitud=200',
    '/reportes/cercanos?latitud=-33&longitud=-58&radioMetros=0',
    '/reportes/cercanos?latitud=-33&longitud=-58&tipoId=malo',
    '/reportes/cercanos?latitud=-33&longitud=-58&estado=recibido',
  ])('400 con %s', async (ruta) => {
    esperarError(await ctx.http().get(ruta), 400, 'VALIDACION_FALLIDA');
  });
});
