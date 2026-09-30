import { JwtService } from '@nestjs/jwt';
import { UsuarioEntidad } from '../../src/modulos/usuarios/usuario.entidad.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { crearUsuario, registrar } from '../utilidades/usuarios.js';

let ctx: AppDePrueba;
beforeAll(async () => {
  ctx = await crearApp();
});
afterAll(() => ctx.cerrar());

const DIA = 24 * 60 * 60 * 1000;

describe('AGENTS §7.1 — POST /auth/registro', () => {
  it('crea un pasajero y devuelve { token, usuario } con los valores iniciales (espec. §1)', async () => {
    const r = await ctx.http
      .post('/auth/registro')
      .send({ nombre: 'Julieta Paz', email: 'julieta@prueba.ar', contrasena: 'clave-segura' })
      .expect(201);
    esperarContrato(r.body, 'Sesion');
    expect(r.body.datos.usuario).toEqual({
      id: expect.stringMatching(/^usr-[a-z0-9]{12}$/),
      nombre: 'Julieta Paz',
      email: 'julieta@prueba.ar',
      lineasFavoritas: [],
      paradasFavoritas: [],
      avisosActivos: true,
      tema: 'sistema',
    });
    expect(r.body.datos.token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
    const guardado = await ctx.dataSource
      .getRepository(UsuarioEntidad)
      .findOneByOrFail({ id: r.body.datos.usuario.id });
    expect(guardado.rol).toBe('pasajero');
  });

  it('el token sirve para GET /yo', async () => {
    const sesion = await registrar(ctx);
    const r = await ctx.http.get('/yo').set('Authorization', `Bearer ${sesion.token}`).expect(200);
    expect(r.body.datos).toEqual(sesion.usuario);
  });

  it('D1 — nunca expone el hash ni el rol', async () => {
    const r = await ctx.http
      .post('/auth/registro')
      .send({ nombre: 'Sin Secretos', email: 'secretos@prueba.ar', contrasena: 'clave-segura' });
    expect(Object.keys(r.body.datos).sort()).toEqual(['token', 'usuario']);
    expect(Object.keys(r.body.datos.usuario)).not.toContain('rol');
    const usuario = JSON.stringify(r.body.datos.usuario);
    expect(usuario).not.toMatch(/scrypt|contrasena|clave-segura|pasajero/);
  });

  it('guarda el email en minúsculas y sin espacios', async () => {
    const r = await ctx.http
      .post('/auth/registro')
      .send({ nombre: 'Mayúsculas', email: '  Mayus@Prueba.AR ', contrasena: 'clave-segura' })
      .expect(201);
    expect(r.body.datos.usuario.email).toBe('mayus@prueba.ar');
  });

  it('no permite elegir el rol: un campo "rol" es un dato de más', async () => {
    const r = await ctx.http.post('/auth/registro').send({
      nombre: 'Colado',
      email: 'colado@prueba.ar',
      contrasena: 'clave-segura',
      rol: 'direccion',
    });
    esperarError(r, 400, 'VALIDACION_FALLIDA');
  });

  it('EMAIL_YA_REGISTRADO (409), sin distinguir mayúsculas', async () => {
    await registrar(ctx, { email: 'repetido@prueba.ar' });
    const r = await ctx.http
      .post('/auth/registro')
      .send({ nombre: 'Otro', email: 'REPETIDO@prueba.ar', contrasena: 'clave-segura' });
    esperarError(r, 409, 'EMAIL_YA_REGISTRADO');
    expect(r.body.error.mensaje).toBe('Ya hay una cuenta con ese email.');
  });

  it('dos registros simultáneos con el mismo email: uno pasa y el otro da EMAIL_YA_REGISTRADO', async () => {
    const cuerpo = {
      nombre: 'Simultáneo',
      email: 'simultaneo@prueba.ar',
      contrasena: 'clave-segura',
    };
    const respuestas = await Promise.all([
      ctx.http.post('/auth/registro').send(cuerpo),
      ctx.http.post('/auth/registro').send(cuerpo),
    ]);
    const estados = respuestas.map((r) => r.status).sort();
    expect(estados).toEqual([201, 409]);
    esperarError(
      respuestas.find((r) => r.status === 409)!,
      409,
      'EMAIL_YA_REGISTRADO',
    );
    expect(
      await ctx.dataSource.getRepository(UsuarioEntidad).countBy({ email: 'simultaneo@prueba.ar' }),
    ).toBe(1);
  });

  it.each([
    [{ email: 'a@prueba.ar', contrasena: 'clave-segura' }, 'Falta tu nombre.'],
    [{ nombre: '   ', email: 'a@prueba.ar', contrasena: 'clave-segura' }, 'Falta tu nombre.'],
    [
      { nombre: 'x'.repeat(101), email: 'a@prueba.ar', contrasena: 'clave-segura' },
      'El nombre puede tener hasta 100 letras.',
    ],
    [{ nombre: 'Ana', contrasena: 'clave-segura' }, 'Falta el email.'],
    [
      { nombre: 'Ana', email: 'no-es-un-email', contrasena: 'clave-segura' },
      'El email no es válido.',
    ],
    [{ nombre: 'Ana', email: 'a@prueba.ar' }, 'Falta la contraseña.'],
    [
      { nombre: 'Ana', email: 'a@prueba.ar', contrasena: 'corta' },
      'La contraseña tiene que tener al menos 8 caracteres.',
    ],
    [
      { nombre: 'Ana', email: 'a@prueba.ar', contrasena: 12345678 },
      'La contraseña tiene que ser un texto.',
    ],
    [
      { nombre: 42, email: 'a@prueba.ar', contrasena: 'clave-segura' },
      'El nombre tiene que ser un texto.',
    ],
  ])('400 VALIDACION_FALLIDA: %j → %s', async (cuerpo, mensaje) => {
    const r = await ctx.http.post('/auth/registro').send(cuerpo);
    esperarError(r, 400, 'VALIDACION_FALLIDA');
    expect(r.body.error.mensaje).toBe(mensaje);
  });
});

describe('AGENTS §7.1 — POST /auth/ingreso', () => {
  it('con email y contraseña correctos devuelve la sesión', async () => {
    const creado = await registrar(ctx, { email: 'ingreso@prueba.ar', contrasena: 'mi-clave-123' });
    const r = await ctx.http
      .post('/auth/ingreso')
      .send({ email: 'ingreso@prueba.ar', contrasena: 'mi-clave-123' })
      .expect(200);
    esperarContrato(r.body, 'Sesion');
    expect(r.body.datos.usuario).toEqual(creado.usuario);
  });

  it('el email no distingue mayúsculas ni espacios', async () => {
    await registrar(ctx, { email: 'mayus-ingreso@prueba.ar', contrasena: 'mi-clave-123' });
    await ctx.http
      .post('/auth/ingreso')
      .send({ email: ' Mayus-Ingreso@Prueba.ar ', contrasena: 'mi-clave-123' })
      .expect(200);
  });

  it('CREDENCIALES_INVALIDAS (401) con el mismo mensaje exista o no el email', async () => {
    await registrar(ctx, { email: 'existe@prueba.ar', contrasena: 'mi-clave-123' });
    const malaClave = await ctx.http
      .post('/auth/ingreso')
      .send({ email: 'existe@prueba.ar', contrasena: 'otra-clave-99' });
    const noExiste = await ctx.http
      .post('/auth/ingreso')
      .send({ email: 'no-existe@prueba.ar', contrasena: 'mi-clave-123' });
    esperarError(malaClave, 401, 'CREDENCIALES_INVALIDAS');
    esperarError(noExiste, 401, 'CREDENCIALES_INVALIDAS');
    expect(malaClave.body).toEqual(noExiste.body);
  });

  it.each([
    [{ contrasena: 'x' }, 'Falta el email.'],
    [{ email: 'a@prueba.ar' }, 'Falta la contraseña.'],
    [
      { email: 'a@prueba.ar', contrasena: 'x', recordarme: true },
      'No se esperaba el dato «recordarme».',
    ],
  ])('400 VALIDACION_FALLIDA: %j', async (cuerpo, mensaje) => {
    const r = await ctx.http.post('/auth/ingreso').send(cuerpo);
    esperarError(r, 400, 'VALIDACION_FALLIDA');
    expect(r.body.error.mensaje).toBe(mensaje);
  });
});

describe('AGENTS §7.1 — GET /yo', () => {
  it('devuelve el Usuario del PRD', async () => {
    const u = await crearUsuario(ctx, {
      nombre: 'Julián Ferrari',
      tema: 'oscuro',
      avisosActivos: false,
    });
    const r = await ctx.http.get('/yo').set(u.auth).expect(200);
    esperarContrato(r.body, 'Usuario');
    expect(r.body.datos).toEqual({
      id: u.id,
      nombre: 'Julián Ferrari',
      email: u.email,
      lineasFavoritas: [],
      paradasFavoritas: [],
      avisosActivos: false,
      tema: 'oscuro',
    });
  });

  it('401 NO_AUTENTICADO sin token', async () => {
    esperarError(await ctx.http.get('/yo'), 401, 'NO_AUTENTICADO');
  });

  it.each([
    ['token basura', 'Bearer esto-no-es-un-jwt'],
    ['sin "Bearer"', 'Token abc'],
    ['Bearer vacío', 'Bearer '],
  ])('401 NO_AUTENTICADO con %s', async (_caso, cabecera) => {
    esperarError(await ctx.http.get('/yo').set('Authorization', cabecera), 401, 'NO_AUTENTICADO');
  });

  it('el esquema "bearer" no distingue mayúsculas', async () => {
    const u = await crearUsuario(ctx);
    await ctx.http.get('/yo').set('Authorization', `bearer ${u.token}`).expect(200);
  });

  it('401 con un token firmado con otro secreto', async () => {
    const u = await crearUsuario(ctx);
    const falso = await new JwtService({ secret: 'otro-secreto' }).signAsync(
      { rol: 'direccion' },
      { subject: u.id },
    );
    esperarError(
      await ctx.http.get('/yo').set('Authorization', `Bearer ${falso}`),
      401,
      'NO_AUTENTICADO',
    );
  });

  it('401 con un token de una cuenta que ya no existe', async () => {
    const u = await crearUsuario(ctx);
    await ctx.dataSource.getRepository(UsuarioEntidad).delete({ id: u.id });
    esperarError(await ctx.http.get('/yo').set(u.auth), 401, 'NO_AUTENTICADO');
  });

  it('C4 — la sesión dura 30 días según el reloj de la API', async () => {
    const reloj = ctx.reloj.ahora();
    const u = await crearUsuario(ctx);
    try {
      ctx.reloj.avanzar(29 * DIA);
      await ctx.http.get('/yo').set(u.auth).expect(200);
      ctx.reloj.avanzar(1 * DIA);
      esperarError(await ctx.http.get('/yo').set(u.auth), 401, 'NO_AUTENTICADO');
    } finally {
      ctx.reloj.fijar(reloj);
    }
  });
});
