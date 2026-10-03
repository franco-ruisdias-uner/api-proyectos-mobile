import { crearComercio, crearRubro } from '../utilidades/comercios.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { crearUsuario } from '../utilidades/usuarios.js';

describe('ESPECIFICACION M3 — Favoritos y cuenta', () => {
  let t: AppDePrueba;
  beforeAll(async () => {
    t = await crearApp();
    await crearRubro(t, { id: 'rub-ferreteria' });
    await crearRubro(t, { id: 'rub-gastro' });
    await crearComercio(t, { id: 'com-118', rubroId: 'rub-ferreteria' });
    await crearComercio(t, { id: 'com-201', rubroId: 'rub-gastro' });
    await crearComercio(t, { id: 'com-baja', rubroId: 'rub-gastro', activo: false });
  });
  afterAll(() => t.cerrar());

  describe('PUT /yo/favoritos/:comercioId', () => {
    it('agrega y devuelve el Usuario con el favorito', async () => {
      const u = await crearUsuario(t);
      const res = await t.http().put('/yo/favoritos/com-118').set(u.auth).expect(200);
      esperarContrato(res.body, 'Usuario');
      expect(res.body.datos.id).toBe(u.id);
      expect(res.body.datos.favoritos).toEqual(['com-118']);
    });

    it('es idempotente: dos veces deja uno solo', async () => {
      const u = await crearUsuario(t);
      const a = await t.http().put('/yo/favoritos/com-118').set(u.auth).expect(200);
      const b = await t.http().put('/yo/favoritos/com-118').set(u.auth).expect(200);
      expect(b.body).toEqual(a.body);
      expect(b.body.datos.favoritos).toEqual(['com-118']);
    });

    it('mantiene el orden en que se agregaron', async () => {
      const u = await crearUsuario(t);
      await t.http().put('/yo/favoritos/com-201').set(u.auth).expect(200);
      t.reloj.avanzar?.(1000);
      const res = await t.http().put('/yo/favoritos/com-118').set(u.auth).expect(200);
      expect(res.body.datos.favoritos).toEqual(['com-201', 'com-118']);
    });

    it('simultáneos: un solo registro y ambos 200', async () => {
      const u = await crearUsuario(t);
      const rs = await Promise.all([
        t.http().put('/yo/favoritos/com-118').set(u.auth),
        t.http().put('/yo/favoritos/com-118').set(u.auth),
      ]);
      expect(rs.map((r) => r.status)).toEqual([200, 200]);
      const yo = await t.http().get('/yo').set(u.auth).expect(200);
      expect(yo.body.datos.favoritos).toEqual(['com-118']);
    });

    it('acepta un comercio dado de baja (el detalle lo devuelve)', async () => {
      const u = await crearUsuario(t);
      const res = await t.http().put('/yo/favoritos/com-baja').set(u.auth).expect(200);
      expect(res.body.datos.favoritos).toEqual(['com-baja']);
    });

    it('404 COMERCIO_NO_ENCONTRADO si no existe', async () => {
      const u = await crearUsuario(t);
      const res = await t.http().put('/yo/favoritos/com-nope').set(u.auth).expect(404);
      esperarError(res.body, 'COMERCIO_NO_ENCONTRADO');
    });

    it('401 sin token', async () => {
      const res = await t.http().put('/yo/favoritos/com-118').expect(401);
      esperarError(res.body, 'NO_AUTENTICADO');
    });

    it('403 SIN_PERMISO para una cuenta de comercio', async () => {
      const c = await crearUsuario(t, { rol: 'comercio', comercioId: 'com-118' });
      const res = await t.http().put('/yo/favoritos/com-201').set(c.auth).expect(403);
      esperarError(res.body, 'SIN_PERMISO');
    });

    it('cada usuario ve sólo los suyos', async () => {
      const a = await crearUsuario(t);
      const b = await crearUsuario(t);
      await t.http().put('/yo/favoritos/com-118').set(a.auth).expect(200);
      const yo = await t.http().get('/yo').set(b.auth).expect(200);
      expect(yo.body.datos.favoritos).toEqual([]);
    });
  });

  describe('DELETE /yo/favoritos/:comercioId', () => {
    it('quita el favorito: 204 sin cuerpo', async () => {
      const u = await crearUsuario(t);
      await t.http().put('/yo/favoritos/com-118').set(u.auth).expect(200);
      await t.http().put('/yo/favoritos/com-201').set(u.auth).expect(200);
      const res = await t.http().delete('/yo/favoritos/com-118').set(u.auth).expect(204);
      expect(res.text).toBe('');
      const yo = await t.http().get('/yo').set(u.auth).expect(200);
      expect(yo.body.datos.favoritos).toEqual(['com-201']);
    });

    it('es idempotente: quitar uno que no estaba (o no existe) da 204', async () => {
      const u = await crearUsuario(t);
      await t.http().delete('/yo/favoritos/com-118').set(u.auth).expect(204);
      await t.http().delete('/yo/favoritos/com-nope').set(u.auth).expect(204);
    });

    it('401 sin token y 403 para comercio', async () => {
      esperarError((await t.http().delete('/yo/favoritos/com-118').expect(401)).body);
      const c = await crearUsuario(t, { rol: 'comercio', comercioId: 'com-118' });
      const res = await t.http().delete('/yo/favoritos/com-118').set(c.auth).expect(403);
      esperarError(res.body, 'SIN_PERMISO');
    });
  });

  describe('PATCH /yo — rubros de interés y avisos', () => {
    it('cambia rubrosDeInteres y avisosActivos', async () => {
      const u = await crearUsuario(t);
      const res = await t
        .http()
        .patch('/yo')
        .set(u.auth)
        .send({ rubrosDeInteres: ['rub-gastro', 'rub-ferreteria'], avisosActivos: false })
        .expect(200);
      esperarContrato(res.body, 'Usuario');
      expect(res.body.datos.rubrosDeInteres).toEqual(['rub-gastro', 'rub-ferreteria']);
      expect(res.body.datos.avisosActivos).toBe(false);
      const yo = await t.http().get('/yo').set(u.auth).expect(200);
      expect(yo.body.datos.rubrosDeInteres).toEqual(['rub-gastro', 'rub-ferreteria']);
      expect(yo.body.datos.avisosActivos).toBe(false);
    });

    it('reemplaza la lista entera y [] la vacía', async () => {
      const u = await crearUsuario(t);
      await t
        .http()
        .patch('/yo')
        .set(u.auth)
        .send({ rubrosDeInteres: ['rub-gastro'] })
        .expect(200);
      const a = await t
        .http()
        .patch('/yo')
        .set(u.auth)
        .send({ rubrosDeInteres: ['rub-ferreteria'] })
        .expect(200);
      expect(a.body.datos.rubrosDeInteres).toEqual(['rub-ferreteria']);
      const b = await t.http().patch('/yo').set(u.auth).send({ rubrosDeInteres: [] }).expect(200);
      expect(b.body.datos.rubrosDeInteres).toEqual([]);
    });

    it('repetidos se quedan una vez', async () => {
      const u = await crearUsuario(t);
      const res = await t
        .http()
        .patch('/yo')
        .set(u.auth)
        .send({ rubrosDeInteres: ['rub-gastro', 'rub-gastro'] })
        .expect(200);
      expect(res.body.datos.rubrosDeInteres).toEqual(['rub-gastro']);
    });

    it('lo que no se manda queda como estaba', async () => {
      const u = await crearUsuario(t, { nombre: 'Ana' });
      await t
        .http()
        .patch('/yo')
        .set(u.auth)
        .send({ rubrosDeInteres: ['rub-gastro'] })
        .expect(200);
      await t.http().put('/yo/favoritos/com-118').set(u.auth).expect(200);
      const res = await t
        .http()
        .patch('/yo')
        .set(u.auth)
        .send({ avisosActivos: false })
        .expect(200);
      expect(res.body.datos).toMatchObject({
        nombre: 'Ana',
        favoritos: ['com-118'],
        rubrosDeInteres: ['rub-gastro'],
        avisosActivos: false,
      });
    });

    it('422 RUBRO_NO_ENCONTRADO y no cambia nada', async () => {
      const u = await crearUsuario(t);
      await t
        .http()
        .patch('/yo')
        .set(u.auth)
        .send({ rubrosDeInteres: ['rub-gastro'] })
        .expect(200);
      const res = await t
        .http()
        .patch('/yo')
        .set(u.auth)
        .send({ nombre: 'Nuevo', rubrosDeInteres: ['rub-ferreteria', 'rub-fantasma'] })
        .expect(422);
      esperarError(res.body, 'RUBRO_NO_ENCONTRADO');
      const yo = await t.http().get('/yo').set(u.auth).expect(200);
      expect(yo.body.datos.rubrosDeInteres).toEqual(['rub-gastro']);
      expect(yo.body.datos.nombre).not.toBe('Nuevo');
    });

    it.each([
      [{ rubrosDeInteres: 'rub-gastro' }, 'Los rubros de interés tienen que ser una lista.'],
      [{ rubrosDeInteres: [3] }, 'Cada rubro de interés tiene que ser un texto.'],
      [{ rubrosDeInteres: null }, 'Los rubros de interés tienen que ser una lista.'],
      [{ avisosActivos: 'si' }, 'Avisos activos tiene que ser sí o no.'],
      [{ avisosActivos: null }, 'Avisos activos tiene que ser sí o no.'],
      [{ favoritos: ['com-118'] }, 'No se esperaba el dato «favoritos».'],
    ])('400 VALIDACION_FALLIDA con %j', async (cuerpo, mensaje) => {
      const u = await crearUsuario(t);
      const res = await t.http().patch('/yo').set(u.auth).send(cuerpo).expect(400);
      esperarError(res.body, 'VALIDACION_FALLIDA');
      expect(res.body.error.mensaje).toBe(mensaje);
    });

    it('401 sin token', async () => {
      esperarError((await t.http().patch('/yo').send({ avisosActivos: false }).expect(401)).body);
    });
  });
});
