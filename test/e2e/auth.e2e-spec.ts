// AGENTS §7 y ESPECIFICACION §1: registro (con teléfono obligatorio), ingreso, /yo.
import type { Sesion } from '../../contract/api.js';
import type { Usuario } from '../../contract/types.js';
import { type AppDePrueba, crearApp } from '../utilities/create-app.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import { crearUsuario, registrarJugador } from '../utilities/users.js';

const valido = () => ({
  nombre: 'Emiliano Ruiz',
  email: `emi-${Math.random().toString(36).slice(2)}@mail.com`,
  contrasena: 'clave-segura-123',
  telefono: '3455-401122',
});

describe('POST /auth/registro — ESPECIFICACION §1', () => {
  let a: AppDePrueba;
  beforeAll(async () => {
    a = await crearApp();
  });
  afterAll(() => a.cerrar());

  it('201 con token y un jugador nuevo, con los valores iniciales del PRD', async () => {
    const cuerpo = valido();
    const res = await a.http().post('/auth/registro').send(cuerpo).expect(201);
    const sesion = esperarContrato<Sesion>(res.body, 'Sesion');
    expect(sesion.token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(sesion.usuario).toEqual({
      id: expect.stringMatching(/^usr-[a-z0-9]{12}$/),
      nombre: 'Emiliano Ruiz',
      email: cuerpo.email,
      telefono: '3455-401122',
      rol: 'jugador',
      espaciosFavoritos: [],
      cancelacionesTardias: 0,
      ausencias: 0,
    });
  });

  it('el email se guarda en minúsculas y sin espacios', async () => {
    const res = await a
      .http()
      .post('/auth/registro')
      .send({ ...valido(), email: '  Lucia.B@Mail.COM ' })
      .expect(201);
    expect(esperarContrato<Sesion>(res.body, 'Sesion').usuario.email).toBe(
      'lucia.b@mail.com',
    );
  });

  it('la respuesta no trae la contraseña ni su hash', async () => {
    const res = await a
      .http()
      .post('/auth/registro')
      .send(valido())
      .expect(201);
    expect(JSON.stringify(res.body)).not.toMatch(
      /clave-segura-123|scrypt|contrasena/i,
    );
  });

  it('EMAIL_YA_REGISTRADO (409), sin distinguir mayúsculas', async () => {
    const cuerpo = valido();
    await a.http().post('/auth/registro').send(cuerpo).expect(201);
    esperarError(
      await a
        .http()
        .post('/auth/registro')
        .send({ ...cuerpo, email: cuerpo.email.toUpperCase() }),
      409,
      'EMAIL_YA_REGISTRADO',
    );
  });

  it('dos registros simultáneos con el mismo email: uno 201 y otro 409', async () => {
    const cuerpo = valido();
    const respuestas = await Promise.all([
      a.http().post('/auth/registro').send(cuerpo),
      a.http().post('/auth/registro').send(cuerpo),
    ]);
    expect(respuestas.map((r) => r.status).sort()).toEqual([201, 409]);
    esperarError(
      respuestas.find((r) => r.status === 409)!,
      409,
      'EMAIL_YA_REGISTRADO',
    );
  });

  it.each([
    [
      'sin teléfono (es obligatorio en este proyecto)',
      { telefono: undefined },
      'Falta el teléfono.',
    ],
    ['teléfono vacío', { telefono: '' }, 'El teléfono no es válido'],
    [
      'teléfono con letras',
      { telefono: 'llamame' },
      'El teléfono no es válido',
    ],
    ['sin nombre', { nombre: undefined }, 'Falta tu nombre.'],
    ['nombre vacío', { nombre: '   ' }, 'El nombre tiene que tener'],
    ['email inválido', { email: 'no-es-un-email' }, 'El email no es válido.'],
    ['contraseña corta', { contrasena: '1234567' }, 'al menos 8 caracteres'],
    [
      'contraseña que no es texto',
      { contrasena: 12345678 },
      'Falta la contraseña.',
    ],
    ['un campo de más (rol)', { rol: 'administrador' }, 'Sobra el dato «rol»'],
  ])('VALIDACION_FALLIDA (400): %s', async (_caso, cambios, mensaje) => {
    const res = await a
      .http()
      .post('/auth/registro')
      .send({ ...valido(), ...cambios });
    esperarError(res, 400, 'VALIDACION_FALLIDA');
    expect(res.body.error.mensaje).toContain(mensaje);
  });
});

describe('POST /auth/ingreso — AGENTS §7.1', () => {
  let a: AppDePrueba;
  beforeAll(async () => {
    a = await crearApp();
  });
  afterAll(() => a.cerrar());

  it('200 con token y usuario; el email no distingue mayúsculas', async () => {
    const j = await registrarJugador(a, { email: 'ingreso@prueba.ar' });
    const res = await a
      .http()
      .post('/auth/ingreso')
      .send({ email: 'INGRESO@prueba.ar ', contrasena: j.contrasena })
      .expect(200);
    const sesion = esperarContrato<Sesion>(res.body, 'Sesion');
    expect(sesion.usuario).toEqual(j.usuario);
  });

  it('CREDENCIALES_INVALIDAS (401) con el mismo mensaje exista o no el email', async () => {
    const j = await registrarJugador(a);
    const malaClave = await a
      .http()
      .post('/auth/ingreso')
      .send({ email: j.usuario.email, contrasena: 'otra-clave-123' });
    const noExiste = await a
      .http()
      .post('/auth/ingreso')
      .send({ email: 'nadie@prueba.ar', contrasena: 'otra-clave-123' });
    esperarError(malaClave, 401, 'CREDENCIALES_INVALIDAS');
    esperarError(noExiste, 401, 'CREDENCIALES_INVALIDAS');
    expect(malaClave.body).toEqual(noExiste.body);
  });

  it('encargado y administrador ingresan con su rol', async () => {
    const e = await crearUsuario(a, 'encargado');
    const ad = await crearUsuario(a, 'administrador');
    expect(e.usuario.rol).toBe('encargado');
    expect(ad.usuario.rol).toBe('administrador');
  });

  it('VALIDACION_FALLIDA (400) sin contraseña', async () => {
    esperarError(
      await a.http().post('/auth/ingreso').send({ email: 'x@prueba.ar' }),
      400,
      'VALIDACION_FALLIDA',
    );
  });
});

describe('GET /yo — AGENTS §7.1', () => {
  let a: AppDePrueba;
  beforeAll(async () => {
    a = await crearApp();
  });
  afterAll(() => a.cerrar());

  it('devuelve el Usuario del PRD de quien tiene la sesión', async () => {
    const j = await registrarJugador(a);
    const res = await a
      .http()
      .get('/yo')
      .set('Authorization', `Bearer ${j.token}`)
      .expect(200);
    expect(esperarContrato<Usuario>(res.body, 'Usuario')).toEqual(j.usuario);
  });

  it('NO_AUTENTICADO (401) sin token', async () => {
    esperarError(await a.http().get('/yo'), 401, 'NO_AUTENTICADO');
  });

  it('AGENTS §7.2 — el token vence a los 30 días', async () => {
    const j = await registrarJugador(a);
    a.reloj.avanzarMinutos(30 * 24 * 60 - 1);
    await a
      .http()
      .get('/yo')
      .set('Authorization', `Bearer ${j.token}`)
      .expect(200);
    a.reloj.avanzarMinutos(2);
    esperarError(
      await a.http().get('/yo').set('Authorization', `Bearer ${j.token}`),
      401,
      'NO_AUTENTICADO',
    );
    a.reloj.avanzarMinutos(-(30 * 24 * 60 + 1));
  });

  it('un token firmado con otro secreto no sirve', async () => {
    const otra = await crearApp({
      entorno: { JWT_SECRETO: 'otro-secreto-distinto-del-de-prueba' },
    });
    try {
      const j = await registrarJugador(otra);
      esperarError(
        await a.http().get('/yo').set('Authorization', `Bearer ${j.token}`),
        401,
        'NO_AUTENTICADO',
      );
    } finally {
      await otra.cerrar();
    }
  });
});
