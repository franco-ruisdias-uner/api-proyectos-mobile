// Verificación independiente de M0 — Base (AGENTS §4, §6, §7, §8, §9, §11; ESPECIFICACION §1).
// Caja negra: no depende de src/ más allá de las utilidades de test.
import type { Response } from 'supertest';
import { crearApp, type AppDePrueba } from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import {
  crearOperador,
  crearVecino,
  CONTRASENA_DE_PRUEBA,
} from '../utilidades/usuarios.js';
import { JPEG, M4A, MP4, PNG, jpegNumerado } from '../utilidades/archivos.js';

let ctx: AppDePrueba;
const AHORA = '2026-09-14T10:00:00-03:00';
beforeAll(async () => {
  ctx = await crearApp({ ahora: AHORA });
});
afterAll(() => ctx.cerrar());
beforeEach(() => {
  ctx.reloj.mover(AHORA);
  ctx.notificador.limpiar();
});

const unico = () => `verif-${Math.random().toString(36).slice(2, 10)}@mail.com`;
const registro = (cuerpo: unknown, app: AppDePrueba = ctx) =>
  app
    .http()
    .post('/auth/registro')
    .send(cuerpo as object);
const ingreso = (cuerpo: unknown) =>
  ctx
    .http()
    .post('/auth/ingreso')
    .send(cuerpo as object);

/** Jerga técnica o inglés que no puede aparecer en un mensaje para el vecino. */
const JERGA =
  /\b(must|should|property|undefined|null|cannot|exception|invalid|string|boolean|number|array|entity|column|constraint|sql|jwt|bearer|multipart|mime|payload|body)\b/i;
function mensajeParaPersonas(res: Response): void {
  const mensaje = (res.body as { error: { mensaje: string } }).error.mensaje;
  expect(mensaje).not.toMatch(JERGA);
  expect(mensaje).not.toMatch(/usr-|[A-Z_]{6,}/);
}

const decodificar = (parte: string) =>
  JSON.parse(Buffer.from(parte, 'base64url').toString('utf8')) as Record<
    string,
    unknown
  >;

// --- Archivos de prueba con firma correcta que las utilidades no traen ---
const WEBP = Buffer.concat([
  Buffer.from('RIFF', 'latin1'),
  Buffer.from([0x40, 0, 0, 0]),
  Buffer.from('WEBPVP8 ', 'latin1'),
  Buffer.alloc(120, 4),
]);
const MP3_ID3 = Buffer.concat([
  Buffer.from('ID3', 'latin1'),
  Buffer.from([3, 0, 0, 0, 0, 0, 0]),
  Buffer.from([0xff, 0xfb, 0x90, 0x64]),
  Buffer.alloc(300, 6),
]);
const AAC_ADTS = Buffer.concat([
  Buffer.from([0xff, 0xf1, 0x50, 0x80, 0x02, 0x1f, 0xfc]),
  Buffer.alloc(300, 8),
]);
const GIF = Buffer.concat([
  Buffer.from('GIF89a', 'latin1'),
  Buffer.alloc(100, 1),
]);
const conRelleno = (cabecera: Buffer, bytes: number) =>
  Buffer.concat([cabecera, Buffer.alloc(bytes - cabecera.length, 3)]);

const binario = (req: ReturnType<ReturnType<AppDePrueba['http']>['get']>) =>
  req.buffer(true).parse((res, cb) => {
    const partes: Buffer[] = [];
    res.on('data', (p: Buffer) => partes.push(p));
    res.on('end', () => cb(null, Buffer.concat(partes)));
  });
const ruta = (url: string) => new URL(url).pathname;

// ============================================================================
describe('AGENTS §7.1 / ESPECIFICACION §1 — Registro: forma y nulos', () => {
  it('telefono: null explícito (lo que manda la app) se acepta y vuelve null', async () => {
    const res = await registro({
      nombre: 'Ana',
      email: unico(),
      contrasena: 'clave1234',
      telefono: null,
    });
    expect(res.status).toBe(201);
    esperarContrato(res, 'Sesion');
    expect(res.body.datos.usuario.telefono).toBeNull();
  });

  it('un teléfono de sólo espacios nunca vuelve como texto en blanco', async () => {
    const res = await registro({
      nombre: 'Ana',
      email: unico(),
      contrasena: 'clave1234',
      telefono: '   ',
    });
    if (res.status === 201) {
      esperarContrato(res, 'Sesion');
      expect(res.body.datos.usuario.telefono).toBeNull();
    } else {
      esperarError(res, 400, 'VALIDACION_FALLIDA');
    }
  });

  it('la sesión tiene exactamente token y usuario', async () => {
    const res = await registro({
      nombre: 'Ana',
      email: unico(),
      contrasena: 'clave1234',
    });
    expect(Object.keys(res.body.datos).sort()).toEqual(['token', 'usuario']);
    expect(Object.keys(res.body.datos.usuario).sort()).toEqual(
      [
        'avisosActivos',
        'creadoEn',
        'email',
        'id',
        'nombre',
        'rol',
        'telefono',
        'zonaId',
      ].sort(),
    );
  });

  it('una contraseña de exactamente 8 caracteres entra', async () => {
    const res = await registro({
      nombre: 'Ana',
      email: unico(),
      contrasena: '12345678',
    });
    expect(res.status).toBe(201);
  });

  it.each([
    ['contraseña numérica', { nombre: 'Ana', contrasena: 12345678 }],
    [
      'teléfono numérico',
      { nombre: 'Ana', contrasena: 'clave1234', telefono: 3446123456 },
    ],
    ['nombre null', { nombre: null, contrasena: 'clave1234' }],
    [
      'avisosActivos en el registro',
      { nombre: 'Ana', contrasena: 'clave1234', avisosActivos: false },
    ],
    [
      'id elegido por el cliente',
      { nombre: 'Ana', contrasena: 'clave1234', id: 'usr-mio' },
    ],
  ])('400 VALIDACION_FALLIDA con %s', async (_caso, cuerpo) => {
    const res = await registro({ email: unico(), ...cuerpo });
    esperarError(res, 400, 'VALIDACION_FALLIDA');
    mensajeParaPersonas(res);
  });

  it('400 con un cuerpo que es una lista', async () => {
    esperarError(
      await registro([{ nombre: 'Ana' }]),
      400,
      'VALIDACION_FALLIDA',
    );
  });

  it('400 (no 500) con un cuerpo vacío', async () => {
    esperarError(await registro({}), 400, 'VALIDACION_FALLIDA');
  });

  it('400 (no 500) con un cuerpo en texto plano', async () => {
    const res = await ctx
      .http()
      .post('/auth/registro')
      .set('Content-Type', 'text/plain')
      .send('nombre=Ana');
    esperarError(res, 400, 'VALIDACION_FALLIDA');
  });

  it('AGENTS §5.3 — textos muy largos no rompen la base (400 o se guardan enteros, nunca 500)', async () => {
    const largo = 'N'.repeat(400);
    const res = await registro({
      nombre: largo,
      email: unico(),
      contrasena: 'clave1234',
      telefono: '9'.repeat(200),
    });
    expect([201, 400]).toContain(res.status);
    if (res.status === 201) {
      expect(res.body.datos.usuario.nombre).toBe(largo);
    } else {
      esperarError(res, 400, 'VALIDACION_FALLIDA');
    }
  });

  it('AGENTS §5.3 — un email muy largo no rompe la base', async () => {
    const res = await registro({
      nombre: 'Ana',
      email: `${'a'.repeat(60)}.${'b'.repeat(60)}.${'c'.repeat(60)}@${'d'.repeat(60)}.com`,
      contrasena: 'clave1234',
    });
    expect([201, 400]).toContain(res.status);
  });
});

// ============================================================================
describe('AGENTS §6 — Registro: creadoEn en hora argentina con el reloj en los bordes', () => {
  it.each([
    ['23:59:59 del 31/12', '2026-12-31T23:59:59-03:00'],
    ['00:00 del 1/1', '2027-01-01T00:00:00-03:00'],
    ['último día del mes a las 23:59', '2026-09-30T23:59:00-03:00'],
    ['21:30 (ya es otro día en UTC)', '2026-10-31T21:30:00-03:00'],
  ])('%s', async (_caso, instante) => {
    ctx.reloj.mover(instante);
    const res = await registro({
      nombre: 'Ana',
      email: unico(),
      contrasena: 'clave1234',
    });
    expect(res.status).toBe(201);
    esperarContrato(res, 'Sesion');
    expect(res.body.datos.usuario.creadoEn).toBe(instante);
  });
});

// ============================================================================
describe('AGENTS §7.2 — Token JWT', () => {
  it('HS256, sub = id del usuario, rol, y vence a los 30 días del reloj de la API', async () => {
    const res = await registro({
      nombre: 'Ana',
      email: unico(),
      contrasena: 'clave1234',
    });
    const [cabecera, carga] = (res.body.datos.token as string).split('.');
    expect(decodificar(cabecera).alg).toBe('HS256');
    const payload = decodificar(carga);
    expect(payload.sub).toBe(res.body.datos.usuario.id);
    expect(payload.rol).toBe('vecino');
    expect(payload.iat).toBe(Date.parse(AHORA) / 1000);
    expect(Number(payload.exp) - Number(payload.iat)).toBe(30 * 24 * 60 * 60);
    expect(JSON.stringify(payload)).not.toMatch(/contrasena|scrypt|email/);
  });

  it('una carga adulterada (vecino → operador) con la firma original da 401', async () => {
    const v = await crearVecino(ctx);
    const [cab, carga, firma] = v.token.split('.');
    const nueva = Buffer.from(
      JSON.stringify({ ...decodificar(carga), rol: 'operador' }),
    ).toString('base64url');
    esperarError(
      await ctx
        .http()
        .get('/yo')
        .set('Authorization', `Bearer ${cab}.${nueva}.${firma}`),
      401,
      'NO_AUTENTICADO',
    );
  });

  it.each([
    ['Bearer vacío', 'Bearer '],
    ['sólo la palabra Bearer', 'Bearer'],
    ['Basic', 'Basic dXN1YXJpbzpjbGF2ZQ=='],
  ])('401 NO_AUTENTICADO con %s', async (_caso, cabecera) => {
    const res = await ctx.http().get('/yo').set('Authorization', cabecera);
    esperarError(res, 401, 'NO_AUTENTICADO');
    mensajeParaPersonas(res);
  });

  it('AGENTS §6 — el vencimiento se mide con el Reloj de la API, no con el de la máquina', async () => {
    const pasado = await crearApp({ ahora: '2020-03-01T12:00:00-03:00' });
    try {
      const res = await registro(
        { nombre: 'Ana', email: unico(), contrasena: 'clave1234' },
        pasado,
      );
      expect(res.status).toBe(201);
      const yo = await pasado
        .http()
        .get('/yo')
        .set('Authorization', `Bearer ${res.body.datos.token}`);
      expect(yo.status).toBe(200);
      esperarContrato(yo, 'Usuario');
      expect(yo.body.datos.creadoEn).toBe('2020-03-01T12:00:00-03:00');
    } finally {
      await pasado.cerrar();
    }
  });
});

// ============================================================================
describe('AGENTS §7.1 — Ingreso', () => {
  it('el email se normaliza igual que en el registro (mayúsculas y espacios)', async () => {
    const email = unico();
    await registro({ nombre: 'Ana', email, contrasena: 'clave1234' }).expect(
      201,
    );
    const res = await ingreso({
      email: `  ${email.toUpperCase()}  `,
      contrasena: 'clave1234',
    });
    expect(res.status).toBe(200);
    esperarContrato(res, 'Sesion');
    expect(res.body.datos.usuario.email).toBe(email);
  });

  it('un operador entra con su rol y su zona', async () => {
    const op = await crearOperador(ctx, { zonaId: 'zon-norte' });
    const res = await ingreso({
      email: op.usuario.email,
      contrasena: CONTRASENA_DE_PRUEBA,
    });
    expect(res.status).toBe(200);
    esperarContrato(res, 'Sesion');
    expect(res.body.datos.usuario).toMatchObject({
      id: op.usuario.id,
      rol: 'operador',
      zonaId: 'zon-norte',
    });
    expect(decodificar(res.body.datos.token.split('.')[1]).rol).toBe(
      'operador',
    );
  });

  it('la contraseña distingue mayúsculas', async () => {
    const email = unico();
    await registro({ nombre: 'Ana', email, contrasena: 'Clave1234' }).expect(
      201,
    );
    const res = await ingreso({ email, contrasena: 'clave1234' });
    esperarError(res, 401, 'CREDENCIALES_INVALIDAS');
    mensajeParaPersonas(res);
  });

  it.each([
    [
      'campo de más',
      { email: 'a@b.com', contrasena: 'clave1234', rol: 'operador' },
    ],
    ['sin email', { contrasena: 'clave1234' }],
    ['email numérico', { email: 5, contrasena: 'clave1234' }],
    ['contraseña numérica', { email: 'a@b.com', contrasena: 12345678 }],
    ['cuerpo vacío', {}],
  ])('400 VALIDACION_FALLIDA con %s', async (_caso, cuerpo) => {
    const res = await ingreso(cuerpo);
    esperarError(res, 400, 'VALIDACION_FALLIDA');
    mensajeParaPersonas(res);
  });

  it('no dice si el email existe: mismo estado y mismo mensaje con una contraseña corta', async () => {
    const email = unico();
    await registro({ nombre: 'Ana', email, contrasena: 'clave1234' }).expect(
      201,
    );
    const a = await ingreso({ email, contrasena: 'otra-clave' });
    const b = await ingreso({ email: unico(), contrasena: 'otra-clave' });
    esperarError(a, 401, 'CREDENCIALES_INVALIDAS');
    esperarError(b, 401, 'CREDENCIALES_INVALIDAS');
    expect(a.body).toEqual(b.body);
  });
});

// ============================================================================
describe('ESPECIFICACION §1 / AGENTS §7.1 — GET /yo', () => {
  it('operador: rol y zonaId; todos los campos presentes', async () => {
    const op = await crearOperador(ctx, {
      zonaId: 'zon-norte',
      telefono: '3446 000',
    });
    const res = await ctx
      .http()
      .get('/yo')
      .set(...op.auth);
    expect(res.status).toBe(200);
    esperarContrato(res, 'Usuario');
    expect(res.body.meta).toBeNull();
    expect(res.body.datos).toEqual({
      id: op.usuario.id,
      nombre: op.usuario.nombre,
      email: op.usuario.email,
      telefono: '3446 000',
      rol: 'operador',
      zonaId: 'zon-norte',
      avisosActivos: true,
      creadoEn: AHORA,
    });
  });

  it('vecino con avisos apagados y todos los opcionales en null', async () => {
    const v = await crearVecino(ctx, { avisosActivos: false });
    const res = await ctx
      .http()
      .get('/yo')
      .set(...v.auth);
    esperarContrato(res, 'Usuario');
    expect(res.body.datos).toMatchObject({
      telefono: null,
      zonaId: null,
      avisosActivos: false,
    });
  });
});

// ============================================================================
describe('ESPECIFICACION §4 M5 — PATCH /yo { nombre?, telefono?, avisosActivos? }', () => {
  const patch = (auth: [string, string], cuerpo: unknown) =>
    ctx
      .http()
      .patch('/yo')
      .set(...auth)
      .send(cuerpo as object);

  it('un cuerpo vacío no cambia nada y devuelve el Usuario', async () => {
    const v = await crearVecino(ctx, { nombre: 'Ana', telefono: '1' });
    const res = await patch(v.auth, {});
    expect(res.status).toBe(200);
    esperarContrato(res, 'Usuario');
    expect(res.body.datos).toMatchObject({
      nombre: 'Ana',
      telefono: '1',
      avisosActivos: true,
    });
  });

  it('AGENTS §4.3 — un teléfono "" se guarda null, nunca ""', async () => {
    const v = await crearVecino(ctx, { telefono: '1' });
    const res = await patch(v.auth, { telefono: '' });
    expect(res.status).toBe(200);
    esperarContrato(res, 'Usuario');
    expect(res.body.datos.telefono).toBeNull();
  });

  it('el nombre se guarda sin espacios de los costados, como en el registro', async () => {
    const v = await crearVecino(ctx);
    const res = await patch(v.auth, { nombre: '  Norma  ' });
    expect(res.status).toBe(200);
    expect(res.body.datos.nombre).toBe('Norma');
  });

  it('un operador puede cambiar sus datos y conserva rol y zona', async () => {
    const op = await crearOperador(ctx, { zonaId: 'zon-norte' });
    const res = await patch(op.auth, {
      avisosActivos: false,
      telefono: '3446 1',
    });
    expect(res.status).toBe(200);
    esperarContrato(res, 'Usuario');
    expect(res.body.datos).toMatchObject({
      rol: 'operador',
      zonaId: 'zon-norte',
      avisosActivos: false,
      telefono: '3446 1',
    });
  });

  it.each([
    ['nombre de sólo espacios', { nombre: '   ' }],
    ['nombre null', { nombre: null }],
    ['avisosActivos null', { avisosActivos: null }],
    ['avisosActivos "true" (texto)', { avisosActivos: 'true' }],
    ['avisosActivos 1', { avisosActivos: 1 }],
    ['teléfono numérico', { telefono: 3446 }],
    ['id', { id: 'usr-otro' }],
    ['creadoEn', { creadoEn: '2020-01-01T00:00:00-03:00' }],
    ['contrasena', { contrasena: 'nueva-clave-1234' }],
    ['una lista', [{ nombre: 'x' }]],
  ])('400 VALIDACION_FALLIDA con %s', async (_caso, cuerpo) => {
    const v = await crearVecino(ctx, { nombre: 'Intacto' });
    const res = await patch(v.auth, cuerpo);
    esperarError(res, 400, 'VALIDACION_FALLIDA');
    mensajeParaPersonas(res);
    const yo = await ctx
      .http()
      .get('/yo')
      .set(...v.auth);
    expect(yo.body.datos.nombre).toBe('Intacto');
  });

  it('401 con un token vencido', async () => {
    const v = await crearVecino(ctx);
    ctx.reloj.mover('2026-10-20T10:00:00-03:00');
    esperarError(await patch(v.auth, { nombre: 'x' }), 401, 'NO_AUTENTICADO');
  });
});

// ============================================================================
describe('AGENTS §8 — POST /archivos: tipos y límites', () => {
  const subir = async (contenido: Buffer, nombre: string) => {
    const v = await crearVecino(ctx);
    return ctx
      .http()
      .post('/archivos')
      .set(...v.auth)
      .attach('archivo', contenido, nombre);
  };

  it.each([
    ['webp', WEBP, 'foto.webp', 'imagen', /\/archivos\/imagenes\/.*\.webp$/],
    [
      'mp3 con ID3',
      MP3_ID3,
      'nota.mp3',
      'audio',
      /\/archivos\/audios\/.*\.mp3$/,
    ],
    ['aac (ADTS)', AAC_ADTS, 'nota.aac', 'audio', /\/archivos\/audios\//],
  ])('acepta %s', async (_caso, contenido, nombre, tipo, url) => {
    const res = await subir(contenido, nombre);
    expect(res.status).toBe(201);
    esperarContrato(res, 'ArchivoSubido');
    expect(res.body.datos).toMatchObject({ tipo, bytes: contenido.length });
    expect(res.body.datos.url).toMatch(url);
  });

  it('se guía por la firma: un PNG que se llama .jpg se sirve como PNG', async () => {
    const res = await subir(PNG, 'foto.jpg');
    expect(res.status).toBe(201);
    expect(res.body.datos.tipo).toBe('imagen');
    const baj = await ctx.http().get(ruta(res.body.datos.url));
    expect(baj.headers['content-type']).toBe('image/png');
  });

  it('un MP4 que se llama .jpg es un video, no una imagen', async () => {
    const res = await subir(MP4, 'foto.jpg');
    expect(res.status).toBe(201);
    expect(res.body.datos.tipo).toBe('video');
  });

  it.each([
    ['GIF', GIF, 'animado.gif'],
    ['texto', Buffer.from('hola, esto no es una foto'), 'foto.jpg'],
  ])(
    '415 TIPO_DE_ARCHIVO_NO_PERMITIDO con %s',
    async (_caso, contenido, nombre) => {
      const res = await subir(contenido, nombre);
      esperarError(res, 415, 'TIPO_DE_ARCHIVO_NO_PERMITIDO');
      mensajeParaPersonas(res);
    },
  );

  it('un archivo vacío no se guarda (ni 201 ni 500)', async () => {
    const res = await subir(Buffer.alloc(0), 'foto.jpg');
    expect([400, 415]).toContain(res.status);
    expect(Object.keys(res.body)).toEqual(['error']);
  });

  it('el límite es por tipo: un audio de 6 MB entra (el de imagen es 5)', async () => {
    const res = await subir(conRelleno(M4A, 6 * 1024 * 1024), 'nota.m4a');
    expect(res.status).toBe(201);
    expect(res.body.datos.tipo).toBe('audio');
  });

  it('413 con un audio de más de 10 MB', async () => {
    const res = await subir(conRelleno(M4A, 10 * 1024 * 1024 + 1), 'nota.m4a');
    esperarError(res, 413, 'ARCHIVO_DEMASIADO_GRANDE');
    mensajeParaPersonas(res);
  });

  it('un video de 12 MB entra (el límite de video es 30)', async () => {
    const res = await subir(conRelleno(MP4, 12 * 1024 * 1024), 'video.mp4');
    expect(res.status).toBe(201);
    expect(res.body.datos.tipo).toBe('video');
  });

  it('401 con un token vencido', async () => {
    const v = await crearVecino(ctx);
    ctx.reloj.mover('2026-11-30T10:00:00-03:00');
    esperarError(
      await ctx
        .http()
        .post('/archivos')
        .set(...v.auth)
        .attach('archivo', JPEG, 'foto.jpg'),
      401,
      'NO_AUTENTICADO',
    );
  });

  it('dos archivos en el campo archivo no dan 500', async () => {
    const v = await crearVecino(ctx);
    const res = await ctx
      .http()
      .post('/archivos')
      .set(...v.auth)
      .attach('archivo', JPEG, 'a.jpg')
      .attach('archivo', PNG, 'b.png');
    expect(res.status).toBeLessThan(500);
    if (res.status >= 400) expect(Object.keys(res.body)).toEqual(['error']);
  });
});

// ============================================================================
describe('AGENTS §17.1 — GET /archivos/<clave> con Range', () => {
  let url: string;
  const contenido = jpegNumerado(1000);
  beforeAll(async () => {
    const v = await crearVecino(ctx);
    const res = await ctx
      .http()
      .post('/archivos')
      .set(...v.auth)
      .attach('archivo', contenido, 'foto.jpg');
    url = ruta(res.body.datos.url);
  });

  it.each([
    ['bytes=0-0', 0, 0],
    ['bytes=990-', 990, 999],
    ['bytes=995-5000 (fin más allá del archivo)', 995, 999],
    ['bytes=-10', 990, 999],
  ])('%s → 206 con esos bytes', async (rango, desde, hasta) => {
    const res = await binario(
      ctx.http().get(url).set('Range', rango.split(' ')[0]),
    );
    expect(res.status).toBe(206);
    expect(
      Buffer.compare(res.body as Buffer, contenido.subarray(desde, hasta + 1)),
    ).toBe(0);
    expect(res.headers['content-range']).toBe(`bytes ${desde}-${hasta}/1000`);
    expect(res.headers['content-length']).toBe(String(hasta - desde + 1));
    expect(res.headers['content-type']).toBe('image/jpeg');
    expect(res.headers['accept-ranges']).toBe('bytes');
  });

  it('bytes=0- devuelve todo como 206', async () => {
    const res = await binario(ctx.http().get(url).set('Range', 'bytes=0-'));
    expect(res.status).toBe(206);
    expect(res.headers['content-range']).toBe('bytes 0-999/1000');
    expect(Buffer.compare(res.body as Buffer, contenido)).toBe(0);
  });

  it('un rango de otra unidad se ignora (200 con todo), no 500', async () => {
    const res = await binario(ctx.http().get(url).set('Range', 'items=0-5'));
    expect([200, 416]).toContain(res.status);
  });

  it('no hace falta sesión aunque venga un token vencido', async () => {
    const v = await crearVecino(ctx);
    ctx.reloj.mover('2027-06-01T10:00:00-03:00');
    const res = await ctx
      .http()
      .get(url)
      .set(...v.auth);
    expect(res.status).toBe(200);
  });
});

// ============================================================================
// ============================================================================
describe('AGENTS §4.1 / §4.6 — Sobre y errores genéricos', () => {
  it('GET /salud: meta null y sin campos de más', async () => {
    const res = await ctx.http().get('/salud');
    esperarContrato(res, 'Salud');
    expect(Object.keys(res.body.datos).sort()).toEqual(
      ['almacen', 'estado', 'motor', 'version'].sort(),
    );
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  it('una ruta pública no se cae si viene un token vencido o basura', async () => {
    const res = await ctx
      .http()
      .get('/salud')
      .set('Authorization', 'Bearer basura');
    expect(res.status).toBe(200);
  });

  it('404 RUTA_NO_ENCONTRADA con mensaje en castellano y sin la ruta pedida', async () => {
    const res = await ctx.http().get('/api/v1/usuarios');
    esperarError(res, 404, 'RUTA_NO_ENCONTRADA');
    mensajeParaPersonas(res);
    expect(res.body.error.mensaje).not.toMatch(/\/api\/v1/);
  });

  it('404 en una ruta inexistente con sesión (no 401 ni 403)', async () => {
    const v = await crearVecino(ctx);
    esperarError(
      await ctx
        .http()
        .post('/no-existe')
        .set(...v.auth)
        .send({}),
      404,
      'RUTA_NO_ENCONTRADA',
    );
  });

  it('JSON mal formado en una ruta con sesión: 400, no 500', async () => {
    const v = await crearVecino(ctx);
    const res = await ctx
      .http()
      .patch('/yo')
      .set(...v.auth)
      .set('Content-Type', 'application/json')
      .send('{nombre:');
    esperarError(res, 400, 'VALIDACION_FALLIDA');
    mensajeParaPersonas(res);
  });

  it('los códigos de error vienen con Content-Type JSON', async () => {
    const res = await ctx.http().get('/yo');
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});

// ============================================================================
describe('AGENTS §11.4 — Simulación de fallas', () => {
  it('apagada: X-Simular demora no demora', async () => {
    const inicio = performance.now();
    const res = await ctx.http().get('/salud').set('X-Simular', 'demora-3000');
    expect(res.status).toBe(200);
    expect(performance.now() - inicio).toBeLessThan(1500);
  });

  describe('prendida', () => {
    let sim: AppDePrueba;
    beforeAll(async () => {
      sim = await crearApp({ entorno: { SIMULACION_HABILITADA: 'true' } });
    });
    afterAll(() => sim.cerrar());

    it('error-500 corta antes de ejecutar: el registro no queda hecho', async () => {
      const email = unico();
      const cuerpo = { nombre: 'Ana', email, contrasena: 'clave1234' };
      const res = await sim
        .http()
        .post('/auth/registro')
        .set('X-Simular', 'error-500')
        .send(cuerpo);
      esperarError(res, 500, 'ERROR_INTERNO');
      mensajeParaPersonas(res);
      const otra = await sim.http().post('/auth/registro').send(cuerpo);
      expect(otra.status).toBe(201);
    });

    it('error-500 también antes de validar el cuerpo', async () => {
      esperarError(
        await sim
          .http()
          .post('/auth/registro')
          .set('X-Simular', 'error-500')
          .send({ basura: true }),
        500,
        'ERROR_INTERNO',
      );
    });

    it('demora + ruta con error: la respuesta sigue siendo el sobre de error', async () => {
      const res = await sim.http().get('/yo').set('X-Simular', 'demora-200');
      esperarError(res, 401, 'NO_AUTENTICADO');
    });
  });
});

// ============================================================================
describe('AGENTS §11.5 — Swagger documenta todos los endpoints de M0', () => {
  it('rutas y métodos', async () => {
    const res = await ctx.http().get('/docs-json');
    expect(res.status).toBe(200);
    const paths = res.body.paths as Record<string, Record<string, unknown>>;
    const esperado: [string, string][] = [
      ['/salud', 'get'],
      ['/auth/registro', 'post'],
      ['/auth/ingreso', 'post'],
      ['/yo', 'get'],
      ['/yo', 'patch'],
      ['/archivos', 'post'],
      ['/dispositivos', 'post'],
      ['/dispositivos/{tokenExpo}', 'delete'],
      ['/dispositivos/prueba', 'post'],
    ];
    for (const [camino, metodo] of esperado) {
      expect(paths[camino], `${metodo} ${camino}`).toBeDefined();
      expect(paths[camino][metodo], `${metodo} ${camino}`).toBeDefined();
    }
    const archivos = Object.keys(paths).filter(
      (p) => p.startsWith('/archivos/') && 'get' in paths[p],
    );
    expect(archivos.length, 'GET /archivos/<clave>').toBeGreaterThan(0);
  });

  it('declara la sesión Bearer', async () => {
    const res = await ctx.http().get('/docs-json');
    const esquemas = res.body.components?.securitySchemes ?? {};
    expect(
      Object.values(esquemas).some(
        (e) => (e as { scheme?: string }).scheme?.toLowerCase() === 'bearer',
      ),
    ).toBe(true);
  });
});

// ============================================================================
// Segunda pasada del verificador
// ============================================================================
describe('AGENTS §5.5 / §7.1 — Registro simultáneo con el mismo email escrito distinto', () => {
  it('mayúsculas y espacios distintos a la vez: uno 201 y el resto 409 EMAIL_YA_REGISTRADO', async () => {
    const email = unico();
    const variantes = [email, email.toUpperCase(), `  ${email}  `];
    const respuestas = await Promise.all(
      variantes.map((e) =>
        registro({ nombre: 'Ana', email: e, contrasena: 'clave1234' }),
      ),
    );
    const estados = respuestas.map((r) => r.status).sort();
    expect(estados).toEqual([201, 409, 409]);
    for (const r of respuestas.filter((x) => x.status === 409)) {
      esperarError(r, 409, 'EMAIL_YA_REGISTRADO');
      mensajeParaPersonas(r);
    }
  });
});

describe('AGENTS §7.2 / §6 — El token vence justo a los 30 días del Reloj', () => {
  it('un segundo antes sirve; un segundo después, 401', async () => {
    const res = await registro({
      nombre: 'Ana',
      email: unico(),
      contrasena: 'clave1234',
    });
    const auth: [string, string] = [
      'Authorization',
      `Bearer ${res.body.datos.token}`,
    ];
    ctx.reloj.mover('2026-10-14T09:59:59-03:00');
    const antes = await ctx
      .http()
      .get('/yo')
      .set(...auth);
    expect(antes.status).toBe(200);
    esperarContrato(antes, 'Usuario');
    ctx.reloj.mover('2026-10-14T10:00:01-03:00');
    esperarError(
      await ctx
        .http()
        .get('/yo')
        .set(...auth),
      401,
      'NO_AUTENTICADO',
    );
  });

  it('el usuario del registro es el mismo que devuelve /yo con ese token', async () => {
    const res = await registro({
      nombre: 'Ana',
      email: unico(),
      contrasena: 'clave1234',
      telefono: '3446 55',
    });
    const yo = await ctx
      .http()
      .get('/yo')
      .set('Authorization', `Bearer ${res.body.datos.token}`);
    esperarContrato(yo, 'Usuario');
    expect(yo.body.datos).toEqual(res.body.datos.usuario);
  });
});

describe('AGENTS §7.3 — Entrada adversarial en PATCH /yo', () => {
  it('__proto__ en el cuerpo no cambia el rol ni rompe la API', async () => {
    const v = await crearVecino(ctx);
    const res = await ctx
      .http()
      .patch('/yo')
      .set(...v.auth)
      .set('Content-Type', 'application/json')
      .send('{"__proto__":{"rol":"operador"},"constructor":{"x":1}}');
    expect(res.status).toBeLessThan(500);
    const yo = await ctx
      .http()
      .get('/yo')
      .set(...v.auth);
    expect(yo.body.datos.rol).toBe('vecino');
  });

  it('AGENTS §5.3 — textos enormes: 400 con mensaje en castellano, nunca 500', async () => {
    const v = await crearVecino(ctx);
    const res = await ctx
      .http()
      .patch('/yo')
      .set(...v.auth)
      .send({ nombre: 'n'.repeat(1000), telefono: '1'.repeat(500) });
    esperarError(res, 400, 'VALIDACION_FALLIDA');
    mensajeParaPersonas(res);
  });

  it('telefono null borra el teléfono (P1)', async () => {
    const v = await crearVecino(ctx, { telefono: '3446 1' });
    const res = await ctx
      .http()
      .patch('/yo')
      .set(...v.auth)
      .send({ telefono: null });
    expect(res.status).toBe(200);
    esperarContrato(res, 'Usuario');
    expect(res.body.datos.telefono).toBeNull();
  });

  it('telefono de sólo espacios nunca queda como texto en blanco', async () => {
    const v = await crearVecino(ctx, { telefono: '3446 1' });
    const res = await ctx
      .http()
      .patch('/yo')
      .set(...v.auth)
      .send({ telefono: '   ' });
    if (res.status === 200) {
      esperarContrato(res, 'Usuario');
      expect(res.body.datos.telefono).toBeNull();
    } else {
      esperarError(res, 400, 'VALIDACION_FALLIDA');
    }
  });

  it('la respuesta del PATCH es lo que queda guardado', async () => {
    const v = await crearVecino(ctx);
    const res = await ctx
      .http()
      .patch('/yo')
      .set(...v.auth)
      .send({ nombre: 'Norma', telefono: '3446 9', avisosActivos: false });
    const yo = await ctx
      .http()
      .get('/yo')
      .set(...v.auth);
    expect(yo.body.datos).toEqual(res.body.datos);
  });
});

describe('AGENTS §4.6 / §7.3 — El mensaje de validación dice qué está mal, sin confundir', () => {
  it.each([
    ['PATCH /yo teléfono numérico', 'patch', { telefono: 5 }],
    [
      'registro con teléfono numérico',
      'registro',
      { nombre: 'Ana', contrasena: 'clave1234', telefono: 5 },
    ],
  ])(
    '%s: nombra el teléfono y no dice que es "demasiado largo"',
    async (_caso, donde, cuerpo) => {
      let res: Response;
      if (donde === 'patch') {
        const v = await crearVecino(ctx);
        res = await ctx
          .http()
          .patch('/yo')
          .set(...v.auth)
          .send(cuerpo);
      } else {
        res = await registro({ email: unico(), ...cuerpo });
      }
      esperarError(res, 400, 'VALIDACION_FALLIDA');
      expect(res.body.error.mensaje).toMatch(/tel[eé]fono/i);
      expect(res.body.error.mensaje).not.toMatch(/demasiado larg/i);
    },
  );

  it.each([
    ['PATCH /yo', { avisosActivos: 'si' }],
    ['POST /dispositivos', { tokenExpo: 'x', plataforma: 'ios' }],
    [
      'POST /dispositivos',
      { tokenExpo: 'ExponentPushToken[x]', plataforma: 'web' },
    ],
  ])('%s %j: sin nombres de campo en camelCase', async (ruta2, cuerpo) => {
    const v = await crearVecino(ctx);
    const req =
      ruta2 === 'PATCH /yo'
        ? ctx.http().patch('/yo')
        : ctx.http().post('/dispositivos');
    const res = await req.set(...v.auth).send(cuerpo);
    esperarError(res, 400, 'VALIDACION_FALLIDA');
    mensajeParaPersonas(res);
    expect(res.body.error.mensaje).not.toMatch(/\b[a-z]+[A-Z][a-zA-Z]*\b/);
  });
});

describe('AGENTS §17.1 — GET /archivos/<clave>: cabeceras y rangos raros', () => {
  let url: string;
  beforeAll(async () => {
    const v = await crearVecino(ctx);
    const res = await ctx
      .http()
      .post('/archivos')
      .set(...v.auth)
      .attach('archivo', jpegNumerado(1000), 'foto.jpg');
    url = ruta(res.body.datos.url);
  });

  it('206 también trae ETag, Cache-Control inmutable y Accept-Ranges', async () => {
    const res = await binario(ctx.http().get(url).set('Range', 'bytes=10-19'));
    expect(res.status).toBe(206);
    expect(res.headers['etag']).toBeTruthy();
    expect(res.headers['cache-control']).toBe(
      'public, max-age=31536000, immutable',
    );
    expect(res.headers['accept-ranges']).toBe('bytes');
  });

  it('HEAD da 200 con el tamaño y sin cuerpo', async () => {
    const res = await ctx.http().head(url);
    expect(res.status).toBe(200);
    expect(res.headers['content-length']).toBe('1000');
    expect(res.headers['content-type']).toBe('image/jpeg');
  });

  it.each(['bytes=abc', 'bytes=0-1,5-6', 'bytes=5-2', 'bytes=-0', 'bytes='])(
    'Range %s: nunca 500; si es error, el sobre de error',
    async (rango) => {
      const res = await binario(ctx.http().get(url).set('Range', rango));
      expect([200, 206, 416]).toContain(res.status);
      if (res.status === 416) {
        expect(res.headers['content-range']).toBe('bytes */1000');
        const cuerpo = JSON.parse((res.body as Buffer).toString('utf8'));
        expect(Object.keys(cuerpo)).toEqual(['error']);
        expect(cuerpo.error.codigo).toBe('RANGO_NO_SATISFACIBLE');
      }
    },
  );

  it.each([
    '/archivos/imagenes/2026/09/%00.jpg',
    `/archivos/imagenes/2026/09/${'x'.repeat(2000)}.jpg`,
    '/archivos/imagenes/2026/09/%E0%A4%A.jpg',
  ])('clave rara %s: 4xx con sobre, no 500', async (camino) => {
    const res = await ctx.http().get(camino);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(Object.keys(res.body)).toEqual(['error']);
  });

  it('POST /archivos con JSON en vez de multipart: 400, no 500', async () => {
    const v = await crearVecino(ctx);
    const res = await ctx
      .http()
      .post('/archivos')
      .set(...v.auth)
      .send({ archivo: 'data:image/jpeg;base64,AAAA' });
    esperarError(res, 400, 'VALIDACION_FALLIDA');
    mensajeParaPersonas(res);
  });
});

describe('AGENTS §11.4 — CORS, /salud y simulación', () => {
  it('la verificación previa de CORS de una ruta con sesión no pide token', async () => {
    const res = await ctx
      .http()
      .options('/yo')
      .set('Origin', 'http://localhost:8081')
      .set('Access-Control-Request-Method', 'PATCH')
      .set('Access-Control-Request-Headers', 'authorization,content-type');
    expect(res.status).toBeLessThan(300);
    expect(res.headers['access-control-allow-origin']).toBeTruthy();
  });

  it('/salud informa el motor con el que está corriendo y el almacén local', async () => {
    const res = await ctx.http().get('/salud');
    esperarContrato(res, 'Salud');
    expect(res.body.datos.motor).toBe(process.env.DB_MOTOR ?? 'better-sqlite3');
    expect(res.body.datos.almacen).toBe('local');
    expect(res.body.datos.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  describe('prendida', () => {
    let sim: AppDePrueba;
    beforeAll(async () => {
      sim = await crearApp({ entorno: { SIMULACION_HABILITADA: 'true' } });
    });
    afterAll(() => sim.cerrar());

    it.each(['demora-abc', 'error-404', ''])(
      'X-Simular "%s" no rompe nada: /salud responde 200',
      async (valor) => {
        const res = await sim.http().get('/salud').set('X-Simular', valor);
        expect(res.status).toBe(200);
        esperarContrato(res, 'Salud');
      },
    );

    it('error-500 en una ruta con sesión, sin token: sobre de ERROR_INTERNO', async () => {
      const res = await sim
        .http()
        .patch('/yo')
        .set('X-Simular', 'error-500')
        .send({});
      esperarError(res, 500, 'ERROR_INTERNO');
    });
  });
});

describe('AGENTS §11.5 — Swagger documenta los códigos de error de M0', () => {
  it.each([
    ['/auth/registro', 'post', ['EMAIL_YA_REGISTRADO', 'VALIDACION_FALLIDA']],
    ['/auth/ingreso', 'post', ['CREDENCIALES_INVALIDAS']],
    ['/yo', 'get', ['NO_AUTENTICADO']],
    [
      '/archivos',
      'post',
      ['ARCHIVO_DEMASIADO_GRANDE', 'TIPO_DE_ARCHIVO_NO_PERMITIDO'],
    ],
    [
      '/archivos/{clave}',
      'get',
      ['ARCHIVO_NO_ENCONTRADO', 'RANGO_NO_SATISFACIBLE'],
    ],
  ])('%s %s menciona %j', async (camino, metodo, codigos) => {
    const res = await ctx.http().get('/docs-json');
    const op = res.body.paths[camino]?.[metodo];
    expect(op).toBeDefined();
    const texto = JSON.stringify(op);
    for (const c of codigos) expect(texto, c).toContain(c);
  });

  it('las rutas públicas no piden sesión en Swagger', async () => {
    const res = await ctx.http().get('/docs-json');
    const p = res.body.paths;
    for (const [c, m] of [
      ['/salud', 'get'],
      ['/auth/registro', 'post'],
      ['/auth/ingreso', 'post'],
      ['/archivos/{clave}', 'get'],
    ]) {
      const sec = p[c][m].security as unknown[] | undefined;
      expect(sec === undefined || sec.length === 0, `${m} ${c}`).toBe(true);
    }
  });
});

// ============================================================================
// Segunda pasada
// ============================================================================

describe('AGENTS §4.1 — Métodos no soportados sobre rutas existentes', () => {
  it.each([
    ['PUT', '/yo'],
    ['DELETE', '/yo'],
    ['GET', '/auth/registro'],
    ['PATCH', '/salud'],
  ])(
    '%s %s devuelve el sobre de error, no el de Express',
    async (metodo, r) => {
      const v = await crearVecino(ctx);
      const pedido = ctx
        .http()
        [metodo.toLowerCase() as 'put' | 'delete' | 'get' | 'patch'](r)
        .set(...v.auth);
      const res = await pedido;
      expect([404, 405]).toContain(res.status);
      expect(Object.keys(res.body)).toEqual(['error']);
      expect(Object.keys(res.body.error).sort()).toEqual(['codigo', 'mensaje']);
      mensajeParaPersonas(res);
    },
  );
});

describe('AGENTS §7.3 — Cabecera Authorization mal armada', () => {
  it.each([
    ['dos tokens', (t: string) => `Bearer ${t} ${t}`],
    ['token con basura al final', (t: string) => `Bearer ${t}x`],
    ['token sin el esquema', (t: string) => t],
  ])('401 NO_AUTENTICADO con %s', async (_caso, armar) => {
    const v = await crearVecino(ctx);
    const token = v.auth[1].replace(/^Bearer /, '');
    const res = await ctx.http().get('/yo').set('Authorization', armar(token));
    esperarError(res, 401, 'NO_AUTENTICADO');
    mensajeParaPersonas(res);
  });
});

describe('AGENTS §7.1 — El esquema Bearer no distingue mayúsculas (RFC 7235)', () => {
  it.each([['bearer'], ['BEARER']])('acepta «%s <token>»', async (esquema) => {
    const v = await crearVecino(ctx);
    const token = v.auth[1].replace(/^Bearer /, '');
    const res = await ctx
      .http()
      .get('/yo')
      .set('Authorization', `${esquema} ${token}`);
    expect(res.status).toBe(200);
    esperarContrato(res.body, 'Usuario');
  });
});
