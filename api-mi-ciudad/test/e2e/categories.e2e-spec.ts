import { crearApp, type AppDePrueba } from '../utilities/create-app.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import { conSesion, crearCategoria, registrarTurista } from '../utilities/builders.js';

describe('PRD §1 — GET /categorias', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
  });
  afterAll(() => ctx.cerrar());

  it('lista vacía cuando no hay categorías', async () => {
    const res = await ctx.http().get('/categorias').expect(200);
    esperarContrato(res.body, 'Categoria');
    expect(res.body).toEqual({ datos: [], meta: { total: 0, pagina: 1, porPagina: 20 } });
  });

  it('es pública: no pide sesión (PRD §5 "para mirar no hace falta cuenta")', async () => {
    await ctx.http().get('/categorias').expect(200);
  });

  describe('con categorías', () => {
    beforeAll(async () => {
      await crearCategoria(ctx, {
        id: 'cat-museos',
        nombre: 'Museos y patrimonio',
        icono: 'business-outline',
        color: '#8E5A4A',
        orden: 3,
      });
      await crearCategoria(ctx, { id: 'cat-playas', nombre: 'Playas', orden: 1 });
      await crearCategoria(ctx, { id: 'cat-termas', nombre: 'Termas', orden: 2 });
      // Empata en orden con cat-termas: desempata por id.
      await crearCategoria(ctx, { id: 'cat-aaa', nombre: 'Empate', orden: 2 });
    });

    it('todas, por orden ascendente y desempate por id, con la forma del PRD', async () => {
      const res = await ctx.http().get('/categorias').expect(200);
      esperarContrato(res.body, 'Categoria');
      expect(res.body.datos.map((c: { id: string }) => c.id)).toEqual([
        'cat-playas',
        'cat-aaa',
        'cat-termas',
        'cat-museos',
      ]);
      expect(res.body.meta).toEqual({ total: 4, pagina: 1, porPagina: 20 });
      expect(res.body.datos[3]).toEqual({
        id: 'cat-museos',
        nombre: 'Museos y patrimonio',
        icono: 'business-outline',
        color: '#8E5A4A',
        orden: 3,
      });
    });

    it('pagina: meta correcto y página fuera de rango vacía', async () => {
      const p2 = await ctx.http().get('/categorias?pagina=2&porPagina=3').expect(200);
      esperarContrato(p2.body, 'Categoria');
      expect(p2.body.datos.map((c: { id: string }) => c.id)).toEqual(['cat-museos']);
      expect(p2.body.meta).toEqual({ total: 4, pagina: 2, porPagina: 3 });
      const fuera = await ctx.http().get('/categorias?pagina=9').expect(200);
      expect(fuera.body).toEqual({ datos: [], meta: { total: 4, pagina: 9, porPagina: 20 } });
    });

    it('R18 — PATCH /yo acepta categorías favoritas que existen', async () => {
      const { token } = await registrarTurista(ctx);
      const res = await ctx
        .http()
        .patch('/yo')
        .set(conSesion(token))
        .send({ preferencias: { categoriasFavoritas: ['cat-museos', 'cat-playas'] } })
        .expect(200);
      esperarContrato(res.body, 'Usuario');
      expect(res.body.datos.preferencias.categoriasFavoritas).toEqual(['cat-museos', 'cat-playas']);
    });

    it('R18 — CATEGORIA_NO_ENCONTRADA si alguna no existe (aunque otras sí)', async () => {
      const { token } = await registrarTurista(ctx);
      esperarError(
        await ctx
          .http()
          .patch('/yo')
          .set(conSesion(token))
          .send({ preferencias: { categoriasFavoritas: ['cat-museos', 'cat-inventada'] } }),
        422,
        'CATEGORIA_NO_ENCONTRADA',
      );
    });

    it('R18 — una categoría con otras mayúsculas no es la misma (igual en los cuatro motores)', async () => {
      const { token } = await registrarTurista(ctx);
      esperarError(
        await ctx
          .http()
          .patch('/yo')
          .set(conSesion(token))
          .send({ preferencias: { categoriasFavoritas: ['cat-MUSEOS'] } }),
        422,
        'CATEGORIA_NO_ENCONTRADA',
      );
    });
  });

  it('AGENTS §4.2 — una página alta fuera de rango da la lista vacía con el total', async () => {
    const res = await ctx.http().get('/categorias?pagina=1000000').expect(200);
    esperarContrato(res.body, 'Categoria');
    expect(res.body.datos).toEqual([]);
  });

  it.each([
    ['pagina=0', 'La página tiene que ser 1 o más.'],
    ['pagina=1000001', 'La página no puede pasar de 1000000.'],
    ['pagina=99999999999999999999', 'La página no puede pasar de 1000000.'],
    ['porPagina=101', 'La cantidad por página no puede pasar de 100.'],
    ['porPagina=abc', 'La cantidad por página tiene que ser un número entero.'],
  ])('VALIDACION_FALLIDA con %s', async (consulta, mensaje) => {
    const res = await ctx.http().get(`/categorias?${consulta}`);
    esperarError(res, 400, 'VALIDACION_FALLIDA');
    expect(res.body.error.mensaje).toBe(mensaje);
  });
});
