import { Promocion } from '../../src/modulos/promociones/promocion.entidad.js';
import { UsoDePromocion } from '../../src/modulos/usos/uso-de-promocion.entidad.js';
import { crearComercio, crearRubro } from '../utilidades/comercios.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { crearPromocion, enDias } from '../utilidades/promociones.js';
import { crearUsuario, type UsuarioDePrueba } from '../utilidades/usuarios.js';
import { crearUso } from '../utilidades/usos.js';

const FORMATO_CODIGO = /^CCU-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

describe('PRD §3 — Uso de promociones: el vecino genera un código y el comercio lo valida', () => {
  let t: AppDePrueba;
  let marta: UsuarioDePrueba;
  let juan: UsuarioDePrueba;
  let tornillo: UsuarioDePrueba;
  let otro: UsuarioDePrueba;

  beforeAll(async () => {
    t = await crearApp();
    await crearRubro(t, { id: 'rub-prueba' });
    await crearComercio(t, { id: 'com-118' });
    await crearComercio(t, { id: 'com-201' });
    await crearComercio(t, { id: 'com-baja', activo: false });
    marta = await crearUsuario(t, { id: 'usr-512' });
    juan = await crearUsuario(t, { id: 'usr-juan' });
    tornillo = await crearUsuario(t, { rol: 'comercio', comercioId: 'com-118' });
    otro = await crearUsuario(t, { rol: 'comercio', comercioId: 'com-201' });
  });
  afterAll(() => t.cerrar());

  const promoApp = (datos: Partial<Promocion> = {}) =>
    crearPromocion(t, { comercioId: 'com-118', soloApp: true, ...datos });
  const usosDe = (promocionId: string) =>
    t.dataSource.getRepository(UsoDePromocion).findBy({ promocionId });
  const usosContados = async (id: string) =>
    (await t.dataSource.getRepository(Promocion).findOneByOrFail({ id })).usos;

  describe('POST /promociones/:id/usos', () => {
    it('201: genera el código CCU-XXXX-XXXX, con la forma exacta del contrato y sin validar', async () => {
      const p = await promoApp();
      const res = await t.http().post(`/promociones/${p.id}/usos`).set(marta.auth).expect(201);
      esperarContrato(res.body, 'UsoDePromocion');
      expect(res.body.datos).toMatchObject({
        promocionId: p.id,
        usuarioId: marta.id,
        validadoEn: null,
      });
      expect(res.body.datos.id).toMatch(/^uso-[a-z0-9]{12}$/);
      expect(res.body.datos.codigo).toMatch(FORMATO_CODIGO);
    });

    it('200 con el mismo código si ya tenía uno sin validar (idempotente)', async () => {
      const p = await promoApp();
      const a = await t.http().post(`/promociones/${p.id}/usos`).set(marta.auth).expect(201);
      const b = await t.http().post(`/promociones/${p.id}/usos`).set(marta.auth).expect(200);
      esperarContrato(b.body, 'UsoDePromocion');
      expect(b.body.datos).toEqual(a.body.datos);
      expect(await usosDe(p.id)).toHaveLength(1);
    });

    it('dos pedidos simultáneos del mismo vecino dejan un solo uso y el mismo código', async () => {
      const p = await promoApp();
      const [a, b] = await Promise.all([
        t.http().post(`/promociones/${p.id}/usos`).set(marta.auth),
        t.http().post(`/promociones/${p.id}/usos`).set(marta.auth),
      ]);
      expect([a.status, b.status].sort()).toEqual([200, 201]);
      expect(a.body.datos.codigo).toBe(b.body.datos.codigo);
      expect(await usosDe(p.id)).toHaveLength(1);
    });

    it('cada vecino tiene su propio código para la misma promo', async () => {
      const p = await promoApp();
      const a = await t.http().post(`/promociones/${p.id}/usos`).set(marta.auth).expect(201);
      const b = await t.http().post(`/promociones/${p.id}/usos`).set(juan.auth).expect(201);
      expect(a.body.datos.codigo).not.toBe(b.body.datos.codigo);
      expect(b.body.datos.usuarioId).toBe(juan.id);
    });

    it('409 PROMO_YA_USADA si ya validó su código', async () => {
      const p = await promoApp();
      await crearUso(t, { promocionId: p.id, usuarioId: marta.id, validadoEn: t.reloj.ahora() });
      const res = await t.http().post(`/promociones/${p.id}/usos`).set(marta.auth).expect(409);
      esperarError(res.body, 'PROMO_YA_USADA');
      expect(await usosDe(p.id)).toHaveLength(1);
    });

    it('422 PROMO_SIN_CODIGO si la promo no es soloApp', async () => {
      const p = await promoApp({ soloApp: false });
      const res = await t.http().post(`/promociones/${p.id}/usos`).set(marta.auth).expect(422);
      esperarError(res.body, 'PROMO_SIN_CODIGO');
    });

    it('422 PROMO_VENCIDA si la promo venció', async () => {
      const p = await promoApp({ desde: enDias(t, -10), hasta: enDias(t, -1) });
      const res = await t.http().post(`/promociones/${p.id}/usos`).set(marta.auth).expect(422);
      esperarError(res.body, 'PROMO_VENCIDA');
    });

    it('422 PROMO_NO_EMPEZO si la promo todavía no empezó', async () => {
      const p = await promoApp({ desde: enDias(t, 2), hasta: enDias(t, 9) });
      const res = await t.http().post(`/promociones/${p.id}/usos`).set(marta.auth).expect(422);
      esperarError(res.body, 'PROMO_NO_EMPEZO');
    });

    it('404 PROMOCION_NO_ENCONTRADA: inexistente, mal formada, dada de baja o de un comercio dado de baja', async () => {
      const baja = await promoApp({ activa: false });
      const deBaja = await promoApp({ comercioId: 'com-baja' });
      for (const id of ['pro-noexiste', 'xx', baja.id, deBaja.id]) {
        const res = await t.http().post(`/promociones/${id}/usos`).set(marta.auth).expect(404);
        esperarError(res.body, 'PROMOCION_NO_ENCONTRADA');
      }
    });

    it('401 sin token y 403 con una cuenta de comercio', async () => {
      const p = await promoApp();
      esperarError(
        (await t.http().post(`/promociones/${p.id}/usos`).expect(401)).body,
        'NO_AUTENTICADO',
      );
      esperarError(
        (await t.http().post(`/promociones/${p.id}/usos`).set(tornillo.auth).expect(403)).body,
        'SIN_PERMISO',
      );
    });
  });

  describe('GET /yo/usos', () => {
    it('200: sólo los del vecino, con la forma exacta del contrato, los más nuevos primero', async () => {
      const lector = await crearUsuario(t);
      const a = await promoApp();
      const b = await promoApp();
      const venc = await promoApp({ desde: enDias(t, -10), hasta: enDias(t, -1) });
      const viejo = await crearUso(t, {
        promocionId: a.id,
        usuarioId: lector.id,
        generadoEn: enDias(t, -3),
        validadoEn: enDias(t, -2),
      });
      const nuevo = await crearUso(t, {
        promocionId: b.id,
        usuarioId: lector.id,
        generadoEn: enDias(t, -1),
      });
      const deVencida = await crearUso(t, {
        promocionId: venc.id,
        usuarioId: lector.id,
        generadoEn: enDias(t, -5),
      });
      await crearUso(t, { promocionId: a.id, usuarioId: marta.id });
      const res = await t.http().get('/yo/usos').set(lector.auth).expect(200);
      esperarContrato(res.body, 'UsoDePromocion');
      expect(res.body.datos.map((u: { id: string }) => u.id)).toEqual([
        nuevo.id,
        viejo.id,
        deVencida.id,
      ]);
      expect(res.body.datos[1].validadoEn).toMatch(/-03:00$/);
      expect(res.body.datos[0].validadoEn).toBeNull();
      expect(res.body.meta).toEqual({ total: 3, pagina: 1, porPagina: 20 });
    });

    it('lista vacía para quien no tiene ninguno, y paginación', async () => {
      const nuevo = await crearUsuario(t);
      const vacia = await t.http().get('/yo/usos').set(nuevo.auth).expect(200);
      expect(vacia.body).toEqual({ datos: [], meta: { total: 0, pagina: 1, porPagina: 20 } });
      for (let i = 0; i < 3; i++) {
        const p = await promoApp();
        await crearUso(t, { promocionId: p.id, usuarioId: nuevo.id, generadoEn: enDias(t, -i) });
      }
      const p2 = await t.http().get('/yo/usos?pagina=2&porPagina=2').set(nuevo.auth).expect(200);
      expect(p2.body.datos).toHaveLength(1);
      expect(p2.body.meta).toEqual({ total: 3, pagina: 2, porPagina: 2 });
      esperarError((await t.http().get('/yo/usos?porPagina=101').set(nuevo.auth).expect(400)).body);
    });

    it('401 sin token', async () => {
      esperarError((await t.http().get('/yo/usos').expect(401)).body, 'NO_AUTENTICADO');
    });
  });

  describe('POST /mi-comercio/usos/validar', () => {
    const validar = (quien: UsuarioDePrueba, cuerpo: unknown) =>
      t
        .http()
        .post('/mi-comercio/usos/validar')
        .set(quien.auth)
        .send(cuerpo as object);

    it('200: registra el uso, devuelve el UsoDePromocion con validadoEn y recalcula `usos` de la promo', async () => {
      const p = await promoApp({ usos: 99 });
      const otroUso = await crearUso(t, {
        promocionId: p.id,
        usuarioId: juan.id,
        validadoEn: t.reloj.ahora(),
      });
      const uso = await crearUso(t, { promocionId: p.id, usuarioId: marta.id });
      const res = await validar(tornillo, { codigo: uso.codigo }).expect(200);
      esperarContrato(res.body, 'UsoDePromocion');
      expect(res.body.datos).toEqual({
        id: uso.id,
        promocionId: p.id,
        usuarioId: marta.id,
        codigo: uso.codigo,
        validadoEn: '2026-10-03T12:00:00-03:00',
      });
      expect(otroUso.validadoEn).not.toBeNull();
      expect(await usosContados(p.id)).toBe(2);
    });

    it('acepta el código en minúsculas y con espacios', async () => {
      const p = await promoApp();
      const uso = await crearUso(t, { promocionId: p.id, usuarioId: marta.id });
      await validar(tornillo, { codigo: `  ${uso.codigo.toLowerCase()} ` }).expect(200);
    });

    it('409 CODIGO_YA_VALIDADO al repetir, y `usos` no se duplica', async () => {
      const p = await promoApp();
      const uso = await crearUso(t, { promocionId: p.id, usuarioId: marta.id });
      await validar(tornillo, { codigo: uso.codigo }).expect(200);
      const res = await validar(tornillo, { codigo: uso.codigo }).expect(409);
      esperarError(res.body, 'CODIGO_YA_VALIDADO');
      expect(await usosContados(p.id)).toBe(1);
    });

    it('dos escaneos simultáneos del mismo código: uno 200 y otro 409', async () => {
      const p = await promoApp();
      const uso = await crearUso(t, { promocionId: p.id, usuarioId: marta.id });
      const [a, b] = await Promise.all([
        validar(tornillo, { codigo: uso.codigo }),
        validar(tornillo, { codigo: uso.codigo }),
      ]);
      expect([a.status, b.status].sort()).toEqual([200, 409]);
      esperarError((a.status === 409 ? a : b).body, 'CODIGO_YA_VALIDADO');
      expect(await usosContados(p.id)).toBe(1);
    });

    it('404 CODIGO_INVALIDO si el código no existe o no tiene el formato', async () => {
      for (const codigo of ['CCU-ZZZZ-ZZZZ', 'hola', 'CCU-0000-0000']) {
        const res = await validar(tornillo, { codigo }).expect(404);
        esperarError(res.body, 'CODIGO_INVALIDO');
      }
    });

    it('403 PROMO_DE_OTRO_COMERCIO si la promo es de otro comercio, y el uso queda sin validar', async () => {
      const p = await promoApp();
      const uso = await crearUso(t, { promocionId: p.id, usuarioId: marta.id });
      const res = await validar(otro, { codigo: uso.codigo }).expect(403);
      esperarError(res.body, 'PROMO_DE_OTRO_COMERCIO');
      const guardado = await t.dataSource
        .getRepository(UsoDePromocion)
        .findOneByOrFail({ id: uso.id });
      expect(guardado.validadoEn).toBeNull();
    });

    it('422 PROMO_VENCIDA si la promo venció o fue dada de baja', async () => {
      const venc = await promoApp({ desde: enDias(t, -10), hasta: enDias(t, -1) });
      const baja = await promoApp({ activa: false });
      for (const p of [venc, baja]) {
        const uso = await crearUso(t, { promocionId: p.id, usuarioId: marta.id });
        const res = await validar(tornillo, { codigo: uso.codigo }).expect(422);
        esperarError(res.body, 'PROMO_VENCIDA');
        expect(await usosContados(p.id)).toBe(0);
      }
    });

    it('400 si falta el código o no es un texto', async () => {
      for (const cuerpo of [
        {},
        { codigo: '' },
        { codigo: 5 },
        { codigo: '   ' },
        { codigo: 'CCU-AAAA-AAAA', x: 1 },
      ]) {
        esperarError((await validar(tornillo, cuerpo).expect(400)).body, 'VALIDACION_FALLIDA');
      }
    });

    it('401 sin token; 403 con una cuenta de vecino o un comercio sin comercioId', async () => {
      esperarError(
        (await t.http().post('/mi-comercio/usos/validar').send({ codigo: 'x' }).expect(401)).body,
        'NO_AUTENTICADO',
      );
      esperarError(
        (await validar(marta, { codigo: 'CCU-AAAA-AAAA' }).expect(403)).body,
        'SIN_PERMISO',
      );
      const huerfano = await crearUsuario(t, { rol: 'comercio' });
      esperarError(
        (await validar(huerfano, { codigo: 'CCU-AAAA-AAAA' }).expect(403)).body,
        'SIN_PERMISO',
      );
    });

    it('el circuito completo: el vecino genera, el comercio valida, el vecino ve el uso validado', async () => {
      const p = await promoApp();
      const gen = await t.http().post(`/promociones/${p.id}/usos`).set(juan.auth).expect(201);
      await validar(tornillo, { codigo: gen.body.datos.codigo }).expect(200);
      const mios = await t.http().get('/yo/usos').set(juan.auth).expect(200);
      const mio = mios.body.datos.find((u: { id: string }) => u.id === gen.body.datos.id);
      expect(mio.validadoEn).toBe('2026-10-03T12:00:00-03:00');
      esperarError(
        (await t.http().post(`/promociones/${p.id}/usos`).set(juan.auth).expect(409)).body,
        'PROMO_YA_USADA',
      );
      const panel = await t.http().get('/mi-comercio/promociones').set(tornillo.auth).expect(200);
      expect(panel.body.datos.find((x: { id: string }) => x.id === p.id).usos).toBe(1);
    });
  });
});
