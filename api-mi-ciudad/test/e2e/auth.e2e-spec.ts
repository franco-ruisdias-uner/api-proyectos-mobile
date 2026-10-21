import { JwtService } from '@nestjs/jwt';
import { crearApp, type AppDePrueba } from '../utilities/create-app.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import { conSesion, registrarTurista } from '../utilities/builders.js';
import { UsuarioEntidad } from '../../src/modules/users/user.entity.js';

describe('AGENTS §7.1 — POST /auth/registro', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp({ ahora: '2026-09-02T18:20:00-03:00' });
  });
  afterAll(() => ctx.cerrar());

  it('crea un turista y devuelve token + Usuario con las preferencias iniciales', async () => {
    const res = await ctx
      .http()
      .post('/auth/registro')
      .send({ nombre: '  Lucía Méndez ', email: 'Lucia.Registro@Mail.com', contrasena: 'una-clave-segura' })
      .expect(201);
    esperarContrato(res.body, 'Sesion');
    const { token, usuario } = res.body.datos;
    expect(token).toEqual(expect.any(String));
    expect(usuario).toEqual({
      id: expect.stringMatching(/^usr-[a-z0-9]{12}$/),
      nombre: 'Lucía Méndez',
      email: 'lucia.registro@mail.com',
      avatarUrl: null,
      creadoEn: '2026-09-02T18:20:00-03:00',
      preferencias: {
        categoriasFavoritas: [],
        avisarProximidad: true,
        radioAvisoMetros: 250,
        tema: 'sistema',
      },
    });
    const yo = await ctx.http().get('/yo').set(conSesion(token)).expect(200);
    expect(yo.body.datos.id).toBe(usuario.id);
  });

  it('especificación §1 — el registro siempre crea el rol turista', async () => {
    const { usuario } = await registrarTurista(ctx);
    const guardado = await ctx.dataSource.getRepository(UsuarioEntidad).findOneByOrFail({ id: usuario.id });
    expect(guardado.rol).toBe('turista');
  });

  it('no se puede pedir otro rol: campo de más → VALIDACION_FALLIDA', async () => {
    const res = await ctx
      .http()
      .post('/auth/registro')
      .send({ nombre: 'Pícaro', email: 'picaro@mail.com', contrasena: 'una-clave-segura', rol: 'admin' });
    esperarError(res, 400, 'VALIDACION_FALLIDA');
  });

  it('el hash de la contraseña se guarda con scrypt y nunca sale', async () => {
    const res = await ctx
      .http()
      .post('/auth/registro')
      .send({ nombre: 'Ana', email: 'ana@mail.com', contrasena: 'una-clave-segura' })
      .expect(201);
    expect(JSON.stringify(res.body)).not.toMatch(/scrypt|una-clave-segura/);
    expect(Object.keys(res.body.datos.usuario)).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/hash|contrasena|rol/i)]),
    );
    const guardado = await ctx.dataSource
      .getRepository(UsuarioEntidad)
      .findOneByOrFail({ email: 'ana@mail.com' });
    expect(guardado.hashContrasena).toMatch(/^scrypt\$/);
  });

  it.each([
    [{ email: 'a@mail.com', contrasena: 'una-clave-segura' }, 'Falta tu nombre.'],
    [{ nombre: '   ', email: 'a@mail.com', contrasena: 'una-clave-segura' }, 'Falta tu nombre.'],
    [{ nombre: 'A', contrasena: 'una-clave-segura' }, 'Falta el email.'],
    [{ nombre: 'A', email: 'no-es-email', contrasena: 'una-clave-segura' }, 'El email no es válido.'],
    [{ nombre: 'A', email: 'a@mail.com' }, 'Falta la contraseña.'],
    [
      { nombre: 'A', email: 'a@mail.com', contrasena: 'corta' },
      'La contraseña tiene que tener al menos 8 caracteres.',
    ],
    [
      { nombre: 'A'.repeat(101), email: 'a@mail.com', contrasena: 'una-clave-segura' },
      'El nombre puede tener hasta 100 letras.',
    ],
    [{ nombre: 123, email: 'a@mail.com', contrasena: 'una-clave-segura' }, 'Falta tu nombre.'],
  ])('VALIDACION_FALLIDA: %j', async (cuerpo, mensaje) => {
    const res = await ctx.http().post('/auth/registro').send(cuerpo);
    esperarError(res, 400, 'VALIDACION_FALLIDA');
    expect(res.body.error.mensaje).toBe(mensaje);
  });

  it('EMAIL_YA_REGISTRADO, sin distinguir mayúsculas', async () => {
    await registrarTurista(ctx, { email: 'repetido@mail.com' });
    const res = await ctx
      .http()
      .post('/auth/registro')
      .send({ nombre: 'Otro', email: 'REPETIDO@mail.com', contrasena: 'una-clave-segura' });
    esperarError(res, 409, 'EMAIL_YA_REGISTRADO');
  });

  it('concurrencia: dos registros simultáneos con el mismo email → uno pasa y el otro 409', async () => {
    const cuerpo = { nombre: 'Doble', email: 'doble@mail.com', contrasena: 'una-clave-segura' };
    const respuestas = await Promise.all([
      ctx.http().post('/auth/registro').send(cuerpo),
      ctx.http().post('/auth/registro').send(cuerpo),
    ]);
    expect(respuestas.map((r) => r.status).sort()).toEqual([201, 409]);
    esperarError(
      respuestas.find((r) => r.status === 409)!,
      409,
      'EMAIL_YA_REGISTRADO',
    );
    expect(await ctx.dataSource.getRepository(UsuarioEntidad).countBy({ email: 'doble@mail.com' })).toBe(1);
  });
});

describe('AGENTS §7.1 — POST /auth/ingreso', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
    await registrarTurista(ctx, { email: 'ingreso@mail.com', contrasena: 'clave-correcta' });
  });
  afterAll(() => ctx.cerrar());

  it('con email y contraseña correctos devuelve la sesión (200)', async () => {
    const res = await ctx
      .http()
      .post('/auth/ingreso')
      .send({ email: ' INGRESO@mail.com ', contrasena: 'clave-correcta' })
      .expect(200);
    esperarContrato(res.body, 'Sesion');
    expect(res.body.datos.usuario.email).toBe('ingreso@mail.com');
    await ctx.http().get('/yo').set(conSesion(res.body.datos.token)).expect(200);
  });

  it('CREDENCIALES_INVALIDAS con el mismo mensaje exista o no el email', async () => {
    const mala = await ctx
      .http()
      .post('/auth/ingreso')
      .send({ email: 'ingreso@mail.com', contrasena: 'otra-clave' });
    const inexistente = await ctx
      .http()
      .post('/auth/ingreso')
      .send({ email: 'nadie@mail.com', contrasena: 'otra-clave' });
    esperarError(mala, 401, 'CREDENCIALES_INVALIDAS');
    esperarError(inexistente, 401, 'CREDENCIALES_INVALIDAS');
    expect(mala.body).toEqual(inexistente.body);
  });

  it('VALIDACION_FALLIDA sin contraseña', async () => {
    const res = await ctx.http().post('/auth/ingreso').send({ email: 'ingreso@mail.com' });
    esperarError(res, 400, 'VALIDACION_FALLIDA');
    expect(res.body.error.mensaje).toBe('Falta la contraseña.');
  });
});

describe('AGENTS §7.2 y §7.3 — Tokens y guard global', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
  });
  afterAll(() => ctx.cerrar());

  it('el token es HS256, con sub y rol, y vence a los 30 días', async () => {
    const { token, usuario } = await registrarTurista(ctx);
    const [cabecera, carga] = token
      .split('.')
      .slice(0, 2)
      .map((p) => JSON.parse(Buffer.from(p, 'base64url').toString()));
    expect(cabecera.alg).toBe('HS256');
    expect(carga.sub).toBe(usuario.id);
    expect(carga.rol).toBe('turista');
    expect(carga.exp - carga.iat).toBe(30 * 24 * 60 * 60);
  });

  it.each([
    ['sin cabecera', undefined],
    ['sin Bearer', 'Token abc'],
    ['Bearer vacío', 'Bearer '],
    ['token basura', 'Bearer no.es.token'],
  ])('NO_AUTENTICADO: %s', async (_caso, cabecera) => {
    const pedido = ctx.http().get('/yo');
    if (cabecera !== undefined) pedido.set('Authorization', cabecera);
    esperarError(await pedido, 401, 'NO_AUTENTICADO');
  });

  it('NO_AUTENTICADO con un token vencido', async () => {
    const { usuario } = await registrarTurista(ctx);
    const vencido = await ctx.app
      .get(JwtService)
      .signAsync({ sub: usuario.id, rol: 'turista' }, { expiresIn: -10 });
    esperarError(await ctx.http().get('/yo').set(conSesion(vencido)), 401, 'NO_AUTENTICADO');
  });

  it('NO_AUTENTICADO con un token firmado con otro secreto', async () => {
    const { usuario } = await registrarTurista(ctx);
    const falso = await new JwtService({ secret: 'otro-secreto' }).signAsync({
      sub: usuario.id,
      rol: 'admin',
    });
    esperarError(await ctx.http().get('/yo').set(conSesion(falso)), 401, 'NO_AUTENTICADO');
  });

  it('NO_AUTENTICADO con el token de una cuenta que ya no existe', async () => {
    const huerfano = await ctx.app.get(JwtService).signAsync({ sub: 'usr-inexistente', rol: 'turista' });
    esperarError(await ctx.http().get('/yo').set(conSesion(huerfano)), 401, 'NO_AUTENTICADO');
  });
});
