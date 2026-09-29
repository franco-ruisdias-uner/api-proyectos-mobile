import { crearApp, type AppDePrueba } from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import {
  crearCuadrilla,
  crearTipo,
  crearZona,
  cuadradoAlrededorDe,
} from '../utilidades/catalogos.js';
import { crearOperador, crearVecino } from '../utilidades/usuarios.js';
import { TipoDeReporte } from '../../src/modulos/catalogos/tipo-de-reporte.entidad.js';
import { Cuadrilla } from '../../src/modulos/catalogos/cuadrilla.entidad.js';
import { Zona } from '../../src/modulos/catalogos/zona.entidad.js';
import { ServicioZonas } from '../../src/modulos/catalogos/zonas.servicio.js';

let ctx: AppDePrueba;
beforeAll(async () => {
  ctx = await crearApp();
});
afterAll(() => ctx.cerrar());

/** Cada describe parte de catálogos vacíos, así los totales no dependen del orden. */
async function vaciar() {
  await ctx.dataSource.getRepository(Cuadrilla).clear();
  await ctx.dataSource.getRepository(Zona).clear();
  await ctx.dataSource.getRepository(TipoDeReporte).clear();
}

describe('GET /tipos-de-reporte', () => {
  beforeEach(vaciar);

  it('M1 — es público y devuelve los tipos con la forma del PRD', async () => {
    await crearTipo(ctx, {
      id: 'tip-bache',
      nombre: 'Bache',
      icono: 'construct',
      color: '#E67E22',
      areaResponsable: 'Obras Públicas',
    });
    const res = await ctx.http().get('/tipos-de-reporte');
    expect(res.status).toBe(200);
    esperarContrato(res, 'TipoDeReporte');
    expect(res.body.datos).toEqual([
      {
        id: 'tip-bache',
        nombre: 'Bache',
        icono: 'construct',
        color: '#E67E22',
        areaResponsable: 'Obras Públicas',
      },
    ]);
    expect(res.body.meta).toEqual({ total: 1, pagina: 1, porPagina: 20 });
  });

  it('también anda con sesión (token de vecino)', async () => {
    const v = await crearVecino(ctx);
    await crearTipo(ctx);
    const res = await ctx
      .http()
      .get('/tipos-de-reporte')
      .set(...v.auth);
    expect(res.status).toBe(200);
  });

  it('lista vacía: datos [] y total 0', async () => {
    const res = await ctx.http().get('/tipos-de-reporte');
    expect(res.status).toBe(200);
    esperarContrato(res, 'TipoDeReporte');
    expect(res.body).toEqual({
      datos: [],
      meta: { total: 0, pagina: 1, porPagina: 20 },
    });
  });

  it('AGENTS §4.2 — orden por nombre, paginación y página fuera de rango', async () => {
    for (const nombre of ['Vereda', 'Bache', 'Luminaria']) {
      await crearTipo(ctx, { nombre });
    }
    const p1 = await ctx.http().get('/tipos-de-reporte?porPagina=2');
    esperarContrato(p1, 'TipoDeReporte');
    expect(p1.body.datos.map((t: { nombre: string }) => t.nombre)).toEqual([
      'Bache',
      'Luminaria',
    ]);
    expect(p1.body.meta).toEqual({ total: 3, pagina: 1, porPagina: 2 });
    const p2 = await ctx.http().get('/tipos-de-reporte?porPagina=2&pagina=2');
    expect(p2.body.datos.map((t: { nombre: string }) => t.nombre)).toEqual([
      'Vereda',
    ]);
    const fuera = await ctx.http().get('/tipos-de-reporte?pagina=9');
    expect(fuera.status).toBe(200);
    expect(fuera.body.datos).toEqual([]);
    expect(fuera.body.meta.total).toBe(3);
  });

  it('400 con una paginación mal formada o un parámetro que no existe', async () => {
    for (const q of ['pagina=0', 'porPagina=101', 'pagina=abc', 'x=1']) {
      const res = await ctx.http().get(`/tipos-de-reporte?${q}`);
      expect(res.status, q).toBe(400);
      esperarError(res, 400, 'VALIDACION_FALLIDA');
    }
  });

  it('con un token inválido en un endpoint público igual responde', async () => {
    const res = await ctx
      .http()
      .get('/tipos-de-reporte')
      .set('Authorization', 'Bearer basura');
    expect(res.status).toBe(200);
  });
});

describe('GET /zonas', () => {
  beforeEach(vaciar);

  it('M1 — es público y devuelve cada zona con su límite', async () => {
    const limite = cuadradoAlrededorDe(-33.01, -58.51);
    await crearZona(ctx, {
      id: 'zon-norte',
      nombre: 'Zona Norte',
      limite,
      referente: 'Marcela Ibarra',
    });
    const res = await ctx.http().get('/zonas');
    expect(res.status).toBe(200);
    esperarContrato(res, 'Zona');
    expect(res.body.datos).toEqual([
      {
        id: 'zon-norte',
        nombre: 'Zona Norte',
        limite,
        referente: 'Marcela Ibarra',
      },
    ]);
    expect(res.body.meta).toEqual({ total: 1, pagina: 1, porPagina: 20 });
  });

  it('orden por nombre y lista vacía', async () => {
    const vacia = await ctx.http().get('/zonas');
    expect(vacia.body.datos).toEqual([]);
    for (const nombre of ['Zona Sur', 'Zona Este', 'Zona Norte']) {
      await crearZona(ctx, { nombre });
    }
    const res = await ctx.http().get('/zonas');
    expect(res.body.datos.map((z: { nombre: string }) => z.nombre)).toEqual([
      'Zona Este',
      'Zona Norte',
      'Zona Sur',
    ]);
    expect(res.body.meta.total).toBe(3);
  });

  it('400 con paginación inválida', async () => {
    const res = await ctx.http().get('/zonas?porPagina=0');
    expect(res.status).toBe(400);
    esperarError(res, 400, 'VALIDACION_FALLIDA');
  });
});

describe('GET /cuadrillas', () => {
  let norte: Zona;
  let sur: Zona;
  beforeEach(async () => {
    await vaciar();
    norte = await crearZona(ctx, { nombre: 'Norte' });
    sur = await crearZona(ctx, { nombre: 'Sur' });
    await crearCuadrilla(ctx, {
      id: 'cua-02',
      nombre: 'Cuadrilla 2 — Bacheo',
      zonaId: norte.id,
      especialidad: 'Bacheo',
    });
    await crearCuadrilla(ctx, {
      id: 'cua-03',
      nombre: 'Cuadrilla 3 — Limpieza',
      zonaId: norte.id,
      activa: false,
    });
    await crearCuadrilla(ctx, {
      id: 'cua-04',
      nombre: 'Cuadrilla 4 — Bacheo',
      zonaId: sur.id,
    });
  });

  const ids = (res: { body: { datos: { id: string }[] } }) =>
    res.body.datos.map((c) => c.id);

  it('M1 — el operador ve las cuadrillas con la forma del PRD', async () => {
    const op = await crearOperador(ctx);
    const res = await ctx
      .http()
      .get('/cuadrillas')
      .set(...op.auth);
    expect(res.status).toBe(200);
    esperarContrato(res, 'Cuadrilla');
    expect(ids(res)).toEqual(['cua-02', 'cua-03', 'cua-04']);
    expect(res.body.datos[0]).toEqual({
      id: 'cua-02',
      nombre: 'Cuadrilla 2 — Bacheo',
      zonaId: norte.id,
      especialidad: 'Bacheo',
      activa: true,
    });
    expect(res.body.meta).toEqual({ total: 3, pagina: 1, porPagina: 20 });
  });

  it('401 sin token', async () => {
    const res = await ctx.http().get('/cuadrillas');
    expect(res.status).toBe(401);
    esperarError(res, 401, 'NO_AUTENTICADO');
  });

  it('R17 — 403 SIN_PERMISO para un vecino', async () => {
    const v = await crearVecino(ctx);
    const res = await ctx
      .http()
      .get('/cuadrillas')
      .set(...v.auth);
    expect(res.status).toBe(403);
    esperarError(res, 403, 'SIN_PERMISO');
  });

  it('filtro zonaId', async () => {
    const op = await crearOperador(ctx);
    const res = await ctx
      .http()
      .get(`/cuadrillas?zonaId=${sur.id}`)
      .set(...op.auth);
    expect(ids(res)).toEqual(['cua-04']);
    expect(res.body.meta.total).toBe(1);
  });

  it('filtro activa=true y activa=false', async () => {
    const op = await crearOperador(ctx);
    const si = await ctx
      .http()
      .get('/cuadrillas?activa=true')
      .set(...op.auth);
    expect(ids(si)).toEqual(['cua-02', 'cua-04']);
    const no = await ctx
      .http()
      .get('/cuadrillas?activa=false')
      .set(...op.auth);
    expect(ids(no)).toEqual(['cua-03']);
    esperarContrato(no, 'Cuadrilla');
  });

  it('filtros combinados y una zona sin cuadrillas devuelve lista vacía', async () => {
    const op = await crearOperador(ctx);
    const combinado = await ctx
      .http()
      .get(`/cuadrillas?zonaId=${norte.id}&activa=false`)
      .set(...op.auth);
    expect(ids(combinado)).toEqual(['cua-03']);
    const ninguna = await ctx
      .http()
      .get('/cuadrillas?zonaId=zon-inexistente')
      .set(...op.auth);
    expect(ninguna.status).toBe(200);
    expect(ninguna.body).toEqual({
      datos: [],
      meta: { total: 0, pagina: 1, porPagina: 20 },
    });
  });

  it('paginación con total filtrado', async () => {
    const op = await crearOperador(ctx);
    const res = await ctx
      .http()
      .get(`/cuadrillas?zonaId=${norte.id}&porPagina=1&pagina=2`)
      .set(...op.auth);
    expect(ids(res)).toEqual(['cua-03']);
    expect(res.body.meta).toEqual({ total: 2, pagina: 2, porPagina: 1 });
  });

  it('400 con filtros mal formados', async () => {
    const op = await crearOperador(ctx);
    for (const q of ['activa=quizas', 'zonaId=norte', 'zonaId=', 'x=1']) {
      const res = await ctx
        .http()
        .get(`/cuadrillas?${q}`)
        .set(...op.auth);
      expect(res.status, q).toBe(400);
      esperarError(res, 400, 'VALIDACION_FALLIDA');
    }
  });
});

describe('R5 — Zona de un punto (ServicioZonas.zonaDe)', () => {
  beforeEach(vaciar);

  it('devuelve la zona que contiene el punto y null si cae afuera', async () => {
    const a = await crearZona(ctx, {
      id: 'zon-a',
      limite: cuadradoAlrededorDe(-33.0, -58.5),
    });
    await crearZona(ctx, {
      id: 'zon-b',
      limite: cuadradoAlrededorDe(-33.0, -58.49),
    });
    const servicio = ctx.app.get(ServicioZonas);
    expect(
      (await servicio.zonaDe({ latitud: -33.0, longitud: -58.504 }))?.id,
    ).toBe(a.id);
    expect(
      (await servicio.zonaDe({ latitud: -33.0, longitud: -58.485 }))?.id,
    ).toBe('zon-b');
    expect(
      await servicio.zonaDe({ latitud: -34.0, longitud: -58.5 }),
    ).toBeNull();
  });
});
