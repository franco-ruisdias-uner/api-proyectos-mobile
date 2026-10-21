import { crearApp, type AppDePrueba } from '../utilities/create-app.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import { conSesion, crearLugar, registrarTurista } from '../utilities/builders.js';

describe('PRD §5 — Favoritos: GET/PUT/DELETE /yo/favoritos', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
  });
  afterAll(() => ctx.cerrar());

  it('sin token, las tres rutas dan 401', async () => {
    for (const [metodo, ruta] of [
      ['get', '/yo/favoritos'],
      ['put', '/yo/favoritos/lug-001'],
      ['delete', '/yo/favoritos/lug-001'],
    ] as const) {
      esperarError(await ctx.http()[metodo](ruta), 401, 'NO_AUTENTICADO');
    }
  });

  it('lista vacía para quien no marcó nada', async () => {
    const { token } = await registrarTurista(ctx);
    const res = await ctx.http().get('/yo/favoritos').set(conSesion(token)).expect(200);
    expect(res.body).toEqual({ datos: [], meta: { total: 0, pagina: 1, porPagina: 20 } });
  });

  it('PRD §5 — PUT marca (201) con la forma del Favorito; el instante lleva -03:00', async () => {
    const { token, usuario } = await registrarTurista(ctx);
    const lugarId = await crearLugar(ctx);
    const res = await ctx.http().put(`/yo/favoritos/${lugarId}`).set(conSesion(token)).expect(201);
    esperarContrato(res.body, 'Favorito');
    expect(res.body.meta).toBeNull();
    expect(res.body.datos).toMatchObject({ usuarioId: usuario.id, lugarId });
    expect(res.body.datos.id).toMatch(/^fav-[a-z0-9]{12}$/);
    expect(res.body.datos.creadoEn).toBe('2026-11-14T12:00:00-03:00');
  });

  it('R11 — PUT dos veces deja uno: la segunda da 200 con el mismo favorito', async () => {
    const { token } = await registrarTurista(ctx);
    const lugarId = await crearLugar(ctx);
    const a = await ctx.http().put(`/yo/favoritos/${lugarId}`).set(conSesion(token)).expect(201);
    ctx.reloj.avanzar(60_000);
    const b = await ctx.http().put(`/yo/favoritos/${lugarId}`).set(conSesion(token)).expect(200);
    esperarContrato(b.body, 'Favorito');
    expect(b.body).toEqual(a.body);
    const lista = await ctx.http().get('/yo/favoritos').set(conSesion(token)).expect(200);
    expect(lista.body.meta.total).toBe(1);
  });

  it('R11 — dos PUT simultáneos: uno crea (201), el otro devuelve el existente (200), queda uno', async () => {
    const { token } = await registrarTurista(ctx);
    const lugarId = await crearLugar(ctx);
    const [a, b] = await Promise.all([
      ctx.http().put(`/yo/favoritos/${lugarId}`).set(conSesion(token)),
      ctx.http().put(`/yo/favoritos/${lugarId}`).set(conSesion(token)),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 201]);
    expect(a.body.datos.id).toBe(b.body.datos.id);
    const lista = await ctx.http().get('/yo/favoritos').set(conSesion(token)).expect(200);
    expect(lista.body.meta.total).toBe(1);
  });

  it('cada usuario tiene los suyos: lo que marca uno no lo ve el otro', async () => {
    const uno = await registrarTurista(ctx);
    const otro = await registrarTurista(ctx);
    const lugarId = await crearLugar(ctx);
    await ctx.http().put(`/yo/favoritos/${lugarId}`).set(conSesion(uno.token)).expect(201);
    const propia = await ctx.http().put(`/yo/favoritos/${lugarId}`).set(conSesion(otro.token)).expect(201);
    expect(propia.body.datos.usuarioId).toBe(otro.usuario.id);
    const listaOtro = await ctx.http().get('/yo/favoritos').set(conSesion(otro.token)).expect(200);
    expect(listaOtro.body.datos).toHaveLength(1);
    await ctx.http().delete(`/yo/favoritos/${lugarId}`).set(conSesion(uno.token)).expect(204);
    const sigue = await ctx.http().get('/yo/favoritos').set(conSesion(otro.token)).expect(200);
    expect(sigue.body.datos).toHaveLength(1);
  });

  it('PUT de un lugar que no existe, o con un id mal formado, da 404 LUGAR_NO_ENCONTRADO', async () => {
    const { token } = await registrarTurista(ctx);
    for (const id of ['lug-noexiste', 'xyz', 'usr-201', 'lug-%00']) {
      esperarError(
        await ctx.http().put(`/yo/favoritos/${id}`).set(conSesion(token)),
        404,
        'LUGAR_NO_ENCONTRADO',
      );
    }
  });

  it('D6 — un lugar dado de baja se puede marcar (su detalle existe)', async () => {
    const { token } = await registrarTurista(ctx);
    const lugarId = await crearLugar(ctx, { activo: false });
    await ctx.http().put(`/yo/favoritos/${lugarId}`).set(conSesion(token)).expect(201);
  });

  it('GET: el más nuevo primero', async () => {
    const { token } = await registrarTurista(ctx);
    const [a, b, c] = [await crearLugar(ctx), await crearLugar(ctx), await crearLugar(ctx)];
    for (const id of [a, b, c]) {
      await ctx.http().put(`/yo/favoritos/${id}`).set(conSesion(token)).expect(201);
      ctx.reloj.avanzar(60_000);
    }
    const res = await ctx.http().get('/yo/favoritos').set(conSesion(token)).expect(200);
    esperarContrato(res.body, 'Favorito');
    expect(res.body.datos.map((f: { lugarId: string }) => f.lugarId)).toEqual([c, b, a]);
  });

  it('GET: paginación, con el total correcto también fuera de rango', async () => {
    const { token } = await registrarTurista(ctx);
    for (let i = 0; i < 3; i++) {
      const id = await crearLugar(ctx);
      await ctx.http().put(`/yo/favoritos/${id}`).set(conSesion(token)).expect(201);
      ctx.reloj.avanzar(60_000);
    }
    const p2 = await ctx.http().get('/yo/favoritos?pagina=2&porPagina=2').set(conSesion(token)).expect(200);
    expect(p2.body.datos).toHaveLength(1);
    expect(p2.body.meta).toEqual({ total: 3, pagina: 2, porPagina: 2 });
    const p9 = await ctx.http().get('/yo/favoritos?pagina=9&porPagina=2').set(conSesion(token)).expect(200);
    expect(p9.body).toEqual({ datos: [], meta: { total: 3, pagina: 9, porPagina: 2 } });
  });

  it.each(['pagina=0', 'porPagina=101', 'porPagina=abc', 'otro=1'])('GET con ?%s da 400', async (q) => {
    const { token } = await registrarTurista(ctx);
    esperarError(await ctx.http().get(`/yo/favoritos?${q}`).set(conSesion(token)), 400, 'VALIDACION_FALLIDA');
  });

  it('DELETE: 204 sin cuerpo; repetido, o de algo que nunca se marcó, también 204', async () => {
    const { token } = await registrarTurista(ctx);
    const lugarId = await crearLugar(ctx);
    await ctx.http().put(`/yo/favoritos/${lugarId}`).set(conSesion(token)).expect(201);
    const res = await ctx.http().delete(`/yo/favoritos/${lugarId}`).set(conSesion(token)).expect(204);
    expect(res.text).toBe('');
    await ctx.http().delete(`/yo/favoritos/${lugarId}`).set(conSesion(token)).expect(204);
    await ctx.http().delete('/yo/favoritos/lug-noexiste').set(conSesion(token)).expect(204);
    await ctx.http().delete('/yo/favoritos/cualquiera').set(conSesion(token)).expect(204);
    const lista = await ctx.http().get('/yo/favoritos').set(conSesion(token)).expect(200);
    expect(lista.body.datos).toEqual([]);
  });

  it('después de sacarlo, se puede volver a marcar (201 y otro id)', async () => {
    const { token } = await registrarTurista(ctx);
    const lugarId = await crearLugar(ctx);
    const a = await ctx.http().put(`/yo/favoritos/${lugarId}`).set(conSesion(token)).expect(201);
    await ctx.http().delete(`/yo/favoritos/${lugarId}`).set(conSesion(token)).expect(204);
    const b = await ctx.http().put(`/yo/favoritos/${lugarId}`).set(conSesion(token)).expect(201);
    expect(b.body.datos.id).not.toBe(a.body.datos.id);
  });
});
