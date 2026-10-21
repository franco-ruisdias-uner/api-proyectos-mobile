import { JwtService } from '@nestjs/jwt';
import { Usuario } from '../../src/modules/users/user.entity.js';
import { type AppDePrueba, crearApp } from '../utilities/create-app.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import { CONTRASENA_DE_PRUEBA, crearUsuario } from '../utilities/users.js';

const registro = (extra: Record<string, unknown> = {}) => ({
  nombre: 'Marta Giménez',
  email: 'marta@mail.com',
  contrasena: 'demo1234',
  ...extra,
});

describe('AGENTS §7.1 / ESPECIFICACION §1 — POST /auth/registro', () => {
  let t: AppDePrueba;
  beforeEach(async () => {
    t = await crearApp();
  });
  afterEach(() => t.cerrar());

  it('201: crea un vecino y devuelve token + Usuario', async () => {
    const res = await t.http().post('/auth/registro').send(registro()).expect(201);
    esperarContrato(res.body, 'Sesion');
    expect(res.body.datos.usuario).toEqual({
      id: expect.stringMatching(/^usr-[a-z0-9]{12}$/),
      nombre: 'Marta Giménez',
      email: 'marta@mail.com',
      rol: 'vecino',
      comercioId: null,
      favoritos: [],
      rubrosDeInteres: [],
      avisosActivos: true,
    });
    expect(res.body.datos.token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
  });

  it('el token sirve para GET /yo', async () => {
    const { body } = await t.http().post('/auth/registro').send(registro()).expect(201);
    const yo = await t
      .http()
      .get('/yo')
      .set('Authorization', `Bearer ${body.datos.token}`)
      .expect(200);
    esperarContrato(yo.body, 'Usuario');
    expect(yo.body.datos.id).toBe(body.datos.usuario.id);
  });

  it('el email se guarda en minúsculas y sin espacios', async () => {
    const res = await t
      .http()
      .post('/auth/registro')
      .send(registro({ email: '  Marta@Mail.COM ' }))
      .expect(201);
    expect(res.body.datos.usuario.email).toBe('marta@mail.com');
  });

  it('el hash de la contraseña no sale en la respuesta', async () => {
    const res = await t.http().post('/auth/registro').send(registro()).expect(201);
    expect(JSON.stringify(res.body)).not.toMatch(/scrypt|hash|contrasena|demo1234/i);
  });

  it('ESPECIFICACION §1 — No se puede elegir el rol ni el comercio desde el registro (400)', async () => {
    for (const extra of [
      { rol: 'comercio' },
      { comercioId: 'com-118' },
      { avisosActivos: false },
    ]) {
      const res = await t.http().post('/auth/registro').send(registro(extra)).expect(400);
      esperarError(res.body, 'VALIDACION_FALLIDA');
      expect(res.body.error.mensaje).toContain(Object.keys(extra)[0]);
    }
    expect(await t.dataSource.getRepository(Usuario).count()).toBe(0);
  });

  it('409 EMAIL_YA_REGISTRADO, sin distinguir mayúsculas', async () => {
    await t.http().post('/auth/registro').send(registro()).expect(201);
    const res = await t
      .http()
      .post('/auth/registro')
      .send(registro({ email: 'MARTA@mail.com', nombre: 'Otra' }))
      .expect(409);
    esperarError(res.body, 'EMAIL_YA_REGISTRADO');
  });

  it('AGENTS §5.5 — Dos registros simultáneos con el mismo email: uno pasa y el otro 409', async () => {
    const [a, b] = await Promise.all([
      t.http().post('/auth/registro').send(registro()),
      t
        .http()
        .post('/auth/registro')
        .send(registro({ email: 'Marta@Mail.com' })),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    esperarError((a.status === 409 ? a : b).body, 'EMAIL_YA_REGISTRADO');
    expect(await t.dataSource.getRepository(Usuario).count()).toBe(1);
  });

  it.each([
    [{ nombre: undefined }, 'Falta tu nombre.'],
    [{ nombre: '   ' }, 'El nombre tiene que tener entre 1 y 80 letras.'],
    [{ nombre: 'x'.repeat(81) }, 'El nombre tiene que tener entre 1 y 80 letras.'],
    [{ nombre: 42 }, 'Falta tu nombre.'],
    [{ email: undefined }, 'Falta el email.'],
    [{ email: 'marta' }, 'El email no es válido.'],
    [{ email: 'marta@' }, 'El email no es válido.'],
    [{ contrasena: undefined }, 'Falta la contraseña.'],
    [{ contrasena: '1234567' }, 'La contraseña tiene que tener al menos 8 caracteres.'],
    [{ contrasena: 12345678 }, 'Falta la contraseña.'],
    [{ contrasena: 'x'.repeat(101) }, 'La contraseña puede tener como máximo 100 caracteres.'],
  ])('400 VALIDACION_FALLIDA con %j', async (cambio, mensaje) => {
    const res = await t.http().post('/auth/registro').send(registro(cambio)).expect(400);
    esperarError(res.body, 'VALIDACION_FALLIDA');
    expect(res.body.error.mensaje).toBe(mensaje);
  });

  it('400 con un cuerpo vacío', async () => {
    const res = await t.http().post('/auth/registro').expect(400);
    esperarError(res.body, 'VALIDACION_FALLIDA');
  });
});

describe('AGENTS §7.1 — POST /auth/ingreso', () => {
  let t: AppDePrueba;
  beforeAll(async () => {
    t = await crearApp();
    await crearUsuario(t, { id: 'usr-512', email: 'marta@mail.com', nombre: 'Marta Giménez' });
    await crearUsuario(t, {
      id: 'usr-tornillo',
      email: 'tornillo@demo.ar',
      rol: 'comercio',
      comercioId: 'com-118',
    });
  });
  afterAll(() => t.cerrar());

  it('200 con email y contraseña, sin distinguir mayúsculas en el email', async () => {
    const res = await t
      .http()
      .post('/auth/ingreso')
      .send({ email: ' MARTA@mail.com', contrasena: CONTRASENA_DE_PRUEBA })
      .expect(200);
    esperarContrato(res.body, 'Sesion');
    expect(res.body.datos.usuario.id).toBe('usr-512');
  });

  it('una cuenta de comercio ingresa con su rol y su comercioId', async () => {
    const res = await t
      .http()
      .post('/auth/ingreso')
      .send({ email: 'tornillo@demo.ar', contrasena: CONTRASENA_DE_PRUEBA })
      .expect(200);
    esperarContrato(res.body, 'Sesion');
    expect(res.body.datos.usuario).toMatchObject({ rol: 'comercio', comercioId: 'com-118' });
  });

  it('401 CREDENCIALES_INVALIDAS con el mismo mensaje exista o no el email', async () => {
    const malaClave = await t
      .http()
      .post('/auth/ingreso')
      .send({ email: 'marta@mail.com', contrasena: 'otra-clave' })
      .expect(401);
    const noExiste = await t
      .http()
      .post('/auth/ingreso')
      .send({ email: 'nadie@mail.com', contrasena: 'otra-clave' })
      .expect(401);
    esperarError(malaClave.body, 'CREDENCIALES_INVALIDAS');
    esperarError(noExiste.body, 'CREDENCIALES_INVALIDAS');
    expect(malaClave.body).toEqual(noExiste.body);
  });

  it.each([
    [{ contrasena: 'x' }, 'Falta el email.'],
    [{ email: 'marta@mail.com' }, 'Falta la contraseña.'],
    [{ email: 'marta@mail.com', contrasena: '' }, 'Falta la contraseña.'],
    [
      { email: 'marta@mail.com', contrasena: 'x', recordarme: true },
      'No se esperaba el dato «recordarme».',
    ],
  ])('400 VALIDACION_FALLIDA con %j', async (cuerpo, mensaje) => {
    const res = await t.http().post('/auth/ingreso').send(cuerpo).expect(400);
    esperarError(res.body, 'VALIDACION_FALLIDA');
    expect(res.body.error.mensaje).toBe(mensaje);
  });
});

describe('AGENTS §7.1 — GET /yo y PATCH /yo', () => {
  let t: AppDePrueba;
  beforeEach(async () => {
    t = await crearApp();
  });
  afterEach(() => t.cerrar());

  it('GET /yo devuelve el Usuario de la sesión', async () => {
    const marta = await crearUsuario(t, {
      id: 'usr-512',
      nombre: 'Marta Giménez',
      email: 'marta@mail.com',
    });
    const res = await t.http().get('/yo').set(marta.auth).expect(200);
    esperarContrato(res.body, 'Usuario');
    expect(res.body.datos).toMatchObject({ id: 'usr-512', nombre: 'Marta Giménez', rol: 'vecino' });
  });

  it('401 NO_AUTENTICADO sin token', async () => {
    const res = await t.http().get('/yo').expect(401);
    esperarError(res.body, 'NO_AUTENTICADO');
  });

  it.each([
    ['Bearer basura'],
    ['Bearer '],
    ['Basic dXN1YXJpbzpjbGF2ZQ=='],
    ['eyJhbGciOiJIUzI1NiJ9.e30.x'],
  ])('401 NO_AUTENTICADO con Authorization: %s', async (cabecera) => {
    const res = await t.http().get('/yo').set('Authorization', cabecera).expect(401);
    esperarError(res.body, 'NO_AUTENTICADO');
  });

  it('401 con un token firmado con otro secreto', async () => {
    const otra = await crearApp({ variables: { JWT_SECRETO: 'otro-secreto' } });
    const intruso = await crearUsuario(otra, { id: 'usr-intruso' });
    await otra.cerrar();
    await crearUsuario(t, { id: 'usr-intruso' });
    const res = await t.http().get('/yo').set(intruso.auth).expect(401);
    esperarError(res.body, 'NO_AUTENTICADO');
  });

  it('AGENTS §7.2 — El token vence a los 30 días', async () => {
    const marta = await crearUsuario(t);
    t.reloj.avanzar(29 * 24 * 3600 * 1000);
    await t.http().get('/yo').set(marta.auth).expect(200);
    t.reloj.avanzar(2 * 24 * 3600 * 1000);
    const res = await t.http().get('/yo').set(marta.auth).expect(401);
    esperarError(res.body, 'NO_AUTENTICADO');
  });

  it('AGENTS §7.2 — 401 con un token sin vencimiento (no hay tokens eternos)', async () => {
    const marta = await crearUsuario(t);
    const sinExp = t.app.get(JwtService).sign({ sub: marta.id, rol: 'vecino' });
    const res = await t.http().get('/yo').set('Authorization', `Bearer ${sinExp}`).expect(401);
    esperarError(res.body, 'NO_AUTENTICADO');
  });

  it('401 si la cuenta del token ya no existe', async () => {
    const marta = await crearUsuario(t);
    await t.dataSource.getRepository(Usuario).delete({ id: marta.id });
    const res = await t.http().get('/yo').set(marta.auth).expect(401);
    esperarError(res.body, 'NO_AUTENTICADO');
  });

  it('PATCH /yo cambia el nombre y no toca lo demás', async () => {
    const marta = await crearUsuario(t, { nombre: 'Marta' });
    const res = await t
      .http()
      .patch('/yo')
      .set(marta.auth)
      .send({ nombre: '  Marta Giménez ' })
      .expect(200);
    esperarContrato(res.body, 'Usuario');
    expect(res.body.datos).toMatchObject({
      nombre: 'Marta Giménez',
      rol: 'vecino',
      avisosActivos: true,
    });
    const yo = await t.http().get('/yo').set(marta.auth).expect(200);
    expect(yo.body.datos.nombre).toBe('Marta Giménez');
  });

  it('PATCH /yo con cuerpo vacío no cambia nada', async () => {
    const marta = await crearUsuario(t, { nombre: 'Marta' });
    const res = await t.http().patch('/yo').set(marta.auth).send({}).expect(200);
    expect(res.body.datos.nombre).toBe('Marta');
  });

  it.each([
    [{ nombre: '' }, 'El nombre tiene que tener entre 1 y 80 letras.'],
    [{ nombre: 7 }, 'El nombre tiene que ser un texto.'],
    [{ nombre: null }, 'El nombre tiene que ser un texto.'],
    [{ rol: 'comercio' }, 'No se esperaba el dato «rol».'],
    [{ email: 'otro@mail.com' }, 'No se esperaba el dato «email».'],
    [{ comercioId: 'com-118' }, 'No se esperaba el dato «comercioId».'],
  ])('PATCH /yo 400 VALIDACION_FALLIDA con %j', async (cuerpo, mensaje) => {
    const marta = await crearUsuario(t);
    const res = await t.http().patch('/yo').set(marta.auth).send(cuerpo).expect(400);
    esperarError(res.body, 'VALIDACION_FALLIDA');
    expect(res.body.error.mensaje).toBe(mensaje);
  });

  it('PATCH /yo 401 sin token', async () => {
    const res = await t.http().patch('/yo').send({ nombre: 'X' }).expect(401);
    esperarError(res.body, 'NO_AUTENTICADO');
  });
});
