import { crearComercio, crearRubro } from '../utilidades/comercios.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { CONTRASENA_DE_PRUEBA, crearUsuario } from '../utilidades/usuarios.js';

describe('ESPECIFICACION M3 — Cuenta y favoritos (verificación adversarial)', () => {
  let t: AppDePrueba;
  beforeAll(async () => {
    t = await crearApp();
    await crearRubro(t, { id: 'rub-a', orden: 1 });
    await crearRubro(t, { id: 'rub-b', orden: 2 });
    await crearRubro(t, { id: 'rub-c', orden: 3 });
    for (const id of ['com-1', 'com-2', 'com-3']) await crearComercio(t, { id, rubroId: 'rub-a' });
    await crearComercio(t, { id: 'com-baja', rubroId: 'rub-a', activo: false });
  });
  afterAll(() => t.cerrar());

  const favs = async (u: { auth: { Authorization: string } }) =>
    (await t.http().get('/yo').set(u.auth).expect(200)).body.datos.favoritos as string[];

  describe('PUT /yo/favoritos/:comercioId — entrada y permisos', () => {
    it.each(['abc', 'rub-a', 'COM-1', 'usr-1', 'com-', '123'])(
      'id mal formado «%s»: 4xx con sobre de error, nunca 500 ni se guarda',
      async (id) => {
        const u = await crearUsuario(t);
        const res = await t.http().put(`/yo/favoritos/${id}`).set(u.auth);
        expect([400, 404]).toContain(res.status);
        esperarError(res.body);
        expect(await favs(u)).toEqual([]);
      },
    );

    it('AGENTS §7.3 — un id sin el prefijo da 400 VALIDACION_FALLIDA (se valida antes de la base)', async () => {
      const u = await crearUsuario(t);
      const res = await t.http().put('/yo/favoritos/abc').set(u.auth);
      esperarError(res.body, 'VALIDACION_FALLIDA');
      expect(res.status).toBe(400);
    });

    it('id inexistente con prefijo correcto: 404 COMERCIO_NO_ENCONTRADO con mensaje del catálogo', async () => {
      const u = await crearUsuario(t);
      const res = await t.http().put('/yo/favoritos/com-fantasma').set(u.auth).expect(404);
      esperarError(res.body, 'COMERCIO_NO_ENCONTRADO');
      expect(res.body.error.mensaje).toBe('No existe ese comercio.');
    });

    it('token vencido o mal firmado: 401 NO_AUTENTICADO', async () => {
      const mal = await t
        .http()
        .put('/yo/favoritos/com-1')
        .set('Authorization', 'Bearer abc.def.ghi')
        .expect(401);
      esperarError(mal.body, 'NO_AUTENTICADO');
      const u = await crearUsuario(t);
      t.reloj.avanzar?.(31 * 24 * 3600 * 1000);
      const viejo = await t.http().put('/yo/favoritos/com-1').set(u.auth).expect(401);
      esperarError(viejo.body, 'NO_AUTENTICADO');
      t.reloj.fijar?.('2026-10-03T12:00:00-03:00');
    });

    it('403 SIN_PERMISO del comercio también al quitar, y no toca nada', async () => {
      const c = await crearUsuario(t, { rol: 'comercio', comercioId: 'com-1' });
      const res = await t.http().delete('/yo/favoritos/com-1').set(c.auth).expect(403);
      esperarError(res.body, 'SIN_PERMISO');
    });

    it('respuesta de éxito: Usuario exacto, sin campos de más', async () => {
      const u = await crearUsuario(t);
      const res = await t.http().put('/yo/favoritos/com-1').set(u.auth).expect(200);
      esperarContrato(res.body, 'Usuario');
      expect(Object.keys(res.body.datos).sort()).toEqual(
        [
          'avisosActivos',
          'comercioId',
          'email',
          'favoritos',
          'id',
          'nombre',
          'rol',
          'rubrosDeInteres',
        ].sort(),
      );
    });

    it('cuerpo con basura en el PUT no rompe (se ignora o 400, nunca 500)', async () => {
      const u = await crearUsuario(t);
      const res = await t.http().put('/yo/favoritos/com-1').set(u.auth).send({ x: 1 });
      expect(res.status).toBeLessThan(500);
    });
  });

  describe('Favoritos — orden, borrado y estado entre pedidos', () => {
    it('quitar y volver a agregar manda el favorito al final', async () => {
      const u = await crearUsuario(t);
      for (const id of ['com-1', 'com-2', 'com-3']) {
        await t.http().put(`/yo/favoritos/${id}`).set(u.auth).expect(200);
        t.reloj.avanzar?.(1000);
      }
      await t.http().delete('/yo/favoritos/com-1').set(u.auth).expect(204);
      t.reloj.avanzar?.(1000);
      await t.http().put('/yo/favoritos/com-1').set(u.auth).expect(200);
      expect(await favs(u)).toEqual(['com-2', 'com-3', 'com-1']);
    });

    it('orden estable aunque el reloj no avance (mismo instante): el mismo orden en cada lectura', async () => {
      const u = await crearUsuario(t);
      for (const id of ['com-3', 'com-1', 'com-2'])
        await t.http().put(`/yo/favoritos/${id}`).set(u.auth).expect(200);
      const a = await favs(u);
      const b = await favs(u);
      expect(a).toEqual(b);
      expect([...a].sort()).toEqual(['com-1', 'com-2', 'com-3']);
    });

    it('DELETE devuelve 204 sin cuerpo ni sobre', async () => {
      const u = await crearUsuario(t);
      await t.http().put('/yo/favoritos/com-1').set(u.auth).expect(200);
      const res = await t.http().delete('/yo/favoritos/com-1').set(u.auth).expect(204);
      expect(res.text).toBe('');
      expect(await favs(u)).toEqual([]);
    });

    it('DELETE con id mal formado no da 500', async () => {
      const u = await crearUsuario(t);
      const res = await t.http().delete('/yo/favoritos/zzz').set(u.auth);
      expect(res.status).toBeLessThan(500);
    });

    it('un favorito que luego se da de baja sigue en la lista; /yo y PATCH /yo lo conservan', async () => {
      const u = await crearUsuario(t);
      await t.http().put('/yo/favoritos/com-baja').set(u.auth).expect(200);
      const res = await t.http().patch('/yo').set(u.auth).send({ nombre: 'Ana' }).expect(200);
      expect(res.body.datos.favoritos).toEqual(['com-baja']);
    });

    it('simultáneos con distintos comercios: quedan todos, sin duplicar', async () => {
      const u = await crearUsuario(t);
      const rs = await Promise.all(
        ['com-1', 'com-2', 'com-3', 'com-1', 'com-2'].map((id) =>
          t.http().put(`/yo/favoritos/${id}`).set(u.auth),
        ),
      );
      expect(rs.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
      expect([...(await favs(u))].sort()).toEqual(['com-1', 'com-2', 'com-3']);
    });

    it('PUT y DELETE simultáneos del mismo favorito terminan en un estado consistente, sin 500', async () => {
      const u = await crearUsuario(t);
      const rs = await Promise.all([
        t.http().put('/yo/favoritos/com-1').set(u.auth),
        t.http().delete('/yo/favoritos/com-1').set(u.auth),
      ]);
      for (const r of rs) expect(r.status).toBeLessThan(500);
      expect((await favs(u)).length).toBeLessThanOrEqual(1);
    });

    it('los favoritos viajan también en /auth/ingreso y no se mezclan entre usuarios', async () => {
      const a = await crearUsuario(t, { email: 'fav.ingreso@prueba.ar' });
      const b = await crearUsuario(t);
      await t.http().put('/yo/favoritos/com-2').set(a.auth).expect(200);
      const ing = await t
        .http()
        .post('/auth/ingreso')
        .send({ email: 'fav.ingreso@prueba.ar', contrasena: CONTRASENA_DE_PRUEBA })
        .expect(200);
      expect(ing.body.datos.usuario.favoritos).toEqual(['com-2']);
      esperarContrato({ datos: ing.body.datos.usuario, meta: null }, 'Usuario');
      expect(await favs(b)).toEqual([]);
    });

    it('el registro nuevo arranca con favoritos y rubros [] y avisosActivos true', async () => {
      const res = await t
        .http()
        .post('/auth/registro')
        .send({ nombre: 'Nuevo', email: 'nuevo.m3@prueba.ar', contrasena: 'una-clave-larga' })
        .expect(201);
      expect(res.body.datos.usuario).toMatchObject({
        favoritos: [],
        rubrosDeInteres: [],
        avisosActivos: true,
      });
    });
  });

  describe('PATCH /yo — rubrosDeInteres y avisosActivos', () => {
    it('devuelve el Usuario exacto con todo lleno', async () => {
      const u = await crearUsuario(t);
      await t.http().put('/yo/favoritos/com-1').set(u.auth).expect(200);
      const res = await t
        .http()
        .patch('/yo')
        .set(u.auth)
        .send({ nombre: 'Ana', rubrosDeInteres: ['rub-b', 'rub-a'], avisosActivos: false })
        .expect(200);
      esperarContrato(res.body, 'Usuario');
      expect(res.body.datos.rubrosDeInteres).toEqual(['rub-b', 'rub-a']);
      expect(res.body.datos.avisosActivos).toBe(false);
      expect(res.body.datos.favoritos).toEqual(['com-1']);
    });

    it('es idempotente: el mismo PATCH dos veces da la misma respuesta', async () => {
      const u = await crearUsuario(t);
      const cuerpo = { rubrosDeInteres: ['rub-c', 'rub-a'], avisosActivos: false };
      const a = await t.http().patch('/yo').set(u.auth).send(cuerpo).expect(200);
      const b = await t.http().patch('/yo').set(u.auth).send(cuerpo).expect(200);
      expect(b.body).toEqual(a.body);
    });

    it('avisosActivos se puede apagar y volver a prender', async () => {
      const u = await crearUsuario(t);
      const off = await t
        .http()
        .patch('/yo')
        .set(u.auth)
        .send({ avisosActivos: false })
        .expect(200);
      expect(off.body.datos.avisosActivos).toBe(false);
      const on = await t.http().patch('/yo').set(u.auth).send({ avisosActivos: true }).expect(200);
      expect(on.body.datos.avisosActivos).toBe(true);
      const yo = await t.http().get('/yo').set(u.auth).expect(200);
      expect(yo.body.datos.avisosActivos).toBe(true);
    });

    it('repetidos con distinto orden: se quedan una vez, en el orden de la primera aparición', async () => {
      const u = await crearUsuario(t);
      const res = await t
        .http()
        .patch('/yo')
        .set(u.auth)
        .send({ rubrosDeInteres: ['rub-c', 'rub-a', 'rub-c', 'rub-a'] })
        .expect(200);
      expect(res.body.datos.rubrosDeInteres).toEqual(['rub-c', 'rub-a']);
    });

    it('un rubro inexistente entre varios: 422 con mensaje del catálogo y sin cambios en avisos', async () => {
      const u = await crearUsuario(t);
      const res = await t
        .http()
        .patch('/yo')
        .set(u.auth)
        .send({ avisosActivos: false, rubrosDeInteres: ['rub-a', 'rub-zzz'] })
        .expect(422);
      esperarError(res.body, 'RUBRO_NO_ENCONTRADO');
      expect(res.body.error.mensaje).toBe('Alguno de los rubros elegidos no existe.');
      const yo = await t.http().get('/yo').set(u.auth).expect(200);
      expect(yo.body.datos.avisosActivos).toBe(true);
      expect(yo.body.datos.rubrosDeInteres).toEqual([]);
    });

    it.each(['', 'a', 'com-1', 'RUB-A', 'rub-'])(
      'rubro «%s» que no existe: nunca 500 y no se guarda',
      async (r) => {
        const u = await crearUsuario(t);
        const res = await t
          .http()
          .patch('/yo')
          .set(u.auth)
          .send({ rubrosDeInteres: [r] });
        expect([400, 422]).toContain(res.status);
        esperarError(res.body);
        const yo = await t.http().get('/yo').set(u.auth).expect(200);
        expect(yo.body.datos.rubrosDeInteres).toEqual([]);
      },
    );

    it.each([
      [{ rubrosDeInteres: {} }],
      [{ rubrosDeInteres: [['rub-a']] }],
      [{ rubrosDeInteres: [null] }],
      [{ rubrosDeInteres: [{ id: 'rub-a' }] }],
      [{ avisosActivos: 1 }],
      [{ avisosActivos: 'true' }],
      [{ avisosActivos: 0 }],
      [{ id: 'usr-999' }],
      [{ favoritos: [] }],
      [{ hashContrasena: 'x' }],
      [{ contrasena: 'otra-clave-larga' }],
      [{ nombre: '   ' }],
    ])('400 VALIDACION_FALLIDA con %j y no cambia nada', async (cuerpo) => {
      const u = await crearUsuario(t);
      const res = await t.http().patch('/yo').set(u.auth).send(cuerpo).expect(400);
      esperarError(res.body, 'VALIDACION_FALLIDA');
    });

    it('lista enorme de rubros: no 500 (400 o 422)', async () => {
      const u = await crearUsuario(t);
      const muchos = Array.from({ length: 500 }, (_, i) => `rub-x${i}`);
      const res = await t.http().patch('/yo').set(u.auth).send({ rubrosDeInteres: muchos });
      expect([400, 422]).toContain(res.status);
      esperarError(res.body);
    });

    it('simultáneos con listas distintas: queda una de las dos completa, sin mezcla ni 500', async () => {
      const u = await crearUsuario(t);
      const rs = await Promise.all([
        t
          .http()
          .patch('/yo')
          .set(u.auth)
          .send({ rubrosDeInteres: ['rub-a', 'rub-b'] }),
        t
          .http()
          .patch('/yo')
          .set(u.auth)
          .send({ rubrosDeInteres: ['rub-c'] }),
      ]);
      for (const r of rs) expect(r.status).toBeLessThan(500);
      const yo = await t.http().get('/yo').set(u.auth).expect(200);
      const r = yo.body.datos.rubrosDeInteres as string[];
      expect(
        JSON.stringify(r) === JSON.stringify(['rub-a', 'rub-b']) ||
          JSON.stringify(r) === JSON.stringify(['rub-c']),
      ).toBe(true);
    });

    it('PATCH sólo toca al usuario de la sesión', async () => {
      const a = await crearUsuario(t);
      const b = await crearUsuario(t);
      await t
        .http()
        .patch('/yo')
        .set(a.auth)
        .send({ rubrosDeInteres: ['rub-a'], avisosActivos: false })
        .expect(200);
      const yoB = await t.http().get('/yo').set(b.auth).expect(200);
      expect(yoB.body.datos.rubrosDeInteres).toEqual([]);
      expect(yoB.body.datos.avisosActivos).toBe(true);
    });

    it('una cuenta de comercio puede usar PATCH /yo y sigue con favoritos []', async () => {
      const c = await crearUsuario(t, { rol: 'comercio', comercioId: 'com-1' });
      const res = await t
        .http()
        .patch('/yo')
        .set(c.auth)
        .send({ rubrosDeInteres: ['rub-b'], avisosActivos: false })
        .expect(200);
      esperarContrato(res.body, 'Usuario');
      expect(res.body.datos).toMatchObject({
        rol: 'comercio',
        comercioId: 'com-1',
        favoritos: [],
        rubrosDeInteres: ['rub-b'],
      });
    });

    it('token mal firmado en PATCH /yo: 401', async () => {
      const res = await t
        .http()
        .patch('/yo')
        .set('Authorization', 'Bearer x.y.z')
        .send({ avisosActivos: false })
        .expect(401);
      esperarError(res.body, 'NO_AUTENTICADO');
    });
  });

  describe('Rutas que no existen en M3', () => {
    it('GET /yo/favoritos y PUT /yo/favoritos sin id: 404 con sobre de error', async () => {
      const u = await crearUsuario(t);
      for (const metodo of ['get', 'put'] as const) {
        const res = await t.http()[metodo]('/yo/favoritos').set(u.auth);
        expect(res.status).toBe(404);
        esperarError(res.body, 'RUTA_NO_ENCONTRADA');
      }
    });
  });
});
