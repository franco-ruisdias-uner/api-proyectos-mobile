import { crearApp, type AppDePrueba } from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import {
  crearOperador,
  crearVecino,
  CONTRASENA_DE_PRUEBA,
} from '../utilidades/usuarios.js';
import { Usuario } from '../../src/modulos/usuarios/usuario.entidad.js';

let ctx: AppDePrueba;
beforeAll(async () => {
  ctx = await crearApp({ ahora: '2026-09-14T10:00:00-03:00' });
});
afterAll(() => ctx.cerrar());

const registro = (cuerpo: Record<string, unknown>) =>
  ctx.http().post('/auth/registro').send(cuerpo);

const unico = () => `${Math.random().toString(36).slice(2, 10)}@mail.com`;

describe('POST /auth/registro', () => {
  it('ESPECIFICACION §1 — crea siempre un vecino, sin zona y con avisos activos', async () => {
    const email = unico();
    const res = await registro({
      nombre: 'Norma Pereyra',
      email,
      contrasena: 'clave1234',
    });
    expect(res.status).toBe(201);
    esperarContrato(res, 'Sesion');
    const { token, usuario } = res.body.datos;
    expect(token).toEqual(expect.any(String));
    expect(usuario).toEqual({
      id: expect.stringMatching(/^usr-[a-z0-9]{12}$/),
      nombre: 'Norma Pereyra',
      email,
      telefono: null,
      rol: 'vecino',
      zonaId: null,
      avisosActivos: true,
      creadoEn: '2026-09-14T10:00:00-03:00',
    });
  });

  it('guarda el teléfono si viene, y el email en minúsculas', async () => {
    const email = unico();
    const res = await registro({
      nombre: '  Ramón  ',
      email: `  ${email.toUpperCase()} `,
      contrasena: 'clave1234',
      telefono: '3446 123456',
    });
    expect(res.status).toBe(201);
    expect(res.body.datos.usuario).toMatchObject({
      nombre: 'Ramón',
      email,
      telefono: '3446 123456',
    });
  });

  it('un teléfono vacío se guarda null', async () => {
    const res = await registro({
      nombre: 'Ana',
      email: unico(),
      contrasena: 'clave1234',
      telefono: '',
    });
    expect(res.status).toBe(201);
    expect(res.body.datos.usuario.telefono).toBeNull();
  });

  it('AGENTS §7.1 — no se puede pedir otro rol desde el registro', async () => {
    const res = await registro({
      nombre: 'Ana',
      email: unico(),
      contrasena: 'clave1234',
      rol: 'operador',
    });
    esperarError(res, 400, 'VALIDACION_FALLIDA');
  });

  it.each([
    ['sin nombre', { email: 'a@b.com', contrasena: 'clave1234' }, /nombre/],
    [
      'nombre vacío',
      { nombre: '   ', email: 'a@b.com', contrasena: 'clave1234' },
      /nombre/,
    ],
    ['sin email', { nombre: 'Ana', contrasena: 'clave1234' }, /email/],
    [
      'email inválido',
      { nombre: 'Ana', email: 'ana', contrasena: 'clave1234' },
      /email/,
    ],
    ['sin contraseña', { nombre: 'Ana', email: 'a@b.com' }, /contraseña/],
    [
      'contraseña corta',
      { nombre: 'Ana', email: 'a@b.com', contrasena: '1234567' },
      /8 caracteres/,
    ],
    [
      'nombre que no es texto',
      { nombre: 12, email: 'a@b.com', contrasena: 'clave1234' },
      /nombre/,
    ],
    [
      'campo de más',
      {
        nombre: 'Ana',
        email: 'a@b.com',
        contrasena: 'clave1234',
        zonaId: 'zon-norte',
      },
      /zonaId/,
    ],
  ])(
    '400 %s, con un mensaje en castellano que nombra el campo',
    async (_caso, cuerpo, mensaje) => {
      const res = await registro(cuerpo);
      esperarError(res, 400, 'VALIDACION_FALLIDA');
      expect(res.body.error.mensaje).toMatch(mensaje);
    },
  );

  it('AGENTS §7.1 — EMAIL_YA_REGISTRADO sin distinguir mayúsculas', async () => {
    const email = unico();
    await registro({ nombre: 'Ana', email, contrasena: 'clave1234' }).expect(
      201,
    );
    const res = await registro({
      nombre: 'Otra',
      email: email.toUpperCase(),
      contrasena: 'clave1234',
    });
    esperarError(res, 409, 'EMAIL_YA_REGISTRADO');
  });

  it('AGENTS §5.5 — dos registros simultáneos con el mismo email: uno pasa, el otro 409', async () => {
    const email = unico();
    const [a, b] = await Promise.all([
      registro({ nombre: 'Ana', email, contrasena: 'clave1234' }),
      registro({ nombre: 'Ana', email, contrasena: 'clave1234' }),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const perdedor = a.status === 409 ? a : b;
    esperarError(perdedor, 409, 'EMAIL_YA_REGISTRADO');
    expect(await ctx.dataSource.getRepository(Usuario).countBy({ email })).toBe(
      1,
    );
  });

  it('AGENTS §7.2 — el hash de la contraseña no sale en la respuesta', async () => {
    const res = await registro({
      nombre: 'Ana',
      email: unico(),
      contrasena: 'clave1234',
    });
    expect(JSON.stringify(res.body)).not.toMatch(/scrypt|contrasena|clave1234/);
  });
});

describe('POST /auth/ingreso', () => {
  it('devuelve token y usuario con 200', async () => {
    const { usuario } = await crearOperador(ctx, { zonaId: 'zon-norte' });
    const res = await ctx.http().post('/auth/ingreso').send({
      email: usuario.email.toUpperCase(),
      contrasena: CONTRASENA_DE_PRUEBA,
    });
    expect(res.status).toBe(200);
    esperarContrato(res, 'Sesion');
    expect(res.body.datos.usuario).toMatchObject({
      id: usuario.id,
      rol: 'operador',
      zonaId: 'zon-norte',
    });
  });

  it('el token del ingreso sirve para /yo', async () => {
    const { usuario } = await crearVecino(ctx);
    const res = await ctx
      .http()
      .post('/auth/ingreso')
      .send({ email: usuario.email, contrasena: CONTRASENA_DE_PRUEBA });
    const yo = await ctx
      .http()
      .get('/yo')
      .set('Authorization', `Bearer ${res.body.datos.token}`);
    expect(yo.status).toBe(200);
    expect(yo.body.datos.id).toBe(usuario.id);
  });

  it('AGENTS §7.1 — CREDENCIALES_INVALIDAS con el mismo mensaje exista o no el email', async () => {
    const { usuario } = await crearVecino(ctx);
    const malaClave = await ctx
      .http()
      .post('/auth/ingreso')
      .send({ email: usuario.email, contrasena: 'otra-clave' });
    const sinCuenta = await ctx
      .http()
      .post('/auth/ingreso')
      .send({ email: 'nadie@mail.com', contrasena: 'otra-clave' });
    esperarError(malaClave, 401, 'CREDENCIALES_INVALIDAS');
    esperarError(sinCuenta, 401, 'CREDENCIALES_INVALIDAS');
    expect(malaClave.body).toEqual(sinCuenta.body);
  });

  it('400 si falta la contraseña', async () => {
    esperarError(
      await ctx.http().post('/auth/ingreso').send({ email: 'a@b.com' }),
      400,
      'VALIDACION_FALLIDA',
    );
  });
});

describe('GET /yo', () => {
  it('devuelve el Usuario del PRD', async () => {
    const v = await crearVecino(ctx, {
      nombre: 'Norma Pereyra',
      telefono: '3446 111111',
    });
    const res = await ctx
      .http()
      .get('/yo')
      .set(...v.auth);
    expect(res.status).toBe(200);
    esperarContrato(res, 'Usuario');
    expect(res.body.datos).toMatchObject({
      id: v.usuario.id,
      nombre: 'Norma Pereyra',
      telefono: '3446 111111',
    });
  });

  it('AGENTS §7.3 — 401 NO_AUTENTICADO sin token', async () => {
    esperarError(await ctx.http().get('/yo'), 401, 'NO_AUTENTICADO');
  });

  it.each([
    ['token mal formado', 'Bearer no-es-un-jwt'],
    ['sin Bearer', 'abc'],
    [
      'firmado con otro secreto',
      'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c3ItMDg0Iiwicm9sIjoidmVjaW5vIiwiaWF0IjoxNzkwMDAwMDAwLCJleHAiOjE5MDAwMDAwMDB9.x2xFbCq0l2bJbqZ5Gm7aN8S2h8bI2YgQ2y2m3Q4f5Xo',
    ],
    [
      'alg none',
      'Bearer eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJ1c3ItMDg0Iiwicm9sIjoib3BlcmFkb3IifQ.',
    ],
  ])('401 con %s', async (_caso, cabecera) => {
    esperarError(
      await ctx.http().get('/yo').set('Authorization', cabecera),
      401,
      'NO_AUTENTICADO',
    );
  });

  it('401 con un token válido seguido de palabras de más', async () => {
    const v = await crearVecino(ctx);
    const { token } = v;
    esperarError(
      await ctx
        .http()
        .get('/yo')
        .set('Authorization', `Bearer ${token} ${token}`),
      401,
      'NO_AUTENTICADO',
    );
  });

  it('AGENTS §7.2 — el token vence a los 30 días', async () => {
    const otro = await crearApp({ ahora: '2026-09-14T10:00:00-03:00' });
    try {
      const v = await crearVecino(otro);
      otro.reloj.mover('2026-10-14T09:59:00-03:00');
      expect(
        (
          await otro
            .http()
            .get('/yo')
            .set(...v.auth)
        ).status,
      ).toBe(200);
      otro.reloj.mover('2026-10-14T10:00:01-03:00');
      esperarError(
        await otro
          .http()
          .get('/yo')
          .set(...v.auth),
        401,
        'NO_AUTENTICADO',
      );
    } finally {
      await otro.cerrar();
    }
  });

  it('401 si el usuario del token ya no existe (base reiniciada)', async () => {
    const v = await crearVecino(ctx);
    await ctx.dataSource.getRepository(Usuario).delete({ id: v.usuario.id });
    esperarError(
      await ctx
        .http()
        .get('/yo')
        .set(...v.auth),
      401,
      'NO_AUTENTICADO',
    );
  });
});

describe('PATCH /yo', () => {
  it('ESPECIFICACION §4 M5 — cambia nombre, teléfono y avisos', async () => {
    const v = await crearVecino(ctx, { telefono: '111' });
    const res = await ctx
      .http()
      .patch('/yo')
      .set(...v.auth)
      .send({ nombre: 'Norma P.', telefono: null, avisosActivos: false });
    expect(res.status).toBe(200);
    esperarContrato(res, 'Usuario');
    expect(res.body.datos).toMatchObject({
      nombre: 'Norma P.',
      telefono: null,
      avisosActivos: false,
    });
    const yo = await ctx
      .http()
      .get('/yo')
      .set(...v.auth);
    expect(yo.body.datos).toEqual(res.body.datos);
  });

  it('lo que no viene no se toca', async () => {
    const v = await crearVecino(ctx, { nombre: 'Ana', telefono: '222' });
    const res = await ctx
      .http()
      .patch('/yo')
      .set(...v.auth)
      .send({ avisosActivos: false });
    expect(res.body.datos).toMatchObject({
      nombre: 'Ana',
      telefono: '222',
      avisosActivos: false,
    });
  });

  it.each([
    ['rol', { rol: 'operador' }],
    ['email', { email: 'otro@mail.com' }],
    ['zonaId', { zonaId: 'zon-sur' }],
    ['avisosActivos no booleano', { avisosActivos: 'si' }],
    ['nombre vacío', { nombre: '' }],
  ])('400 con %s', async (_caso, cuerpo) => {
    const v = await crearVecino(ctx);
    esperarError(
      await ctx
        .http()
        .patch('/yo')
        .set(...v.auth)
        .send(cuerpo),
      400,
      'VALIDACION_FALLIDA',
    );
  });

  it('401 sin token', async () => {
    esperarError(
      await ctx.http().patch('/yo').send({ nombre: 'x' }),
      401,
      'NO_AUTENTICADO',
    );
  });
});
