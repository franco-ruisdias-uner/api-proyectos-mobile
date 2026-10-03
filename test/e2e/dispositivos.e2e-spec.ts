import { Dispositivo } from '../../src/comun/notificaciones/dispositivo.entidad.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { crearUsuario } from '../utilidades/usuarios.js';

const TOKEN = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]';
const OTRO_TOKEN = 'ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]';

describe('AGENTS §9 — POST /dispositivos', () => {
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
    expect(await t.dataSource.getRepository(Dispositivo).count()).toBe(1);
  });

  it('dos POST simultáneos del mismo token dejan un solo registro', async () => {
    const marta = await crearUsuario(t);
    const cuerpo = { tokenExpo: TOKEN, plataforma: 'ios' };
    const respuestas = await Promise.all([
      t.http().post('/dispositivos').set(marta.auth).send(cuerpo),
      t.http().post('/dispositivos').set(marta.auth).send(cuerpo),
    ]);
    expect(respuestas.map((r) => r.status)).toEqual([201, 201]);
    expect(await t.dataSource.getRepository(Dispositivo).count()).toBe(1);
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
    const filas = await t.dataSource.getRepository(Dispositivo).find();
    expect(filas.map((f) => f.usuarioId)).toEqual([jose.id]);
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

describe('AGENTS §9 — DELETE /dispositivos/:tokenExpo', () => {
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
    expect(await t.dataSource.getRepository(Dispositivo).count()).toBe(0);
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
    expect(await t.dataSource.getRepository(Dispositivo).count()).toBe(1);
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

describe('AGENTS §9 — POST /dispositivos/prueba', () => {
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
    expect(await t.dataSource.getRepository(Dispositivo).count()).toBe(0);
  });

  it('401 NO_AUTENTICADO sin sesión', async () => {
    const res = await t.http().post('/dispositivos/prueba').expect(401);
    esperarError(res.body, 'NO_AUTENTICADO');
  });
});

describe('AGENTS §19.2 — Avisos: a quién se avisa', () => {
  let t: AppDePrueba;
  beforeEach(async () => {
    t = await crearApp();
  });
  afterEach(() => t.cerrar());

  const registrar = (auth: { Authorization: string }, tokenExpo: string) =>
    t.http().post('/dispositivos').set(auth).send({ tokenExpo, plataforma: 'android' }).expect(201);

  const aviso = {
    titulo: 'Promo nueva',
    cuerpo: '15% en pinturas',
    datos: { promocionId: 'pro-441' },
  };

  it('avisa a los usuarios con avisos activos, una sola vez aunque se repitan', async () => {
    const marta = await crearUsuario(t);
    await registrar(marta.auth, TOKEN);
    t.avisos.avisar([marta.id, marta.id], aviso);
    await t.avisos.esperarPendientes();
    expect(t.enviador.enviados).toEqual([{ tokens: [TOKEN], ...aviso }]);
  });

  it('nadie recibe nada si tiene los avisos apagados', async () => {
    const marta = await crearUsuario(t, { avisosActivos: false });
    const jose = await crearUsuario(t);
    await registrar(marta.auth, TOKEN);
    await registrar(jose.auth, OTRO_TOKEN);
    t.avisos.avisar([marta.id, jose.id], aviso);
    await t.avisos.esperarPendientes();
    expect(t.enviador.enviados).toEqual([{ tokens: [OTRO_TOKEN], ...aviso }]);
  });

  it('sin tokens no se llama al enviador', async () => {
    const marta = await crearUsuario(t);
    t.avisos.avisar([marta.id], aviso);
    await t.avisos.esperarPendientes();
    expect(t.enviador.enviados).toEqual([]);
  });

  it('descarta los tokens que el enviador informa como inválidos', async () => {
    const marta = await crearUsuario(t);
    await registrar(marta.auth, TOKEN);
    await registrar(marta.auth, OTRO_TOKEN);
    t.enviador.invalidos.add(TOKEN);
    t.avisos.avisar([marta.id], aviso);
    await t.avisos.esperarPendientes();
    const quedan = await t.dataSource.getRepository(Dispositivo).find();
    expect(quedan.map((d) => d.tokenExpo)).toEqual([OTRO_TOKEN]);
  });

  it('si el envío falla, no tira error (se loguea)', async () => {
    const marta = await crearUsuario(t);
    await registrar(marta.auth, TOKEN);
    t.enviador.fallarCon = new Error('Expo no responde');
    expect(() => t.avisos.avisar([marta.id], aviso)).not.toThrow();
    await expect(t.avisos.esperarPendientes()).resolves.toBeUndefined();
  });
});
