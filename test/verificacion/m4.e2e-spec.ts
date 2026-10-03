import { Comercio } from '../../src/modulos/comercios/comercio.entidad.js';
import { Resena } from '../../src/modulos/resenas/resena.entidad.js';
import { crearComercio, crearRubro } from '../utilidades/comercios.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { crearResena } from '../utilidades/resenas.js';
import { crearUsuario, type UsuarioDePrueba } from '../utilidades/usuarios.js';

describe('ESPECIFICACION M4 — Reseñas (verificación adversarial)', () => {
  let t: AppDePrueba;
  let marta: UsuarioDePrueba;
  let juan: UsuarioDePrueba;
  let tornillo: UsuarioDePrueba;
  let n = 0;

  beforeAll(async () => {
    t = await crearApp();
    await crearRubro(t, { id: 'rub-v' });
    marta = await crearUsuario(t);
    juan = await crearUsuario(t);
    tornillo = await crearUsuario(t, { rol: 'comercio', comercioId: 'com-vtt' });
    await crearComercio(t, { id: 'com-vtt', rubroId: 'rub-v' });
  });
  afterAll(() => t.cerrar());

  const nuevo = async (datos: Partial<Comercio> = {}) => {
    n += 1;
    return crearComercio(t, { id: `com-vv${n}x`, rubroId: 'rub-v', ...datos });
  };
  const puntajeDe = async (id: string) => {
    const c = await t.dataSource.getRepository(Comercio).findOneByOrFail({ id });
    return [c.puntaje, c.cantidadResenas];
  };
  const crear = (c: string, u: UsuarioDePrueba, cuerpo: object) =>
    t.http().post(`/comercios/${c}/resenas`).set(u.auth).send(cuerpo);

  describe('R8 — puntaje: un decimal y recálculo', () => {
    it.each([
      [[5, 4, 4, 4], 4.3], // 4.25
      [[1, 1, 2], 1.3], // 1.333
      [[5, 5, 4], 4.7], // 4.666
      [[1, 2], 1.5],
      [[3], 3],
    ])('estrellas %j → puntaje %d (devuelto por /comercios/:id)', async (estrellas, esperado) => {
      const c = await nuevo();
      for (const e of estrellas) {
        const u = await crearUsuario(t);
        await crear(c.id, u, { estrellas: e, comentario: 'ok' }).expect(201);
      }
      const res = await t.http().get(`/comercios/${c.id}`).expect(200);
      esperarContrato(res.body, 'Comercio');
      expect(res.body.datos.puntaje).toBe(esperado);
      expect(res.body.datos.cantidadResenas).toBe(estrellas.length);
    });

    it('borrar la reseña de otro vecino no altera la de este; al quedar sin ninguna vuelve a 0', async () => {
      const c = await nuevo();
      const a = await crear(c.id, marta, { estrellas: 5, comentario: 'a' }).expect(201);
      const b = await crear(c.id, juan, { estrellas: 1, comentario: 'b' }).expect(201);
      expect(await puntajeDe(c.id)).toEqual([3, 2]);
      await t.http().delete(`/resenas/${b.body.datos.id}`).set(juan.auth).expect(204);
      expect(await puntajeDe(c.id)).toEqual([5, 1]);
      await t.http().delete(`/resenas/${a.body.datos.id}`).set(marta.auth).expect(204);
      expect(await puntajeDe(c.id)).toEqual([0, 0]);
    });

    it('editar sólo estrellas recalcula; editar sólo comentario no cambia el puntaje', async () => {
      const c = await nuevo();
      const a = await crear(c.id, marta, { estrellas: 2, comentario: 'a' }).expect(201);
      await t
        .http()
        .patch(`/resenas/${a.body.datos.id}`)
        .set(marta.auth)
        .send({ estrellas: 4 })
        .expect(200);
      expect(await puntajeDe(c.id)).toEqual([4, 1]);
      await t
        .http()
        .patch(`/resenas/${a.body.datos.id}`)
        .set(marta.auth)
        .send({ comentario: 'z' })
        .expect(200);
      expect(await puntajeDe(c.id)).toEqual([4, 1]);
    });

    it('reseñas de un comercio no afectan el puntaje de otro', async () => {
      const a = await nuevo();
      const b = await nuevo();
      await crear(a.id, marta, { estrellas: 5, comentario: 'a' }).expect(201);
      expect(await puntajeDe(b.id)).toEqual([0, 0]);
    });
  });

  describe('Fechas — creadaEn y reloj', () => {
    it.each([
      ['con milisegundos y Z', '2026-10-01T15:30:00.123Z', '2026-10-01T12:30:00-03:00'],
      ['con offset +00:00', '2026-10-01T15:30:00+00:00', '2026-10-01T12:30:00-03:00'],
      ['con offset +05:30', '2026-10-01T18:00:00+05:30', '2026-10-01T09:30:00-03:00'],
      ['ya en -03:00', '2026-10-01T23:59:59-03:00', '2026-10-01T23:59:59-03:00'],
      ['UTC que cruza medianoche', '2026-10-02T02:30:00Z', '2026-10-01T23:30:00-03:00'],
    ])('creadaEn %s se normaliza a -03:00 sin milisegundos', async (_n, entrada, esperado) => {
      const c = await nuevo();
      const res = await crear(c.id, marta, {
        estrellas: 3,
        comentario: 'x',
        creadaEn: entrada,
      }).expect(201);
      esperarContrato(res.body, 'Resena');
      expect(res.body.datos.creadaEn).toBe(esperado);
      const lista = await t.http().get(`/comercios/${c.id}/resenas`).expect(200);
      expect(lista.body.datos[0].creadaEn).toBe(esperado);
    });

    it.each(['2026-10-01', '2026-10-01 10:00:00', '1759320000', '2026-13-45T10:00:00Z', ''])(
      'creadaEn con formato inválido «%s»: 400',
      async (v) => {
        const c = await nuevo();
        const res = await crear(c.id, marta, { estrellas: 3, comentario: 'x', creadaEn: v });
        expect(res.status).toBe(400);
        esperarError(res.body, 'VALIDACION_FALLIDA');
      },
    );

    it('creadaEn null o ausente: se usa el reloj', async () => {
      const c = await nuevo();
      const res = await crear(c.id, marta, { estrellas: 3, comentario: 'x', creadaEn: null });
      expect([201, 400]).toContain(res.status);
      if (res.status === 201) expect(res.body.datos.creadaEn).toBe('2026-10-03T12:00:00-03:00');
    });

    it('creadaEn numérica (epoch) es 400', async () => {
      const c = await nuevo();
      const res = await crear(c.id, marta, {
        estrellas: 3,
        comentario: 'x',
        creadaEn: 1759320000000,
      });
      expect(res.status).toBe(400);
      esperarError(res.body, 'VALIDACION_FALLIDA');
    });

    it.each([
      ['2026-12-31T23:59:30-03:00', '2026-12-31T23:59:30-03:00'],
      ['2027-01-01T00:00:00-03:00', '2027-01-01T00:00:00-03:00'],
      ['2026-03-01T00:00:00-03:00', '2026-03-01T00:00:00-03:00'],
    ])('reloj en %s: creadaEn del servidor es ese instante', async (ahora, esperado) => {
      const app = await crearApp({ ahora });
      try {
        await crearComercio(app, { id: 'com-ff1x' });
        const u = await crearUsuario(app);
        const res = await app
          .http()
          .post('/comercios/com-ff1x/resenas')
          .set(u.auth)
          .send({ estrellas: 5, comentario: 'x' })
          .expect(201);
        esperarContrato(res.body, 'Resena');
        expect(res.body.datos.creadaEn).toBe(esperado);
      } finally {
        await app.cerrar();
      }
    });

    it('con el reloj a las 23:59 la tolerancia de 5 minutos cruza la medianoche', async () => {
      const app = await crearApp({ ahora: '2026-12-31T23:59:00-03:00' });
      try {
        await crearComercio(app, { id: 'com-ff2x' });
        const u = await crearUsuario(app);
        const ok = await app
          .http()
          .post('/comercios/com-ff2x/resenas')
          .set(u.auth)
          .send({ estrellas: 5, comentario: 'x', creadaEn: '2027-01-01T00:04:00-03:00' });
        expect(ok.status).toBe(201);
        const u2 = await crearUsuario(app);
        const mal = await app
          .http()
          .post('/comercios/com-ff2x/resenas')
          .set(u2.auth)
          .send({ estrellas: 5, comentario: 'x', creadaEn: '2027-01-01T00:04:01-03:00' });
        expect(mal.status).toBe(422);
        esperarError(mal.body, 'FECHA_EN_EL_FUTURO');
      } finally {
        await app.cerrar();
      }
    });

    it('una fecha en el pasado remoto es válida y ordena al final', async () => {
      const c = await nuevo();
      await crear(c.id, marta, {
        estrellas: 3,
        comentario: 'vieja',
        creadaEn: '2020-01-01T00:00:00-03:00',
      }).expect(201);
      await crear(c.id, juan, { estrellas: 3, comentario: 'nueva' }).expect(201);
      const lista = await t.http().get(`/comercios/${c.id}/resenas`).expect(200);
      expect(lista.body.datos.map((r: { comentario: string }) => r.comentario)).toEqual([
        'nueva',
        'vieja',
      ]);
    });
  });

  describe('Entrada — tipos, campos de más y textos', () => {
    it.each([
      ['estrellas booleano', { estrellas: true, comentario: 'x' }],
      ['estrellas null', { estrellas: null, comentario: 'x' }],
      ['estrellas negativas', { estrellas: -1, comentario: 'x' }],
      ['estrellas array', { estrellas: [5], comentario: 'x' }],
      ['comentario numérico', { estrellas: 5, comentario: 12345 }],
      ['comentario objeto', { estrellas: 5, comentario: { a: 1 } }],
      ['comentario array', { estrellas: 5, comentario: ['x'] }],
      ['comentario sólo saltos de línea y tabs', { estrellas: 5, comentario: '\n\t \n' }],
      ['id con mayúscula en prefijo', { id: 'RES-abc123', estrellas: 5, comentario: 'x' }],
      ['id con otro prefijo', { id: 'com-abc123', estrellas: 5, comentario: 'x' }],
      ['id con espacios', { id: 'res-abc 123', estrellas: 5, comentario: 'x' }],
      ['id demasiado largo', { id: `res-${'a'.repeat(40)}`, estrellas: 5, comentario: 'x' }],
      ['id null no es string', { id: 7, estrellas: 5, comentario: 'x' }],
      ['campo de más: respuesta', { estrellas: 5, comentario: 'x', respuesta: 'hack' }],
      ['campo de más: reportada', { estrellas: 5, comentario: 'x', reportada: true }],
      ['campo de más: comercioId', { estrellas: 5, comentario: 'x', comercioId: 'com-vtt' }],
      ['campo de más: createdAt', { estrellas: 5, comentario: 'x', createdAt: '2026-01-01' }],
      ['cuerpo vacío', {}],
    ])('400 VALIDACION_FALLIDA: %s', async (_n, cuerpo) => {
      const c = await nuevo();
      const res = await crear(c.id, marta, cuerpo);
      expect(res.status).toBe(400);
      esperarError(res.body, 'VALIDACION_FALLIDA');
      expect(await t.dataSource.getRepository(Resena).countBy({ comercioId: c.id })).toBe(0);
    });

    it('cuerpo que es un array o un string: 400, nunca 500', async () => {
      const c = await nuevo();
      for (const cuerpo of [[], 'hola', 5]) {
        const res = await t
          .http()
          .post(`/comercios/${c.id}/resenas`)
          .set(marta.auth)
          .set('Content-Type', 'application/json')
          .send(JSON.stringify(cuerpo));
        expect(res.status).toBeLessThan(500);
        expect(res.status).toBeGreaterThanOrEqual(400);
        esperarError(res.body);
      }
    });

    it('JSON mal formado: 400 con sobre de error', async () => {
      const c = await nuevo();
      const res = await t
        .http()
        .post(`/comercios/${c.id}/resenas`)
        .set(marta.auth)
        .set('Content-Type', 'application/json')
        .send('{"estrellas": 5,');
      expect(res.status).toBe(400);
      esperarError(res.body);
    });

    it('el mensaje de validación está en castellano y sin jerga', async () => {
      const c = await nuevo();
      const res = await crear(c.id, marta, { estrellas: 9, comentario: 'x' });
      esperarError(res.body, 'VALIDACION_FALLIDA');
      const m: string = res.body.error.mensaje;
      expect(m).not.toMatch(/must be|should|property|undefined|isInt|class-validator/i);
      expect(m.length).toBeGreaterThan(5);
    });

    it('comentario con emojis y tildes se guarda tal cual; 1000 emojis (pares sustitutos) es borde', async () => {
      const c = await nuevo();
      const texto = 'Excelente atención 😀 ñandú — ¡volveré!';
      const res = await crear(c.id, marta, { estrellas: 5, comentario: texto }).expect(201);
      expect(res.body.datos.comentario).toBe(texto);
      const d = await nuevo();
      const r2 = await crear(d.id, marta, { estrellas: 5, comentario: '😀'.repeat(1000) });
      // 1000 caracteres visibles: el límite es "1 a 1000 caracteres"
      expect([201, 400]).toContain(r2.status);
      if (r2.status === 400) esperarError(r2.body, 'VALIDACION_FALLIDA');
    });

    it('comentario con recorte: el espacio de los costados no cuenta pero el interior se conserva', async () => {
      const c = await nuevo();
      const res = await crear(c.id, marta, {
        estrellas: 5,
        comentario: '  hola   mundo\nlinea  ',
      }).expect(201);
      expect(res.body.datos.comentario).toBe('hola   mundo\nlinea');
    });

    it('sincronizada enviada como false o true en la entrada se ignora (AGENTS §4.4)', async () => {
      const c = await nuevo();
      const res = await crear(c.id, marta, { estrellas: 5, comentario: 'x', sincronizada: false });
      expect(res.status).toBe(201);
      expect(res.body.datos.sincronizada).toBe(true);
    });
  });

  describe('Permisos', () => {
    it('token mal firmado y token vencido: 401 NO_AUTENTICADO en cada endpoint protegido', async () => {
      const c = await nuevo();
      const r = await crearResena(t, { comercioId: c.id, usuarioId: juan.id });
      const malo = { Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.e30.firma-falsa' };
      const llamadas = [
        t
          .http()
          .post(`/comercios/${c.id}/resenas`)
          .set(malo)
          .send({ estrellas: 5, comentario: 'x' }),
        t.http().patch(`/resenas/${r.id}`).set(malo).send({ estrellas: 5 }),
        t.http().delete(`/resenas/${r.id}`).set(malo),
        t.http().post(`/resenas/${r.id}/reportes`).set(malo),
        t.http().post(`/resenas/${r.id}/respuesta`).set(malo).send({ respuesta: 'x' }),
      ];
      for (const res of await Promise.all(llamadas)) {
        expect(res.status).toBe(401);
        esperarError(res.body, 'NO_AUTENTICADO');
      }
      const vencido = await crearUsuario(t);
      t.reloj.avanzar(31 * 24 * 3600 * 1000);
      try {
        const res = await crear(c.id, vencido, { estrellas: 5, comentario: 'x' });
        expect(res.status).toBe(401);
        esperarError(res.body, 'NO_AUTENTICADO');
      } finally {
        t.reloj.fijar('2026-10-03T12:00:00-03:00');
      }
    });

    it('GET de reseñas con token inválido sigue funcionando (público)', async () => {
      const c = await nuevo();
      await t
        .http()
        .get(`/comercios/${c.id}/resenas`)
        .set('Authorization', 'Bearer basura')
        .expect(200);
    });

    it('un vecino no puede editar, borrar ni responder la reseña de otro; nada cambia', async () => {
      const c = await nuevo();
      const r = await crearResena(t, {
        comercioId: c.id,
        usuarioId: juan.id,
        estrellas: 4,
        comentario: 'orig',
      });
      const e = await t.http().patch(`/resenas/${r.id}`).set(marta.auth).send({ estrellas: 1 });
      expect(e.status).toBe(403);
      esperarError(e.body, 'SIN_PERMISO');
      const d = await t.http().delete(`/resenas/${r.id}`).set(marta.auth);
      expect(d.status).toBe(403);
      esperarError(d.body, 'SIN_PERMISO');
      const p = await t
        .http()
        .post(`/resenas/${r.id}/respuesta`)
        .set(marta.auth)
        .send({ respuesta: 'x' });
      expect(p.status).toBe(403);
      esperarError(p.body, 'SIN_PERMISO');
      const fila = await t.dataSource.getRepository(Resena).findOneByOrFail({ id: r.id });
      expect(fila).toMatchObject({ estrellas: 4, comentario: 'orig', respuesta: null });
    });

    it('un comercio no puede editar ni borrar una reseña (ni siquiera la de su local)', async () => {
      const c = await crearComercio(t, { id: 'com-vtt2', rubroId: 'rub-v' });
      const dueno = await crearUsuario(t, { rol: 'comercio', comercioId: c.id });
      const r = await crearResena(t, { comercioId: c.id, usuarioId: juan.id });
      expect(
        (await t.http().patch(`/resenas/${r.id}`).set(dueno.auth).send({ estrellas: 1 })).status,
      ).toBe(403);
      expect((await t.http().delete(`/resenas/${r.id}`).set(dueno.auth)).status).toBe(403);
    });

    it('un comercio puede reportar una reseña (cualquier usuario con sesión salvo el autor)', async () => {
      const c = await nuevo();
      const r = await crearResena(t, { comercioId: c.id, usuarioId: juan.id });
      const res = await t.http().post(`/resenas/${r.id}/reportes`).set(tornillo.auth);
      expect(res.status).toBe(200);
      esperarContrato(res.body, 'Resena');
      expect(res.body.datos.reportada).toBe(true);
    });

    it('un comercio con comercioId null o de otro local no responde', async () => {
      const c = await nuevo();
      const r = await crearResena(t, { comercioId: c.id, usuarioId: juan.id });
      const res = await t
        .http()
        .post(`/resenas/${r.id}/respuesta`)
        .set(tornillo.auth)
        .send({ respuesta: 'hola' });
      expect(res.status).toBe(403);
      esperarError(res.body, 'SIN_PERMISO');
    });

    it('el comercio dueño puede responder aunque el comercio esté dado de baja (o no: nunca 500)', async () => {
      const c = await nuevo({ activo: false });
      const dueno = await crearUsuario(t, { rol: 'comercio', comercioId: c.id });
      const r = await crearResena(t, { comercioId: c.id, usuarioId: juan.id });
      const res = await t
        .http()
        .post(`/resenas/${r.id}/respuesta`)
        .set(dueno.auth)
        .send({ respuesta: 'hola' });
      expect(res.status).toBeLessThan(500);
    });
  });

  describe('R9 — respuesta del comercio', () => {
    const respuestaDe = async (texto: unknown) => {
      const c = await crearComercio(t, { id: `com-rr${++n}x`, rubroId: 'rub-v' });
      const dueno = await crearUsuario(t, { rol: 'comercio', comercioId: c.id });
      const r = await crearResena(t, { comercioId: c.id, usuarioId: juan.id });
      return {
        r,
        dueno,
        res: await t
          .http()
          .post(`/resenas/${r.id}/respuesta`)
          .set(dueno.auth)
          .send({ respuesta: texto }),
      };
    };

    it('200 con la Resena completa y la respuesta recortada', async () => {
      const { res } = await respuestaDe('  Gracias por su visita.  ');
      expect(res.status).toBe(200);
      esperarContrato(res.body, 'Resena');
      expect(res.body.datos.respuesta).toBe('Gracias por su visita.');
    });

    it.each([
      ['vacía', ''],
      ['sólo espacios', '   '],
      ['null', null],
      ['número', 5],
      ['objeto', { a: 1 }],
      ['array', ['x']],
      ['ausente', undefined],
    ])('respuesta %s: 400 VALIDACION_FALLIDA, la reseña sigue sin respuesta', async (_n, v) => {
      const { r, res } = await respuestaDe(v);
      expect(res.status).toBe(400);
      esperarError(res.body, 'VALIDACION_FALLIDA');
      const fila = await t.dataSource.getRepository(Resena).findOneByOrFail({ id: r.id });
      expect(fila.respuesta).toBeNull();
    });

    it('respuesta de 1001 caracteres: 400 (mismo tope que el comentario) o aceptada, nunca 500', async () => {
      const { res } = await respuestaDe('a'.repeat(1001));
      expect([200, 400]).toContain(res.status);
    });

    it('campos de más en el cuerpo: 400', async () => {
      const c = await nuevo();
      const dueno = await crearUsuario(t, { rol: 'comercio', comercioId: c.id });
      const r = await crearResena(t, { comercioId: c.id, usuarioId: juan.id });
      const res = await t
        .http()
        .post(`/resenas/${r.id}/respuesta`)
        .set(dueno.auth)
        .send({ respuesta: 'x', reportada: true });
      expect(res.status).toBe(400);
      esperarError(res.body, 'VALIDACION_FALLIDA');
    });

    it('responder no cambia estrellas, comentario, creadaEn ni el puntaje; y el autor sigue pudiendo editar', async () => {
      const c = await nuevo();
      const dueno = await crearUsuario(t, { rol: 'comercio', comercioId: c.id });
      const a = await crear(c.id, juan, {
        estrellas: 2,
        comentario: 'mal',
        creadaEn: '2026-10-02T10:00:00-03:00',
      }).expect(201);
      await t
        .http()
        .post(`/resenas/${a.body.datos.id}/respuesta`)
        .set(dueno.auth)
        .send({ respuesta: 'Lo sentimos.' })
        .expect(200);
      expect(await puntajeDe(c.id)).toEqual([2, 1]);
      const ed = await t
        .http()
        .patch(`/resenas/${a.body.datos.id}`)
        .set(juan.auth)
        .send({ comentario: 'mejoró' })
        .expect(200);
      expect(ed.body.datos).toMatchObject({
        respuesta: 'Lo sentimos.',
        comentario: 'mejoró',
        creadaEn: '2026-10-02T10:00:00-03:00',
      });
    });
  });

  describe('R10 — reportes', () => {
    it('reportar 3 veces seguidas y por otros: siempre 200, reportada true, la reseña sigue en la lista (D6)', async () => {
      const c = await nuevo();
      const r = await crearResena(t, { comercioId: c.id, usuarioId: juan.id });
      for (let i = 0; i < 3; i++) {
        const res = await t.http().post(`/resenas/${r.id}/reportes`).set(marta.auth).expect(200);
        esperarContrato(res.body, 'Resena');
      }
      const lista = await t.http().get(`/comercios/${c.id}/resenas`).expect(200);
      expect(lista.body.datos).toHaveLength(1);
      expect(lista.body.datos[0].reportada).toBe(true);
      expect(await puntajeDe(c.id)).toEqual([0, 0]); // crearResena no recalcula: el reporte tampoco debe tocarlo
    });

    it('reportar con cuerpo con campos de más: 400 (o ignorado), nunca 500', async () => {
      const c = await nuevo();
      const r = await crearResena(t, { comercioId: c.id, usuarioId: juan.id });
      const res = await t
        .http()
        .post(`/resenas/${r.id}/reportes`)
        .set(marta.auth)
        .send({ motivo: 'ofensiva' });
      expect(res.status).toBeLessThan(500);
    });

    it('el autor de una reseña de comercio-dueño... REPORTE_PROPIO tiene prioridad sobre ya reportada', async () => {
      const c = await nuevo();
      const r = await crearResena(t, { comercioId: c.id, usuarioId: juan.id, reportada: true });
      const res = await t.http().post(`/resenas/${r.id}/reportes`).set(juan.auth);
      expect(res.status).toBe(422);
      esperarError(res.body, 'REPORTE_PROPIO');
      expect(res.body.error.mensaje).toBe('No podés reportar tu propia reseña.');
    });
  });

  describe('Errores — sobre exacto y mensajes del catálogo', () => {
    it.each([['RESENA_NO_ENCONTRADA', 404, 'No existe esa reseña.']])(
      '%s: %d con mensaje exacto en cada endpoint',
      async (codigo, estado, mensaje) => {
        const llamadas = [
          t.http().patch('/resenas/res-noexiste').set(marta.auth).send({ estrellas: 3 }),
          t.http().delete('/resenas/res-noexiste').set(marta.auth),
          t.http().post('/resenas/res-noexiste/reportes').set(marta.auth),
          t
            .http()
            .post('/resenas/res-noexiste/respuesta')
            .set(tornillo.auth)
            .send({ respuesta: 'x' }),
        ];
        for (const res of await Promise.all(llamadas)) {
          expect(res.status).toBe(estado);
          esperarError(res.body, codigo);
          expect(res.body.error.mensaje).toBe(mensaje);
          expect(Object.keys(res.body.error).sort()).toEqual(['codigo', 'mensaje']);
          expect(Object.keys(res.body)).toEqual(['error']);
        }
      },
    );

    it('mensajes exactos de RESENA_YA_EXISTE, RESENA_YA_RESPONDIDA, FECHA_EN_EL_FUTURO, ID_EN_USO', async () => {
      const c = await nuevo();
      await crear(c.id, marta, { estrellas: 5, comentario: 'x' }).expect(201);
      const ya = await crear(c.id, marta, { estrellas: 5, comentario: 'y' }).expect(409);
      expect(ya.body.error.mensaje).toBe(
        'Ya dejaste una reseña para este comercio. Podés editarla.',
      );
      const dueno = await crearUsuario(t, { rol: 'comercio', comercioId: c.id });
      const r = await crearResena(t, { comercioId: c.id, usuarioId: juan.id, respuesta: 'ya' });
      const rr = await t
        .http()
        .post(`/resenas/${r.id}/respuesta`)
        .set(dueno.auth)
        .send({ respuesta: 'otra' })
        .expect(409);
      expect(rr.body.error.mensaje).toBe('Ya respondiste esta reseña.');
      const f = await crear(c.id, juan, {
        estrellas: 5,
        comentario: 'x',
        creadaEn: '2030-01-01T00:00:00-03:00',
      }).expect(422);
      expect(f.body.error.mensaje).toBe('La fecha no puede ser posterior a este momento.');
      const o = await crear((await nuevo()).id, marta, {
        id: r.id,
        estrellas: 5,
        comentario: 'x',
      }).expect(409);
      expect(o.body.error.codigo).toBe('ID_EN_USO');
      expect(o.body.error.mensaje).toBe('Ese identificador ya está en uso.');
    });

    it('id de ruta con caracteres raros (espacios, %, unicode, muy largo): 4xx con sobre, nunca 500', async () => {
      for (const id of [
        'res-%20x',
        'res-ñandú',
        `res-${'a'.repeat(300)}`,
        '%00',
        "res-'; DROP TABLE resenas;--",
      ]) {
        const e = encodeURIComponent(id);
        for (const llamada of [
          () => t.http().patch(`/resenas/${e}`).set(marta.auth).send({ estrellas: 3 }),
          () => t.http().delete(`/resenas/${e}`).set(marta.auth),
          () => t.http().post(`/resenas/${e}/reportes`).set(marta.auth),
          () => t.http().get(`/comercios/${e}/resenas`),
        ]) {
          const res = await llamada();
          expect(res.status).toBeGreaterThanOrEqual(400);
          expect(res.status).toBeLessThan(500);
          esperarError(res.body);
        }
      }
    });

    it('un comercio inexistente con id bien formado es 404 COMERCIO_NO_ENCONTRADO antes que 400 por cuerpo (o al revés), pero nunca 500', async () => {
      const res = await crear('com-fantasma', marta, { estrellas: 99 });
      expect([400, 404]).toContain(res.status);
      esperarError(res.body);
    });
  });

  describe('Idempotencia y concurrencia', () => {
    it('reintento con el mismo id y el mismo cuerpo 5 veces simultáneas: una fila, todas las respuestas iguales', async () => {
      const c = await nuevo();
      const cuerpo = {
        id: 'res-cinco-x',
        estrellas: 4,
        comentario: 'Cinco veces.',
        creadaEn: '2026-10-02T09:00:00-03:00',
      };
      const rs = await Promise.all([1, 2, 3, 4, 5].map(() => crear(c.id, marta, cuerpo)));
      expect(rs.filter((r) => r.status === 201)).toHaveLength(1);
      expect(rs.filter((r) => r.status === 200)).toHaveLength(4);
      for (const r of rs) expect(r.body).toEqual(rs[0].body);
      expect(await t.dataSource.getRepository(Resena).countBy({ comercioId: c.id })).toBe(1);
      expect(await puntajeDe(c.id)).toEqual([4, 1]);
    });

    it('el mismo id usado en otro comercio por el mismo usuario no duplica ni crea otra reseña (id es global)', async () => {
      const a = await nuevo();
      const b = await nuevo();
      await crear(a.id, marta, { id: 'res-global1', estrellas: 4, comentario: 'x' }).expect(201);
      const res = await crear(b.id, marta, { id: 'res-global1', estrellas: 4, comentario: 'x' });
      expect([200, 409]).toContain(res.status);
      expect(await t.dataSource.getRepository(Resena).countBy({ id: 'res-global1' })).toBe(1);
      expect(await t.dataSource.getRepository(Resena).countBy({ comercioId: b.id })).toBe(0);
      expect(await puntajeDe(b.id)).toEqual([0, 0]);
    });

    it('la reseña reenviada (200) conserva el creadaEn original aunque el reloj avance', async () => {
      const c = await nuevo();
      const cuerpo = { id: 'res-reloj-1', estrellas: 4, comentario: 'x' };
      const a = await crear(c.id, marta, cuerpo).expect(201);
      t.reloj.avanzar(3600 * 1000);
      try {
        const b = await crear(c.id, marta, cuerpo).expect(200);
        expect(b.body).toEqual(a.body);
      } finally {
        t.reloj.fijar('2026-10-03T12:00:00-03:00');
      }
    });

    it('concurrencia: 6 vecinos reseñan a la vez el mismo comercio; el puntaje final es consistente', async () => {
      const c = await nuevo();
      const us = await Promise.all([1, 2, 3, 4, 5, 6].map(() => crearUsuario(t)));
      const rs = await Promise.all(
        us.map((u, i) => crear(c.id, u, { estrellas: (i % 5) + 1, comentario: 'x' })),
      );
      for (const r of rs) expect(r.status).toBe(201);
      // estrellas 1,2,3,4,5,1 -> 16/6 = 2.67 -> 2.7
      expect(await puntajeDe(c.id)).toEqual([2.7, 6]);
    });

    it('concurrencia: borrar y editar la misma reseña a la vez termina sin 500 y con puntaje consistente', async () => {
      const c = await nuevo();
      const a = await crear(c.id, marta, { estrellas: 2, comentario: 'x' }).expect(201);
      const id = a.body.datos.id;
      const [d, e] = await Promise.all([
        t.http().delete(`/resenas/${id}`).set(marta.auth),
        t.http().patch(`/resenas/${id}`).set(marta.auth).send({ estrellas: 5 }),
      ]);
      expect(d.status).toBeLessThan(500);
      expect(e.status).toBeLessThan(500);
      const restantes = await t.dataSource.getRepository(Resena).countBy({ comercioId: c.id });
      const [puntaje, cantidad] = await puntajeDe(c.id);
      expect(cantidad).toBe(restantes);
      if (restantes === 0) expect(puntaje).toBe(0);
    });

    it('concurrencia: dos reportes de usuarios distintos a la vez: dos 200', async () => {
      const c = await nuevo();
      const r = await crearResena(t, { comercioId: c.id, usuarioId: juan.id });
      const rs = await Promise.all([
        t.http().post(`/resenas/${r.id}/reportes`).set(marta.auth),
        t.http().post(`/resenas/${r.id}/reportes`).set(tornillo.auth),
      ]);
      expect(rs.map((x) => x.status)).toEqual([200, 200]);
    });
  });

  describe('Paginación y orden del listado', () => {
    it.each([
      'pagina=0',
      'pagina=-1',
      'pagina=abc',
      'porPagina=0',
      'porPagina=-5',
      'porPagina=x',
      'pagina=1.5',
    ])('parámetro inválido %s: 400 VALIDACION_FALLIDA', async (q) => {
      const c = await nuevo();
      const res = await t.http().get(`/comercios/${c.id}/resenas?${q}`);
      expect(res.status).toBe(400);
      esperarError(res.body, 'VALIDACION_FALLIDA');
    });

    it('filtro desconocido en la query: 400 (forbidNonWhitelisted) o ignorado, nunca 500', async () => {
      const c = await nuevo();
      const res = await t.http().get(`/comercios/${c.id}/resenas?estrellas=5`);
      expect(res.status).toBeLessThan(500);
    });

    it('paginando de a una recorre todas sin repetir ni saltear, aun con fechas empatadas', async () => {
      const c = await nuevo();
      const creadaEn = new Date(t.reloj.ahora().getTime() - 5000);
      for (let i = 0; i < 5; i++) {
        const u = await crearUsuario(t);
        await crearResena(t, {
          id: `res-emp${i}${c.id}`,
          comercioId: c.id,
          usuarioId: u.id,
          creadaEn,
        });
      }
      const vistos: string[] = [];
      for (let p = 1; p <= 5; p++) {
        const res = await t
          .http()
          .get(`/comercios/${c.id}/resenas?pagina=${p}&porPagina=1`)
          .expect(200);
        expect(res.body.meta).toEqual({ total: 5, pagina: p, porPagina: 1 });
        vistos.push(res.body.datos[0].id);
      }
      expect(new Set(vistos).size).toBe(5);
    });

    it('una reseña nueva con creadaEn del cliente anterior a las existentes queda al final', async () => {
      const c = await nuevo();
      await crear(c.id, marta, {
        estrellas: 3,
        comentario: 'a',
        creadaEn: '2026-10-03T11:00:00-03:00',
      }).expect(201);
      await crear(c.id, juan, {
        estrellas: 3,
        comentario: 'b',
        creadaEn: '2026-10-03T10:00:00-03:00',
      }).expect(201);
      const lista = await t.http().get(`/comercios/${c.id}/resenas`).expect(200);
      expect(lista.body.datos.map((r: { comentario: string }) => r.comentario)).toEqual(['a', 'b']);
    });

    it('todas las reseñas de la lista (con todos los opcionales llenos y en null) cumplen el contrato', async () => {
      const c = await nuevo();
      const u2 = await crearUsuario(t);
      await crearResena(t, {
        comercioId: c.id,
        usuarioId: juan.id,
        respuesta: 'Gracias',
        reportada: true,
        estrellas: 1,
      });
      await crearResena(t, { comercioId: c.id, usuarioId: u2.id, estrellas: 5 });
      const res = await t.http().get(`/comercios/${c.id}/resenas`).expect(200);
      esperarContrato(res.body, 'Resena');
      for (const r of res.body.datos) {
        expect(r.respuesta === null || r.respuesta.length > 0).toBe(true);
        expect(Object.keys(r).sort()).toEqual([
          'comentario',
          'comercioId',
          'creadaEn',
          'estrellas',
          'id',
          'reportada',
          'respuesta',
          'sincronizada',
          'usuarioId',
        ]);
      }
    });
  });

  describe('PATCH /resenas/:id — entrada', () => {
    it.each([
      ['estrellas 0', { estrellas: 0 }],
      ['estrellas 6', { estrellas: 6 }],
      ['estrellas null', { estrellas: null }],
      ['estrellas texto', { estrellas: '3' }],
      ['comentario vacío', { comentario: '' }],
      ['comentario null', { comentario: null }],
      ['comentario sólo espacios', { comentario: '   ' }],
      ['comentario 1001', { comentario: 'a'.repeat(1001) }],
      ['campo de más: creadaEn', { creadaEn: '2026-10-01T10:00:00-03:00' }],
      ['campo de más: respuesta', { respuesta: 'x' }],
      ['campo de más: reportada', { reportada: false }],
      ['campo de más: usuarioId', { usuarioId: 'usr-1' }],
      ['campo de más: id', { id: 'res-nuevo-id' }],
    ])('400 y no cambia nada: %s', async (_n, cuerpo) => {
      const c = await nuevo();
      const r = await crearResena(t, {
        comercioId: c.id,
        usuarioId: marta.id,
        estrellas: 3,
        comentario: 'orig',
      });
      const res = await t.http().patch(`/resenas/${r.id}`).set(marta.auth).send(cuerpo);
      expect(res.status).toBe(400);
      esperarError(res.body, 'VALIDACION_FALLIDA');
      const fila = await t.dataSource.getRepository(Resena).findOneByOrFail({ id: r.id });
      expect(fila).toMatchObject({ estrellas: 3, comentario: 'orig' });
    });

    it('PATCH {} es 200 con la reseña y la forma exacta', async () => {
      const c = await nuevo();
      const r = await crearResena(t, { comercioId: c.id, usuarioId: marta.id });
      const res = await t.http().patch(`/resenas/${r.id}`).set(marta.auth).send({}).expect(200);
      esperarContrato(res.body, 'Resena');
    });

    it('PATCH con sólo sincronizada es ignorado o 400, nunca 500; sigue true', async () => {
      const c = await nuevo();
      const r = await crearResena(t, { comercioId: c.id, usuarioId: marta.id });
      const res = await t
        .http()
        .patch(`/resenas/${r.id}`)
        .set(marta.auth)
        .send({ sincronizada: false });
      expect(res.status).toBeLessThan(500);
      if (res.status === 200) expect(res.body.datos.sincronizada).toBe(true);
    });

    it('editar la reseña de un comercio dado de baja no da 500', async () => {
      const c = await nuevo({ activo: false });
      const r = await crearResena(t, { comercioId: c.id, usuarioId: marta.id });
      const res = await t.http().patch(`/resenas/${r.id}`).set(marta.auth).send({ estrellas: 2 });
      expect(res.status).toBe(200);
      expect(await puntajeDe(c.id)).toEqual([2, 1]);
    });
  });

  describe('Notificaciones y datos de más', () => {
    it('ninguna acción de reseñas dispara push (la especificación §7 no lo pide)', async () => {
      const c = await nuevo();
      const dueno = await crearUsuario(t, { rol: 'comercio', comercioId: c.id });
      await t
        .http()
        .post('/dispositivos')
        .set(dueno.auth)
        .send({ tokenExpo: 'ExponentPushToken[abc123]', plataforma: 'android' });
      t.enviador.limpiar();
      const a = await crear(c.id, marta, { estrellas: 5, comentario: 'x' }).expect(201);
      await t.http().post(`/resenas/${a.body.datos.id}/reportes`).set(juan.auth).expect(200);
      await t
        .http()
        .post(`/resenas/${a.body.datos.id}/respuesta`)
        .set(dueno.auth)
        .send({ respuesta: 'gracias' })
        .expect(200);
      await t.avisos.esperarPendientes();
      expect(t.enviador.enviados).toEqual([]);
    });

    it('las respuestas de éxito no traen campos internos (hash, rol, createdAt, nombre del autor)', async () => {
      const c = await nuevo();
      const res = await crear(c.id, marta, { estrellas: 5, comentario: 'x' }).expect(201);
      const txt = JSON.stringify(res.body);
      expect(txt).not.toMatch(/hash|contrasena|password|createdAt|updatedAt|rol|nombre|email/i);
      expect(res.body.meta).toBeNull();
    });
  });
});
