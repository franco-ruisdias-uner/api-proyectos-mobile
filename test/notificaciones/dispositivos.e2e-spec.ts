import {
  ALMACEN_TOKENS_PUSH,
  type AlmacenTokensPush,
} from '../../src/comun/notificaciones/puertos.js';
import { type AppDePrueba, crearApp as crearAppBase } from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { crearUsuario } from '../utilidades/usuarios.js';

// Consigna de notificaciones (AGENTS §19): acá se prueba el almacén de tokens de verdad.
const crearApp = () => crearAppBase({ almacenReal: true });
const tokensDe = (t: AppDePrueba, ids: string[]) =>
  t.app.get<AlmacenTokensPush>(ALMACEN_TOKENS_PUSH).tokensDe(ids);

const TOKEN = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]';
const OTRO_TOKEN = 'ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]';

describe('Guardar tokens — POST /dispositivos: el alumno tiene que lograr que cada token quede guardado una sola vez y a nombre del usuario actual', () => {
  let t: AppDePrueba;
  beforeEach(async () => {
    t = await crearApp();
  });
  afterEach(() => t.cerrar());

  it('201: registra el token del teléfono', async () => {
    const marta = await crearUsuario(t);
    const res = await t
      .http()
      .post('/dispositivos')
      .set(marta.auth)
      .send({ tokenExpo: TOKEN, plataforma: 'android' })
      .expect(201);
    esperarContrato(res.body, 'Dispositivo');
    expect(res.body.datos).toEqual({ tokenExpo: TOKEN, plataforma: 'android' });
  });

  it('idempotente: el mismo POST dos veces deja un solo registro', async () => {
    const marta = await crearUsuario(t);
    const cuerpo = { tokenExpo: TOKEN, plataforma: 'ios' };
    const a = await t.http().post('/dispositivos').set(marta.auth).send(cuerpo).expect(201);
    const b = await t.http().post('/dispositivos').set(marta.auth).send(cuerpo).expect(201);
    expect(a.body).toEqual(b.body);
    expect(await tokensDe(t, [marta.id])).toEqual([TOKEN]);
  });

  it('dos POST simultáneos del mismo token dejan un solo registro', async () => {
    const marta = await crearUsuario(t);
    const cuerpo = { tokenExpo: TOKEN, plataforma: 'ios' };
    const respuestas = await Promise.all([
      t.http().post('/dispositivos').set(marta.auth).send(cuerpo),
      t.http().post('/dispositivos').set(marta.auth).send(cuerpo),
    ]);
    expect(respuestas.map((r) => r.status)).toEqual([201, 201]);
    expect(await tokensDe(t, [marta.id])).toEqual([TOKEN]);
  });

  it('si otro usuario tenía el token, pasa al actual', async () => {
    const marta = await crearUsuario(t);
    const jose = await crearUsuario(t);
    await t
      .http()
      .post('/dispositivos')
      .set(marta.auth)
      .send({ tokenExpo: TOKEN, plataforma: 'android' })
      .expect(201);
    await t
      .http()
      .post('/dispositivos')
      .set(jose.auth)
      .send({ tokenExpo: TOKEN, plataforma: 'android' })
      .expect(201);
    expect(await tokensDe(t, [marta.id])).toEqual([]);
    expect(await tokensDe(t, [jose.id])).toEqual([TOKEN]);
  });

  it.each([
    [{ plataforma: 'android' }, 'Falta el token de notificaciones del teléfono.'],
    [{ tokenExpo: 'abc', plataforma: 'android' }, /token de notificaciones no es válido/],
    [{ tokenExpo: TOKEN }, 'La plataforma tiene que ser «ios» o «android».'],
    [{ tokenExpo: TOKEN, plataforma: 'windows' }, 'La plataforma tiene que ser «ios» o «android».'],
    [
      { tokenExpo: TOKEN, plataforma: 'ios', usuarioId: 'usr-otro' },
      'No se esperaba el dato «usuarioId».',
    ],
  ])('400 VALIDACION_FALLIDA con %j', async (cuerpo, mensaje) => {
    const marta = await crearUsuario(t);
    const res = await t.http().post('/dispositivos').set(marta.auth).send(cuerpo).expect(400);
    esperarError(res.body, 'VALIDACION_FALLIDA');
    expect(res.body.error.mensaje).toMatch(mensaje);
  });

  it('401 NO_AUTENTICADO sin sesión', async () => {
    const res = await t
      .http()
      .post('/dispositivos')
      .send({ tokenExpo: TOKEN, plataforma: 'ios' })
      .expect(401);
    esperarError(res.body, 'NO_AUTENTICADO');
  });
});

describe('Dar de baja — DELETE /dispositivos/:tokenExpo: el alumno tiene que lograr que sólo el dueño pueda borrar su token', () => {
  let t: AppDePrueba;
  beforeEach(async () => {
    t = await crearApp();
  });
  afterEach(() => t.cerrar());

  it('204 sin cuerpo y el token queda dado de baja', async () => {
    const marta = await crearUsuario(t);
    await t
      .http()
      .post('/dispositivos')
      .set(marta.auth)
      .send({ tokenExpo: TOKEN, plataforma: 'ios' })
      .expect(201);
    const res = await t
      .http()
      .delete(`/dispositivos/${encodeURIComponent(TOKEN)}`)
      .set(marta.auth)
      .expect(204);
    expect(res.text).toBe('');
    expect(await tokensDe(t, [marta.id])).toEqual([]);
  });

  it('204 aunque el token no estuviera registrado', async () => {
    const marta = await crearUsuario(t);
    await t
      .http()
      .delete(`/dispositivos/${encodeURIComponent(TOKEN)}`)
      .set(marta.auth)
      .expect(204);
  });

  it('no se puede dar de baja el teléfono de otro usuario', async () => {
    const marta = await crearUsuario(t);
    const intruso = await crearUsuario(t);
    await t
      .http()
      .post('/dispositivos')
      .set(marta.auth)
      .send({ tokenExpo: TOKEN, plataforma: 'ios' })
      .expect(201);
    await t
      .http()
      .delete(`/dispositivos/${encodeURIComponent(TOKEN)}`)
      .set(intruso.auth)
      .expect(204);
    expect(await tokensDe(t, [marta.id])).toEqual([TOKEN]);
  });

  it('400 VALIDACION_FALLIDA con algo que no es un token de Expo', async () => {
    const marta = await crearUsuario(t);
    const res = await t.http().delete('/dispositivos/cualquier-cosa').set(marta.auth).expect(400);
    esperarError(res.body, 'VALIDACION_FALLIDA');
  });

  it('401 NO_AUTENTICADO sin sesión', async () => {
    const res = await t
      .http()
      .delete(`/dispositivos/${encodeURIComponent(TOKEN)}`)
      .expect(401);
    esperarError(res.body, 'NO_AUTENTICADO');
  });
});

describe('Push de prueba — POST /dispositivos/prueba: el alumno tiene que lograr que se mande a los tokens del usuario y se descarten los inválidos', () => {
  let t: AppDePrueba;
  beforeEach(async () => {
    t = await crearApp();
  });
  afterEach(() => t.cerrar());

  it('manda una push de prueba a los teléfonos del usuario y a ninguno más', async () => {
    const marta = await crearUsuario(t);
    const jose = await crearUsuario(t);
    await t
      .http()
      .post('/dispositivos')
      .set(marta.auth)
      .send({ tokenExpo: TOKEN, plataforma: 'ios' })
      .expect(201);
    await t
      .http()
      .post('/dispositivos')
      .set(marta.auth)
      .send({ tokenExpo: OTRO_TOKEN, plataforma: 'android' })
      .expect(201);
    await t
      .http()
      .post('/dispositivos')
      .set(jose.auth)
      .send({ tokenExpo: 'ExponentPushToken[cccccccccccccccccccccc]', plataforma: 'ios' })
      .expect(201);

    const res = await t.http().post('/dispositivos/prueba').set(marta.auth).expect(200);
    esperarContrato(res.body, 'PruebaPush');
    expect(res.body.datos).toEqual({ dispositivos: 2 });
    expect(t.enviador.enviados).toEqual([
      {
        tokens: [TOKEN, OTRO_TOKEN],
        titulo: 'Notificación de prueba',
        cuerpo: 'Si ves esto, las notificaciones andan.',
        datos: { tipo: 'prueba' },
      },
    ]);
  });

  it('sin teléfonos registrados responde 0 y no manda nada', async () => {
    const marta = await crearUsuario(t);
    const res = await t.http().post('/dispositivos/prueba').set(marta.auth).expect(200);
    expect(res.body.datos).toEqual({ dispositivos: 0 });
    expect(t.enviador.enviados).toEqual([]);
  });

  it('los tokens que Expo da por inválidos se borran', async () => {
    const marta = await crearUsuario(t);
    await t
      .http()
      .post('/dispositivos')
      .set(marta.auth)
      .send({ tokenExpo: TOKEN, plataforma: 'ios' })
      .expect(201);
    t.enviador.invalidos.add(TOKEN);
    await t.http().post('/dispositivos/prueba').set(marta.auth).expect(200);
    expect(await tokensDe(t, [marta.id])).toEqual([]);
  });

  it('401 NO_AUTENTICADO sin sesión', async () => {
    const res = await t.http().post('/dispositivos/prueba').expect(401);
    esperarError(res.body, 'NO_AUTENTICADO');
  });
});
