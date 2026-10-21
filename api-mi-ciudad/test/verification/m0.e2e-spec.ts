// Verificación independiente de M0 — Base (verificador-contrato, AGENTS §12).
// Caja negra: sólo HTTP contra la app completa. No lee src/.
import { JwtService } from '@nestjs/jwt';
import { crearApp, type AppDePrueba } from '../utilities/create-app.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import { conSesion, crearAdmin, MUESTRAS, registrarTurista, subirArchivo } from '../utilities/builders.js';

let n = 0;
const emailUnico = (base = 'verif') => `${base}${++n}-${Math.random().toString(36).slice(2, 8)}@prueba.ar`;
const CAMEL = /\b[a-z]+[A-Z][a-zA-Z]*\b/;

/** Un error 400 con mensaje en castellano que no nombra el campo en camelCase ni en inglés. */
function esperarValidacion(res: { status: number; body: unknown }) {
  esperarError(res, 400, 'VALIDACION_FALLIDA');
  const { mensaje } = (res.body as { error: { mensaje: string } }).error;
  expect(mensaje).not.toMatch(CAMEL);
  expect(mensaje).not.toMatch(/\b(should|must|property|string|number|array|object|boolean|is not)\b/i);
}

// ───────────────────────────────────────────────────────────────────────────────────────────
describe('AGENTS §4.3 y §6 — creadoEn: -03:00, sin milisegundos, bordes de día, mes y año', () => {
  it.each([
    ['23:59:59 del 31/12', '2026-12-31T23:59:59-03:00', '2026-12-31T23:59:59-03:00'],
    ['00:00 del 1/1', '2027-01-01T00:00:00-03:00', '2027-01-01T00:00:00-03:00'],
    ['último día del mes, 23:59', '2026-11-30T23:59:00-03:00', '2026-11-30T23:59:00-03:00'],
    ['reloj dado en Z', '2026-11-15T02:30:00Z', '2026-11-14T23:30:00-03:00'],
    [
      'reloj con milisegundos (se truncan, no redondean)',
      '2026-12-31T23:59:59.999-03:00',
      '2026-12-31T23:59:59-03:00',
    ],
    ['reloj con milisegundos a media tarde', '2026-11-14T18:20:00.600-03:00', '2026-11-14T18:20:00-03:00'],
  ])('%s', async (_caso, ahora, esperado) => {
    const ctx = await crearApp({ ahora });
    try {
      const { token, usuario } = await registrarTurista(ctx, { email: emailUnico() });
      expect(usuario.creadoEn).toBe(esperado);
      // Ida y vuelta por la base: el motor no puede redondear ni correr la zona.
      const yo = await ctx.http().get('/yo').set(conSesion(token)).expect(200);
      esperarContrato(yo.body, 'Usuario');
      expect(yo.body.datos.creadoEn).toBe(esperado);
    } finally {
      await ctx.cerrar();
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────
describe('AGENTS §6 y §11.4 — Con el reloj congelado en el pasado, la sesión sigue andando', () => {
  // RELOJ_FIJO sirve para demos: si el token se emite con la hora del reloj y se verifica con
  // la hora real, con el reloj congelado hace más de 30 días nadie podría entrar.
  it('reloj fijo en 2025: registro, ingreso y /yo con el token', async () => {
    const ctx = await crearApp({ ahora: '2025-03-01T10:00:00-03:00' });
    try {
      const email = emailUnico();
      const { token } = await registrarTurista(ctx, { email, contrasena: 'clave-de-demo' });
      await ctx.http().get('/yo').set(conSesion(token)).expect(200);
      const ingreso = await ctx
        .http()
        .post('/auth/ingreso')
        .send({ email, contrasena: 'clave-de-demo' })
        .expect(200);
      await ctx.http().get('/yo').set(conSesion(ingreso.body.datos.token)).expect(200);
    } finally {
      await ctx.cerrar();
    }
  });

  it('reloj fijo en 2030: el token también anda', async () => {
    const ctx = await crearApp({ ahora: '2030-06-01T10:00:00-03:00' });
    try {
      const { token } = await registrarTurista(ctx, { email: emailUnico() });
      await ctx.http().get('/yo').set(conSesion(token)).expect(200);
    } finally {
      await ctx.cerrar();
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────
describe('AGENTS §7.1 — POST /auth/registro: entrada adversarial', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
  });
  afterAll(() => ctx.cerrar());
  const registro = (cuerpo: unknown) =>
    ctx
      .http()
      .post('/auth/registro')
      .send(cuerpo as object);

  it.each([
    ['id', { id: 'usr-mio' }],
    ['avatarUrl', { avatarUrl: null }],
    ['preferencias', { preferencias: { tema: 'oscuro' } }],
    ['creadoEn', { creadoEn: '2020-01-01T00:00:00-03:00' }],
    ['password (en inglés)', { password: 'una-clave-segura' }],
  ])('campo de más (%s) → 400', async (_c, extra) => {
    esperarValidacion(
      await registro({ nombre: 'Ana', email: emailUnico(), contrasena: 'una-clave-segura', ...extra }),
    );
  });

  it.each([
    ['email número', { nombre: 'Ana', email: 42, contrasena: 'una-clave-segura' }],
    ['contraseña número', { nombre: 'Ana', email: 'x@mail.com', contrasena: 12345678 }],
    ['contraseña de 7', { nombre: 'Ana', email: 'x@mail.com', contrasena: '1234567' }],
    ['email vacío', { nombre: 'Ana', email: '', contrasena: 'una-clave-segura' }],
    ['nombre nulo', { nombre: null, email: 'x@mail.com', contrasena: 'una-clave-segura' }],
  ])('%s → 400 con mensaje en castellano', async (_c, cuerpo) => {
    esperarValidacion(await registro(cuerpo));
  });

  it.each([
    ['un arreglo', []],
    ['null', null],
  ])('cuerpo JSON que es %s → 400 con sobre', async (_c, cuerpo) => {
    const res = await ctx
      .http()
      .post('/auth/registro')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(cuerpo));
    esperarValidacion(res);
  });

  it('cuerpo en texto plano → 400 con sobre (no 500)', async () => {
    const res = await ctx.http().post('/auth/registro').set('Content-Type', 'text/plain').send('hola');
    esperarValidacion(res);
  });

  it('M0-1 — cuerpo JSON gigante → 413 PEDIDO_DEMASIADO_GRANDE con sobre', async () => {
    const res = await registro({
      nombre: 'x'.repeat(2 * 1024 * 1024),
      email: emailUnico(),
      contrasena: 'una-clave-segura',
    });
    esperarError(res, 413, 'PEDIDO_DEMASIADO_GRANDE');
  });

  it('contraseña de exactamente 8 caracteres entra', async () => {
    await registro({ nombre: 'Ana', email: emailUnico(), contrasena: '12345678' }).expect(201);
  });

  it('nombre de exactamente 100 letras entra', async () => {
    const res = await registro({
      nombre: 'N'.repeat(100),
      email: emailUnico(),
      contrasena: 'una-clave-segura',
    }).expect(201);
    esperarContrato(res.body, 'Sesion');
  });

  it('contraseña larga (126) y con tildes: registra e ingresa', async () => {
    const email = emailUnico();
    const contrasena = 'ñandú-canción-'.repeat(9);
    await registro({ nombre: 'Ana', email, contrasena }).expect(201);
    await ctx.http().post('/auth/ingreso').send({ email, contrasena }).expect(200);
  });

  it('M0-6 — contraseña larguísima (700) → 400 en castellano', async () => {
    esperarValidacion(
      await registro({ nombre: 'Ana', email: emailUnico(), contrasena: 'ñandú-canción-'.repeat(50) }),
    );
  });

  it('email con espacios alrededor se guarda recortado y en minúsculas', async () => {
    const base = emailUnico('Espacios');
    const res = await registro({
      nombre: 'Ana',
      email: `  ${base.toUpperCase()}  `,
      contrasena: 'una-clave-segura',
    }).expect(201);
    expect(res.body.datos.usuario.email).toBe(base.toLowerCase());
  });

  it('EMAIL_YA_REGISTRADO también con espacios alrededor', async () => {
    const email = emailUnico();
    await registro({ nombre: 'Ana', email, contrasena: 'una-clave-segura' }).expect(201);
    esperarError(
      await registro({ nombre: 'Otra', email: ` ${email.toUpperCase()} `, contrasena: 'una-clave-segura' }),
      409,
      'EMAIL_YA_REGISTRADO',
    );
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────
describe('AGENTS §7.1 — POST /auth/ingreso: entrada adversarial', () => {
  let ctx: AppDePrueba;
  const email = emailUnico('ingreso');
  beforeAll(async () => {
    ctx = await crearApp();
    await registrarTurista(ctx, { email, contrasena: 'clave-correcta' });
  });
  afterAll(() => ctx.cerrar());

  it('campo de más → 400', async () => {
    esperarValidacion(
      await ctx.http().post('/auth/ingreso').send({ email, contrasena: 'clave-correcta', recordarme: true }),
    );
  });

  it.each([
    [{ email: 42, contrasena: 'clave-correcta' }],
    [{ email, contrasena: 12345678 }],
    [{ email, contrasena: ['clave-correcta'] }],
    [{}],
  ])('tipos equivocados → 400 (nunca 500): %j', async (cuerpo) => {
    esperarValidacion(await ctx.http().post('/auth/ingreso').send(cuerpo));
  });

  it('la sesión del ingreso trae el mismo Usuario que /yo', async () => {
    const res = await ctx
      .http()
      .post('/auth/ingreso')
      .send({ email, contrasena: 'clave-correcta' })
      .expect(200);
    esperarContrato(res.body, 'Sesion');
    const yo = await ctx.http().get('/yo').set(conSesion(res.body.datos.token)).expect(200);
    expect(yo.body.datos).toEqual(res.body.datos.usuario);
  });

  it('CREDENCIALES_INVALIDAS: el mensaje no delata si el email existe', async () => {
    const res = await ctx.http().post('/auth/ingreso').send({ email, contrasena: 'otra-clave' });
    esperarError(res, 401, 'CREDENCIALES_INVALIDAS');
    expect(res.body.error.mensaje).not.toMatch(/no existe|no está registrad|no encontramos/i);
  });

  it('el admin entra por /auth/ingreso y su Usuario no expone el rol (D2)', async () => {
    const admin = await crearAdmin(ctx);
    const res = await ctx
      .http()
      .post('/auth/ingreso')
      .send({ email: `${admin.id}@admin.prueba.ar`, contrasena: 'una-clave-segura' })
      .expect(200);
    esperarContrato(res.body, 'Sesion');
    expect(res.body.datos.usuario).not.toHaveProperty('rol');
    const yo = await ctx.http().get('/yo').set(conSesion(admin.token)).expect(200);
    esperarContrato(yo.body, 'Usuario');
    expect(JSON.stringify(yo.body)).not.toMatch(/admin"|"rol"|hash|scrypt/);
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────
describe('AGENTS §7.2 — Tokens manipulados', () => {
  let ctx: AppDePrueba;
  let usuarioId: string;
  beforeAll(async () => {
    ctx = await crearApp();
    usuarioId = (await registrarTurista(ctx, { email: emailUnico() })).usuario.id;
  });
  afterAll(() => ctx.cerrar());

  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');

  it('alg "none" sin firma → 401', async () => {
    const ahora = Math.floor(Date.parse('2026-11-14T15:00:00Z') / 1000);
    const token = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: usuarioId, rol: 'admin', iat: ahora, exp: ahora + 3600 * 24 * 365 * 10 })}.`;
    esperarError(await ctx.http().get('/yo').set(conSesion(token)), 401, 'NO_AUTENTICADO');
  });

  it('carga cambiada con la firma original → 401', async () => {
    const { token } = await registrarTurista(ctx, { email: emailUnico() });
    const [cab, carga, firma] = token.split('.');
    const datos = JSON.parse(Buffer.from(carga, 'base64url').toString()) as Record<string, unknown>;
    const trucho = `${cab}.${b64({ ...datos, rol: 'admin' })}.${firma}`;
    esperarError(await ctx.http().get('/yo').set(conSesion(trucho)), 401, 'NO_AUTENTICADO');
  });

  it('"bearer" en minúsculas se acepta o da 401 con sobre, nunca 500', async () => {
    const { token } = await registrarTurista(ctx, { email: emailUnico() });
    const res = await ctx.http().get('/yo').set('Authorization', `bearer ${token}`);
    expect([200, 401]).toContain(res.status);
    if (res.status === 401) esperarError(res, 401, 'NO_AUTENTICADO');
  });

  it('token sin sub (firmado bien) → 401', async () => {
    const token = await ctx.app.get(JwtService).signAsync({ rol: 'turista' });
    esperarError(await ctx.http().get('/yo').set(conSesion(token)), 401, 'NO_AUTENTICADO');
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────
describe('R18 — PATCH /yo: entrada adversarial', () => {
  let ctx: AppDePrueba;
  let token: string;
  beforeEach(async () => {
    ctx = await crearApp();
    ({ token } = await registrarTurista(ctx, { email: emailUnico() }));
  });
  afterEach(() => ctx.cerrar());
  const patch = (cuerpo: unknown) =>
    ctx
      .http()
      .patch('/yo')
      .set(conSesion(token))
      .send(cuerpo as object);

  it.each([
    [{ preferencias: null }],
    [{ preferencias: { radioAvisoMetros: 0 } }],
    [{ preferencias: { radioAvisoMetros: -250 } }],
    [{ preferencias: { radioAvisoMetros: 250.5 } }],
    [{ preferencias: { radioAvisoMetros: null } }],
    [{ preferencias: { tema: null } }],
    [{ preferencias: { tema: 'Oscuro' } }],
    [{ preferencias: { categoriasFavoritas: null } }],
    [{ preferencias: { categoriasFavoritas: [1, 2] } }],
    [{ preferencias: [] }],
    [{ nombre: '    ' }],
    [{ nombre: 'N'.repeat(101) }],
    [{ nombre: 42 }],
    [{ contrasena: 'otra-clave-nueva' }],
    [{ rol: 'admin' }],
  ])('→ 400 con mensaje en castellano: %j', async (cuerpo) => {
    esperarValidacion(await patch(cuerpo));
  });

  it('avatarUrl "" no se guarda como "": da error o queda null', async () => {
    const res = await patch({ avatarUrl: '' });
    if (res.status === 200) {
      esperarContrato(res.body, 'Usuario');
      expect(res.body.datos.avatarUrl).toBeNull();
    } else {
      expect([400, 422]).toContain(res.status);
      expect(['VALIDACION_FALLIDA', 'ARCHIVO_NO_SUBIDO']).toContain(res.body.error.codigo);
      esperarError(res, res.status, res.body.error.codigo);
    }
  });

  it('preferencias: {} no cambia nada', async () => {
    const antes = await ctx.http().get('/yo').set(conSesion(token));
    const res = await patch({ preferencias: {} }).expect(200);
    expect(res.body.datos).toEqual(antes.body.datos);
  });

  it('un error de validación no deja cambios a medias', async () => {
    const antes = await ctx.http().get('/yo').set(conSesion(token));
    esperarValidacion(await patch({ nombre: 'Nuevo', preferencias: { radioAvisoMetros: 300 } }));
    await patch({ nombre: 'Otro', preferencias: { categoriasFavoritas: ['cat-museos'] } }).expect(422);
    const despues = await ctx.http().get('/yo').set(conSesion(token));
    expect(despues.body.datos).toEqual(antes.body.datos);
  });

  it('lo que devuelve el PATCH es lo que queda guardado (todos los campos)', async () => {
    const url = await subirArchivo(ctx, token);
    const res = await patch({
      nombre: 'Lucía Méndez',
      avatarUrl: url,
      preferencias: {
        categoriasFavoritas: [],
        avisarProximidad: false,
        radioAvisoMetros: 100,
        tema: 'claro',
      },
    }).expect(200);
    esperarContrato(res.body, 'Usuario');
    const yo = await ctx.http().get('/yo').set(conSesion(token)).expect(200);
    expect(yo.body.datos).toEqual(res.body.datos);
    expect(res.body.datos.preferencias).toEqual({
      categoriasFavoritas: [],
      avisarProximidad: false,
      radioAvisoMetros: 100,
      tema: 'claro',
    });
  });

  it('R18 — dos PATCH simultáneos de preferencias distintas: se mezclan los dos', async () => {
    await Promise.all([
      patch({ preferencias: { tema: 'oscuro' } }),
      patch({ preferencias: { radioAvisoMetros: 500 } }),
      patch({ preferencias: { avisarProximidad: false } }),
    ]);
    const yo = await ctx.http().get('/yo').set(conSesion(token)).expect(200);
    expect(yo.body.datos.preferencias).toEqual({
      categoriasFavoritas: [],
      avisarProximidad: false,
      radioAvisoMetros: 500,
      tema: 'oscuro',
    });
  });

  it('R18 — avatarUrl: un video subido por /archivos no es una foto → ARCHIVO_NO_SUBIDO', async () => {
    const video = await subirArchivo(ctx, token, MUESTRAS.mp4(), 'v.mp4');
    esperarError(await patch({ avatarUrl: video }), 422, 'ARCHIVO_NO_SUBIDO');
  });

  it('R18 — avatarUrl: esquema javascript: o data: → ARCHIVO_NO_SUBIDO o 400, nunca se guarda', async () => {
    for (const url of ['javascript:alert(1)', 'data:image/png;base64,iVBORw0KGgo=']) {
      const res = await patch({ avatarUrl: url });
      expect([400, 422]).toContain(res.status);
    }
    const yo = await ctx.http().get('/yo').set(conSesion(token));
    expect(yo.body.datos.avatarUrl).toBeNull();
  });

  it('el token de otro usuario sólo cambia al otro', async () => {
    const otro = await registrarTurista(ctx, { email: emailUnico() });
    await ctx.http().patch('/yo').set(conSesion(otro.token)).send({ nombre: 'El otro' }).expect(200);
    const yo = await ctx.http().get('/yo').set(conSesion(token));
    expect(yo.body.datos.nombre).not.toBe('El otro');
  });
});

describe('AGENTS §8 y R18 — avatarUrl con URL_PUBLICA: la URL que devolvió la API se acepta', () => {
  it('sube con URL_PUBLICA y manda esa misma URL en PATCH /yo', async () => {
    const ctx = await crearApp({ entorno: { URL_PUBLICA: 'https://mi-api.ejemplo.com' } });
    try {
      const { token } = await registrarTurista(ctx, { email: emailUnico() });
      const url = await subirArchivo(ctx, token);
      expect(url).toMatch(/^https:\/\/mi-api\.ejemplo\.com\/archivos\//);
      const res = await ctx.http().patch('/yo').set(conSesion(token)).send({ avatarUrl: url }).expect(200);
      esperarContrato(res.body, 'Usuario');
      expect(res.body.datos.avatarUrl).toBe(url);
    } finally {
      await ctx.cerrar();
    }
  });

  it('con CONFIAR_PROXY, la URL https que devolvió la API se acepta en PATCH /yo', async () => {
    const ctx = await crearApp({ entorno: { CONFIAR_PROXY: 'true' } });
    try {
      const { token } = await registrarTurista(ctx, { email: emailUnico() });
      const proxy = { 'X-Forwarded-Proto': 'https', 'X-Forwarded-Host': 'mi-api.onrender.com' };
      const subida = await ctx
        .http()
        .post('/archivos')
        .set(conSesion(token))
        .set(proxy)
        .attach('archivo', MUESTRAS.png(), 'a.png')
        .expect(201);
      const url = subida.body.datos.url as string;
      const res = await ctx
        .http()
        .patch('/yo')
        .set(conSesion(token))
        .set(proxy)
        .send({ avatarUrl: url })
        .expect(200);
      expect(res.body.datos.avatarUrl).toBe(url);
    } finally {
      await ctx.cerrar();
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────
describe('AGENTS §8 — POST /archivos: formatos y límites', () => {
  let ctx: AppDePrueba;
  let token: string;
  beforeAll(async () => {
    ctx = await crearApp();
    ({ token } = await registrarTurista(ctx, { email: emailUnico() }));
  });
  afterAll(() => ctx.cerrar());
  const subir = (contenido: Buffer, nombre: string) =>
    ctx.http().post('/archivos').set(conSesion(token)).attach('archivo', contenido, nombre);

  const webp = Buffer.concat([
    Buffer.from('RIFF', 'latin1'),
    Buffer.from([0xf8, 0x00, 0x00, 0x00]),
    Buffer.from('WEBPVP8 ', 'latin1'),
    Buffer.alloc(240, 5),
  ]);
  const mp3 = Buffer.concat([
    Buffer.from('ID3', 'latin1'),
    Buffer.from([3, 0, 0, 0, 0, 0, 0]),
    Buffer.alloc(246, 0),
  ]);
  const aac = Buffer.concat([Buffer.from([0xff, 0xf1, 0x50, 0x80, 0x02, 0x1f, 0xfc]), Buffer.alloc(249, 0)]);

  it.each([
    ['webp', webp, 'imagen', /\.webp$/, 'image/webp'],
    ['mp3 (ID3)', mp3, 'audio', /\.mp3$/, 'audio/mpeg'],
    ['aac (ADTS)', aac, 'audio', /\.aac$/, 'audio/aac'],
  ])('AGENTS §8 — acepta %s', async (_n, contenido, tipo, ext, mime) => {
    const res = await subir(contenido, 'archivo.bin').expect(201);
    esperarContrato(res.body, 'ArchivoSubido');
    expect(res.body.datos.tipo).toBe(tipo);
    expect(res.body.datos.url).toMatch(ext);
    const bajada = await ctx
      .http()
      .get(new URL(res.body.datos.url).pathname)
      .responseType('blob')
      .expect(200);
    expect(bajada.headers['content-type']).toContain(mime);
    expect(Buffer.compare(bajada.body as Buffer, contenido)).toBe(0);
  });

  it('la extensión de la clave sale de la firma, no del nombre: un jpeg llamado .png', async () => {
    const res = await subir(MUESTRAS.jpg(), 'foto.png').expect(201);
    expect(res.body.datos.url).toMatch(/\.jpg$/);
    expect(res.body.datos.tipo).toBe('imagen');
  });

  it('una imagen de exactamente 5 MB entra', async () => {
    await subir(MUESTRAS.png(5 * 1024 * 1024), 'justa.png').expect(201);
  });

  it('un audio de más de 10 MB → ARCHIVO_DEMASIADO_GRANDE', async () => {
    esperarError(
      await subir(MUESTRAS.m4a(10 * 1024 * 1024 + 1), 'largo.m4a'),
      413,
      'ARCHIVO_DEMASIADO_GRANDE',
    );
  });

  it('un archivo vacío → 400 o 415 con sobre, nunca 500', async () => {
    const res = await subir(Buffer.alloc(0), 'vacio.png');
    expect([400, 415]).toContain(res.status);
    esperarError(res, res.status, res.body.error.codigo);
  });

  it('JSON en vez de multipart → 400 con sobre', async () => {
    esperarValidacion(
      await ctx.http().post('/archivos').set(conSesion(token)).send({ archivo: 'iVBORw0KGgo=' }),
    );
  });

  it('dos archivos en el campo → error con sobre, nunca 500', async () => {
    const res = await ctx
      .http()
      .post('/archivos')
      .set(conSesion(token))
      .attach('archivo', MUESTRAS.png(), 'a.png')
      .attach('archivo', MUESTRAS.png(), 'b.png');
    expect(res.status).toBeLessThan(500);
    if (res.status >= 400) esperarError(res, res.status, res.body.error.codigo);
  });

  it('token vencido → 401 aunque el archivo sea válido', async () => {
    const yo = await ctx.http().get('/yo').set(conSesion(token));
    const vencido = await ctx.app
      .get(JwtService)
      .signAsync({ sub: yo.body.datos.id, rol: 'turista' }, { expiresIn: -10 });
    esperarError(
      await ctx.http().post('/archivos').set(conSesion(vencido)).attach('archivo', MUESTRAS.png(), 'a.png'),
      401,
      'NO_AUTENTICADO',
    );
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────
describe('AGENTS §17.1 y R19 — GET /archivos/<clave>: bordes', () => {
  let ctx: AppDePrueba;
  let ruta: string;
  let rutaPng: string;
  const contenido = Buffer.concat([
    Buffer.from([0, 0, 0, 0x20]),
    Buffer.from('ftypM4A ', 'latin1'),
    Buffer.alloc(488, 9),
  ]);
  beforeAll(async () => {
    ctx = await crearApp();
    const { token } = await registrarTurista(ctx, { email: emailUnico() });
    ruta = new URL(await subirArchivo(ctx, token, contenido, 'a.m4a')).pathname;
    rutaPng = new URL(await subirArchivo(ctx, token, MUESTRAS.png(300), 'a.png')).pathname;
  });
  afterAll(() => ctx.cerrar());

  it('una clave bien formada que no existe → 404 ARCHIVO_NO_ENCONTRADO (no RUTA_NO_ENCONTRADA)', async () => {
    const inexistente = ruta.replace(/[a-z0-9]{12}\.m4a$/, 'zzzzzzzzzzzz.m4a');
    esperarError(await ctx.http().get(inexistente), 404, 'ARCHIVO_NO_ENCONTRADO');
  });

  it('Range: bytes=0-0 → 206 con 1 byte', async () => {
    const res = await ctx.http().get(ruta).set('Range', 'bytes=0-0').responseType('blob').expect(206);
    expect(res.headers['content-range']).toBe('bytes 0-0/500');
    expect((res.body as Buffer).length).toBe(1);
  });

  it('Range con fin más allá del archivo se recorta al final (RFC 9110)', async () => {
    const res = await ctx.http().get(ruta).set('Range', 'bytes=490-9999').responseType('blob').expect(206);
    expect(res.headers['content-range']).toBe('bytes 490-499/500');
    expect((res.body as Buffer).length).toBe(10);
  });

  it('Range mal escrito se ignora → 200 con el archivo entero', async () => {
    const res = await ctx.http().get(ruta).set('Range', 'bytes=abc').responseType('blob');
    expect([200, 416]).toContain(res.status);
    if (res.status === 200) expect((res.body as Buffer).length).toBe(500);
    else esperarError(res, 416, 'RANGO_NO_SATISFACIBLE');
  });

  it('Range en una imagen también → 206', async () => {
    const res = await ctx.http().get(rutaPng).set('Range', 'bytes=0-7').responseType('blob').expect(206);
    expect(res.headers['content-type']).toBe('image/png');
    expect((res.body as Buffer).subarray(1, 4).toString('latin1')).toBe('PNG');
  });

  it('HEAD devuelve cabeceras sin cuerpo (expo-video lo usa)', async () => {
    const res = await ctx.http().head(ruta);
    expect(res.status).toBe(200);
    expect(res.headers['content-length']).toBe('500');
    expect(res.headers['accept-ranges']).toBe('bytes');
  });

  it('GET /archivos sin clave → 404 con sobre', async () => {
    const res = await ctx.http().get('/archivos');
    expect(res.status).toBe(404);
    esperarError(res, 404, res.body.error.codigo);
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────
// ───────────────────────────────────────────────────────────────────────────────────────────
describe('AGENTS §11.4 — X-Simular: bordes', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp({ entorno: { SIMULACION_HABILITADA: 'true' } });
  });
  afterAll(() => ctx.cerrar());

  it('error-500 en un POST no ejecuta la acción (el registro no queda hecho)', async () => {
    const email = emailUnico();
    const cuerpo = { nombre: 'Ana', email, contrasena: 'una-clave-segura' };
    esperarError(
      await ctx.http().post('/auth/registro').set('X-Simular', 'error-500').send(cuerpo),
      500,
      'ERROR_INTERNO',
    );
    await ctx.http().post('/auth/registro').send(cuerpo).expect(201);
  });

  it('error-500 sobre una ruta protegida sin token: la simulación responde el error pedido', async () => {
    const res = await ctx.http().get('/yo').set('X-Simular', 'error-500');
    expect([401, 500]).toContain(res.status);
    esperarError(res, res.status, res.body.error.codigo);
  });

  it('demora con un número inválido se ignora y responde enseguida', async () => {
    const inicio = performance.now();
    await ctx.http().get('/salud').set('X-Simular', 'demora-abc').expect(200);
    expect(performance.now() - inicio).toBeLessThan(1000);
  });

  it('el ERROR_INTERNO simulado tiene un mensaje genérico en castellano', async () => {
    const res = await ctx.http().get('/salud').set('X-Simular', 'error-500');
    esperarError(res, 500, 'ERROR_INTERNO');
    expect(res.body.error.mensaje).not.toMatch(/simul|X-Simular/i);
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────
describe('AGENTS §4.1, §11.4 y §11.5 — Sobre, CORS y Swagger', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
  });
  afterAll(() => ctx.cerrar());

  it('/salud: meta es null (no ausente) y datos sin campos de más', async () => {
    const res = await ctx.http().get('/salud').expect(200);
    expect(res.body).toHaveProperty('meta', null);
    esperarContrato(res.body, 'Salud');
  });

  it('CORS: el preflight de un pedido con Authorization, JSON y X-Simular pasa', async () => {
    const res = await ctx
      .http()
      .options('/yo')
      .set('Origin', 'http://localhost:8081')
      .set('Access-Control-Request-Method', 'PATCH')
      .set('Access-Control-Request-Headers', 'authorization,content-type,x-simular');
    expect(res.status).toBeLessThan(300);
    expect(res.headers['access-control-allow-origin']).toBeDefined();
    const permitidas = String(res.headers['access-control-allow-headers'] ?? '').toLowerCase();
    for (const h of ['authorization', 'content-type', 'x-simular']) expect(permitidas).toContain(h);
    expect(String(res.headers['access-control-allow-methods'] ?? '')).toContain('PATCH');
  });

  it('404 de una ruta con token también tiene sobre', async () => {
    const { token } = await registrarTurista(ctx, { email: emailUnico() });
    esperarError(await ctx.http().get('/yo/no-existe').set(conSesion(token)), 404, 'RUTA_NO_ENCONTRADA');
  });

  it('Swagger en /docs-json es público y documenta cada endpoint de M0', async () => {
    const res = await ctx.http().get('/docs-json').expect(200);
    const rutas = res.body.paths as Record<string, Record<string, unknown>>;
    const esperadas: [string, string][] = [
      ['/salud', 'get'],
      ['/auth/registro', 'post'],
      ['/auth/ingreso', 'post'],
      ['/yo', 'get'],
      ['/yo', 'patch'],
      ['/archivos', 'post'],
      ['/dispositivos', 'post'],
      ['/dispositivos/prueba', 'post'],
      ['/dispositivos/{tokenExpo}', 'delete'],
    ];
    for (const [ruta, metodo] of esperadas) expect(rutas[ruta]?.[metodo], `${metodo} ${ruta}`).toBeDefined();
    expect(Object.keys(rutas).some((r) => r.startsWith('/archivos/'))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// Segunda pasada: decisiones M0-5 y M0-6 (docs/DECISIONS.md).
// ═══════════════════════════════════════════════════════════════════════════════════════════

describe('M0-5 — Una URL de /archivos/<clave> existente se acepta con cualquier origen', () => {
  let ctx: AppDePrueba;
  let token: string;
  let clave: string;
  beforeEach(async () => {
    ctx = await crearApp();
    ({ token } = await registrarTurista(ctx, { email: emailUnico() }));
    clave = new URL(await subirArchivo(ctx, token)).pathname;
  });
  afterEach(() => ctx.cerrar());
  const patch = (cuerpo: object) => ctx.http().patch('/yo').set(conSesion(token)).send(cuerpo);

  it.each([
    ['la IP de la compu por wifi', 'http://192.168.0.10:3000'],
    ['localhost', 'http://localhost:3000'],
    ['un dominio https', 'https://mi-api.onrender.com'],
  ])('origen distinto del pedido (%s) → 200 y sale con el origen del pedido', async (_c, origen) => {
    const res = await patch({ avatarUrl: `${origen}${clave}` })
      .set('Host', '10.0.0.5:3000')
      .expect(200);
    esperarContrato(res.body, 'Usuario');
    expect(res.body.datos.avatarUrl).toBe(`http://10.0.0.5:3000${clave}`);
  });

  it('con ?query al final → 200 y la query no se guarda', async () => {
    const res = await patch({ avatarUrl: `http://localhost:3000${clave}?v=2&t=abc` })
      .set('Host', '10.0.0.5:3000')
      .expect(200);
    expect(res.body.datos.avatarUrl).toBe(`http://10.0.0.5:3000${clave}`);
  });

  it('con #fragmento al final → 200 o ARCHIVO_NO_SUBIDO, pero nunca se guarda el fragmento', async () => {
    const res = await patch({ avatarUrl: `http://localhost:3000${clave}#x` }).set('Host', '10.0.0.5:3000');
    if (res.status === 200) expect(res.body.datos.avatarUrl).toBe(`http://10.0.0.5:3000${clave}`);
    else esperarError(res, 422, 'ARCHIVO_NO_SUBIDO');
  });

  it('un archivo que subió otra persona también se acepta (no se exige el mismo autor)', async () => {
    const otro = await registrarTurista(ctx, { email: emailUnico() });
    const res = await ctx
      .http()
      .patch('/yo')
      .set(conSesion(otro.token))
      .set('Host', '10.0.0.5:3000')
      .send({ avatarUrl: `http://192.168.0.10:3000${clave}` })
      .expect(200);
    expect(res.body.datos.avatarUrl).toBe(`http://10.0.0.5:3000${clave}`);
  });

  it.each([
    [
      'origen ajeno con una clave que no existe',
      (c: string) => `https://otro.com${c.replace(/[a-z0-9]{12}\.png$/, 'zzzzzzzzzzzz.png')}`,
    ],
    ['file:// con la ruta de una clave nuestra', (c: string) => `file://${c}`],
    ['ruta que no es /archivos', (c: string) => `http://localhost:3000/otra${c}`],
    ['sólo la ruta, sin origen', (c: string) => c],
    ['ftp:// con la clave', (c: string) => `ftp://localhost${c}`],
    ['/archivos/ sin clave', () => 'http://localhost:3000/archivos/'],
    ['clave con ../ codificado', () => 'http://localhost:3000/archivos/imagenes/..%2F..%2F..%2Fetc%2Fpasswd'],
    ['clave con %00', (c: string) => `http://localhost:3000${c}%00.png`],
  ])('%s → 422 ARCHIVO_NO_SUBIDO (nunca 500) y no se guarda', async (_c, armar) => {
    const res = await patch({ avatarUrl: armar(clave) });
    // "sólo la ruta" podría leerse como 400 de formato; lo importante: no se guarda y no es 500.
    expect([400, 422]).toContain(res.status);
    esperarError(res, res.status, res.status === 400 ? 'VALIDACION_FALLIDA' : 'ARCHIVO_NO_SUBIDO');
    const yo = await ctx.http().get('/yo').set(conSesion(token));
    expect(yo.body.datos.avatarUrl).toBeNull();
  });

  it('una URL ajena con la ruta /archivos/<clave> existente sólo guarda la clave: la respuesta nunca trae el host ajeno', async () => {
    const res = await patch({ avatarUrl: `https://sitio-malo.com${clave}` }).expect(200);
    expect(res.body.datos.avatarUrl).not.toContain('sitio-malo');
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────
describe('M0-6 — La contraseña va de 8 a 200 caracteres', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
  });
  afterAll(() => ctx.cerrar());
  const registro = (contrasena: string, email = emailUnico()) =>
    ctx.http().post('/auth/registro').send({ nombre: 'Ana', email, contrasena });

  it('exactamente 200 caracteres: registra e ingresa', async () => {
    const email = emailUnico();
    const contrasena = 'a'.repeat(200);
    await registro(contrasena, email).expect(201);
    await ctx.http().post('/auth/ingreso').send({ email, contrasena }).expect(200);
  });

  it('200 caracteres con tildes (más de 200 bytes) también entra', async () => {
    await registro('ñ'.repeat(200)).expect(201);
  });

  it('201 caracteres → 400 y el mensaje dice el máximo', async () => {
    const res = await registro('a'.repeat(201));
    esperarValidacion(res);
    expect(res.body.error.mensaje).toMatch(/200/);
    expect(res.body.error.mensaje).toMatch(/contraseña/i);
  });

  it('7 caracteres → 400 y el mensaje dice el mínimo', async () => {
    const res = await registro('a'.repeat(7));
    esperarValidacion(res);
    expect(res.body.error.mensaje).toMatch(/8/);
  });

  it('ingreso con una contraseña gigante (10.000) → 400 o 401 con sobre, nunca 500 ni lento', async () => {
    const inicio = performance.now();
    const res = await ctx
      .http()
      .post('/auth/ingreso')
      .send({ email: emailUnico(), contrasena: 'x'.repeat(10_000) });
    expect([400, 401]).toContain(res.status);
    esperarError(res, res.status, res.status === 400 ? 'VALIDACION_FALLIDA' : 'CREDENCIALES_INVALIDAS');
    expect(performance.now() - inicio).toBeLessThan(3000);
  });

  it('Swagger documenta minLength 8 y maxLength 200 en el registro', async () => {
    const doc = (await ctx.http().get('/docs-json').expect(200)).body as {
      paths: Record<
        string,
        Record<string, { requestBody?: { content: Record<string, { schema: { $ref?: string } }> } }>
      >;
      components: {
        schemas: Record<string, { properties: Record<string, { minLength?: number; maxLength?: number }> }>;
      };
    };
    const ref = doc.paths['/auth/registro'].post.requestBody?.content['application/json'].schema.$ref ?? '';
    const esquema = doc.components.schemas[ref.split('/').pop() ?? ''];
    expect(esquema.properties.contrasena).toMatchObject({ minLength: 8, maxLength: 200 });
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────
// ───────────────────────────────────────────────────────────────────────────────────────────
describe('M0-6 y R18 — PATCH /yo simultáneos: se mezclan todos', () => {
  let ctx: AppDePrueba;
  let token: string;
  beforeEach(async () => {
    ctx = await crearApp();
    ({ token } = await registrarTurista(ctx, { email: emailUnico() }));
  });
  afterEach(() => ctx.cerrar());
  const patch = (cuerpo: object) => ctx.http().patch('/yo').set(conSesion(token)).send(cuerpo);

  it('cinco cambios a la vez (nombre, avatar y tres preferencias): todos 200 y quedan todos', async () => {
    const url = await subirArchivo(ctx, token);
    const res = await Promise.all([
      patch({ nombre: 'Lucía Méndez' }),
      patch({ avatarUrl: url }),
      patch({ preferencias: { tema: 'oscuro' } }),
      patch({ preferencias: { radioAvisoMetros: 100 } }),
      patch({ preferencias: { avisarProximidad: false } }),
    ]);
    for (const r of res) expect(r.status).toBe(200);
    const yo = await ctx.http().get('/yo').set(conSesion(token)).expect(200);
    esperarContrato(yo.body, 'Usuario');
    expect(yo.body.datos.nombre).toBe('Lucía Méndez');
    expect(new URL(yo.body.datos.avatarUrl as string).pathname).toBe(new URL(url).pathname);
    expect(yo.body.datos.preferencias).toEqual({
      categoriasFavoritas: [],
      avisarProximidad: false,
      radioAvisoMetros: 100,
      tema: 'oscuro',
    });
  });

  it('diez PATCH del mismo campo a la vez: todos 200 y queda uno de los valores mandados', async () => {
    const radios = [100, 250, 500, 100, 250, 500, 100, 250, 500, 100];
    const res = await Promise.all(radios.map((r) => patch({ preferencias: { radioAvisoMetros: r } })));
    for (const r of res) {
      expect(r.status).toBe(200);
      esperarContrato(r.body, 'Usuario');
    }
    const yo = await ctx.http().get('/yo').set(conSesion(token)).expect(200);
    expect([100, 250, 500]).toContain(yo.body.datos.preferencias.radioAvisoMetros);
    expect(yo.body.datos.preferencias.tema).toBe('sistema');
  });

  it('un PATCH inválido en medio de los simultáneos no se lleva puestos a los otros', async () => {
    const [a, b, c] = await Promise.all([
      patch({ preferencias: { tema: 'claro' } }),
      patch({ preferencias: { radioAvisoMetros: 300 } }),
      patch({ preferencias: { avisarProximidad: false } }),
    ]);
    expect(a.status).toBe(200);
    esperarValidacion(b);
    expect(c.status).toBe(200);
    const yo = await ctx.http().get('/yo').set(conSesion(token)).expect(200);
    expect(yo.body.datos.preferencias).toMatchObject({
      tema: 'claro',
      avisarProximidad: false,
      radioAvisoMetros: 250,
    });
  });

  it('la columna interna de versión no se filtra en la respuesta', async () => {
    const res = await patch({ nombre: 'Otro' }).expect(200);
    esperarContrato(res.body, 'Usuario');
    expect(JSON.stringify(res.body)).not.toMatch(/"version"/);
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────
describe('M0-6 — Token firmado con el secreto pero sin un sub válido → NO_AUTENTICADO', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
  });
  afterAll(() => ctx.cerrar());
  const firmar = (carga: Record<string, unknown>) => ctx.app.get(JwtService).signAsync(carga);

  it.each([
    ['sub vacío', { sub: '', rol: 'turista' }],
    ['sub numérico', { sub: 42, rol: 'turista' }],
    ['sub nulo', { sub: null, rol: 'turista' }],
    ['sub objeto', { sub: { id: 'usr-x' }, rol: 'turista' }],
    ['sub arreglo', { sub: ['usr-x'], rol: 'turista' }],
    ['sub sin prefijo usr-', { sub: 'lug-004', rol: 'turista' }],
    ['sub de un usuario que no existe', { sub: 'usr-noexiste1234', rol: 'turista' }],
    ['sub con inyección', { sub: "usr-x' OR '1'='1", rol: 'turista' }],
  ])('%s → 401 en GET /yo, PATCH /yo y POST /dispositivos', async (_c, carga) => {
    const token = await firmar(carga);
    esperarError(await ctx.http().get('/yo').set(conSesion(token)), 401, 'NO_AUTENTICADO');
    esperarError(
      await ctx.http().patch('/yo').set(conSesion(token)).send({ nombre: 'X' }),
      401,
      'NO_AUTENTICADO',
    );
    esperarError(
      await ctx
        .http()
        .post('/dispositivos')
        .set(conSesion(token))
        .send({ tokenExpo: 'ExponentPushToken[subinvalidosubinvalido]', plataforma: 'ios' }),
      401,
      'NO_AUTENTICADO',
    );
  });

  it('sub inexistente en POST /archivos → 401 (no se guarda un archivo huérfano)', async () => {
    const token = await firmar({ sub: 'usr-noexiste1234', rol: 'turista' });
    esperarError(
      await ctx.http().post('/archivos').set(conSesion(token)).attach('archivo', MUESTRAS.png(), 'a.png'),
      401,
      'NO_AUTENTICADO',
    );
  });

  it('usuario borrado de la base: su token deja de servir', async () => {
    const { token, usuario } = await registrarTurista(ctx, { email: emailUnico() });
    await ctx.dataSource.getRepository('UsuarioEntidad').delete({ id: usuario.id });
    esperarError(await ctx.http().get('/yo').set(conSesion(token)), 401, 'NO_AUTENTICADO');
  });
});
