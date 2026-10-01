// Verificación independiente del M0 — Base (AGENTS §12). Caja negra: sólo HTTP, más los
// builders de test/utilidades/. Cada describe nombra la regla que prueba.
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'supertest';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { jpeg, mp4, png } from '../utilidades/archivos.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { crearUsuario, registrar, type UsuarioDePrueba } from '../utilidades/usuarios.js';

const DIA = 24 * 60 * 60 * 1000;
const SECRETO = 'secreto-de-los-tests';

const JERGA =
  /\b(must|should|property|undefined|null|string|number|boolean|array|object|Bad Request|Unauthorized|Forbidden|Not Found|Internal Server|Error:|exception|Cannot|SQLITE|QueryFailed|duplicate|constraint|jwt|token expired|whitelist)\b/i;

/** esperarError + mensaje en castellano, sin jerga técnica (AGENTS §4.6). */
function esperarErrorLimpio(r: { status: number; body: unknown }, estado: number, codigo: string) {
  esperarError(r, estado, codigo);
  const { mensaje } = (r.body as { error: { mensaje: string } }).error;
  expect(mensaje).not.toMatch(JERGA);
  expect(Object.keys(r.body as object)).toEqual(['error']);
  expect(Object.keys((r.body as { error: object }).error).sort()).toEqual(['codigo', 'mensaje']);
}

function binario(respuesta: Response, listo: (error: Error | null, cuerpo: Buffer) => void) {
  const partes: Buffer[] = [];
  respuesta.on('data', (parte: Buffer) => partes.push(parte));
  respuesta.on('end', () => listo(null, Buffer.concat(partes)));
}

function decodificar(token: string): {
  cabecera: Record<string, unknown>;
  carga: Record<string, unknown>;
} {
  const [c, p] = token.split('.');
  return {
    cabecera: JSON.parse(Buffer.from(c, 'base64url').toString('utf8')) as Record<string, unknown>,
    carga: JSON.parse(Buffer.from(p, 'base64url').toString('utf8')) as Record<string, unknown>,
  };
}

let n = 0;
const tokenExpo = () =>
  `ExponentPushToken[verif-${++n}-${Math.random().toString(36).slice(2, 10)}]`;
const emailNuevo = () => `verif${++n}-${Math.random().toString(36).slice(2, 8)}@prueba.ar`;

let ctx: AppDePrueba;
beforeAll(async () => {
  ctx = await crearApp();
});
afterAll(() => ctx.cerrar());
beforeEach(() => {
  ctx.notificador.vaciar();
});

// ---------------------------------------------------------------------------------------------

describe('AGENTS §7.1 — POST /auth/registro: entrada', () => {
  const valido = () => ({ nombre: 'Ana Pérez', email: emailNuevo(), contrasena: 'clave-segura' });

  it.each([
    ['sin cuerpo', {}],
    ['sin nombre', { email: 'x@prueba.ar', contrasena: 'clave-segura' }],
    ['sin email', { nombre: 'Ana', contrasena: 'clave-segura' }],
    ['sin contraseña', { nombre: 'Ana', email: 'x@prueba.ar' }],
    ['nombre vacío', { nombre: '', email: 'x@prueba.ar', contrasena: 'clave-segura' }],
    ['nombre sólo espacios', { nombre: '   ', email: 'x@prueba.ar', contrasena: 'clave-segura' }],
    ['nombre número', { nombre: 123, email: 'x@prueba.ar', contrasena: 'clave-segura' }],
    ['nombre null', { nombre: null, email: 'x@prueba.ar', contrasena: 'clave-segura' }],
    ['email inválido', { nombre: 'Ana', email: 'no-es-un-email', contrasena: 'clave-segura' }],
    ['email vacío', { nombre: 'Ana', email: '', contrasena: 'clave-segura' }],
    ['contraseña de 7', { nombre: 'Ana', email: 'x@prueba.ar', contrasena: '1234567' }],
    ['contraseña número', { nombre: 'Ana', email: 'x@prueba.ar', contrasena: 12345678 }],
    [
      'campo de más: id',
      { id: 'usr-mio', nombre: 'Ana', email: 'x@prueba.ar', contrasena: 'clave-segura' },
    ],
    [
      'campo de más: avisosActivos',
      { avisosActivos: false, nombre: 'Ana', email: 'x@prueba.ar', contrasena: 'clave-segura' },
    ],
    [
      'campo de más: lineasFavoritas',
      {
        lineasFavoritas: ['lin-05'],
        nombre: 'Ana',
        email: 'x@prueba.ar',
        contrasena: 'clave-segura',
      },
    ],
  ])('%s → 400 VALIDACION_FALLIDA en castellano', async (_caso, cuerpo) => {
    const r = await ctx.http.post('/auth/registro').send(cuerpo);
    esperarErrorLimpio(r, 400, 'VALIDACION_FALLIDA');
  });

  it('un arreglo como cuerpo → 400', async () => {
    const r = await ctx.http.post('/auth/registro').send([valido()]);
    esperarErrorLimpio(r, 400, 'VALIDACION_FALLIDA');
  });

  it('contraseña de exactamente 8 caracteres entra (mínimo 8, AGENTS §7.2)', async () => {
    const r = await ctx.http
      .post('/auth/registro')
      .send({ ...valido(), contrasena: '12345678' })
      .expect(201);
    esperarContrato(r.body, 'Sesion');
  });

  it('un nombre enorme no rompe la API (nunca 500)', async () => {
    const r = await ctx.http.post('/auth/registro').send({ ...valido(), nombre: 'A'.repeat(5000) });
    expect(r.status).toBeLessThan(500);
    if (r.status === 201) esperarContrato(r.body, 'Sesion');
    else esperarErrorLimpio(r, 400, 'VALIDACION_FALLIDA');
  });

  it('un email enorme no rompe la API (nunca 500)', async () => {
    const r = await ctx.http
      .post('/auth/registro')
      .send({ ...valido(), email: `${'a'.repeat(400)}@prueba.ar` });
    expect(r.status).toBeLessThan(500);
    if (r.status === 201) esperarContrato(r.body, 'Sesion');
    else esperarErrorLimpio(r, 400, 'VALIDACION_FALLIDA');
  });

  it('una contraseña enorme no rompe la API (nunca 500)', async () => {
    const r = await ctx.http
      .post('/auth/registro')
      .send({ ...valido(), contrasena: 'x'.repeat(20000) });
    expect(r.status).toBeLessThan(500);
  });

  it('el cuerpo como texto plano (sin JSON) → 400, no 500', async () => {
    const r = await ctx.http
      .post('/auth/registro')
      .set('Content-Type', 'text/plain')
      .send('nombre=Ana');
    esperarErrorLimpio(r, 400, 'VALIDACION_FALLIDA');
  });
});

describe('AGENTS §7.1 y §4.1 — POST /auth/registro: salida', () => {
  it('201, sobre con meta null, y el Usuario inicial de espec. §1 con todos los campos', async () => {
    const email = emailNuevo();
    const r = await ctx.http
      .post('/auth/registro')
      .send({ nombre: 'Ana Pérez', email, contrasena: 'clave-segura' })
      .expect(201);
    esperarContrato(r.body, 'Sesion');
    expect(r.body.meta).toBeNull();
    expect(Object.keys(r.body.datos).sort()).toEqual(['token', 'usuario']);
    const u = r.body.datos.usuario;
    expect(u.id).toMatch(/^usr-[a-z0-9]{12}$/);
    expect(u).toEqual({
      id: u.id,
      nombre: 'Ana Pérez',
      email,
      lineasFavoritas: [],
      paradasFavoritas: [],
      avisosActivos: true,
      tema: 'sistema',
    });
    expect(r.headers['content-type']).toMatch(/application\/json/);
  });

  it('AGENTS §7.2 — el token es HS256, con sub = id, rol pasajero y 30 días exactos', async () => {
    const s = await registrar(ctx);
    const { cabecera, carga } = decodificar(s.token);
    expect(cabecera.alg).toBe('HS256');
    expect(carga.sub).toBe(s.usuario.id);
    expect(carga.rol).toBe('pasajero');
    expect(typeof carga.exp).toBe('number');
    expect(typeof carga.iat).toBe('number');
    expect((carga.exp as number) - (carga.iat as number)).toBe(30 * 24 * 60 * 60);
    // emitido según el reloj de la API
    expect((carga.iat as number) * 1000).toBe(ctx.reloj.ahora().getTime());
    // el token no lleva datos privados
    expect(JSON.stringify(carga)).not.toMatch(/contrasena|hash|password/i);
  });

  it('dos registros con ids distintos', async () => {
    const [a, b] = await Promise.all([registrar(ctx), registrar(ctx)]);
    expect(a.usuario.id).not.toBe(b.usuario.id);
  });
});

describe('AGENTS §5.5 — concurrencia: email único sin distinguir mayúsculas', () => {
  it('cinco registros simultáneos con el mismo email en mayúsculas distintas → uno solo', async () => {
    const base = emailNuevo();
    const variantes = [base, base.toUpperCase(), ` ${base}`, base.replace(/^v/, 'V'), base];
    const rs = await Promise.all(
      variantes.map((email) =>
        ctx.http.post('/auth/registro').send({ nombre: 'Ana', email, contrasena: 'clave-segura' }),
      ),
    );
    const estados = rs.map((r) => r.status).sort();
    expect(estados).toEqual([201, 409, 409, 409, 409]);
    for (const r of rs.filter((x) => x.status === 409)) {
      esperarErrorLimpio(r, 409, 'EMAIL_YA_REGISTRADO');
    }
  });
});

// ---------------------------------------------------------------------------------------------

describe('AGENTS §7.1 — POST /auth/ingreso', () => {
  it('200 (no 201), sobre Sesion con meta null', async () => {
    const u = await crearUsuario(ctx, { contrasena: 'clave-de-ana' });
    const r = await ctx.http
      .post('/auth/ingreso')
      .send({ email: u.email, contrasena: 'clave-de-ana' });
    expect(r.status).toBe(200);
    esperarContrato(r.body, 'Sesion');
    expect(r.body.datos.usuario.id).toBe(u.id);
  });

  it('D1 — una cuenta de la Dirección ingresa con rol direccion en el token, pero el Usuario no lo muestra', async () => {
    const u = await crearUsuario(ctx, { rol: 'direccion', contrasena: 'clave-direccion' });
    const r = await ctx.http
      .post('/auth/ingreso')
      .send({ email: u.email, contrasena: 'clave-direccion' })
      .expect(200);
    esperarContrato(r.body, 'Sesion');
    expect(decodificar(r.body.datos.token as string).carga.rol).toBe('direccion');
    expect(JSON.stringify(r.body)).not.toMatch(/direccion"/);
  });

  it.each([
    ['sin contraseña', { email: 'a@prueba.ar' }],
    ['sin email', { contrasena: 'clave-segura' }],
    ['email número', { email: 5, contrasena: 'clave-segura' }],
    ['campo de más', { email: 'a@prueba.ar', contrasena: 'clave-segura', recordarme: true }],
  ])('%s → 400 VALIDACION_FALLIDA', async (_caso, cuerpo) => {
    esperarErrorLimpio(
      await ctx.http.post('/auth/ingreso').send(cuerpo),
      400,
      'VALIDACION_FALLIDA',
    );
  });

  it('contraseña con otra capitalización → CREDENCIALES_INVALIDAS (la contraseña sí distingue)', async () => {
    const u = await crearUsuario(ctx, { contrasena: 'ClaveDeAna' });
    esperarErrorLimpio(
      await ctx.http.post('/auth/ingreso').send({ email: u.email, contrasena: 'clavedeana' }),
      401,
      'CREDENCIALES_INVALIDAS',
    );
  });

  it('una contraseña enorme no rompe (401, nunca 500)', async () => {
    const u = await crearUsuario(ctx);
    const r = await ctx.http
      .post('/auth/ingreso')
      .send({ email: u.email, contrasena: 'x'.repeat(20000) });
    expect(r.status).toBeLessThan(500);
    expect([400, 401]).toContain(r.status);
  });

  it('registro → ingreso con la misma contraseña, email en mayúsculas', async () => {
    const email = emailNuevo();
    await registrar(ctx, { email, contrasena: 'otra-clave-1' });
    const r = await ctx.http
      .post('/auth/ingreso')
      .send({ email: email.toUpperCase(), contrasena: 'otra-clave-1' })
      .expect(200);
    esperarContrato(r.body, 'Sesion');
    expect(r.body.datos.usuario.email).toBe(email);
  });
});

// ---------------------------------------------------------------------------------------------

describe('AGENTS §7.2 y §7.3 — tokens que no sirven → 401 NO_AUTENTICADO', () => {
  let u: UsuarioDePrueba;
  beforeAll(async () => {
    u = await crearUsuario(ctx);
  });

  const ahoraSeg = () => Math.floor(ctx.reloj.ahora().getTime() / 1000);

  it('alg "none" (sin firma)', async () => {
    const c = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const p = Buffer.from(
      JSON.stringify({ sub: u.id, rol: 'direccion', iat: ahoraSeg(), exp: ahoraSeg() + 3600 }),
    ).toString('base64url');
    esperarErrorLimpio(
      await ctx.http.get('/yo').set('Authorization', `Bearer ${c}.${p}.`),
      401,
      'NO_AUTENTICADO',
    );
  });

  it('firma adulterada (payload cambiado)', async () => {
    const [c, , f] = u.token.split('.');
    const p = Buffer.from(
      JSON.stringify({ sub: u.id, rol: 'direccion', iat: ahoraSeg(), exp: ahoraSeg() + 3600 }),
    ).toString('base64url');
    esperarErrorLimpio(
      await ctx.http.get('/yo').set('Authorization', `Bearer ${c}.${p}.${f}`),
      401,
      'NO_AUTENTICADO',
    );
  });

  it('bien firmado pero sin sub', async () => {
    const t = await new JwtService({ secret: SECRETO }).signAsync({
      rol: 'pasajero',
      iat: ahoraSeg(),
      exp: ahoraSeg() + 3600,
    });
    esperarErrorLimpio(
      await ctx.http.get('/yo').set('Authorization', `Bearer ${t}`),
      401,
      'NO_AUTENTICADO',
    );
  });

  it('bien firmado pero ya vencido según el reloj de la API', async () => {
    const t = await new JwtService({ secret: SECRETO }).signAsync(
      { rol: 'pasajero', iat: ahoraSeg() - 31 * 86400, exp: ahoraSeg() - 1 },
      { subject: u.id },
    );
    esperarErrorLimpio(
      await ctx.http.get('/yo').set('Authorization', `Bearer ${t}`),
      401,
      'NO_AUTENTICADO',
    );
  });

  it('bien firmado con HS512 en vez de HS256', async () => {
    const t = await new JwtService({ secret: SECRETO }).signAsync(
      { rol: 'pasajero', iat: ahoraSeg(), exp: ahoraSeg() + 3600 },
      { subject: u.id, algorithm: 'HS512' },
    );
    const r = await ctx.http.get('/yo').set('Authorization', `Bearer ${t}`);
    esperarErrorLimpio(r, 401, 'NO_AUTENTICADO');
  });

  it('el mismo token en POST /archivos, POST /dispositivos y /dispositivos/prueba', async () => {
    const malo = { Authorization: 'Bearer a.b.c' };
    esperarErrorLimpio(
      await ctx.http.post('/archivos').set(malo).attach('archivo', jpeg(), 'f.jpg'),
      401,
      'NO_AUTENTICADO',
    );
    esperarErrorLimpio(
      await ctx.http
        .post('/dispositivos')
        .set(malo)
        .send({ tokenExpo: tokenExpo(), plataforma: 'ios' }),
      401,
      'NO_AUTENTICADO',
    );
    esperarErrorLimpio(
      await ctx.http.post('/dispositivos/prueba').set(malo),
      401,
      'NO_AUTENTICADO',
    );
    esperarErrorLimpio(
      await ctx.http.delete(`/dispositivos/${encodeURIComponent(tokenExpo())}`).set(malo),
      401,
      'NO_AUTENTICADO',
    );
  });

  it('C4 — 23:59 del 31/12: el token vence justo a los 30 días, cruzando el año', async () => {
    const antes = ctx.reloj.ahora();
    try {
      ctx.reloj.fijar('2026-12-31T23:59:59-03:00');
      const s = await registrar(ctx);
      const auth = { Authorization: `Bearer ${s.token}` };
      ctx.reloj.fijar('2027-01-01T00:00:00-03:00');
      await ctx.http.get('/yo').set(auth).expect(200);
      ctx.reloj.fijar(new Date(new Date('2026-12-31T23:59:59-03:00').getTime() + 30 * DIA - 1000));
      await ctx.http.get('/yo').set(auth).expect(200);
      ctx.reloj.fijar(new Date(new Date('2026-12-31T23:59:59-03:00').getTime() + 30 * DIA));
      esperarErrorLimpio(await ctx.http.get('/yo').set(auth), 401, 'NO_AUTENTICADO');
    } finally {
      ctx.reloj.fijar(antes);
    }
  });
});

describe('RFC 7235 — el esquema de Authorization no distingue mayúsculas', () => {
  it.each([['bearer'], ['BEARER'], ['Bearer']])('%s <token> → 200 en GET /yo', async (esquema) => {
    const u = await crearUsuario(ctx);
    const r = await ctx.http.get('/yo').set('Authorization', `${esquema} ${u.token}`);
    expect(r.status).toBe(200);
    esperarContrato(r.body, 'Usuario');
  });

  it('bearer en minúsculas con un token basura sigue siendo 401', async () => {
    esperarErrorLimpio(
      await ctx.http.get('/yo').set('Authorization', 'bearer basura'),
      401,
      'NO_AUTENTICADO',
    );
  });

  it('el token solo, sin esquema, → 401', async () => {
    const u = await crearUsuario(ctx);
    esperarErrorLimpio(
      await ctx.http.get('/yo').set('Authorization', u.token),
      401,
      'NO_AUTENTICADO',
    );
  });
});

describe('AGENTS §7.3 — lo público sigue público aunque venga un token roto', () => {
  const basura = { Authorization: 'Bearer esto-no-es-un-jwt' };

  it('GET /salud', async () => {
    const r = await ctx.http.get('/salud').set(basura);
    expect(r.status).toBe(200);
    esperarContrato(r.body, 'Salud');
  });

  it('POST /auth/registro', async () => {
    const r = await ctx.http
      .post('/auth/registro')
      .set(basura)
      .send({ nombre: 'Ana', email: emailNuevo(), contrasena: 'clave-segura' });
    expect(r.status).toBe(201);
  });

  it('POST /auth/ingreso', async () => {
    const u = await crearUsuario(ctx);
    const r = await ctx.http
      .post('/auth/ingreso')
      .set(basura)
      .send({ email: u.email, contrasena: u.contrasena });
    expect(r.status).toBe(200);
  });

  it('GET /archivos/<clave>', async () => {
    const u = await crearUsuario(ctx);
    const url = (await ctx.http.post('/archivos').set(u.auth).attach('archivo', png(), 'f.png'))
      .body.datos.url as string;
    await ctx.http.get(new URL(url).pathname).set(basura).expect(200);
  });
});

// ---------------------------------------------------------------------------------------------

describe('AGENTS §7.1 y DECISIONES A5 — /yo', () => {
  it('GET /yo recién registrado: el Usuario completo, sin campos de más', async () => {
    const s = await registrar(ctx, { nombre: 'Julián Ferrari' });
    const r = await ctx.http.get('/yo').set('Authorization', `Bearer ${s.token}`).expect(200);
    esperarContrato(r.body, 'Usuario');
    expect(r.body).toEqual({ datos: s.usuario, meta: null });
  });

  it('A5 — PATCH /yo existe desde M3: con sesión 200, sin sesión 401', async () => {
    const u = await crearUsuario(ctx);
    const r = await ctx.http.patch('/yo').set(u.auth).send({ nombre: 'Otro' }).expect(200);
    esperarContrato(r.body, 'Usuario');
    esperarErrorLimpio(await ctx.http.patch('/yo').send({ nombre: 'Otro' }), 401, 'NO_AUTENTICADO');
  });

  it('otros métodos sobre rutas de M0 → 404 RUTA_NO_ENCONTRADA', async () => {
    esperarErrorLimpio(await ctx.http.delete('/salud'), 404, 'RUTA_NO_ENCONTRADA');
    esperarErrorLimpio(await ctx.http.get('/auth/registro'), 404, 'RUTA_NO_ENCONTRADA');
    esperarErrorLimpio(await ctx.http.put('/yo'), 404, 'RUTA_NO_ENCONTRADA');
    esperarErrorLimpio(await ctx.http.get('/dispositivos'), 404, 'RUTA_NO_ENCONTRADA');
  });

  it('las rutas de módulos futuros no existen todavía (sin adelantar trabajo)', async () => {
    esperarErrorLimpio(await ctx.http.get('/avisos'), 404, 'RUTA_NO_ENCONTRADA');
  });
});

// ---------------------------------------------------------------------------------------------

describe('AGENTS §8 — POST /archivos: adversarial', () => {
  let u: UsuarioDePrueba;
  beforeAll(async () => {
    u = await crearUsuario(ctx);
  });
  const subir = (contenido: Buffer, nombre = 'archivo.bin') =>
    ctx.http.post('/archivos').set(u.auth).attach('archivo', contenido, nombre);

  it('webp (permitido en §8) → 201 imagen', async () => {
    const b = Buffer.alloc(1024, 7);
    b.write('RIFF', 0, 'latin1');
    b.writeUInt32LE(1016, 4);
    b.write('WEBPVP8 ', 8, 'latin1');
    const r = await subir(b, 'foto.webp');
    expect(r.status).toBe(201);
    esperarContrato(r.body, 'ArchivoSubido');
    expect(r.body.datos.tipo).toBe('imagen');
    expect(r.body.datos.url).toMatch(/\/imagenes\/.+\.webp$/);
  });

  it('aac en ADTS (permitido en §8) → 201 audio', async () => {
    const b = Buffer.alloc(2048, 0);
    // cabecera ADTS: sync 0xFFF, MPEG-4, sin CRC
    Buffer.from([0xff, 0xf1, 0x50, 0x80, 0x10, 0x1f, 0xfc]).copy(b);
    const r = await subir(b, 'audio.aac');
    expect(r.status).toBe(201);
    esperarContrato(r.body, 'ArchivoSubido');
    expect(r.body.datos.tipo).toBe('audio');
  });

  it('un archivo vacío (0 bytes) → error 4xx con sobre, no 201 ni 500', async () => {
    const r = await subir(Buffer.alloc(0), 'vacio.jpg');
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.status).toBeLessThan(500);
    esperarError(r, r.status, r.body?.error?.codigo as string);
  });

  it('la firma manda sobre la extensión: un JPEG llamado .png sale como .jpg', async () => {
    const r = await subir(jpeg(), 'mentira.png').expect(201);
    expect(r.body.datos.url).toMatch(/\.jpg$/);
  });

  it('JSON en vez de multipart → 400 VALIDACION_FALLIDA', async () => {
    const r = await ctx.http.post('/archivos').set(u.auth).send({ archivo: 'aGVsbG8=' });
    esperarErrorLimpio(r, 400, 'VALIDACION_FALLIDA');
  });

  it('el mismo contenido dos veces → dos claves distintas (la clave no se reutiliza)', async () => {
    const c = jpeg();
    const a = await subir(c, 'a.jpg').expect(201);
    const b = await subir(c, 'a.jpg').expect(201);
    expect(a.body.datos.url).not.toBe(b.body.datos.url);
  });

  it('bytes coincide con el Content-Length al bajar, y el tipo con el Content-Type', async () => {
    const c = png(4321);
    const r = await subir(c, 'x.png').expect(201);
    expect(r.body.datos.bytes).toBe(4321);
    const g = await ctx.http.get(new URL(r.body.datos.url as string).pathname).expect(200);
    expect(g.headers['content-length']).toBe('4321');
    expect(g.headers['content-type']).toBe('image/png');
  });

  it.each([
    ['2026-12-31T23:59:59-03:00', '/imagenes/2026/12/'],
    ['2027-01-01T00:00:00-03:00', '/imagenes/2027/01/'],
    ['2026-10-31T23:59:00-03:00', '/imagenes/2026/10/'],
    ['2026-11-01T00:00:00-03:00', '/imagenes/2026/11/'],
  ])('AGENTS §6 — con el reloj en %s la clave va en %s', async (instante, carpeta) => {
    const antes = ctx.reloj.ahora();
    try {
      ctx.reloj.fijar(instante);
      // el usuario se crea con el reloj ya movido, para que su sesión esté vigente
      const otro = await crearUsuario(ctx);
      const r = await ctx.http
        .post('/archivos')
        .set(otro.auth)
        .attach('archivo', jpeg(), 'f.jpg')
        .expect(201);
      expect(r.body.datos.url).toContain(carpeta);
    } finally {
      ctx.reloj.fijar(antes);
    }
  });

  it('la URL no lleva el nombre original ni caracteres raros', async () => {
    const r = await subir(jpeg(), 'mi foto ñandú (1).jpg').expect(201);
    expect(r.body.datos.url).toMatch(
      /^http:\/\/[^/]+\/archivos\/imagenes\/\d{4}\/\d{2}\/[a-z0-9]+\.jpg$/,
    );
  });
});

describe('AGENTS §8 y §17.1 — GET /archivos/<clave> con Range: bordes', () => {
  let ruta: string;
  const contenido = mp4(1000);

  beforeAll(async () => {
    const u = await crearUsuario(ctx);
    const r = await ctx.http.post('/archivos').set(u.auth).attach('archivo', contenido, 'v.mp4');
    ruta = new URL(r.body.datos.url as string).pathname;
  });

  const pedir = (rango: string) =>
    ctx.http.get(ruta).set('Range', rango).buffer(true).parse(binario);

  it('bytes=0-0 → 206 con el primer byte', async () => {
    const r = await pedir('bytes=0-0').expect(206);
    expect(r.headers['content-range']).toBe('bytes 0-0/1000');
    expect(r.headers['content-length']).toBe('1');
    expect((r.body as Buffer).equals(contenido.subarray(0, 1))).toBe(true);
  });

  it('bytes=500- (abierto) → 206 hasta el final', async () => {
    const r = await pedir('bytes=500-').expect(206);
    expect(r.headers['content-range']).toBe('bytes 500-999/1000');
    expect((r.body as Buffer).equals(contenido.subarray(500))).toBe(true);
  });

  it('bytes=999-999 → el último byte', async () => {
    const r = await pedir('bytes=999-999').expect(206);
    expect(r.headers['content-range']).toBe('bytes 999-999/1000');
    expect((r.body as Buffer).equals(contenido.subarray(999))).toBe(true);
  });

  it('RFC 9110 — un fin más allá del archivo se recorta: bytes=990-5000 → 206 990-999', async () => {
    const r = await pedir('bytes=990-5000');
    expect(r.status).toBe(206);
    expect(r.headers['content-range']).toBe('bytes 990-999/1000');
    expect((r.body as Buffer).equals(contenido.subarray(990))).toBe(true);
  });

  it('bytes=0-999 (el archivo entero pedido como rango) → 206', async () => {
    const r = await pedir('bytes=0-999').expect(206);
    expect(r.headers['content-range']).toBe('bytes 0-999/1000');
    expect((r.body as Buffer).length).toBe(1000);
  });

  it('bytes=1000- (empieza justo después del final) → 416 con el sobre', async () => {
    const r = await ctx.http.get(ruta).set('Range', 'bytes=1000-');
    esperarErrorLimpio(r, 416, 'RANGO_NO_VALIDO');
    expect(r.headers['content-range']).toBe('bytes */1000');
  });

  it('rango al revés bytes=20-10 nunca da 500', async () => {
    const r = await ctx.http.get(ruta).set('Range', 'bytes=20-10');
    expect([200, 416]).toContain(r.status);
  });

  it('una unidad que no es bytes se ignora → 200 con el archivo entero', async () => {
    const r = await ctx.http.get(ruta).set('Range', 'items=0-5').buffer(true).parse(binario);
    expect(r.status).toBe(200);
    expect((r.body as Buffer).length).toBe(1000);
  });

  it('RFC 9110 §14.2 — varios rangos (bytes=0-1,5-6) se pueden ignorar (200) o servir, pero no son 416', async () => {
    const r = await ctx.http.get(ruta).set('Range', 'bytes=0-1,5-6');
    expect([200, 206]).toContain(r.status);
  });

  it.each([['bytes=abc'], ['bytes='], ['bytes=20-10'], ['Range 0-5'], ['bytes=0-1,5-6']])(
    'A2 — un Range que no se entiende (%s) se ignora → 200 entero, sin Content-Range',
    async (rango) => {
      const r = await pedir(rango);
      expect(r.status).toBe(200);
      expect(r.headers['content-range']).toBeUndefined();
      expect(r.headers['content-length']).toBe('1000');
      expect((r.body as Buffer).equals(contenido)).toBe(true);
    },
  );

  it('RFC 9110 — un sufijo más largo que el archivo (bytes=-5000) → 206 con todo', async () => {
    const r = await pedir('bytes=-5000').expect(206);
    expect(r.headers['content-range']).toBe('bytes 0-999/1000');
    expect((r.body as Buffer).equals(contenido)).toBe(true);
  });

  it('A2 — un sufijo de cero bytes (bytes=-0) es un rango bien escrito imposible → 416', async () => {
    const r = await ctx.http.get(ruta).set('Range', 'bytes=-0');
    esperarErrorLimpio(r, 416, 'RANGO_NO_VALIDO');
    expect(r.headers['content-range']).toBe('bytes */1000');
  });

  it('A2 — bytes=5000-6000 sigue siendo 416 aunque haya un rango ignorado antes', async () => {
    await pedir('bytes=abc').expect(200);
    esperarErrorLimpio(
      await ctx.http.get(ruta).set('Range', 'bytes=5000-6000'),
      416,
      'RANGO_NO_VALIDO',
    );
  });

  it('el ETag es estable entre pedidos', async () => {
    const a = await ctx.http.get(ruta).expect(200);
    const b = await ctx.http.get(ruta).expect(200);
    expect(a.headers.etag).toBe(b.headers.etag);
  });

  it('GET /archivos sin clave → 404 con sobre de error', async () => {
    const r = await ctx.http.get('/archivos');
    expect(r.status).toBe(404);
    esperarError(r, 404, r.body?.error?.codigo as string);
  });

  it('una clave de otra carpeta con nombre válido → 404 ARCHIVO_NO_ENCONTRADO', async () => {
    const otra = ruta.replace('/videos/', '/imagenes/').replace(/\.mp4$/, '.jpg');
    esperarErrorLimpio(await ctx.http.get(otra), 404, 'ARCHIVO_NO_ENCONTRADO');
  });

  it('path traversal codificado dos veces → 404 sin filtrar rutas del disco', async () => {
    const r = await ctx.http.get('/archivos/imagenes/%252e%252e%252f%252e%252e%252fpackage.json');
    expect(r.status).toBe(404);
    expect(JSON.stringify(r.body)).not.toMatch(/\/Users\/|\/tmp\/|package\.json/);
  });
});

// ---------------------------------------------------------------------------------------------

describe('AGENTS §9 y DECISIONES A1 — /dispositivos: adversarial', () => {
  it.each([
    ['tokenExpo vacío', { tokenExpo: '', plataforma: 'ios' }],
    ['tokenExpo número', { tokenExpo: 12345, plataforma: 'ios' }],
    ['tokenExpo null', { tokenExpo: null, plataforma: 'ios' }],
    ['plataforma web', { tokenExpo: 'ExponentPushToken[abc]', plataforma: 'web' }],
    ['plataforma vacía', { tokenExpo: 'ExponentPushToken[abc]', plataforma: '' }],
    ['ExponentPushToken[] vacío', { tokenExpo: 'ExponentPushToken[]', plataforma: 'ios' }],
    [
      'campo de más',
      { tokenExpo: 'ExponentPushToken[abc]', plataforma: 'ios', sincronizado: true },
    ],
  ])('%s → 400 VALIDACION_FALLIDA', async (_caso, cuerpo) => {
    const u = await crearUsuario(ctx);
    esperarErrorLimpio(
      await ctx.http.post('/dispositivos').set(u.auth).send(cuerpo),
      400,
      'VALIDACION_FALLIDA',
    );
  });

  it('el mismo token con otra plataforma: queda uno solo y la respuesta dice la nueva', async () => {
    const u = await crearUsuario(ctx);
    const t = tokenExpo();
    await ctx.http
      .post('/dispositivos')
      .set(u.auth)
      .send({ tokenExpo: t, plataforma: 'ios' })
      .expect(201);
    const r = await ctx.http
      .post('/dispositivos')
      .set(u.auth)
      .send({ tokenExpo: t, plataforma: 'android' })
      .expect(201);
    esperarContrato(r.body, 'Dispositivo');
    expect(r.body.datos).toEqual({ tokenExpo: t, plataforma: 'android' });
    const p = await ctx.http.post('/dispositivos/prueba').set(u.auth).expect(200);
    expect(p.body.datos).toEqual({ enviadas: 1 });
  });

  it('el token que pasa a otra cuenta ya no le llega al dueño anterior', async () => {
    const a = await crearUsuario(ctx);
    const b = await crearUsuario(ctx);
    const t = tokenExpo();
    await ctx.http.post('/dispositivos').set(a.auth).send({ tokenExpo: t, plataforma: 'ios' });
    await ctx.http.post('/dispositivos').set(b.auth).send({ tokenExpo: t, plataforma: 'ios' });
    ctx.notificador.vaciar();
    expect(
      (await ctx.http.post('/dispositivos/prueba').set(a.auth).expect(200)).body.datos,
    ).toEqual({
      enviadas: 0,
    });
    expect(ctx.notificador.enviadas).toEqual([]);
    expect(
      (await ctx.http.post('/dispositivos/prueba').set(b.auth).expect(200)).body.datos,
    ).toEqual({
      enviadas: 1,
    });
    expect(ctx.notificador.enviadas.map((m) => m.tokenExpo)).toEqual([t]);
  });

  it('dos cuentas registran el mismo token a la vez: queda en una sola', async () => {
    const a = await crearUsuario(ctx);
    const b = await crearUsuario(ctx);
    const t = tokenExpo();
    const rs = await Promise.all([
      ctx.http.post('/dispositivos').set(a.auth).send({ tokenExpo: t, plataforma: 'ios' }),
      ctx.http.post('/dispositivos').set(b.auth).send({ tokenExpo: t, plataforma: 'ios' }),
    ]);
    for (const r of rs) expect(r.status).toBeLessThan(500);
    const pa = (await ctx.http.post('/dispositivos/prueba').set(a.auth)).body.datos
      .enviadas as number;
    const pb = (await ctx.http.post('/dispositivos/prueba').set(b.auth)).body.datos
      .enviadas as number;
    expect(pa + pb).toBe(1);
  });

  it('DELETE con el token codificado → 204 y después la prueba ya no le llega', async () => {
    const u = await crearUsuario(ctx);
    const t = tokenExpo();
    await ctx.http.post('/dispositivos').set(u.auth).send({ tokenExpo: t, plataforma: 'android' });
    const d = await ctx.http.delete(`/dispositivos/${encodeURIComponent(t)}`).set(u.auth);
    expect(d.status).toBe(204);
    expect(d.text).toBe('');
    expect(d.headers['content-type']).toBeUndefined();
    const p = await ctx.http.post('/dispositivos/prueba').set(u.auth).expect(200);
    expect(p.body.datos).toEqual({ enviadas: 0 });
  });

  it('DELETE de un token mal formado nunca da 500', async () => {
    const u = await crearUsuario(ctx);
    const r = await ctx.http.delete('/dispositivos/cualquier-cosa').set(u.auth);
    expect([204, 400, 404]).toContain(r.status);
  });

  it('la push de prueba es en castellano, con título y cuerpo no vacíos', async () => {
    const u = await crearUsuario(ctx);
    await ctx.http
      .post('/dispositivos')
      .set(u.auth)
      .send({ tokenExpo: tokenExpo(), plataforma: 'ios' });
    await ctx.http.post('/dispositivos/prueba').set(u.auth).expect(200);
    expect(ctx.notificador.enviadas).toHaveLength(1);
    const m = ctx.notificador.enviadas[0];
    expect(m.titulo.trim()).not.toBe('');
    expect(m.cuerpo.trim()).not.toBe('');
    expect(`${m.titulo} ${m.cuerpo}`).not.toMatch(/\b(test|push notification|hello)\b/i);
  });

  it('la prueba sólo le llega a la cuenta que la pide, no a otros teléfonos', async () => {
    const a = await crearUsuario(ctx);
    const b = await crearUsuario(ctx);
    const ta = tokenExpo();
    await ctx.http.post('/dispositivos').set(a.auth).send({ tokenExpo: ta, plataforma: 'ios' });
    await ctx.http
      .post('/dispositivos')
      .set(b.auth)
      .send({ tokenExpo: tokenExpo(), plataforma: 'ios' });
    ctx.notificador.vaciar();
    await ctx.http.post('/dispositivos/prueba').set(a.auth).expect(200);
    expect(ctx.notificador.enviadas.map((m) => m.tokenExpo)).toEqual([ta]);
  });
});

// ---------------------------------------------------------------------------------------------

describe('AGENTS §4.1 y §11.4 — GET /salud', () => {
  it('exactamente { estado, motor, almacen, version } y meta null', async () => {
    const r = await ctx.http.get('/salud').expect(200);
    esperarContrato(r.body, 'Salud');
    expect(Object.keys(r.body.datos).sort()).toEqual(['almacen', 'estado', 'motor', 'version']);
    expect(r.body.meta).toBeNull();
  });

  it('CORS: el preflight de un POST con Authorization pasa', async () => {
    const r = await ctx.http
      .options('/auth/ingreso')
      .set('Origin', 'http://localhost:8081')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type,x-simular');
    expect(r.status).toBeLessThan(300);
    expect(r.headers['access-control-allow-origin']).toBeDefined();
  });
});

describe('AGENTS §4.6 y DECISIONES A8 — cuerpos rotos o enormes', () => {
  it('un JSON de 60 MB → 413 ARCHIVO_DEMASIADO_GRANDE con el mensaje de A8, nunca 500', async () => {
    const r = await ctx.http
      .post('/auth/registro')
      .set('Content-Type', 'application/json')
      .send(
        `{"nombre":"${'a'.repeat(60 * 1024 * 1024)}","email":"x@prueba.ar","contrasena":"clave-segura"}`,
      );
    esperarErrorLimpio(r, 413, 'ARCHIVO_DEMASIADO_GRANDE');
    expect(r.body.error.mensaje).toBe('Lo que mandaste es demasiado grande.');
  });

  it('JSON roto en un endpoint real → 400 con el mensaje de A8', async () => {
    const r = await ctx.http
      .post('/auth/ingreso')
      .set('Content-Type', 'application/json')
      .send('{"email": "a@b.c", ');
    esperarErrorLimpio(r, 400, 'VALIDACION_FALLIDA');
    expect(r.body.error.mensaje).toBe('Lo que mandaste no es un JSON válido.');
  });

  it('un prototipo envenenado (__proto__) no pasa la validación como dato de más', async () => {
    const r = await ctx.http
      .post('/auth/registro')
      .set('Content-Type', 'application/json')
      .send(
        '{"nombre":"Ana","email":"proto@prueba.ar","contrasena":"clave-segura","__proto__":{"rol":"direccion"}}',
      );
    expect(r.status).toBeLessThan(500);
    if (r.status === 201) {
      expect(decodificar(r.body.datos.token as string).carga.rol).toBe('pasajero');
    }
  });
});

// ---------------------------------------------------------------------------------------------

describe('AGENTS §11.4 — simulación de fallas: bordes', () => {
  let sim: AppDePrueba;
  beforeAll(async () => {
    sim = await crearApp({ entorno: { SIMULACION_HABILITADA: 'true' } });
  });
  afterAll(() => sim.cerrar());

  it('X-Simular: error-500 en un POST no hace la acción (el registro no queda hecho)', async () => {
    const email = emailNuevo();
    const cuerpo = { nombre: 'Ana', email, contrasena: 'clave-segura' };
    esperarErrorLimpio(
      await sim.http.post('/auth/registro').set('X-Simular', 'error-500').send(cuerpo),
      500,
      'ERROR_INTERNO',
    );
    const r = await sim.http.post('/auth/registro').send(cuerpo);
    expect(r.status).toBe(201);
  });

  it('X-Simular: error-500 funciona también en una ruta protegida con sesión', async () => {
    const u = await crearUsuario(sim);
    esperarErrorLimpio(
      await sim.http.get('/yo').set(u.auth).set('X-Simular', 'error-500'),
      500,
      'ERROR_INTERNO',
    );
  });

  it('X-Simular en mayúsculas o con espacios (ERROR-500) no rompe: 200 o 500 con sobre', async () => {
    const r = await sim.http.get('/salud').set('X-Simular', ' ERROR-500 ');
    expect([200, 500]).toContain(r.status);
    if (r.status === 500) esperarErrorLimpio(r, 500, 'ERROR_INTERNO');
  });

  it('demora con un número inválido se ignora', async () => {
    await sim.http.get('/salud').set('X-Simular', 'demora-abc').expect(200);
    await sim.http.get('/salud').set('X-Simular', 'demora--5').expect(200);
  });
});
