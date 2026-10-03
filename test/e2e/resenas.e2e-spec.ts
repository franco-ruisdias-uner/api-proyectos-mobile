import { Comercio } from '../../src/modulos/comercios/comercio.entidad.js';
import { ReporteDeResena } from '../../src/modulos/resenas/reporte-de-resena.entidad.js';
import { Resena } from '../../src/modulos/resenas/resena.entidad.js';
import { crearComercio, crearRubro } from '../utilidades/comercios.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { crearResena } from '../utilidades/resenas.js';
import { crearUsuario, type UsuarioDePrueba } from '../utilidades/usuarios.js';

describe('PRD §4 — Reseñas', () => {
  let t: AppDePrueba;
  let marta: UsuarioDePrueba;
  let juan: UsuarioDePrueba;
  let tornillo: UsuarioDePrueba;
  let otroComercio: UsuarioDePrueba;
  let n = 0;

  beforeAll(async () => {
    t = await crearApp();
    await crearRubro(t, { id: 'rub-prueba' });
    await crearComercio(t, { id: 'com-118' });
    await crearComercio(t, { id: 'com-201' });
    marta = await crearUsuario(t, { id: 'usr-512', nombre: 'Marta Giménez' });
    juan = await crearUsuario(t, { id: 'usr-juan' });
    tornillo = await crearUsuario(t, { rol: 'comercio', comercioId: 'com-118' });
    otroComercio = await crearUsuario(t, { rol: 'comercio', comercioId: 'com-201' });
  });
  afterAll(() => t.cerrar());

  /** Un comercio nuevo por test: no dependen del orden. */
  const comercioNuevo = async (datos: Partial<Comercio> = {}) => {
    n += 1;
    return crearComercio(t, { id: `com-tst${n}`, ...datos });
  };
  const puntajeDe = async (id: string) => {
    const c = await t.dataSource.getRepository(Comercio).findOneByOrFail({ id });
    return [c.puntaje, c.cantidadResenas];
  };

  describe('GET /comercios/:id/resenas', () => {
    it('200 sin sesión: de la más nueva a la más vieja, con la forma exacta del contrato', async () => {
      const c = await comercioNuevo();
      const hora = 60 * 60 * 1000;
      const ahora = t.reloj.ahora().getTime();
      await crearResena(t, {
        id: 'res-vieja',
        comercioId: c.id,
        usuarioId: marta.id,
        creadaEn: new Date(ahora - 5 * hora),
      });
      await crearResena(t, {
        id: 'res-nueva',
        comercioId: c.id,
        usuarioId: juan.id,
        creadaEn: new Date(ahora - hora),
        respuesta: 'Gracias por venir.',
        reportada: true,
        estrellas: 5,
      });
      const res = await t.http().get(`/comercios/${c.id}/resenas`).expect(200);
      esperarContrato(res.body, 'Resena');
      expect(res.body.datos.map((r: { id: string }) => r.id)).toEqual(['res-nueva', 'res-vieja']);
      expect(res.body.meta).toEqual({ total: 2, pagina: 1, porPagina: 20 });
      expect(res.body.datos[0]).toEqual({
        id: 'res-nueva',
        comercioId: c.id,
        usuarioId: juan.id,
        estrellas: 5,
        comentario: 'Muy buena atención.',
        respuesta: 'Gracias por venir.',
        reportada: true,
        creadaEn: '2026-10-03T11:00:00-03:00',
        sincronizada: true,
      });
      expect(res.body.datos[1].respuesta).toBeNull();
    });

    it('empate de fecha: desempata por id (descendente, determinístico)', async () => {
      const c = await comercioNuevo();
      const creadaEn = new Date(t.reloj.ahora().getTime() - 1000);
      for (const [id, usuarioId] of [
        ['res-aaa1', marta.id],
        ['res-aaa2', juan.id],
      ] as const)
        await crearResena(t, { id, comercioId: c.id, usuarioId, creadaEn });
      const res = await t.http().get(`/comercios/${c.id}/resenas`).expect(200);
      expect(res.body.datos.map((r: { id: string }) => r.id)).toEqual(['res-aaa2', 'res-aaa1']);
    });

    it('lista vacía: datos [] y total 0', async () => {
      const c = await comercioNuevo();
      const res = await t.http().get(`/comercios/${c.id}/resenas`).expect(200);
      esperarContrato(res.body, 'Resena');
      expect(res.body.datos).toEqual([]);
      expect(res.body.meta).toEqual({ total: 0, pagina: 1, porPagina: 20 });
    });

    it('paginación: meta correcto y página fuera de rango vacía con el total', async () => {
      const c = await comercioNuevo();
      const ahora = t.reloj.ahora().getTime();
      for (let i = 0; i < 3; i++) {
        const u = await crearUsuario(t);
        await crearResena(t, {
          id: `res-p${i}${c.id}`,
          comercioId: c.id,
          usuarioId: u.id,
          creadaEn: new Date(ahora - i * 1000),
        });
      }
      const p2 = await t.http().get(`/comercios/${c.id}/resenas?pagina=2&porPagina=2`).expect(200);
      expect(p2.body.datos).toHaveLength(1);
      expect(p2.body.meta).toEqual({ total: 3, pagina: 2, porPagina: 2 });
      const p9 = await t.http().get(`/comercios/${c.id}/resenas?pagina=9`).expect(200);
      expect(p9.body.datos).toEqual([]);
      expect(p9.body.meta.total).toBe(3);
      esperarError(
        (await t.http().get(`/comercios/${c.id}/resenas?porPagina=101`).expect(400)).body,
      );
    });

    it('sólo las del comercio pedido, y también las de un comercio dado de baja', async () => {
      const a = await comercioNuevo();
      const b = await comercioNuevo({ activo: false });
      await crearResena(t, { comercioId: a.id, usuarioId: marta.id });
      await crearResena(t, { comercioId: b.id, usuarioId: marta.id });
      const res = await t.http().get(`/comercios/${b.id}/resenas`).expect(200);
      expect(res.body.datos).toHaveLength(1);
      expect(res.body.datos[0].comercioId).toBe(b.id);
    });

    it('404 COMERCIO_NO_ENCONTRADO si no existe o el id está mal formado', async () => {
      for (const id of ['com-nada', 'xyz'])
        esperarError(
          (await t.http().get(`/comercios/${id}/resenas`).expect(404)).body,
          'COMERCIO_NO_ENCONTRADO',
        );
    });
  });

  describe('POST /comercios/:id/resenas', () => {
    it('201: crea con id del servidor, sincronizada true, creadaEn ahora y recalcula el puntaje (R8)', async () => {
      const c = await comercioNuevo();
      const res = await t
        .http()
        .post(`/comercios/${c.id}/resenas`)
        .set(marta.auth)
        .send({ estrellas: 5, comentario: '  Excelente atención.  ' })
        .expect(201);
      esperarContrato(res.body, 'Resena');
      expect(res.body.datos).toMatchObject({
        comercioId: c.id,
        usuarioId: marta.id,
        estrellas: 5,
        comentario: 'Excelente atención.',
        respuesta: null,
        reportada: false,
        creadaEn: '2026-10-03T12:00:00-03:00',
        sincronizada: true,
      });
      expect(res.body.datos.id).toMatch(/^res-[a-z0-9]{12}$/);
      expect(await puntajeDe(c.id)).toEqual([5, 1]);
    });

    it('el puntaje es el promedio con un decimal de todas las reseñas', async () => {
      const c = await comercioNuevo();
      for (const [u, e] of [
        [marta, 5],
        [juan, 4],
        [await crearUsuario(t), 4],
      ] as const)
        await t
          .http()
          .post(`/comercios/${c.id}/resenas`)
          .set(u.auth)
          .send({ estrellas: e, comentario: 'Bien.' })
          .expect(201);
      expect(await puntajeDe(c.id)).toEqual([4.3, 3]);
    });

    it('acepta id y creadaEn del cliente (cola offline) y normaliza la fecha a -03:00', async () => {
      const c = await comercioNuevo();
      const res = await t
        .http()
        .post(`/comercios/${c.id}/resenas`)
        .set(marta.auth)
        .send({
          id: 'res-cliente1',
          estrellas: 3,
          comentario: 'Normal.',
          creadaEn: '2026-10-01T15:30:00Z',
          sincronizada: false,
        })
        .expect(201);
      esperarContrato(res.body, 'Resena');
      expect(res.body.datos.id).toBe('res-cliente1');
      expect(res.body.datos.creadaEn).toBe('2026-10-01T12:30:00-03:00');
      expect(res.body.datos.sincronizada).toBe(true);
    });

    it('AGENTS §10.5 — el mismo cuerpo dos veces deja una reseña y las dos respuestas coinciden', async () => {
      const c = await comercioNuevo();
      const cuerpo = {
        id: 'res-idem-1',
        estrellas: 4,
        comentario: 'Todo bien.',
        creadaEn: '2026-10-02T10:00:00-03:00',
      };
      const a = await t.http().post(`/comercios/${c.id}/resenas`).set(marta.auth).send(cuerpo);
      const b = await t.http().post(`/comercios/${c.id}/resenas`).set(marta.auth).send(cuerpo);
      expect([a.status, b.status]).toEqual([201, 200]);
      expect(b.body).toEqual(a.body);
      expect(await t.dataSource.getRepository(Resena).countBy({ comercioId: c.id })).toBe(1);
      expect(await puntajeDe(c.id)).toEqual([4, 1]);
    });

    it('el mismo id reenviado con otros datos devuelve la existente sin pisarla', async () => {
      const c = await comercioNuevo();
      await t
        .http()
        .post(`/comercios/${c.id}/resenas`)
        .set(marta.auth)
        .send({ id: 'res-idem-2', estrellas: 4, comentario: 'Original.' })
        .expect(201);
      const res = await t
        .http()
        .post(`/comercios/${c.id}/resenas`)
        .set(marta.auth)
        .send({ id: 'res-idem-2', estrellas: 1, comentario: 'Otro.' })
        .expect(200);
      expect(res.body.datos).toMatchObject({ estrellas: 4, comentario: 'Original.' });
    });

    it('409 ID_EN_USO si el id es de la reseña de otro usuario', async () => {
      const c = await comercioNuevo();
      await crearResena(t, { id: 'res-ajena', comercioId: c.id, usuarioId: juan.id });
      const res = await t
        .http()
        .post(`/comercios/${c.id}/resenas`)
        .set(marta.auth)
        .send({ id: 'res-ajena', estrellas: 4, comentario: 'Mía.' })
        .expect(409);
      esperarError(res.body, 'ID_EN_USO');
    });

    it('409 RESENA_YA_EXISTE: una por vecino y comercio, con otro id', async () => {
      const c = await comercioNuevo();
      await crearResena(t, { comercioId: c.id, usuarioId: marta.id });
      const res = await t
        .http()
        .post(`/comercios/${c.id}/resenas`)
        .set(marta.auth)
        .send({ estrellas: 2, comentario: 'Otra vez.' })
        .expect(409);
      esperarError(res.body, 'RESENA_YA_EXISTE');
      expect(await t.dataSource.getRepository(Resena).countBy({ comercioId: c.id })).toBe(1);
    });

    it('concurrencia: dos pedidos iguales con ids distintos → uno 201 y otro RESENA_YA_EXISTE', async () => {
      const c = await comercioNuevo();
      const enviar = (id: string) =>
        t
          .http()
          .post(`/comercios/${c.id}/resenas`)
          .set(marta.auth)
          .send({ id, estrellas: 4, comentario: 'Simultánea.' });
      const [a, b] = await Promise.all([enviar('res-conc-a'), enviar('res-conc-b')]);
      expect([a.status, b.status].sort()).toEqual([201, 409]);
      const perdedor = a.status === 409 ? a : b;
      esperarError(perdedor.body, 'RESENA_YA_EXISTE');
      expect(await t.dataSource.getRepository(Resena).countBy({ comercioId: c.id })).toBe(1);
      expect(await puntajeDe(c.id)).toEqual([4, 1]);
    });

    it('concurrencia: dos pedidos con el mismo id → los dos devuelven la misma reseña, una sola fila', async () => {
      const c = await comercioNuevo();
      const enviar = () =>
        t
          .http()
          .post(`/comercios/${c.id}/resenas`)
          .set(marta.auth)
          .send({ id: 'res-conc-mismo', estrellas: 4, comentario: 'Simultánea.' });
      const [a, b] = await Promise.all([enviar(), enviar()]);
      expect([a.status, b.status].sort()).toEqual([200, 201]);
      expect(a.body).toEqual(b.body);
      expect(await t.dataSource.getRepository(Resena).countBy({ comercioId: c.id })).toBe(1);
    });

    it('R7/D5 — una cuenta de comercio no reseña: 403 SIN_PERMISO', async () => {
      const c = await comercioNuevo();
      const res = await t
        .http()
        .post(`/comercios/${c.id}/resenas`)
        .set(tornillo.auth)
        .send({ estrellas: 5, comentario: 'Me autoelogio.' })
        .expect(403);
      esperarError(res.body, 'SIN_PERMISO');
    });

    it('401 sin token', async () => {
      const c = await comercioNuevo();
      esperarError(
        (
          await t
            .http()
            .post(`/comercios/${c.id}/resenas`)
            .send({ estrellas: 5, comentario: 'Hola.' })
            .expect(401)
        ).body,
        'NO_AUTENTICADO',
      );
    });

    it('404 COMERCIO_NO_ENCONTRADO', async () => {
      esperarError(
        (
          await t
            .http()
            .post('/comercios/com-nada/resenas')
            .set(marta.auth)
            .send({ estrellas: 5, comentario: 'Hola.' })
            .expect(404)
        ).body,
        'COMERCIO_NO_ENCONTRADO',
      );
    });

    it.each([
      ['sin estrellas', { comentario: 'Hola.' }],
      ['estrellas 0', { estrellas: 0, comentario: 'Hola.' }],
      ['estrellas 6', { estrellas: 6, comentario: 'Hola.' }],
      ['estrellas decimales', { estrellas: 3.5, comentario: 'Hola.' }],
      ['estrellas como texto', { estrellas: '5', comentario: 'Hola.' }],
      ['sin comentario', { estrellas: 5 }],
      ['comentario vacío', { estrellas: 5, comentario: '' }],
      ['comentario sólo espacios', { estrellas: 5, comentario: '   ' }],
      ['comentario null', { estrellas: 5, comentario: null }],
      ['comentario de 1001 caracteres', { estrellas: 5, comentario: 'a'.repeat(1001) }],
      ['id sin prefijo', { id: 'abc-123', estrellas: 5, comentario: 'Hola.' }],
      ['id demasiado corto', { id: 'res-a', estrellas: 5, comentario: 'Hola.' }],
      ['id numérico', { id: 123, estrellas: 5, comentario: 'Hola.' }],
      ['creadaEn sin zona', { estrellas: 5, comentario: 'Hola.', creadaEn: '2026-10-01T10:00:00' }],
      ['creadaEn basura', { estrellas: 5, comentario: 'Hola.', creadaEn: 'ayer' }],
      ['campo de más', { estrellas: 5, comentario: 'Hola.', usuarioId: 'usr-1' }],
    ])('400 VALIDACION_FALLIDA: %s', async (_nombre, cuerpo) => {
      const c = await comercioNuevo();
      const res = await t
        .http()
        .post(`/comercios/${c.id}/resenas`)
        .set(marta.auth)
        .send(cuerpo)
        .expect(400);
      esperarError(res.body, 'VALIDACION_FALLIDA');
    });

    it('comentario de exactamente 1000 caracteres y de 1 carácter: válidos', async () => {
      const c = await comercioNuevo();
      await t
        .http()
        .post(`/comercios/${c.id}/resenas`)
        .set(marta.auth)
        .send({ estrellas: 1, comentario: 'a'.repeat(1000) })
        .expect(201);
      const d = await comercioNuevo();
      await t
        .http()
        .post(`/comercios/${d.id}/resenas`)
        .set(marta.auth)
        .send({ estrellas: 1, comentario: 'a' })
        .expect(201);
    });

    it('R15 — 422 FECHA_EN_EL_FUTURO; con 5 minutos de tolerancia se acepta', async () => {
      const c = await comercioNuevo();
      const res = await t
        .http()
        .post(`/comercios/${c.id}/resenas`)
        .set(marta.auth)
        .send({ estrellas: 5, comentario: 'Hola.', creadaEn: '2026-10-03T12:05:01-03:00' })
        .expect(422);
      esperarError(res.body, 'FECHA_EN_EL_FUTURO');
      await t
        .http()
        .post(`/comercios/${c.id}/resenas`)
        .set(marta.auth)
        .send({ estrellas: 5, comentario: 'Hola.', creadaEn: '2026-10-03T12:05:00-03:00' })
        .expect(201);
    });
  });

  describe('PATCH /resenas/:id', () => {
    it('200: el autor cambia estrellas y comentario y el puntaje se recalcula', async () => {
      const c = await comercioNuevo();
      const r = await crearResena(t, { comercioId: c.id, usuarioId: marta.id, estrellas: 2 });
      await crearResena(t, { comercioId: c.id, usuarioId: juan.id, estrellas: 4 });
      const res = await t
        .http()
        .patch(`/resenas/${r.id}`)
        .set(marta.auth)
        .send({ estrellas: 5, comentario: 'Mejoró mucho.' })
        .expect(200);
      esperarContrato(res.body, 'Resena');
      expect(res.body.datos).toMatchObject({
        id: r.id,
        estrellas: 5,
        comentario: 'Mejoró mucho.',
        creadaEn: '2026-10-03T11:00:00-03:00',
      });
      expect(await puntajeDe(c.id)).toEqual([4.5, 2]);
    });

    it('lo que no se manda queda como estaba, y {} no cambia nada', async () => {
      const c = await comercioNuevo();
      const r = await crearResena(t, {
        comercioId: c.id,
        usuarioId: marta.id,
        estrellas: 3,
        comentario: 'Original.',
        respuesta: 'Gracias.',
      });
      const solo = await t
        .http()
        .patch(`/resenas/${r.id}`)
        .set(marta.auth)
        .send({ comentario: 'Nuevo.' })
        .expect(200);
      expect(solo.body.datos).toMatchObject({
        estrellas: 3,
        comentario: 'Nuevo.',
        respuesta: 'Gracias.',
      });
      const vacio = await t.http().patch(`/resenas/${r.id}`).set(marta.auth).send({}).expect(200);
      expect(vacio.body.datos.comentario).toBe('Nuevo.');
    });

    it('403 SIN_PERMISO si no es el autor, 403 para el comercio reseñado', async () => {
      const c = await comercioNuevo();
      const r = await crearResena(t, { comercioId: c.id, usuarioId: marta.id });
      for (const quien of [juan, tornillo]) {
        const res = await t
          .http()
          .patch(`/resenas/${r.id}`)
          .set(quien.auth)
          .send({ estrellas: 1 })
          .expect(403);
        esperarError(res.body, 'SIN_PERMISO');
      }
      const intacta = await t.dataSource.getRepository(Resena).findOneByOrFail({ id: r.id });
      expect(intacta.estrellas).toBe(4);
    });

    it('401 sin token; 404 RESENA_NO_ENCONTRADA (inexistente o id mal formado)', async () => {
      esperarError((await t.http().patch('/resenas/res-x1y2').send({}).expect(401)).body);
      for (const id of ['res-nadie', 'basura'])
        esperarError(
          (await t.http().patch(`/resenas/${id}`).set(marta.auth).send({}).expect(404)).body,
          'RESENA_NO_ENCONTRADA',
        );
    });

    it.each([
      ['estrellas 0', { estrellas: 0 }],
      ['estrellas 6', { estrellas: 6 }],
      ['estrellas null', { estrellas: null }],
      ['comentario vacío', { comentario: '' }],
      ['comentario null', { comentario: null }],
      ['comentario largo', { comentario: 'a'.repeat(1001) }],
      ['respuesta (no se edita acá)', { respuesta: 'hola' }],
      ['creadaEn (no se edita)', { creadaEn: '2026-10-01T10:00:00-03:00' }],
    ])('400 VALIDACION_FALLIDA: %s', async (_nombre, cuerpo) => {
      const c = await comercioNuevo();
      const r = await crearResena(t, { comercioId: c.id, usuarioId: marta.id });
      esperarError(
        (await t.http().patch(`/resenas/${r.id}`).set(marta.auth).send(cuerpo).expect(400)).body,
        'VALIDACION_FALLIDA',
      );
    });
  });

  describe('DELETE /resenas/:id', () => {
    it('204 sin cuerpo: borra, recalcula el puntaje (0 si era la última) y se puede reseñar de nuevo', async () => {
      const c = await comercioNuevo({ puntaje: 4, cantidadResenas: 1 });
      const r = await crearResena(t, { comercioId: c.id, usuarioId: marta.id });
      const res = await t.http().delete(`/resenas/${r.id}`).set(marta.auth).expect(204);
      expect(res.text).toBe('');
      expect(await puntajeDe(c.id)).toEqual([0, 0]);
      await t
        .http()
        .post(`/comercios/${c.id}/resenas`)
        .set(marta.auth)
        .send({ estrellas: 5, comentario: 'Vuelvo a opinar.' })
        .expect(201);
    });

    it('borra también sus reportes y recalcula con las que quedan', async () => {
      const c = await comercioNuevo();
      const r = await crearResena(t, { comercioId: c.id, usuarioId: marta.id, estrellas: 1 });
      await crearResena(t, { comercioId: c.id, usuarioId: juan.id, estrellas: 5 });
      await t.http().post(`/resenas/${r.id}/reportes`).set(juan.auth).expect(200);
      await t.http().delete(`/resenas/${r.id}`).set(marta.auth).expect(204);
      expect(await puntajeDe(c.id)).toEqual([5, 1]);
      const filas = await t.dataSource.getRepository(ReporteDeResena).findBy({ resenaId: r.id });
      expect(filas).toEqual([]);
    });

    it('403 si no es el autor; 401 sin token; 404 si no existe', async () => {
      const c = await comercioNuevo();
      const r = await crearResena(t, { comercioId: c.id, usuarioId: marta.id });
      esperarError(
        (await t.http().delete(`/resenas/${r.id}`).set(juan.auth).expect(403)).body,
        'SIN_PERMISO',
      );
      esperarError(
        (await t.http().delete(`/resenas/${r.id}`).set(tornillo.auth).expect(403)).body,
        'SIN_PERMISO',
      );
      esperarError((await t.http().delete(`/resenas/${r.id}`).expect(401)).body);
      esperarError(
        (await t.http().delete('/resenas/res-nadie').set(marta.auth).expect(404)).body,
        'RESENA_NO_ENCONTRADA',
      );
      expect(await t.dataSource.getRepository(Resena).countBy({ id: r.id })).toBe(1);
    });

    it('borrar dos veces: la segunda da 404', async () => {
      const c = await comercioNuevo();
      const r = await crearResena(t, { comercioId: c.id, usuarioId: marta.id });
      await t.http().delete(`/resenas/${r.id}`).set(marta.auth).expect(204);
      await t.http().delete(`/resenas/${r.id}`).set(marta.auth).expect(404);
    });
  });

  describe('POST /resenas/:id/reportes', () => {
    it('200 con la Resena reportada: true; idempotente por usuario', async () => {
      const c = await comercioNuevo();
      const r = await crearResena(t, { comercioId: c.id, usuarioId: marta.id });
      const a = await t.http().post(`/resenas/${r.id}/reportes`).set(juan.auth).expect(200);
      esperarContrato(a.body, 'Resena');
      expect(a.body.datos.reportada).toBe(true);
      const b = await t.http().post(`/resenas/${r.id}/reportes`).set(juan.auth).expect(200);
      expect(b.body).toEqual(a.body);
      const filas = await t.dataSource.getRepository(ReporteDeResena).findBy({ resenaId: r.id });
      expect(filas).toHaveLength(1);
    });

    it('la reseña reportada sigue en el listado, con reportada: true (D6)', async () => {
      const c = await comercioNuevo();
      const r = await crearResena(t, { comercioId: c.id, usuarioId: marta.id });
      await t.http().post(`/resenas/${r.id}/reportes`).set(juan.auth).expect(200);
      const lista = await t.http().get(`/comercios/${c.id}/resenas`).expect(200);
      expect(lista.body.datos[0]).toMatchObject({ id: r.id, reportada: true });
    });

    it('dos usuarios distintos pueden reportar la misma reseña', async () => {
      const c = await comercioNuevo();
      const r = await crearResena(t, { comercioId: c.id, usuarioId: marta.id });
      await t.http().post(`/resenas/${r.id}/reportes`).set(juan.auth).expect(200);
      await t.http().post(`/resenas/${r.id}/reportes`).set(tornillo.auth).expect(200);
      const filas = await t.dataSource.getRepository(ReporteDeResena).findBy({ resenaId: r.id });
      expect(filas).toHaveLength(2);
    });

    it('concurrencia: el mismo usuario reportando dos veces a la vez → los dos 200 y un solo reporte', async () => {
      const c = await comercioNuevo();
      const r = await crearResena(t, { comercioId: c.id, usuarioId: marta.id });
      const enviar = () => t.http().post(`/resenas/${r.id}/reportes`).set(juan.auth);
      const [a, b] = await Promise.all([enviar(), enviar()]);
      expect([a.status, b.status]).toEqual([200, 200]);
      const filas = await t.dataSource.getRepository(ReporteDeResena).findBy({ resenaId: r.id });
      expect(filas).toHaveLength(1);
    });

    it('R10 — 422 REPORTE_PROPIO si es el autor', async () => {
      const c = await comercioNuevo();
      const r = await crearResena(t, { comercioId: c.id, usuarioId: marta.id });
      esperarError(
        (await t.http().post(`/resenas/${r.id}/reportes`).set(marta.auth).expect(422)).body,
        'REPORTE_PROPIO',
      );
      const intacta = await t.dataSource.getRepository(Resena).findOneByOrFail({ id: r.id });
      expect(intacta.reportada).toBe(false);
    });

    it('401 sin token; 404 RESENA_NO_ENCONTRADA', async () => {
      esperarError((await t.http().post('/resenas/res-abcd/reportes').expect(401)).body);
      esperarError(
        (await t.http().post('/resenas/res-nadie/reportes').set(juan.auth).expect(404)).body,
        'RESENA_NO_ENCONTRADA',
      );
    });
  });

  describe('POST /resenas/:id/respuesta', () => {
    it('200: el dueño del comercio reseñado responde, y la Resena queda con respuesta', async () => {
      const r = await crearResena(t, { comercioId: 'com-118', usuarioId: marta.id });
      const res = await t
        .http()
        .post(`/resenas/${r.id}/respuesta`)
        .set(tornillo.auth)
        .send({ respuesta: '  ¡Gracias, Marta!  ' })
        .expect(200);
      esperarContrato(res.body, 'Resena');
      expect(res.body.datos).toMatchObject({ id: r.id, respuesta: '¡Gracias, Marta!' });
      const lista = await t.http().get('/comercios/com-118/resenas').expect(200);
      expect(lista.body.datos.find((x: { id: string }) => x.id === r.id).respuesta).toBe(
        '¡Gracias, Marta!',
      );
    });

    it('R9 — 409 RESENA_YA_RESPONDIDA la segunda vez, y la respuesta original se conserva', async () => {
      const r = await crearResena(t, { comercioId: 'com-118', usuarioId: juan.id });
      await t
        .http()
        .post(`/resenas/${r.id}/respuesta`)
        .set(tornillo.auth)
        .send({ respuesta: 'Primera.' })
        .expect(200);
      esperarError(
        (
          await t
            .http()
            .post(`/resenas/${r.id}/respuesta`)
            .set(tornillo.auth)
            .send({ respuesta: 'Segunda.' })
            .expect(409)
        ).body,
        'RESENA_YA_RESPONDIDA',
      );
      const fila = await t.dataSource.getRepository(Resena).findOneByOrFail({ id: r.id });
      expect(fila.respuesta).toBe('Primera.');
    });

    it('concurrencia: dos respuestas a la vez → una 200 y la otra 409', async () => {
      const u = await crearUsuario(t);
      const r = await crearResena(t, { comercioId: 'com-118', usuarioId: u.id });
      const enviar = (respuesta: string) =>
        t.http().post(`/resenas/${r.id}/respuesta`).set(tornillo.auth).send({ respuesta });
      const [a, b] = await Promise.all([enviar('Uno.'), enviar('Dos.')]);
      expect([a.status, b.status].sort()).toEqual([200, 409]);
    });

    it('403 SIN_PERMISO: el comercio de otro, un vecino (ni siquiera el autor)', async () => {
      const autora = await crearUsuario(t);
      const r = await crearResena(t, { comercioId: 'com-118', usuarioId: autora.id });
      for (const quien of [otroComercio, juan, autora])
        esperarError(
          (
            await t
              .http()
              .post(`/resenas/${r.id}/respuesta`)
              .set(quien.auth)
              .send({ respuesta: 'Hola.' })
              .expect(403)
          ).body,
          'SIN_PERMISO',
        );
      const fila = await t.dataSource.getRepository(Resena).findOneByOrFail({ id: r.id });
      expect(fila.respuesta).toBeNull();
    });

    it('401 sin token; 404 RESENA_NO_ENCONTRADA', async () => {
      esperarError(
        (await t.http().post('/resenas/res-abcd/respuesta').send({ respuesta: 'x' }).expect(401))
          .body,
      );
      esperarError(
        (
          await t
            .http()
            .post('/resenas/res-nadie/respuesta')
            .set(tornillo.auth)
            .send({ respuesta: 'x' })
            .expect(404)
        ).body,
        'RESENA_NO_ENCONTRADA',
      );
    });

    it.each([
      ['sin respuesta', {}],
      ['vacía', { respuesta: '' }],
      ['sólo espacios', { respuesta: '   ' }],
      ['null', { respuesta: null }],
      ['de 1001 caracteres', { respuesta: 'a'.repeat(1001) }],
      ['campo de más', { respuesta: 'Hola.', otra: 1 }],
    ])('400 VALIDACION_FALLIDA: respuesta %s', async (_nombre, cuerpo) => {
      const u = await crearUsuario(t);
      const r = await crearResena(t, { comercioId: 'com-118', usuarioId: u.id });
      esperarError(
        (
          await t
            .http()
            .post(`/resenas/${r.id}/respuesta`)
            .set(tornillo.auth)
            .send(cuerpo)
            .expect(400)
        ).body,
        'VALIDACION_FALLIDA',
      );
    });
  });

  it('Comercio.puntaje y cantidadResenas salen del listado de comercios ya recalculados', async () => {
    const c = await comercioNuevo();
    await t
      .http()
      .post(`/comercios/${c.id}/resenas`)
      .set(marta.auth)
      .send({ estrellas: 4, comentario: 'Bien.' })
      .expect(201);
    const res = await t.http().get(`/comercios/${c.id}`).expect(200);
    esperarContrato(res.body, 'Comercio');
    expect([res.body.datos.puntaje, res.body.datos.cantidadResenas]).toEqual([4, 1]);
  });
});
