import { Tokens } from '../../src/comun/auth/tokens.js';
import { Promocion } from '../../src/modulos/promociones/promocion.entidad.js';
import { UsoDePromocion } from '../../src/modulos/usos/uso-de-promocion.entidad.js';
import { crearComercio, crearRubro } from '../utilidades/comercios.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { crearPromocion, enDias } from '../utilidades/promociones.js';
import { crearUsuario, type UsuarioDePrueba } from '../utilidades/usuarios.js';
import { crearUso } from '../utilidades/usos.js';

const CAMPOS_USO = ['codigo', 'id', 'promocionId', 'usuarioId', 'validadoEn'];
const FORMATO = /^CCU-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;
const PROHIBIDOS = /stack|statusCode|QueryFailed|SQLITE|constraint|undefined|null|Error:/i;

describe('ESPECIFICACION M6 — Uso de promociones (verificación adversarial)', () => {
  let t: AppDePrueba;
  let vecino: UsuarioDePrueba;
  let vecino2: UsuarioDePrueba;
  let dueno: UsuarioDePrueba;
  let otro: UsuarioDePrueba;

  beforeAll(async () => {
    t = await crearApp();
    await crearRubro(t, { id: 'rub-prueba' });
    await crearComercio(t, { id: 'com-m6a' });
    await crearComercio(t, { id: 'com-m6b' });
    await crearComercio(t, { id: 'com-m6baja', activo: false });
    vecino = await crearUsuario(t);
    vecino2 = await crearUsuario(t);
    dueno = await crearUsuario(t, { rol: 'comercio', comercioId: 'com-m6a' });
    otro = await crearUsuario(t, { rol: 'comercio', comercioId: 'com-m6b' });
  });
  afterAll(() => t.cerrar());

  const promo = (d: Partial<Promocion> = {}) =>
    crearPromocion(t, { comercioId: 'com-m6a', soloApp: true, ...d });
  const generar = (id: string, u = vecino) => t.http().post(`/promociones/${id}/usos`).set(u.auth);
  const validar = (codigo: unknown, u = dueno) =>
    t.http().post('/mi-comercio/usos/validar').set(u.auth).send({ codigo });
  const usos = async (id: string) =>
    (await t.dataSource.getRepository(Promocion).findOneByOrFail({ id })).usos;
  const filas = (promocionId: string) =>
    t.dataSource.getRepository(UsoDePromocion).findBy({ promocionId });

  describe('Forma y formato del código (D8)', () => {
    it('el uso tiene exactamente los 5 campos del contrato y el id uso-', async () => {
      const p = await promo();
      const r = await generar(p.id).expect(201);
      esperarContrato(r.body, 'UsoDePromocion');
      expect(Object.keys(r.body.datos).sort()).toEqual(CAMPOS_USO);
      expect(r.body.datos.id).toMatch(/^uso-[a-z0-9]{12}$/);
      expect(r.body.datos.codigo).toMatch(FORMATO);
    });

    it('40 códigos generados: todos distintos y sin caracteres ambiguos', async () => {
      const p = await promo();
      const us = await Promise.all(Array.from({ length: 40 }, () => crearUsuario(t)));
      const res = await Promise.all(us.map((u) => generar(p.id, u)));
      const codigos = res.map((r) => r.body.datos.codigo as string);
      expect(res.every((r) => r.status === 201)).toBe(true);
      expect(new Set(codigos).size).toBe(40);
      for (const c of codigos) expect(c).toMatch(FORMATO);
    });
  });

  describe('R11 — POST /promociones/:id/usos: bordes de vigencia', () => {
    it('hasta == ahora todavía es vigente; desde == ahora también', async () => {
      const a = await promo({ hasta: t.reloj.ahora() });
      const b = await promo({ desde: t.reloj.ahora() });
      await generar(a.id).expect(201);
      await generar(b.id).expect(201);
    });

    it('un segundo después de hasta: 422 PROMO_VENCIDA; un segundo antes de desde: 422 PROMO_NO_EMPEZO', async () => {
      const a = await promo({ hasta: new Date(t.reloj.ahora().getTime() - 1000) });
      const b = await promo({ desde: new Date(t.reloj.ahora().getTime() + 1000) });
      const ra = await generar(a.id).expect(422);
      esperarError(ra.body, 'PROMO_VENCIDA');
      const rb = await generar(b.id).expect(422);
      esperarError(rb.body, 'PROMO_NO_EMPEZO');
      expect(await filas(a.id)).toHaveLength(0);
      expect(await filas(b.id)).toHaveLength(0);
    });

    it('al mover el reloj: la promo vigente vence a las 00:00 del 1/1 (cruce de año)', async () => {
      t.reloj.fijar('2026-12-31T23:59:00-03:00');
      const p = await promo({
        desde: new Date('2026-12-01T00:00:00-03:00'),
        hasta: new Date('2026-12-31T23:59:59-03:00'),
      });
      const u = await crearUsuario(t);
      await generar(p.id, u).expect(201);
      t.reloj.fijar('2027-01-01T00:00:00-03:00');
      const u2 = await crearUsuario(t);
      esperarError((await generar(p.id, u2).expect(422)).body, 'PROMO_VENCIDA');
      t.reloj.fijar('2026-10-03T12:00:00-03:00');
    });

    it('promo sin soloApp: 422 PROMO_SIN_CODIGO y no crea fila', async () => {
      const p = await promo({ soloApp: false });
      esperarError((await generar(p.id).expect(422)).body, 'PROMO_SIN_CODIGO');
      expect(await filas(p.id)).toHaveLength(0);
    });

    it('PROMO_SIN_CODIGO tiene prioridad sobre PROMO_VENCIDA (orden documentado en A29)', async () => {
      const p = await promo({ soloApp: false, hasta: enDias(t, -1) });
      esperarError((await generar(p.id).expect(422)).body, 'PROMO_SIN_CODIGO');
    });

    it('promo dada de baja o de comercio inactivo: 404 PROMOCION_NO_ENCONTRADA', async () => {
      const a = await promo({ activa: false });
      const b = await crearPromocion(t, { comercioId: 'com-m6baja', soloApp: true });
      esperarError((await generar(a.id).expect(404)).body, 'PROMOCION_NO_ENCONTRADA');
      esperarError((await generar(b.id).expect(404)).body, 'PROMOCION_NO_ENCONTRADA');
    });

    it.each(['pro-', 'xxx-123', 'PRO-123', 'lug-123456', '1234', 'pro-no-existe-para-nada'])(
      'id "%s" → 404 PROMOCION_NO_ENCONTRADA, nunca 500',
      async (id) => {
        const r = await generar(id);
        expect([404, 400]).toContain(r.status);
        esperarError(r.body);
        expect(r.body.error.mensaje).not.toMatch(PROHIBIDOS);
      },
    );

    it('si ya lo validó: 409 PROMO_YA_USADA, y no se crea otro uso', async () => {
      const p = await promo();
      await crearUso(t, { promocionId: p.id, usuarioId: vecino.id, validadoEn: t.reloj.ahora() });
      esperarError((await generar(p.id).expect(409)).body, 'PROMO_YA_USADA');
      expect(await filas(p.id)).toHaveLength(1);
    });

    it('10 pedidos simultáneos del mismo vecino: una fila, un 201, el resto 200, mismo código, ningún 5xx', async () => {
      const p = await promo();
      const rs = await Promise.all(Array.from({ length: 10 }, () => generar(p.id)));
      expect(rs.map((r) => r.status).filter((s) => s >= 500)).toEqual([]);
      expect(rs.filter((r) => r.status === 201)).toHaveLength(1);
      expect(rs.filter((r) => r.status === 200)).toHaveLength(9);
      expect(new Set(rs.map((r) => r.body.datos.codigo)).size).toBe(1);
      expect(await filas(p.id)).toHaveLength(1);
    });

    it('permisos: sin token 401, token mal firmado 401, vencido 401, comercio 403', async () => {
      const p = await promo();
      esperarError(
        (await t.http().post(`/promociones/${p.id}/usos`).expect(401)).body,
        'NO_AUTENTICADO',
      );
      esperarError(
        (
          await t
            .http()
            .post(`/promociones/${p.id}/usos`)
            .set('Authorization', 'Bearer abc.def.ghi')
            .expect(401)
        ).body,
        'NO_AUTENTICADO',
      );
      esperarError(
        (
          await t
            .http()
            .post(`/promociones/${p.id}/usos`)
            .set('Authorization', `Bearer ${vecino.token.slice(0, -3)}xyz`)
            .expect(401)
        ).body,
        'NO_AUTENTICADO',
      );
      const viejo = t.app.get(Tokens).firmar({ id: vecino.id, rol: 'vecino' });
      t.reloj.avanzar(31 * 24 * 3600 * 1000);
      esperarError(
        (
          await t
            .http()
            .post(`/promociones/${p.id}/usos`)
            .set('Authorization', `Bearer ${viejo}`)
            .expect(401)
        ).body,
        'NO_AUTENTICADO',
      );
      t.reloj.fijar('2026-10-03T12:00:00-03:00');
      esperarError((await generar(p.id, dueno).expect(403)).body, 'SIN_PERMISO');
      expect(await filas(p.id)).toHaveLength(0);
    });

    it('el endpoint no tiene cuerpo: lo que mande el cliente no cambia de quién es el uso (DUDA: ¿400 por campos de más?)', async () => {
      const p = await promo();
      const r = await generar(p.id).send({
        usuarioId: 'usr-otro',
        validadoEn: '2026-10-03T12:00:00-03:00',
      });
      expect([201, 400]).toContain(r.status);
      if (r.status === 201) {
        expect(r.body.datos.usuarioId).toBe(vecino.id);
        expect(r.body.datos.validadoEn).toBeNull();
      }
    });

    it('no manda push al generar el código', async () => {
      const p = await promo();
      t.enviador.limpiar();
      await generar(p.id).expect(201);
      await t.avisos.esperarPendientes();
      expect(t.enviador.enviados).toEqual([]);
    });
  });

  describe('GET /yo/usos', () => {
    it('sólo los propios; los de otro vecino no se filtran; orden más nuevo primero; validado y pendiente', async () => {
      const u = await crearUsuario(t);
      const p1 = await promo();
      const p2 = await promo();
      const p3 = await promo();
      const base = t.reloj.ahora().getTime();
      const a = await crearUso(t, {
        promocionId: p1.id,
        usuarioId: u.id,
        generadoEn: new Date(base - 3000),
      });
      const b = await crearUso(t, {
        promocionId: p2.id,
        usuarioId: u.id,
        generadoEn: new Date(base - 1000),
        validadoEn: new Date(base),
      });
      await crearUso(t, { promocionId: p3.id, usuarioId: vecino2.id });
      const r = await t.http().get('/yo/usos').set(u.auth).expect(200);
      esperarContrato(r.body, 'UsoDePromocion');
      expect(r.body.meta).toEqual({ total: 2, pagina: 1, porPagina: 20 });
      expect(r.body.datos.map((x: { id: string }) => x.id)).toEqual([b.id, a.id]);
      for (const x of r.body.datos) expect(Object.keys(x).sort()).toEqual(CAMPOS_USO);
      expect(r.body.datos[0].validadoEn).toMatch(/-03:00$/);
      expect(r.body.datos[1].validadoEn).toBeNull();
    });

    it('empate de generadoEn: desempate estable por id y paginación sin repetidos', async () => {
      const u = await crearUsuario(t);
      const mismo = t.reloj.ahora();
      for (let i = 0; i < 5; i++) {
        const p = await promo();
        await crearUso(t, { promocionId: p.id, usuarioId: u.id, generadoEn: mismo });
      }
      const ids: string[] = [];
      for (const pagina of [1, 2, 3]) {
        const r = await t
          .http()
          .get(`/yo/usos?pagina=${pagina}&porPagina=2`)
          .set(u.auth)
          .expect(200);
        expect(r.body.meta).toEqual({ total: 5, pagina, porPagina: 2 });
        ids.push(...r.body.datos.map((x: { id: string }) => x.id));
      }
      expect(new Set(ids).size).toBe(5);
      const completo = await t.http().get('/yo/usos').set(u.auth);
      expect(completo.body.datos.map((x: { id: string }) => x.id)).toEqual(ids);
    });

    it('página fuera de rango: datos [] con total correcto; vacío para quien no tiene', async () => {
      const u = await crearUsuario(t);
      const p = await promo();
      await crearUso(t, { promocionId: p.id, usuarioId: u.id });
      const r = await t.http().get('/yo/usos?pagina=9').set(u.auth).expect(200);
      expect(r.body.datos).toEqual([]);
      expect(r.body.meta).toEqual({ total: 1, pagina: 9, porPagina: 20 });
      const v = await crearUsuario(t);
      const e = await t.http().get('/yo/usos').set(v.auth).expect(200);
      esperarContrato(e.body, 'UsoDePromocion');
      expect(e.body.datos).toEqual([]);
      expect(e.body.meta.total).toBe(0);
    });

    it.each(['pagina=0', 'pagina=-1', 'pagina=abc', 'porPagina=0', 'porPagina=101', 'porPagina=x'])(
      'parámetro inválido ?%s → 400 VALIDACION_FALLIDA',
      async (q) => {
        const r = await t.http().get(`/yo/usos?${q}`).set(vecino.auth).expect(400);
        esperarError(r.body, 'VALIDACION_FALLIDA');
      },
    );

    it('un uso cuya promo ya venció o se dio de baja sigue apareciendo', async () => {
      const u = await crearUsuario(t);
      const p = await promo({ hasta: enDias(t, -2), activa: false });
      await crearUso(t, { promocionId: p.id, usuarioId: u.id });
      const r = await t.http().get('/yo/usos').set(u.auth).expect(200);
      expect(r.body.meta.total).toBe(1);
    });

    it('401 sin token, con token mal firmado; un comercio recibe lista vacía', async () => {
      esperarError((await t.http().get('/yo/usos').expect(401)).body, 'NO_AUTENTICADO');
      esperarError(
        (await t.http().get('/yo/usos').set('Authorization', 'Bearer basura').expect(401)).body,
        'NO_AUTENTICADO',
      );
      const r = await t.http().get('/yo/usos').set(dueno.auth).expect(200);
      expect(r.body.datos).toEqual([]);
    });
  });

  describe('R12/R13 — POST /mi-comercio/usos/validar', () => {
    it('200: devuelve el uso con validadoEn en -03:00 sin milisegundos y usos de la promo = 1', async () => {
      const p = await promo();
      const g = await generar(p.id).expect(201);
      const r = await validar(g.body.datos.codigo).expect(200);
      esperarContrato(r.body, 'UsoDePromocion');
      expect(r.body.datos.id).toBe(g.body.datos.id);
      expect(r.body.datos.usuarioId).toBe(vecino.id);
      expect(r.body.datos.validadoEn).toBe('2026-10-03T12:00:00-03:00');
      expect(await usos(p.id)).toBe(1);
      const lista = await t.http().get('/yo/usos').set(vecino.auth).expect(200);
      const mio = lista.body.datos.find((x: { id: string }) => x.id === g.body.datos.id);
      expect(mio.validadoEn).toBe('2026-10-03T12:00:00-03:00');
    });

    it.each([
      ['2026-12-31T23:59:59-03:00'],
      ['2027-01-01T00:00:00-03:00'],
      ['2026-02-28T23:59:59-03:00'],
    ])('validadoEn con el reloj en %s lleva la fecha local y offset -03:00', async (hora) => {
      const p = await promo({
        desde: new Date('2026-01-01T00:00:00-03:00'),
        hasta: new Date('2027-06-01T00:00:00-03:00'),
      });
      const u = await crearUsuario(t);
      const g = await generar(p.id, u).expect(201);
      t.reloj.fijar(hora);
      const r = await validar(g.body.datos.codigo, {
        ...dueno,
        auth: {
          Authorization: `Bearer ${t.app.get(Tokens).firmar({ id: dueno.id, rol: 'comercio' })}`,
        },
      }).expect(200);
      expect(r.body.datos.validadoEn).toBe(hora);
      esperarContrato(r.body, 'UsoDePromocion');
      t.reloj.fijar('2026-10-03T12:00:00-03:00');
    });

    it('usos = cantidad real de validados, con varios vecinos (recalculado, no +1 sobre un valor falso)', async () => {
      const p = await promo({ usos: 50 });
      const us = await Promise.all([crearUsuario(t), crearUsuario(t), crearUsuario(t)]);
      const codigos: string[] = [];
      for (const u of us) codigos.push((await generar(p.id, u).expect(201)).body.datos.codigo);
      await crearUso(t, {
        promocionId: p.id,
        usuarioId: (await crearUsuario(t)).id,
        validadoEn: t.reloj.ahora(),
      });
      for (const c of codigos.slice(0, 2)) await validar(c).expect(200);
      expect(await usos(p.id)).toBe(3);
    });

    it('el código se acepta en minúsculas y con espacios alrededor; sin guiones es CODIGO_INVALIDO', async () => {
      const p = await promo();
      const g = await generar(p.id).expect(201);
      const c: string = g.body.datos.codigo;
      esperarError((await validar(c.replaceAll('-', '')).expect(404)).body, 'CODIGO_INVALIDO');
      await validar(`  ${c.toLowerCase()}  `).expect(200);
    });

    it.each([
      ['inexistente', 'CCU-AAAA-BBBB'],
      ['vacío', ''],
      ['sólo espacios', '   '],
      ['basura', "'; DROP TABLE usos;--"],
      ['muy largo', 'CCU-' + 'A'.repeat(5000)],
      ['con 0 y O', 'CCU-0O0O-1I1I'],
    ])('código %s → 404 CODIGO_INVALIDO (o 400 si es vacío), sin 500', async (_n, codigo) => {
      const r = await validar(codigo);
      expect([400, 404]).toContain(r.status);
      esperarError(r.body);
      if (r.status === 404) expect(r.body.error.codigo).toBe('CODIGO_INVALIDO');
      expect(r.body.error.mensaje).not.toMatch(PROHIBIDOS);
    });

    it.each([
      ['número', 12345],
      ['null', null],
      ['arreglo', ['CCU-AAAA-BBBB']],
      ['objeto', { a: 1 }],
      ['booleano', true],
    ])('codigo de tipo %s → 400 VALIDACION_FALLIDA', async (_n, codigo) => {
      esperarError((await validar(codigo).expect(400)).body, 'VALIDACION_FALLIDA');
    });

    it('sin cuerpo, cuerpo vacío o con campos de más → 400', async () => {
      for (const cuerpo of [undefined, {}, { codigo: 'CCU-AAAA-BBBB', usuarioId: 'usr-1' }]) {
        const r = await t
          .http()
          .post('/mi-comercio/usos/validar')
          .set(dueno.auth)
          .send(cuerpo as object);
        expect(r.status).toBe(400);
        esperarError(r.body, 'VALIDACION_FALLIDA');
      }
    });

    it('403 PROMO_DE_OTRO_COMERCIO: queda sin validar y `usos` no cambia', async () => {
      const p = await promo();
      const g = await generar(p.id).expect(201);
      esperarError(
        (await validar(g.body.datos.codigo, otro).expect(403)).body,
        'PROMO_DE_OTRO_COMERCIO',
      );
      expect((await filas(p.id))[0].validadoEn).toBeNull();
      expect(await usos(p.id)).toBe(0);
      await validar(g.body.datos.codigo).expect(200);
    });

    it('409 CODIGO_YA_VALIDADO al repetir; el otro comercio sigue viendo 403 antes que 409', async () => {
      const p = await promo();
      const g = await generar(p.id).expect(201);
      await validar(g.body.datos.codigo).expect(200);
      esperarError((await validar(g.body.datos.codigo).expect(409)).body, 'CODIGO_YA_VALIDADO');
      esperarError(
        (await validar(g.body.datos.codigo, otro).expect(403)).body,
        'PROMO_DE_OTRO_COMERCIO',
      );
      expect(await usos(p.id)).toBe(1);
    });

    it('promo vencida, dada de baja o que no empezó: 422 y no se valida', async () => {
      const a = await promo();
      const b = await promo();
      const c = await promo();
      const ua = await crearUso(t, { promocionId: a.id, usuarioId: vecino.id });
      const ub = await crearUso(t, { promocionId: b.id, usuarioId: vecino.id });
      const uc = await crearUso(t, { promocionId: c.id, usuarioId: vecino.id });
      await t.dataSource.getRepository(Promocion).update(a.id, { hasta: enDias(t, -1) });
      await t.dataSource.getRepository(Promocion).update(b.id, { activa: false });
      await t.dataSource.getRepository(Promocion).update(c.id, { desde: enDias(t, 1) });
      esperarError((await validar(ua.codigo).expect(422)).body, 'PROMO_VENCIDA');
      esperarError((await validar(ub.codigo).expect(422)).body, 'PROMO_VENCIDA');
      esperarError((await validar(uc.codigo).expect(422)).body, 'PROMO_NO_EMPEZO');
      for (const p of [a, b, c]) {
        expect((await filas(p.id))[0].validadoEn).toBeNull();
        expect(await usos(p.id)).toBe(0);
      }
    });

    it('un comercio vence con el reloj: generó vigente, validó después de hasta → 422', async () => {
      const p = await promo({ hasta: enDias(t, 1) });
      const g = await generar(p.id).expect(201);
      t.reloj.avanzar(2 * 24 * 3600 * 1000);
      const auth = {
        Authorization: `Bearer ${t.app.get(Tokens).firmar({ id: dueno.id, rol: 'comercio' })}`,
      };
      const r = await t
        .http()
        .post('/mi-comercio/usos/validar')
        .set(auth)
        .send({ codigo: g.body.datos.codigo });
      t.reloj.fijar('2026-10-03T12:00:00-03:00');
      expect(r.status).toBe(422);
      esperarError(r.body, 'PROMO_VENCIDA');
    });

    it('8 escaneos simultáneos del mismo código: exactamente un 200, siete 409 y usos = 1', async () => {
      const p = await promo();
      const g = await generar(p.id).expect(201);
      const rs = await Promise.all(Array.from({ length: 8 }, () => validar(g.body.datos.codigo)));
      expect(rs.filter((r) => r.status >= 500)).toEqual([]);
      expect(rs.filter((r) => r.status === 200)).toHaveLength(1);
      const perdedores = rs.filter((r) => r.status === 409);
      expect(perdedores).toHaveLength(7);
      for (const r of perdedores) esperarError(r.body, 'CODIGO_YA_VALIDADO');
      expect(await usos(p.id)).toBe(1);
    });

    it('validaciones simultáneas de códigos distintos de la misma promo: usos termina en el total', async () => {
      const p = await promo();
      const us = await Promise.all(Array.from({ length: 6 }, () => crearUsuario(t)));
      const cs = await Promise.all(us.map(async (u) => (await generar(p.id, u)).body.datos.codigo));
      const rs = await Promise.all(cs.map((c) => validar(c)));
      expect(rs.map((r) => r.status)).toEqual([200, 200, 200, 200, 200, 200]);
      expect(await usos(p.id)).toBe(6);
    });

    it('permisos: 401 sin token/vencido; 403 vecino y comercio sin comercioId', async () => {
      esperarError(
        (
          await t
            .http()
            .post('/mi-comercio/usos/validar')
            .send({ codigo: 'CCU-AAAA-BBBB' })
            .expect(401)
        ).body,
        'NO_AUTENTICADO',
      );
      esperarError((await validar('CCU-AAAA-BBBB', vecino).expect(403)).body, 'SIN_PERMISO');
      const sin = await crearUsuario(t, { rol: 'comercio' });
      esperarError((await validar('CCU-AAAA-BBBB', sin).expect(403)).body, 'SIN_PERMISO');
      const viejo = t.app.get(Tokens).firmar({ id: dueno.id, rol: 'comercio' });
      t.reloj.avanzar(31 * 24 * 3600 * 1000);
      const r = await t
        .http()
        .post('/mi-comercio/usos/validar')
        .set('Authorization', `Bearer ${viejo}`)
        .send({ codigo: 'CCU-AAAA-BBBB' });
      t.reloj.fijar('2026-10-03T12:00:00-03:00');
      expect(r.status).toBe(401);
    });

    it('un vecino no puede validar su propio código aunque mande el rol en el cuerpo', async () => {
      const p = await promo();
      const g = await generar(p.id).expect(201);
      const r = await t
        .http()
        .post('/mi-comercio/usos/validar')
        .set(vecino.auth)
        .send({ codigo: g.body.datos.codigo, comercioId: 'com-m6a' });
      expect([400, 403]).toContain(r.status);
      expect((await filas(p.id))[0].validadoEn).toBeNull();
    });

    it('un comercio dado de baja puede validar (D12/A29)', async () => {
      const baja = await crearUsuario(t, { rol: 'comercio', comercioId: 'com-m6baja' });
      const p = await crearPromocion(t, { comercioId: 'com-m6baja', soloApp: true });
      const u = await crearUso(t, { promocionId: p.id, usuarioId: vecino.id });
      await validar(u.codigo, baja).expect(200);
    });

    it('no manda push al validar', async () => {
      const p = await promo();
      const g = await generar(p.id).expect(201);
      t.enviador.limpiar();
      await validar(g.body.datos.codigo).expect(200);
      await t.avisos.esperarPendientes();
      expect(t.enviador.enviados).toEqual([]);
    });

    it('tras validar, el vecino ve PROMO_YA_USADA al intentar de nuevo', async () => {
      const p = await promo();
      const g = await generar(p.id).expect(201);
      await validar(g.body.datos.codigo).expect(200);
      esperarError((await generar(p.id).expect(409)).body, 'PROMO_YA_USADA');
      expect(await filas(p.id)).toHaveLength(1);
    });
  });

  describe('Sobre de error: sólo codigo y mensaje, en castellano', () => {
    it('ningún error de M6 filtra jerga técnica', async () => {
      const p = await promo({ soloApp: false });
      const rs = [
        await generar(p.id),
        await generar('pro-inexistente'),
        await validar('CCU-AAAA-BBBB'),
        await validar(5),
      ];
      for (const r of rs) {
        esperarError(r.body);
        expect(Object.keys(r.body.error).sort()).toEqual(['codigo', 'mensaje']);
        expect(r.body.error.mensaje).not.toMatch(PROHIBIDOS);
      }
    });
  });
});
