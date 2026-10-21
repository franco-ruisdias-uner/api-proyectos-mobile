import { crearApp, type AppDePrueba } from '../utilities/create-app.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import { crearTipo, crearZona } from '../utilities/catalogs.js';
import { crearVecino, type UsuarioDePrueba } from '../utilities/users.js';
import { crearReporte } from '../utilities/reports.js';
import type { EstadoReporte } from '../../contract/types.js';
import { Adhesion } from '../../src/modules/reports/follow.entity.js';
import { CambioDeEstado } from '../../src/modules/reports/status-change.entity.js';
import { FotoDeReporte } from '../../src/modules/reports/photo.entity.js';
import { Reporte } from '../../src/modules/reports/report.entity.js';

let ctx: AppDePrueba;
let autor: UsuarioDePrueba;
let ana: UsuarioDePrueba;
let beto: UsuarioDePrueba;
let tipoId: string;
let zonaId: string;

beforeAll(async () => {
  ctx = await crearApp();
  autor = await crearVecino(ctx);
  ana = await crearVecino(ctx);
  beto = await crearVecino(ctx);
  tipoId = (await crearTipo(ctx, { id: 'tip-bache' })).id;
  zonaId = (await crearZona(ctx, { id: 'zon-a' })).id;
});
afterAll(() => ctx.cerrar());

beforeEach(async () => {
  await ctx.dataSource.getRepository(Adhesion).clear();
  await ctx.dataSource.getRepository(CambioDeEstado).clear();
  await ctx.dataSource.getRepository(FotoDeReporte).clear();
  await ctx.dataSource.getRepository(Reporte).clear();
});

const reporte = (estado: EstadoReporte = 'recibido') =>
  crearReporte(ctx, { autorId: autor.usuario.id, tipoId, zonaId, estado });

const sumar = (id: string, quien?: UsuarioDePrueba) => {
  const req = ctx.http().post(`/reportes/${id}/adhesiones`);
  return quien ? req.set(...quien.auth) : req;
};

const contadorEnBase = async (id: string) =>
  (await ctx.dataSource.getRepository(Reporte).findOneByOrFail({ id }))
    .adhesiones;

describe('POST /reportes/:id/adhesiones', () => {
  it('R10 — 201 con el Reporte actualizado', async () => {
    const r = await reporte();
    const res = await sumar(r.id, ana);
    expect(res.status).toBe(201);
    esperarContrato(res, 'Reporte');
    expect(res.body.datos.id).toBe(r.id);
    expect(res.body.datos.adhesiones).toBe(1);
    expect(res.body.datos.fotos).toHaveLength(1);
    expect(await contadorEnBase(r.id)).toBe(1);
  });

  it('el reporte público refleja la adhesión', async () => {
    const r = await reporte();
    await sumar(r.id, ana);
    await sumar(r.id, beto);
    const res = await ctx.http().get(`/reportes/${r.id}`);
    expect(res.body.datos.adhesiones).toBe(2);
    const mapa = await ctx.http().get('/reportes');
    expect(mapa.body.datos[0].adhesiones).toBe(2);
  });

  it('R10 — otra persona suma: el contador es el real de la tabla', async () => {
    const r = await reporte();
    expect((await sumar(r.id, ana)).body.datos.adhesiones).toBe(1);
    expect((await sumar(r.id, beto)).body.datos.adhesiones).toBe(2);
  });

  it('R10 — el contador se recalcula desde la tabla, no con +1', async () => {
    const r = await reporte();
    await ctx.dataSource
      .getRepository(Reporte)
      .update({ id: r.id }, { adhesiones: 40 });
    const res = await sumar(r.id, ana);
    expect(res.body.datos.adhesiones).toBe(1);
  });

  it('R10 — repetir: 200 con el mismo reporte y una sola adhesión', async () => {
    const r = await reporte();
    const primera = await sumar(r.id, ana);
    const segunda = await sumar(r.id, ana);
    expect(primera.status).toBe(201);
    expect(segunda.status).toBe(200);
    esperarContrato(segunda, 'Reporte');
    expect(segunda.body).toEqual(primera.body);
    expect(await ctx.dataSource.getRepository(Adhesion).count()).toBe(1);
  });

  it('R10 — dos pedidos a la vez de la misma persona: una adhesión, uno 201 y otro 200', async () => {
    const r = await reporte();
    const res = await Promise.all([sumar(r.id, ana), sumar(r.id, ana)]);
    expect(res.map((x) => x.status).sort()).toEqual([200, 201]);
    expect(await contadorEnBase(r.id)).toBe(1);
    expect(res[0].body.datos.adhesiones).toBe(1);
    expect(res[1].body.datos.adhesiones).toBe(1);
  });

  it('R10 — varias personas a la vez: el contador termina en el total', async () => {
    const r = await reporte();
    const otros = await Promise.all([1, 2, 3, 4].map(() => crearVecino(ctx)));
    const res = await Promise.all(otros.map((o) => sumar(r.id, o)));
    expect(res.every((x) => x.status === 201)).toBe(true);
    expect(await contadorEnBase(r.id)).toBe(4);
    expect(await ctx.dataSource.getRepository(Adhesion).count()).toBe(4);
  });

  it('ADHESION_A_REPORTE_PROPIO (422)', async () => {
    const r = await reporte();
    esperarError(await sumar(r.id, autor), 422, 'ADHESION_A_REPORTE_PROPIO');
    expect(await contadorEnBase(r.id)).toBe(0);
  });

  it.each(['resuelto', 'rechazado'] as const)(
    'REPORTE_CERRADO (422) si está %s',
    async (estado) => {
      const r = await reporte(estado);
      esperarError(await sumar(r.id, ana), 422, 'REPORTE_CERRADO');
      expect(await ctx.dataSource.getRepository(Adhesion).count()).toBe(0);
    },
  );

  it.each(['recibido', 'en_revision', 'asignado'] as const)(
    'se puede sumar a uno %s',
    async (estado) => {
      const r = await reporte(estado);
      expect((await sumar(r.id, ana)).status).toBe(201);
    },
  );

  it('sumarse a un reporte que se cerró después de haberse sumado sigue siendo 200', async () => {
    const r = await reporte();
    await sumar(r.id, ana);
    await ctx.dataSource
      .getRepository(Reporte)
      .update({ id: r.id }, { estado: 'resuelto' });
    const res = await sumar(r.id, ana);
    expect(res.status).toBe(200);
    expect(res.body.datos.adhesiones).toBe(1);
  });

  it('401 sin token', async () => {
    const r = await reporte();
    esperarError(await sumar(r.id), 401, 'NO_AUTENTICADO');
  });

  it('404 REPORTE_NO_ENCONTRADO', async () => {
    esperarError(
      await sumar('rep-noexiste', ana),
      404,
      'REPORTE_NO_ENCONTRADO',
    );
  });

  it('400 con un id mal formado', async () => {
    esperarError(await sumar('123', ana), 400, 'VALIDACION_FALLIDA');
  });
});
