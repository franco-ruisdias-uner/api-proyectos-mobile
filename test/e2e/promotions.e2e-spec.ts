import { crearComercio, crearRubro } from '../utilities/businesses.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import { type AppDePrueba, crearApp } from '../utilities/create-app.js';
import { crearPromocion, enDias } from '../utilities/promotions.js';
import { crearUsuario } from '../utilities/users.js';

describe('PRD §3 — GET /promociones', () => {
  let t: AppDePrueba;
  beforeAll(async () => {
    t = await crearApp();
    await crearRubro(t, { id: 'rub-ferreteria' });
    await crearRubro(t, { id: 'rub-gastro' });
    await crearRubro(t, { id: 'rub-vacio' });
    await crearComercio(t, { id: 'com-118', rubroId: 'rub-ferreteria' });
    await crearComercio(t, { id: 'com-201', rubroId: 'rub-gastro' });
    await crearComercio(t, { id: 'com-baja', rubroId: 'rub-gastro', activo: false });

    await crearPromocion(t, {
      id: 'pro-441',
      comercioId: 'com-118',
      titulo: '15% en pinturas',
      detalle: 'Todas las marcas.',
      descuento: 15,
      hasta: enDias(t, 20),
    });
    await crearPromocion(t, { id: 'pro-pronto', comercioId: 'com-201', hasta: enDias(t, 2) });
    await crearPromocion(t, { id: 'pro-limite', comercioId: 'com-201', hasta: enDias(t, 3) });
    await crearPromocion(t, {
      id: 'pro-sinpct',
      comercioId: 'com-118',
      descuento: null,
      soloApp: true,
      hasta: enDias(t, 8),
    });
    await crearPromocion(t, {
      id: 'pro-proxima',
      comercioId: 'com-201',
      desde: enDias(t, 4),
      hasta: enDias(t, 30),
    });
    await crearPromocion(t, {
      id: 'pro-lejana',
      comercioId: 'com-201',
      desde: enDias(t, 8),
      hasta: enDias(t, 30),
    });
    await crearPromocion(t, {
      id: 'pro-vencida',
      comercioId: 'com-118',
      desde: enDias(t, -30),
      hasta: enDias(t, -1),
    });
    await crearPromocion(t, { id: 'pro-baja', comercioId: 'com-118', activa: false });
    await crearPromocion(t, { id: 'pro-decomercio-baja', comercioId: 'com-baja' });
  });
  afterAll(() => t.cerrar());

  const ids = (res: { body: { datos: { id: string }[] } }) => res.body.datos.map((p) => p.id);

  it('200 sin sesión: por defecto las vigentes, por `hasta`, con la forma exacta del contrato', async () => {
    const res = await t.http().get('/promociones').expect(200);
    esperarContrato(res.body, 'Promocion');
    expect(ids(res)).toEqual(['pro-pronto', 'pro-limite', 'pro-sinpct', 'pro-441']);
    expect(res.body.meta).toEqual({ total: 4, pagina: 1, porPagina: 20 });
  });

  it('la promo trae todos los campos del PRD, con instantes -03:00 y nulos en null', async () => {
    const res = await t.http().get('/promociones?comercioId=com-118').expect(200);
    const p441 = res.body.datos.find((p: { id: string }) => p.id === 'pro-441');
    expect(p441).toEqual({
      id: 'pro-441',
      comercioId: 'com-118',
      titulo: '15% en pinturas',
      detalle: 'Todas las marcas.',
      descuento: 15,
      desde: '2026-10-02T12:00:00-03:00',
      hasta: '2026-10-23T12:00:00-03:00',
      imagenUrl: null,
      soloApp: false,
      usos: 0,
      activa: true,
    });
    const sinPct = res.body.datos.find((p: { id: string }) => p.id === 'pro-sinpct');
    expect(sinPct.descuento).toBeNull();
    expect(sinPct.soloApp).toBe(true);
  });

  it('también anda con sesión', async () => {
    const u = await crearUsuario(t);
    const res = await t.http().get('/promociones').set(u.auth).expect(200);
    esperarContrato(res.body, 'Promocion');
  });

  it('estado=vigentes es el default', async () => {
    const a = await t.http().get('/promociones?estado=vigentes').expect(200);
    expect(ids(a)).toEqual(['pro-pronto', 'pro-limite', 'pro-sinpct', 'pro-441']);
  });

  it('estado=por-vencer: vigentes que vencen en 3 días o menos (D4)', async () => {
    const res = await t.http().get('/promociones?estado=por-vencer').expect(200);
    esperarContrato(res.body, 'Promocion');
    expect(ids(res)).toEqual(['pro-pronto', 'pro-limite']);
  });

  it('estado=proximas: empiezan en los próximos 7 días, por `desde` (D4)', async () => {
    const res = await t.http().get('/promociones?estado=proximas').expect(200);
    esperarContrato(res.body, 'Promocion');
    expect(ids(res)).toEqual(['pro-proxima']);
  });

  it('nunca devuelve vencidas, dadas de baja ni las de comercios inactivos (R4)', async () => {
    for (const estado of ['vigentes', 'proximas', 'por-vencer']) {
      const res = await t.http().get(`/promociones?estado=${estado}&porPagina=100`).expect(200);
      const lista = ids(res);
      expect(lista).not.toContain('pro-vencida');
      expect(lista).not.toContain('pro-baja');
      expect(lista).not.toContain('pro-decomercio-baja');
    }
  });

  it('filtra por comercioId', async () => {
    const res = await t.http().get('/promociones?comercioId=com-201').expect(200);
    expect(ids(res)).toEqual(['pro-pronto', 'pro-limite']);
  });

  it('filtra por rubroId (el del comercio)', async () => {
    const res = await t.http().get('/promociones?rubroId=rub-ferreteria').expect(200);
    expect(ids(res)).toEqual(['pro-sinpct', 'pro-441']);
  });

  it('combina filtros', async () => {
    const res = await t
      .http()
      .get('/promociones?rubroId=rub-gastro&comercioId=com-118&estado=vigentes')
      .expect(200);
    expect(res.body.datos).toEqual([]);
    expect(res.body.meta.total).toBe(0);
  });

  it('un rubro sin promociones da lista vacía', async () => {
    const res = await t.http().get('/promociones?rubroId=rub-vacio').expect(200);
    esperarContrato(res.body, 'Promocion');
    expect(res.body.datos).toEqual([]);
    expect(res.body.meta).toEqual({ total: 0, pagina: 1, porPagina: 20 });
  });

  it('pagina con el total filtrado', async () => {
    const res = await t.http().get('/promociones?pagina=2&porPagina=3').expect(200);
    expect(ids(res)).toEqual(['pro-441']);
    expect(res.body.meta).toEqual({ total: 4, pagina: 2, porPagina: 3 });
  });

  it('una página fuera de rango da lista vacía con el total correcto', async () => {
    const res = await t.http().get('/promociones?pagina=9').expect(200);
    expect(res.body.datos).toEqual([]);
    expect(res.body.meta.total).toBe(4);
  });

  it.each([
    ['estado=ayer', 'estado desconocido'],
    ['estado=', 'estado vacío'],
    ['pagina=0', 'página 0'],
    ['porPagina=101', 'demasiados por página'],
    ['rubroId=cualquiera', 'rubroId mal formado'],
    ['comercioId=123', 'comercioId mal formado'],
    ['comercioId=rub-ferreteria', 'comercioId con otro prefijo'],
  ])('400 con %s (%s)', async (consulta) => {
    const res = await t.http().get(`/promociones?${consulta}`).expect(400);
    esperarError(res.body, 'VALIDACION_FALLIDA');
  });

  it('un comercioId bien formado pero inexistente da lista vacía', async () => {
    const res = await t.http().get('/promociones?comercioId=com-nadie').expect(200);
    expect(res.body.datos).toEqual([]);
  });
});

describe('PRD §3 — GET /promociones: el reloj manda', () => {
  let t: AppDePrueba;
  beforeAll(async () => {
    t = await crearApp();
    await crearComercio(t, { id: 'com-118', rubroId: 'rub-x' });
    await crearPromocion(t, {
      id: 'pro-441',
      comercioId: 'com-118',
      desde: new Date('2026-10-04T03:00:00Z'), // 00:00 del domingo en Buenos Aires
      hasta: new Date('2026-10-05T02:59:59Z'), // 23:59:59 del domingo
    });
  });
  afterAll(() => t.cerrar());

  it('antes de `desde` es próxima; en `desde` ya es vigente; pasado `hasta` desaparece', async () => {
    const antes = await t.http().get('/promociones?estado=proximas').expect(200);
    expect(antes.body.datos.map((p: { id: string }) => p.id)).toEqual(['pro-441']);
    expect((await t.http().get('/promociones').expect(200)).body.datos).toEqual([]);

    t.reloj.fijar('2026-10-04T00:00:00-03:00');
    const justo = await t.http().get('/promociones').expect(200);
    expect(justo.body.datos.map((p: { id: string }) => p.id)).toEqual(['pro-441']);

    t.reloj.fijar('2026-10-04T23:59:59-03:00');
    expect((await t.http().get('/promociones').expect(200)).body.datos).toHaveLength(1);

    t.reloj.fijar('2026-10-05T00:00:00-03:00');
    expect((await t.http().get('/promociones').expect(200)).body.datos).toEqual([]);
    await t.http().get('/promociones/pro-441').expect(410);
  });
});

describe('PRD §3 — GET /promociones/:id', () => {
  let t: AppDePrueba;
  beforeAll(async () => {
    t = await crearApp();
    await crearComercio(t, { id: 'com-118', rubroId: 'rub-x' });
    await crearComercio(t, { id: 'com-baja', rubroId: 'rub-x', activo: false });
    await crearPromocion(t, { id: 'pro-441', comercioId: 'com-118', usos: 7 });
    await crearPromocion(t, {
      id: 'pro-proxima',
      comercioId: 'com-118',
      desde: enDias(t, 30),
      hasta: enDias(t, 60),
    });
    await crearPromocion(t, { id: 'pro-vencida', comercioId: 'com-118', hasta: enDias(t, -1) });
    await crearPromocion(t, { id: 'pro-baja', comercioId: 'com-118', activa: false });
    await crearPromocion(t, {
      id: 'pro-baja-vencida',
      comercioId: 'com-118',
      activa: false,
      hasta: enDias(t, -1),
    });
    await crearPromocion(t, { id: 'pro-decomercio-baja', comercioId: 'com-baja' });
  });
  afterAll(() => t.cerrar());

  it('200 sin sesión, con la forma exacta del contrato', async () => {
    const res = await t.http().get('/promociones/pro-441').expect(200);
    esperarContrato(res.body, 'Promocion');
    expect(res.body.datos).toMatchObject({ id: 'pro-441', comercioId: 'com-118', usos: 7 });
    expect(res.body.meta).toBeNull();
  });

  it('una promo próxima, aunque falte mucho, se puede ver', async () => {
    const res = await t.http().get('/promociones/pro-proxima').expect(200);
    esperarContrato(res.body, 'Promocion');
  });

  it('410 PROMO_VENCIDA si ya venció (R4)', async () => {
    const res = await t.http().get('/promociones/pro-vencida').expect(410);
    esperarError(res.body, 'PROMO_VENCIDA');
    expect(res.body.error.mensaje).toBe('Esa promoción ya no está vigente.');
  });

  it('404 PROMOCION_NO_ENCONTRADA si está dada de baja, aunque también esté vencida (R4)', async () => {
    for (const id of ['pro-baja', 'pro-baja-vencida']) {
      const res = await t.http().get(`/promociones/${id}`).expect(404);
      esperarError(res.body, 'PROMOCION_NO_ENCONTRADA');
    }
  });

  it('404 si es de un comercio dado de baja (R4)', async () => {
    const res = await t.http().get('/promociones/pro-decomercio-baja').expect(404);
    esperarError(res.body, 'PROMOCION_NO_ENCONTRADA');
  });

  it.each(['pro-nadie', '123', 'com-118', '%20', 'pro-'])('404 con el id «%s»', async (id) => {
    const res = await t.http().get(`/promociones/${id}`).expect(404);
    esperarError(res.body, 'PROMOCION_NO_ENCONTRADA');
  });
});
