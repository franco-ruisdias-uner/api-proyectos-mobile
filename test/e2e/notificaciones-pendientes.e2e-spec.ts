import { Logger } from '@nestjs/common';
import { crearComercio, crearRubro } from '../utilidades/comercios.js';
import { esperarError } from '../utilidades/contrato.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { crearUsuario } from '../utilidades/usuarios.js';

const TOKEN = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]';

describe('AGENTS §19.3 — Las piezas de los alumnos están vacías: 501 y el resto sigue andando', () => {
  let t: AppDePrueba;
  beforeEach(async () => {
    t = await crearApp({
      almacenReal: true,
      enviadorReal: true,
      variables: { NOTIFICACIONES: 'expo' },
    });
  });
  afterEach(() => t.cerrar());

  it('POST /dispositivos responde 501 NO_IMPLEMENTADO con el sobre de error', async () => {
    const marta = await crearUsuario(t);
    const res = await t
      .http()
      .post('/dispositivos')
      .set(marta.auth)
      .send({ tokenExpo: TOKEN, plataforma: 'ios' })
      .expect(501);
    esperarError(res.body, 'NO_IMPLEMENTADO');
    expect(res.body.error.mensaje).toBe(
      'Esta parte la programan ustedes. Mirá docs/NOTIFICACIONES.md.',
    );
  });

  it('DELETE /dispositivos/:tokenExpo responde 501 NO_IMPLEMENTADO', async () => {
    const marta = await crearUsuario(t);
    const res = await t
      .http()
      .delete(`/dispositivos/${encodeURIComponent(TOKEN)}`)
      .set(marta.auth)
      .expect(501);
    esperarError(res.body, 'NO_IMPLEMENTADO');
  });

  it('POST /dispositivos/prueba responde 501 NO_IMPLEMENTADO', async () => {
    const marta = await crearUsuario(t);
    const res = await t.http().post('/dispositivos/prueba').set(marta.auth).expect(501);
    esperarError(res.body, 'NO_IMPLEMENTADO');
  });

  it('sin sesión sigue siendo 401 y con un cuerpo mal formado, 400 (antes del 501)', async () => {
    const marta = await crearUsuario(t);
    esperarError((await t.http().post('/dispositivos/prueba').expect(401)).body, 'NO_AUTENTICADO');
    esperarError(
      (await t.http().post('/dispositivos').set(marta.auth).send({}).expect(400)).body,
      'VALIDACION_FALLIDA',
    );
  });

  it('una promo nueva se crea igual (201) y Avisos deja en el log que la push quedó pendiente', async () => {
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    try {
      await crearRubro(t, { id: 'rub-ferreteria' });
      await crearComercio(t, {
        id: 'com-118',
        nombre: 'Ferretería El Tornillo',
        rubroId: 'rub-ferreteria',
      });
      const tornillo = await crearUsuario(t, { rol: 'comercio', comercioId: 'com-118' });
      const vecino = await crearUsuario(t);
      await t.http().put('/yo/favoritos/com-118').set(vecino.auth).expect(200);
      await t
        .http()
        .post('/mi-comercio/promociones')
        .set(tornillo.auth)
        .send({ titulo: 'Promo', detalle: 'Detalle.', hasta: '2026-10-31T23:59:59-03:00' })
        .expect(201);
      await t.avisos.esperarPendientes();
      const mensajes = log.mock.calls.map((c) => String(c[0]));
      expect(mensajes).toContain(
        'Push pendiente de implementar: Ferretería El Tornillo → 1 usuarios',
      );
    } finally {
      log.mockRestore();
    }
  });
});
