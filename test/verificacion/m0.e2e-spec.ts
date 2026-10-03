// Verificación independiente de M0 — Base (AGENTS §4, §6, §7, §8, §9, §11.4, §11.5).
// Caja negra: sólo HTTP, contrato y utilidades de test.
import { createHmac } from 'node:crypto';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { conPatron, jpeg, m4a, mp4 } from '../utilidades/archivos.js';
import { CONTRASENA_DE_PRUEBA, crearUsuario } from '../utilidades/usuarios.js';

const MB = 1024 * 1024;
const SECRETO = 'secreto-de-los-tests';
const TOKEN = 'ExponentPushToken[vvvvvvvvvvvvvvvvvvvvvv]';
const OTRO_TOKEN = 'ExpoPushToken[wwwwwwwwwwwwwwwwwwwwww]';

/** Jerga técnica que no puede aparecer en un mensaje para la persona usuaria (AGENTS §4.6). */
const JERGA =
  /should|must|property|undefined|null\b|Cannot|Error:|Exception|Unauthorized|Forbidden|Not Found|Bad Request|Internal|SQL|SQLITE|QueryFailed|JSON|stack|\bstring\b|\bnumber\b|\bboolean\b|\bundefined\b/i;

function esperarMensajeHumano(cuerpo: unknown) {
  const { mensaje } = (cuerpo as { error: { mensaje: string } }).error;
  expect(mensaje).not.toMatch(JERGA);
  expect(mensaje.length).toBeLessThan(200);
}

function b64url(x: string | Buffer) {
  return Buffer.from(x).toString('base64url');
}

/** Arma un JWT a mano (para probar firmas y cargas raras). */
function jwt(carga: Record<string, unknown>, opciones: { alg?: string; secreto?: string } = {}) {
  const alg = opciones.alg ?? 'HS256';
  const cabecera = b64url(JSON.stringify({ alg, typ: 'JWT' }));
  const cuerpo = b64url(JSON.stringify(carga));
  if (alg === 'none') return `${cabecera}.${cuerpo}.`;
  const firma = createHmac('sha256', opciones.secreto ?? SECRETO)
    .update(`${cabecera}.${cuerpo}`)
    .digest('base64url');
  return `${cabecera}.${cuerpo}.${firma}`;
}

const segundos = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

// ---------------------------------------------------------------------------------------------

describe('AGENTS §7.1 — POST /auth/registro (verificación)', () => {
  let t: AppDePrueba;
  beforeEach(async () => {
    t = await crearApp();
  });
  afterEach(() => t.cerrar());

  const base = { nombre: 'Rosa Benítez', email: 'rosa@mail.com', contrasena: 'clave-larga' };

  it('201 con meta: null y el Usuario exacto del PRD (sin campos de más)', async () => {
    const res = await t.http().post('/auth/registro').send(base).expect(201);
    esperarContrato(res.body, 'Sesion');
    expect(res.body.meta).toBeNull();
    expect(Object.keys(res.body.datos).sort()).toEqual(['token', 'usuario']);
    expect(Object.keys(res.body.datos.usuario).sort()).toEqual(
      [
        'avisosActivos',
        'comercioId',
        'email',
        'favoritos',
        'id',
        'nombre',
        'rol',
        'rubrosDeInteres',
      ].sort(),
    );
  });

  it('AGENTS §7.2 — una contraseña de 8 caracteres justos alcanza', async () => {
    await t
      .http()
      .post('/auth/registro')
      .send({ ...base, contrasena: '12345678' })
      .expect(201);
  });

  it.each([
    ['contraseña de 7 caracteres', { contrasena: '1234567' }],
    ['email inválido', { email: 'no-es-un-email' }],
    ['email numérico', { email: 12345 }],
    ['contraseña numérica', { contrasena: 12345678 }],
    ['nombre vacío', { nombre: '' }],
    ['nombre de sólo espacios', { nombre: '    ' }],
    ['nombre null', { nombre: null }],
    ['falta el email', { email: undefined }],
    ['falta la contraseña', { contrasena: undefined }],
    ['campo de más: favoritos', { favoritos: ['com-118'] }],
    ['campo de más: avisosActivos', { avisosActivos: false }],
    ['campo de más: id', { id: 'usr-elegido' }],
    ['campo de más: password', { password: 'clave-larga' }],
  ])('400 VALIDACION_FALLIDA: %s', async (_n, cambio) => {
    const res = await t
      .http()
      .post('/auth/registro')
      .send({ ...base, ...cambio })
      .expect(400);
    esperarError(res.body, 'VALIDACION_FALLIDA');
    esperarMensajeHumano(res.body);
  });

  it('AGENTS §7.3 — el mensaje de validación nombra el campo en castellano', async () => {
    const sinClave = await t
      .http()
      .post('/auth/registro')
      .send({ nombre: 'Rosa', email: 'rosa@mail.com' })
      .expect(400);
    expect(sinClave.body.error.mensaje).toMatch(/contraseña/i);
    const sinEmail = await t
      .http()
      .post('/auth/registro')
      .send({ nombre: 'Rosa', contrasena: 'clave-larga' })
      .expect(400);
    expect(sinEmail.body.error.mensaje).toMatch(/email|correo/i);
  });

  it('400 si el cuerpo es una lista en vez de un objeto', async () => {
    const res = await t.http().post('/auth/registro').send([base]).expect(400);
    esperarError(res.body, 'VALIDACION_FALLIDA');
  });

  it('400 si el cuerpo llega como texto plano', async () => {
    const res = await t
      .http()
      .post('/auth/registro')
      .set('Content-Type', 'text/plain')
      .send(JSON.stringify(base))
      .expect(400);
    esperarError(res.body, 'VALIDACION_FALLIDA');
  });

  it('AGENTS §7.2 — la contraseña no se guarda en claro: otra contraseña no ingresa', async () => {
    await t.http().post('/auth/registro').send(base).expect(201);
    const res = await t
      .http()
      .post('/auth/ingreso')
      .send({ email: base.email, contrasena: 'clave-largA' })
      .expect(401);
    esperarError(res.body, 'CREDENCIALES_INVALIDAS');
  });

  it('A7 — un token vencido en un endpoint público no impide registrarse', async () => {
    const res = await t
      .http()
      .post('/auth/registro')
      .set('Authorization', 'Bearer basura.basura.basura')
      .send(base)
      .expect(201);
    esperarContrato(res.body, 'Sesion');
  });

  it('409 EMAIL_YA_REGISTRADO contra un usuario creado por otra vía (con espacios)', async () => {
    await crearUsuario(t, { email: 'rosa@mail.com' });
    const res = await t
      .http()
      .post('/auth/registro')
      .send({ ...base, email: ' ROSA@mail.com' })
      .expect(409);
    esperarError(res.body, 'EMAIL_YA_REGISTRADO');
    esperarMensajeHumano(res.body);
  });
});

describe('AGENTS §7.1 — POST /auth/ingreso (verificación)', () => {
  let t: AppDePrueba;
  beforeEach(async () => {
    t = await crearApp();
  });
  afterEach(() => t.cerrar());

  it('200 (no 201) con Sesion y meta: null; el token sirve en /yo', async () => {
    const u = await crearUsuario(t, { email: 'ana@mail.com', avisosActivos: false });
    const res = await t
      .http()
      .post('/auth/ingreso')
      .send({ email: 'ana@mail.com', contrasena: CONTRASENA_DE_PRUEBA })
      .expect(200);
    esperarContrato(res.body, 'Sesion');
    expect(res.body.datos.usuario).toMatchObject({ id: u.id, avisosActivos: false });
    const yo = await t
      .http()
      .get('/yo')
      .set('Authorization', `Bearer ${res.body.datos.token}`)
      .expect(200);
    expect(yo.body.datos.id).toBe(u.id);
  });

  it('acepta el email con espacios alrededor', async () => {
    await crearUsuario(t, { email: 'ana@mail.com' });
    await t
      .http()
      .post('/auth/ingreso')
      .send({ email: '  Ana@Mail.com ', contrasena: CONTRASENA_DE_PRUEBA })
      .expect(200);
  });

  it.each([
    ['campo de más', { email: 'ana@mail.com', contrasena: 'x'.repeat(8), recordar: true }],
    ['falta la contraseña', { email: 'ana@mail.com' }],
    ['email con tipo equivocado', { email: ['ana@mail.com'], contrasena: 'x'.repeat(8) }],
    ['contraseña con tipo equivocado', { email: 'ana@mail.com', contrasena: 12345678 }],
  ])('400 VALIDACION_FALLIDA: %s', async (_n, cuerpo) => {
    const res = await t.http().post('/auth/ingreso').send(cuerpo).expect(400);
    esperarError(res.body, 'VALIDACION_FALLIDA');
    esperarMensajeHumano(res.body);
  });

  it('401 CREDENCIALES_INVALIDAS: contraseña vacía o equivocada, mismo mensaje', async () => {
    await crearUsuario(t, { email: 'ana@mail.com' });
    const mala = await t
      .http()
      .post('/auth/ingreso')
      .send({ email: 'ana@mail.com', contrasena: 'equivocada' })
      .expect(401);
    esperarError(mala.body, 'CREDENCIALES_INVALIDAS');
    esperarMensajeHumano(mala.body);
    const inexistente = await t
      .http()
      .post('/auth/ingreso')
      .send({ email: 'nadie@mail.com', contrasena: 'equivocada' })
      .expect(401);
    expect(inexistente.body).toEqual(mala.body);
  });

  it('una cuenta de comercio ingresa y /yo devuelve su comercioId', async () => {
    await crearUsuario(t, {
      email: 'tornillo@demo.ar',
      rol: 'comercio',
      comercioId: 'com-118',
    });
    const res = await t
      .http()
      .post('/auth/ingreso')
      .send({ email: 'tornillo@demo.ar', contrasena: CONTRASENA_DE_PRUEBA })
      .expect(200);
    const yo = await t
      .http()
      .get('/yo')
      .set('Authorization', `Bearer ${res.body.datos.token}`)
      .expect(200);
    esperarContrato(yo.body, 'Usuario');
    expect(yo.body.datos).toMatchObject({ rol: 'comercio', comercioId: 'com-118' });
  });
});

describe('AGENTS §7.2 — Tokens: firma, carga y vencimiento (verificación)', () => {
  let t: AppDePrueba;
  beforeEach(async () => {
    t = await crearApp();
  });
  afterEach(() => t.cerrar());

  const ahora = () => segundos('2026-10-03T12:00:00-03:00');

  it('un token armado a mano con el secreto correcto y carga válida funciona (control)', async () => {
    const u = await crearUsuario(t);
    const token = jwt({ sub: u.id, rol: 'vecino', iat: ahora(), exp: ahora() + 3600 });
    await t.http().get('/yo').set('Authorization', `Bearer ${token}`).expect(200);
  });

  it('401 con alg: none', async () => {
    const u = await crearUsuario(t);
    const token = jwt(
      { sub: u.id, rol: 'vecino', iat: ahora(), exp: ahora() + 3600 },
      {
        alg: 'none',
      },
    );
    const res = await t.http().get('/yo').set('Authorization', `Bearer ${token}`).expect(401);
    esperarError(res.body, 'NO_AUTENTICADO');
  });

  it('401 con un token sin sub', async () => {
    await crearUsuario(t);
    const token = jwt({ rol: 'vecino', iat: ahora(), exp: ahora() + 3600 });
    const res = await t.http().get('/yo').set('Authorization', `Bearer ${token}`).expect(401);
    esperarError(res.body, 'NO_AUTENTICADO');
  });

  it('401 con un token sin exp (no hay tokens eternos)', async () => {
    const u = await crearUsuario(t);
    const token = jwt({ sub: u.id, rol: 'vecino', iat: ahora() });
    const res = await t.http().get('/yo').set('Authorization', `Bearer ${token}`).expect(401);
    esperarError(res.body, 'NO_AUTENTICADO');
  });

  it('401 con un token vencido hace un segundo', async () => {
    const u = await crearUsuario(t);
    const token = jwt({ sub: u.id, rol: 'vecino', iat: ahora() - 3600, exp: ahora() - 1 });
    const res = await t.http().get('/yo').set('Authorization', `Bearer ${token}`).expect(401);
    esperarError(res.body, 'NO_AUTENTICADO');
    esperarMensajeHumano(res.body);
  });

  it('el rol del token no le da a un vecino datos de comercio: /yo sale de la base', async () => {
    const u = await crearUsuario(t);
    const token = jwt({ sub: u.id, rol: 'comercio', iat: ahora(), exp: ahora() + 3600 });
    const res = await t.http().get('/yo').set('Authorization', `Bearer ${token}`);
    if (res.status === 200) expect(res.body.datos.rol).toBe('vecino');
    else esperarError(res.body, 'NO_AUTENTICADO');
  });

  it('401 con el token en minúsculas "bearer"? se acepta o 401, nunca 500', async () => {
    const u = await crearUsuario(t);
    const res = await t.http().get('/yo').set('Authorization', `bearer ${u.token}`);
    expect([200, 401]).toContain(res.status);
  });

  it('AGENTS §6 — vencimiento exacto: 30 días menos un segundo vale, 30 días + 1 s no', async () => {
    const res = await t
      .http()
      .post('/auth/registro')
      .send({ nombre: 'Rosa', email: 'rosa@mail.com', contrasena: 'clave-larga' })
      .expect(201);
    const auth = { Authorization: `Bearer ${res.body.datos.token}` };
    t.reloj.avanzar(30 * 24 * 3600 * 1000 - 1000);
    await t.http().get('/yo').set(auth).expect(200);
    t.reloj.avanzar(2000);
    const vencido = await t.http().get('/yo').set(auth).expect(401);
    esperarError(vencido.body, 'NO_AUTENTICADO');
  });

  it('AGENTS §6 — token emitido el 31/12 a las 23:59 sigue valiendo en enero', async () => {
    const t2 = await crearApp({ ahora: '2026-12-31T23:59:00-03:00' });
    const res = await t2
      .http()
      .post('/auth/registro')
      .send({ nombre: 'Rosa', email: 'rosa@mail.com', contrasena: 'clave-larga' })
      .expect(201);
    t2.reloj.fijar('2027-01-01T00:00:00-03:00');
    await t2.http().get('/yo').set('Authorization', `Bearer ${res.body.datos.token}`).expect(200);
    t2.reloj.fijar('2027-01-30T23:58:59-03:00');
    await t2.http().get('/yo').set('Authorization', `Bearer ${res.body.datos.token}`).expect(200);
    t2.reloj.fijar('2027-01-31T00:00:00-03:00');
    await t2.http().get('/yo').set('Authorization', `Bearer ${res.body.datos.token}`).expect(401);
    await t2.cerrar();
  });

  it('A7 — en un endpoint público, un token vencido se ignora (no 401)', async () => {
    const u = await crearUsuario(t);
    t.reloj.avanzar(31 * 24 * 3600 * 1000);
    await t.http().get('/salud').set(u.auth).expect(200);
  });
});

describe('AGENTS §7.1 / A9 — GET /yo y PATCH /yo (verificación)', () => {
  let t: AppDePrueba;
  beforeEach(async () => {
    t = await crearApp();
  });
  afterEach(() => t.cerrar());

  it('GET /yo con avisos apagados y comercioId lleno cumple el contrato', async () => {
    const c = await crearUsuario(t, {
      rol: 'comercio',
      comercioId: 'com-118',
      avisosActivos: false,
    });
    const res = await t.http().get('/yo').set(c.auth).expect(200);
    esperarContrato(res.body, 'Usuario');
    expect(res.body.datos).toEqual({
      id: c.id,
      nombre: 'Vecina de Prueba',
      email: c.email,
      rol: 'comercio',
      comercioId: 'com-118',
      favoritos: [],
      rubrosDeInteres: [],
      avisosActivos: false,
    });
  });

  it('GET /yo de un vecino: comercioId null (no ausente, no "")', async () => {
    const v = await crearUsuario(t);
    const res = await t.http().get('/yo').set(v.auth).expect(200);
    expect(res.body.datos).toHaveProperty('comercioId', null);
  });

  it.each([
    ['nombre de sólo espacios', { nombre: '    ' }],
    ['nombre null', { nombre: null }],
    ['nombre lista', { nombre: ['Ana'] }],
    ['A9 — favoritos todavía no se aceptan', { favoritos: [] }],
    ['A9 — avisosActivos todavía no se acepta', { avisosActivos: false }],
    ['id de más', { id: 'usr-otro' }],
    ['contrasena de más', { contrasena: 'nueva-clave-larga' }],
    ['sincronizado de más', { sincronizado: true }],
  ])('PATCH /yo 400 VALIDACION_FALLIDA: %s', async (_n, cuerpo) => {
    const v = await crearUsuario(t, { nombre: 'Original' });
    const res = await t.http().patch('/yo').set(v.auth).send(cuerpo).expect(400);
    esperarError(res.body, 'VALIDACION_FALLIDA');
    esperarMensajeHumano(res.body);
    const yo = await t.http().get('/yo').set(v.auth).expect(200);
    expect(yo.body.datos.nombre).toBe('Original');
  });

  it('PATCH /yo con un nombre de 80 letras entra y con 81 no', async () => {
    const v = await crearUsuario(t);
    await t
      .http()
      .patch('/yo')
      .set(v.auth)
      .send({ nombre: 'a'.repeat(80) })
      .expect(200);
    const res = await t
      .http()
      .patch('/yo')
      .set(v.auth)
      .send({ nombre: 'a'.repeat(81) })
      .expect(400);
    esperarError(res.body, 'VALIDACION_FALLIDA');
  });

  it('PATCH /yo con tildes y eñes las conserva tal cual', async () => {
    const v = await crearUsuario(t);
    const res = await t
      .http()
      .patch('/yo')
      .set(v.auth)
      .send({ nombre: 'Íñigo Muñoz Ñandú' })
      .expect(200);
    esperarContrato(res.body, 'Usuario');
    expect(res.body.datos.nombre).toBe('Íñigo Muñoz Ñandú');
  });

  it('PATCH /yo sólo toca al usuario de la sesión', async () => {
    const a = await crearUsuario(t, { nombre: 'Ana' });
    const b = await crearUsuario(t, { nombre: 'Beto' });
    await t.http().patch('/yo').set(a.auth).send({ nombre: 'Ana María' }).expect(200);
    const yoB = await t.http().get('/yo').set(b.auth).expect(200);
    expect(yoB.body.datos.nombre).toBe('Beto');
  });

  it('PATCH /yo 401 con un token vencido', async () => {
    const v = await crearUsuario(t);
    t.reloj.avanzar(31 * 24 * 3600 * 1000);
    const res = await t.http().patch('/yo').set(v.auth).send({ nombre: 'X' }).expect(401);
    esperarError(res.body, 'NO_AUTENTICADO');
  });

  it('PUT /yo no existe: 404 RUTA_NO_ENCONTRADA (no 401 que confunda)', async () => {
    const v = await crearUsuario(t);
    const res = await t.http().put('/yo').set(v.auth).send({ nombre: 'X' }).expect(404);
    esperarError(res.body, 'RUTA_NO_ENCONTRADA');
  });
});

describe('AGENTS §11.4 — GET /salud (verificación)', () => {
  let t: AppDePrueba;
  beforeAll(async () => {
    t = await crearApp();
  });
  afterAll(() => t.cerrar());

  it('sólo los cuatro campos de Salud, con meta: null', async () => {
    const res = await t.http().get('/salud').expect(200);
    esperarContrato(res.body, 'Salud');
    expect(Object.keys(res.body.datos).sort()).toEqual(['almacen', 'estado', 'motor', 'version']);
    expect(res.body.meta).toBeNull();
  });

  it('parámetros de consulta desconocidos no lo rompen', async () => {
    await t.http().get('/salud?x=1').expect(200);
  });

  it('CORS — el preflight deja mandar Authorization, Content-Type y X-Simular', async () => {
    const res = await t
      .http()
      .options('/yo')
      .set('Origin', 'http://localhost:8081')
      .set('Access-Control-Request-Method', 'PATCH')
      .set('Access-Control-Request-Headers', 'authorization,content-type,x-simular');
    expect(res.status).toBeLessThan(300);
    expect(res.headers['access-control-allow-origin']).toBe('*');
    const permitidas = String(res.headers['access-control-allow-headers'] ?? '').toLowerCase();
    expect(permitidas).toContain('authorization');
    expect(permitidas).toContain('x-simular');
    const metodos = String(res.headers['access-control-allow-methods'] ?? '').toUpperCase();
    expect(metodos).toContain('PATCH');
    expect(metodos).toContain('DELETE');
  });
});

describe('AGENTS §4.1 / §4.6 — Sobre de error y filtro global (verificación)', () => {
  let t: AppDePrueba;
  beforeAll(async () => {
    t = await crearApp();
  });
  afterAll(() => t.cerrar());

  it.each([
    ['GET', '/'],
    ['POST', '/no-existe'],
    ['GET', '/auth/registro'],
    ['GET', '/dispositivos'],
    ['GET', '/salud/extra'],
  ])('404 RUTA_NO_ENCONTRADA con %s %s, mensaje sin "Cannot GET"', async (metodo, ruta) => {
    const req = metodo === 'GET' ? t.http().get(ruta) : t.http().post(ruta).send({ algo: 1 });
    const res = await req.expect(404);
    esperarError(res.body, 'RUTA_NO_ENCONTRADA');
    esperarMensajeHumano(res.body);
  });

  it('una ruta protegida que no existe da 404 aunque no haya token', async () => {
    const res = await t.http().get('/yo/no-existe').expect(404);
    esperarError(res.body, 'RUTA_NO_ENCONTRADA');
  });

  it('401 NO_AUTENTICADO con mensaje para humanos', async () => {
    const res = await t.http().get('/yo').expect(401);
    esperarError(res.body, 'NO_AUTENTICADO');
    esperarMensajeHumano(res.body);
  });

  it('las respuestas de error son JSON', async () => {
    const res = await t.http().get('/no-existe').expect(404);
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  it('JSON mal escrito: el mensaje no filtra el error del parser', async () => {
    const res = await t
      .http()
      .post('/auth/registro')
      .set('Content-Type', 'application/json')
      .send('{"nombre": "x",}')
      .expect(400);
    esperarError(res.body, 'VALIDACION_FALLIDA');
    esperarMensajeHumano(res.body);
  });
});

describe('AGENTS §11.4 — X-Simular (verificación)', () => {
  let t: AppDePrueba;
  beforeAll(async () => {
    t = await crearApp({ variables: { SIMULACION_HABILITADA: 'true' } });
  });
  afterAll(() => t.cerrar());

  it('error-500 también en un endpoint protegido y en un POST, con mensaje humano', async () => {
    const v = await crearUsuario(t);
    const a = await t.http().get('/yo').set(v.auth).set('X-Simular', 'error-500').expect(500);
    esperarError(a.body, 'ERROR_INTERNO');
    esperarMensajeHumano(a.body);
    const b = await t
      .http()
      .post('/auth/ingreso')
      .set('X-Simular', 'error-500')
      .send({ email: 'a@a.com', contrasena: 'x'.repeat(8) })
      .expect(500);
    esperarError(b.body, 'ERROR_INTERNO');
  });

  it('error-500 no ejecuta la acción (no deja un usuario registrado)', async () => {
    await t
      .http()
      .post('/auth/registro')
      .set('X-Simular', 'error-500')
      .send({ nombre: 'Simulada', email: 'simulada@mail.com', contrasena: 'clave-larga' })
      .expect(500);
    await t
      .http()
      .post('/auth/registro')
      .send({ nombre: 'Simulada', email: 'simulada@mail.com', contrasena: 'clave-larga' })
      .expect(201);
  });
});

describe('AGENTS §8 — POST /archivos (verificación)', () => {
  let t: AppDePrueba;
  let auth: { Authorization: string };
  beforeAll(async () => {
    t = await crearApp();
    auth = (await crearUsuario(t)).auth;
  });
  afterAll(() => t.cerrar());

  const subir = (contenido: Buffer, nombre: string) =>
    t.http().post('/archivos').set(auth).attach('archivo', contenido, nombre);

  function webp(bytes = 1000) {
    const b = Buffer.alloc(bytes, 0x55);
    b.write('RIFF', 0, 'latin1');
    b.writeUInt32LE(bytes - 8, 4);
    b.write('WEBP', 8, 'latin1');
    b.write('VP8 ', 12, 'latin1');
    return b;
  }
  function mp3(bytes = 1000) {
    const b = Buffer.alloc(bytes, 0x00);
    b.write('ID3', 0, 'latin1');
    b.set([0x04, 0x00, 0x00, 0, 0, 0, 0], 3);
    return b;
  }
  function aac(bytes = 1000) {
    const b = Buffer.alloc(bytes, 0x00);
    b.set([0xff, 0xf1, 0x50, 0x80], 0);
    return b;
  }

  it.each([
    ['webp', webp(), 'imagen'],
    ['mp3', mp3(), 'audio'],
    ['aac', aac(), 'audio'],
  ])('201 con %s (formato permitido por AGENTS §8)', async (nombre, contenido, tipo) => {
    const res = await subir(contenido, `archivo.${nombre}`).expect(201);
    esperarContrato(res.body, 'ArchivoSubido');
    expect(res.body.datos.tipo).toBe(tipo);
    expect(res.body.datos.bytes).toBe(contenido.length);
  });

  it('la extensión engañosa no manda: un JPEG llamado .mp4 es una imagen', async () => {
    const res = await subir(jpeg(), 'video.mp4').expect(201);
    expect(res.body.datos.tipo).toBe('imagen');
    expect(res.body.datos.url).toMatch(/\/archivos\/imagenes\/.*\.jpg$/);
  });

  it('dos subidas del mismo archivo tienen claves distintas', async () => {
    const a = await subir(jpeg(), 'f.jpg').expect(201);
    const b = await subir(jpeg(), 'f.jpg').expect(201);
    expect(a.body.datos.url).not.toBe(b.body.datos.url);
  });

  it('413 ARCHIVO_DEMASIADO_GRANDE: un audio de más de 10 MB', async () => {
    const res = await subir(m4a(10 * MB + 1), 'a.m4a').expect(413);
    esperarError(res.body, 'ARCHIVO_DEMASIADO_GRANDE');
    esperarMensajeHumano(res.body);
  });

  it('un audio de 10 MB justos entra', async () => {
    await subir(m4a(10 * MB), 'a.m4a').expect(201);
  });

  it('un video de 6 MB entra (el límite de imagen no se aplica al video)', async () => {
    await subir(mp4(6 * MB), 'v.mp4').expect(201);
  });

  it('un archivo vacío no se acepta (ni 201 ni 500)', async () => {
    const res = await subir(Buffer.alloc(0), 'f.jpg');
    expect([400, 415]).toContain(res.status);
    esperarError(res.body);
  });

  it('415 TIPO_DE_ARCHIVO_NO_PERMITIDO con un GIF', async () => {
    const gif = Buffer.alloc(500, 0);
    gif.write('GIF89a', 0, 'latin1');
    const res = await subir(gif, 'f.gif').expect(415);
    esperarError(res.body, 'TIPO_DE_ARCHIVO_NO_PERMITIDO');
    esperarMensajeHumano(res.body);
  });

  // Duda de especificación: AGENTS §8 no dice qué hacer con campos de texto de más en el
  // multipart. Sólo se exige que no rompa y que, si lo acepta, el nombre no se use.
  it('un campo de texto de más en el formulario: 201 sin usarlo o 400, nunca 500', async () => {
    const res = await t
      .http()
      .post('/archivos')
      .set(auth)
      .field('clave', 'imagenes/2026/10/elegida0000000000.jpg')
      .attach('archivo', jpeg(), 'f.jpg');
    expect([201, 400]).toContain(res.status);
    if (res.status === 201) expect(res.body.datos.url).not.toContain('elegida');
    else esperarError(res.body, 'VALIDACION_FALLIDA');
  });

  it('dos archivos en el campo archivo: no 500', async () => {
    const res = await t
      .http()
      .post('/archivos')
      .set(auth)
      .attach('archivo', jpeg(), 'a.jpg')
      .attach('archivo', jpeg(), 'b.jpg');
    expect(res.status).toBeLessThan(500);
    if (res.status >= 400) esperarError(res.body);
  });

  it('400 con un cuerpo JSON en vez de multipart', async () => {
    const res = await t.http().post('/archivos').set(auth).send({ archivo: 'x' }).expect(400);
    esperarError(res.body, 'VALIDACION_FALLIDA');
  });

  it('401 con un token vencido', async () => {
    const v = await crearUsuario(t);
    t.reloj.avanzar(31 * 24 * 3600 * 1000);
    const res = await t
      .http()
      .post('/archivos')
      .set(v.auth)
      .attach('archivo', jpeg(), 'f.jpg')
      .expect(401);
    esperarError(res.body, 'NO_AUTENTICADO');
    t.reloj.fijar('2026-10-03T12:00:00-03:00');
  });

  it('la clave usa el año y mes del reloj de la API en Buenos Aires (31/12 23:59)', async () => {
    t.reloj.fijar('2026-12-31T23:59:00-03:00');
    const v = await crearUsuario(t);
    const res = await t
      .http()
      .post('/archivos')
      .set(v.auth)
      .attach('archivo', jpeg(), 'f.jpg')
      .expect(201);
    expect(res.body.datos.url).toMatch(/\/archivos\/imagenes\/2026\/12\//);
    t.reloj.fijar('2026-10-03T12:00:00-03:00');
  });
});

describe('AGENTS §8 / §17.1 / A5 — GET /archivos/<clave> con Range (verificación)', () => {
  let t: AppDePrueba;
  let ruta: string;
  let audio: Buffer;
  beforeAll(async () => {
    t = await crearApp();
    const v = await crearUsuario(t);
    audio = conPatron(m4a(1000));
    const res = await t
      .http()
      .post('/archivos')
      .set(v.auth)
      .attach('archivo', audio, 'a.m4a')
      .expect(201);
    ruta = new URL(res.body.datos.url).pathname;
  });
  afterAll(() => t.cerrar());

  it('206 con un solo byte (bytes=0-0)', async () => {
    const res = await t.http().get(ruta).set('Range', 'bytes=0-0').buffer(true).expect(206);
    expect((res.body as Buffer).length).toBe(1);
    expect(res.headers['content-range']).toBe('bytes 0-0/1000');
    expect(res.headers['content-length']).toBe('1');
  });

  it('206 con el último byte (bytes=999-999)', async () => {
    const res = await t.http().get(ruta).set('Range', 'bytes=999-999').buffer(true).expect(206);
    expect([...(res.body as Buffer)]).toEqual([audio[999]]);
    expect(res.headers['content-range']).toBe('bytes 999-999/1000');
  });

  it('206 recortado si el final pasa del tamaño (bytes=995-5000)', async () => {
    const res = await t.http().get(ruta).set('Range', 'bytes=995-5000').buffer(true).expect(206);
    expect([...(res.body as Buffer)]).toEqual([...audio.subarray(995)]);
    expect(res.headers['content-range']).toBe('bytes 995-999/1000');
  });

  it('206 con un sufijo más largo que el archivo devuelve todo (bytes=-5000)', async () => {
    const res = await t.http().get(ruta).set('Range', 'bytes=-5000').buffer(true);
    expect([200, 206]).toContain(res.status);
    expect((res.body as Buffer).length).toBe(1000);
  });

  it('416 con bytes=1000- (empieza justo en el final)', async () => {
    const res = await t.http().get(ruta).set('Range', 'bytes=1000-').expect(416);
    esperarError(res.body, 'RANGO_NO_SATISFACIBLE');
    expect(res.headers['content-range']).toBe('bytes */1000');
    esperarMensajeHumano(res.body);
  });

  it('A5 — varios rangos se ignoran: 200 con el archivo entero', async () => {
    const res = await t.http().get(ruta).set('Range', 'bytes=0-1,5-6').buffer(true).expect(200);
    expect((res.body as Buffer).length).toBe(1000);
  });

  it('A5 — rango invertido (bytes=20-10) no da 500', async () => {
    const res = await t.http().get(ruta).set('Range', 'bytes=20-10').buffer(true);
    expect([200, 416]).toContain(res.status);
  });

  it('el content-type del audio es de audio', async () => {
    const res = await t.http().get(ruta).buffer(true).expect(200);
    expect(res.headers['content-type']).toMatch(/^audio\//);
  });

  it('se sirve sin sesión aunque mande un token vencido (A7)', async () => {
    await t
      .http()
      .get(ruta)
      .set('Authorization', 'Bearer basura.basura.basura')
      .buffer(true)
      .expect(200);
  });

  it('una clave con barra invertida o puntos no sale de la carpeta (404, nunca 500)', async () => {
    for (const camino of [
      '/archivos/imagenes/2026/10/%2e%2e/%2e%2e/%2e%2e/package.json',
      '/archivos/..%5c..%5cpackage.json',
      '/archivos/',
    ]) {
      const res = await t.http().get(camino);
      expect(res.status, camino).toBe(404);
      esperarError(res.body);
    }
  });
});

describe('AGENTS §9 / A1–A4 — /dispositivos (verificación)', () => {
  let t: AppDePrueba;
  beforeEach(async () => {
    t = await crearApp();
  });
  afterEach(() => t.cerrar());

  it('A4 — acepta ExpoPushToken[…] y devuelve sólo tokenExpo y plataforma', async () => {
    const v = await crearUsuario(t);
    const res = await t
      .http()
      .post('/dispositivos')
      .set(v.auth)
      .send({ tokenExpo: OTRO_TOKEN, plataforma: 'ios' })
      .expect(201);
    esperarContrato(res.body, 'Dispositivo');
    expect(res.body.datos).toEqual({ tokenExpo: OTRO_TOKEN, plataforma: 'ios' });
  });

  it.each([
    ['plataforma web', { tokenExpo: TOKEN, plataforma: 'web' }],
    ['plataforma en mayúsculas', { tokenExpo: TOKEN, plataforma: 'IOS' }],
    ['falta la plataforma', { tokenExpo: TOKEN }],
    ['falta el token', { plataforma: 'ios' }],
    ['token vacío', { tokenExpo: '', plataforma: 'ios' }],
    ['token sin corchetes', { tokenExpo: 'ExponentPushToken', plataforma: 'ios' }],
    ['token con corchetes vacíos', { tokenExpo: 'ExponentPushToken[]', plataforma: 'ios' }],
    ['token de FCM crudo', { tokenExpo: 'fcm:abcdefg1234567', plataforma: 'android' }],
    [
      'token de más de 200 caracteres',
      { tokenExpo: `ExponentPushToken[${'a'.repeat(190)}]`, plataforma: 'ios' },
    ],
    ['token numérico', { tokenExpo: 123, plataforma: 'ios' }],
    ['campo de más', { tokenExpo: TOKEN, plataforma: 'ios', usuarioId: 'usr-otro' }],
  ])('POST 400 VALIDACION_FALLIDA: %s', async (_n, cuerpo) => {
    const v = await crearUsuario(t);
    const res = await t.http().post('/dispositivos').set(v.auth).send(cuerpo).expect(400);
    esperarError(res.body, 'VALIDACION_FALLIDA');
    esperarMensajeHumano(res.body);
  });

  it('re-registrar con otra plataforma actualiza la plataforma', async () => {
    const v = await crearUsuario(t);
    await t
      .http()
      .post('/dispositivos')
      .set(v.auth)
      .send({ tokenExpo: TOKEN, plataforma: 'ios' })
      .expect(201);
    const res = await t
      .http()
      .post('/dispositivos')
      .set(v.auth)
      .send({ tokenExpo: TOKEN, plataforma: 'android' })
      .expect(201);
    expect(res.body.datos.plataforma).toBe('android');
  });

  it('si el token pasó a otro usuario, la prueba del anterior no lo alcanza', async () => {
    const a = await crearUsuario(t);
    const b = await crearUsuario(t);
    await t
      .http()
      .post('/dispositivos')
      .set(a.auth)
      .send({ tokenExpo: TOKEN, plataforma: 'ios' })
      .expect(201);
    await t
      .http()
      .post('/dispositivos')
      .set(b.auth)
      .send({ tokenExpo: TOKEN, plataforma: 'ios' })
      .expect(201);
    const res = await t.http().post('/dispositivos/prueba').set(a.auth).expect(200);
    esperarContrato(res.body, 'PruebaPush');
    expect(res.body.datos).toEqual({ dispositivos: 0 });
    await t.avisos.esperarPendientes();
    expect(t.enviador.enviados.flatMap((m) => m.tokens)).not.toContain(TOKEN);
  });

  it('A3 — la prueba se manda aunque los avisos estén apagados, con texto en castellano', async () => {
    const v = await crearUsuario(t, { avisosActivos: false });
    await t
      .http()
      .post('/dispositivos')
      .set(v.auth)
      .send({ tokenExpo: TOKEN, plataforma: 'android' })
      .expect(201);
    const res = await t.http().post('/dispositivos/prueba').set(v.auth).expect(200);
    esperarContrato(res.body, 'PruebaPush');
    expect(res.body.datos.dispositivos).toBe(1);
    await t.avisos.esperarPendientes();
    expect(t.enviador.enviados).toHaveLength(1);
    const [m] = t.enviador.enviados;
    expect(m.tokens).toEqual([TOKEN]);
    expect(m.titulo.trim()).not.toBe('');
    expect(m.cuerpo.trim()).not.toBe('');
    for (const valor of Object.values(m.datos)) expect(typeof valor).toBe('string');
  });

  it('POST /dispositivos/prueba con un cuerpo con campos de más: 400 o se ignora, nunca 500', async () => {
    const v = await crearUsuario(t);
    const res = await t.http().post('/dispositivos/prueba').set(v.auth).send({ x: 1 });
    expect([200, 400]).toContain(res.status);
  });

  it('DELETE con el token codificado en la URL lo da de baja', async () => {
    const v = await crearUsuario(t);
    await t
      .http()
      .post('/dispositivos')
      .set(v.auth)
      .send({ tokenExpo: TOKEN, plataforma: 'ios' })
      .expect(201);
    const res = await t
      .http()
      .delete(`/dispositivos/${encodeURIComponent(TOKEN)}`)
      .set(v.auth)
      .expect(204);
    expect(res.text ?? '').toBe('');
    const prueba = await t.http().post('/dispositivos/prueba').set(v.auth).expect(200);
    expect(prueba.body.datos.dispositivos).toBe(0);
  });

  it('DELETE dos veces seguidas: 204 las dos', async () => {
    const v = await crearUsuario(t);
    await t
      .http()
      .post('/dispositivos')
      .set(v.auth)
      .send({ tokenExpo: TOKEN, plataforma: 'ios' })
      .expect(201);
    await t
      .http()
      .delete(`/dispositivos/${encodeURIComponent(TOKEN)}`)
      .set(v.auth)
      .expect(204);
    await t
      .http()
      .delete(`/dispositivos/${encodeURIComponent(TOKEN)}`)
      .set(v.auth)
      .expect(204);
  });

  it('401 en los tres endpoints con un token vencido', async () => {
    const v = await crearUsuario(t);
    t.reloj.avanzar(31 * 24 * 3600 * 1000);
    const a = await t
      .http()
      .post('/dispositivos')
      .set(v.auth)
      .send({ tokenExpo: TOKEN, plataforma: 'ios' })
      .expect(401);
    esperarError(a.body, 'NO_AUTENTICADO');
    const b = await t
      .http()
      .delete(`/dispositivos/${encodeURIComponent(TOKEN)}`)
      .set(v.auth)
      .expect(401);
    esperarError(b.body, 'NO_AUTENTICADO');
    const c = await t.http().post('/dispositivos/prueba').set(v.auth).expect(401);
    esperarError(c.body, 'NO_AUTENTICADO');
  });

  it('una cuenta de comercio también puede registrar su teléfono', async () => {
    const c = await crearUsuario(t, { rol: 'comercio', comercioId: 'com-118' });
    await t
      .http()
      .post('/dispositivos')
      .set(c.auth)
      .send({ tokenExpo: TOKEN, plataforma: 'ios' })
      .expect(201);
  });
});

describe('AGENTS §11.5 — Swagger documenta los endpoints de M0 (verificación)', () => {
  let t: AppDePrueba;
  beforeAll(async () => {
    t = await crearApp();
  });
  afterAll(() => t.cerrar());

  it('/docs-json tiene cada ruta y método de M0', async () => {
    const res = await t.http().get('/docs-json').expect(200);
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
    for (const [ruta, metodo] of esperado) {
      expect(paths[ruta]?.[metodo], `${metodo.toUpperCase()} ${ruta}`).toBeTruthy();
    }
    const archivo = Object.keys(paths).find((p) => p.startsWith('/archivos/'));
    expect(archivo, 'GET /archivos/<clave>').toBeTruthy();
  });

  it('las rutas con sesión piden bearer y documentan el 401', async () => {
    const res = await t.http().get('/docs-json').expect(200);
    const yo = res.body.paths['/yo'].get as {
      security?: unknown[];
      responses: Record<string, unknown>;
    };
    expect(yo.security?.length ?? 0).toBeGreaterThan(0);
    expect(yo.responses['401']).toBeTruthy();
  });

  it('el registro documenta el 409 y el 400', async () => {
    const res = await t.http().get('/docs-json').expect(200);
    const reg = res.body.paths['/auth/registro'].post as { responses: Record<string, unknown> };
    expect(reg.responses['409']).toBeTruthy();
    expect(reg.responses['400']).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------------------------
// Segunda pasada: nulos y tipos raros en cada cuerpo, cargas maliciosas, tokens con formas
// raras, concurrencia de dispositivos y rangos que faltaban.
// ---------------------------------------------------------------------------------------------

describe('AGENTS §7.3 — POST /auth/registro con nulos y cuerpos raros (verificación, 2ª pasada)', () => {
  let t: AppDePrueba;
  beforeAll(async () => {
    t = await crearApp();
  });
  afterAll(() => t.cerrar());

  const base = { nombre: 'Rosa Benítez', email: 'rosa2@mail.com', contrasena: 'clave-larga' };

  it.each([
    ['email null', { email: null }],
    ['contraseña null', { contrasena: null }],
    ['email vacío', { email: '' }],
    ['contraseña vacía', { contrasena: '' }],
    ['nombre objeto', { nombre: { primero: 'Rosa' } }],
    ['nombre booleano', { nombre: true }],
    ['email lista', { email: ['rosa2@mail.com'] }],
    ['nombre con sólo tabulaciones y saltos', { nombre: '\t\n  \n' }],
    ['campo de más: rol null', { rol: null }],
    ['campo de más: comercioId null', { comercioId: null }],
    ['campo de más: sincronizado', { sincronizado: true }],
  ])('400 VALIDACION_FALLIDA: %s', async (_n, cambio) => {
    const res = await t
      .http()
      .post('/auth/registro')
      .send({ ...base, ...cambio })
      .expect(400);
    esperarError(res.body, 'VALIDACION_FALLIDA');
    esperarMensajeHumano(res.body);
  });

  it.each([
    ['null', 'null'],
    ['un texto JSON', '"hola"'],
    ['un número', '42'],
    ['un booleano', 'true'],
  ])('400 VALIDACION_FALLIDA si el cuerpo JSON es %s', async (_n, crudo) => {
    const res = await t
      .http()
      .post('/auth/registro')
      .set('Content-Type', 'application/json')
      .send(crudo);
    expect(res.status).toBe(400);
    esperarError(res.body, 'VALIDACION_FALLIDA');
    esperarMensajeHumano(res.body);
  });

  it('__proto__ en el cuerpo no da rol de comercio (400 o vecino, nunca comercio ni 500)', async () => {
    const crudo = `{"nombre":"Proto","email":"proto@mail.com","contrasena":"clave-larga","__proto__":{"rol":"comercio","comercioId":"com-118"}}`;
    const res = await t
      .http()
      .post('/auth/registro')
      .set('Content-Type', 'application/json')
      .send(crudo);
    expect([201, 400]).toContain(res.status);
    if (res.status === 201) {
      esperarContrato(res.body, 'Sesion');
      expect(res.body.datos.usuario.rol).toBe('vecino');
      expect(res.body.datos.usuario.comercioId).toBeNull();
    } else esperarError(res.body, 'VALIDACION_FALLIDA');
  });

  it('un email larguísimo con forma válida: 400 o 201, nunca 500 (la columna tiene largo)', async () => {
    const email = `${'a'.repeat(60)}@${'b'.repeat(60)}.${'c'.repeat(60)}.${'d'.repeat(60)}.com`;
    const res = await t
      .http()
      .post('/auth/registro')
      .send({ ...base, email });
    expect([201, 400]).toContain(res.status);
    if (res.status === 400) esperarError(res.body, 'VALIDACION_FALLIDA');
    else {
      const yo = await t
        .http()
        .get('/yo')
        .set('Authorization', `Bearer ${res.body.datos.token}`)
        .expect(200);
      expect(yo.body.datos.email).toBe(email);
    }
  });

  it('una contraseña enorme (50 000 caracteres): 400 o 201, nunca 500', async () => {
    const res = await t
      .http()
      .post('/auth/registro')
      .send({ ...base, email: 'enorme@mail.com', contrasena: 'x'.repeat(50_000) });
    expect([201, 400]).toContain(res.status);
    if (res.status === 400) esperarError(res.body, 'VALIDACION_FALLIDA');
  });

  it('AGENTS §4.6 / §7.3 — una contraseña larga (200) no se rechaza con un mensaje falso', async () => {
    const res = await t
      .http()
      .post('/auth/registro')
      .send({ ...base, email: 'larga@mail.com', contrasena: 'x'.repeat(200) });
    expect([201, 400]).toContain(res.status);
    if (res.status === 400) {
      esperarError(res.body, 'VALIDACION_FALLIDA');
      // 200 caracteres cumplen "al menos 8": el mensaje no puede decir lo contrario.
      expect(res.body.error.mensaje).not.toMatch(/al menos 8/);
      expect(res.body.error.mensaje).toMatch(/contraseña/i);
    }
  });

  it('el token del registro es HS256, con sub = id, rol vecino, y vence a los 30 días del reloj', async () => {
    const res = await t
      .http()
      .post('/auth/registro')
      .send({ ...base, email: 'jwt@mail.com' })
      .expect(201);
    const { token, usuario } = res.body.datos as { token: string; usuario: { id: string } };
    expect(usuario.id).toMatch(/^usr-[a-z0-9]{12}$/);
    const [cab, carga] = token.split('.');
    const cabecera = JSON.parse(Buffer.from(cab, 'base64url').toString()) as { alg: string };
    const datos = JSON.parse(Buffer.from(carga, 'base64url').toString()) as Record<string, unknown>;
    expect(cabecera.alg).toBe('HS256');
    expect(datos.sub).toBe(usuario.id);
    expect(datos.rol).toBe('vecino');
    expect(datos.iat).toBe(segundos('2026-10-03T12:00:00-03:00'));
    expect((datos.exp as number) - (datos.iat as number)).toBe(30 * 24 * 3600);
    expect(Object.keys(datos)).not.toContain('contrasena');
    expect(Object.keys(datos)).not.toContain('email');
  });

  it('el usuario del registro es idéntico al que devuelve GET /yo', async () => {
    const res = await t
      .http()
      .post('/auth/registro')
      .send({ ...base, email: 'Igual@Mail.com' })
      .expect(201);
    const yo = await t
      .http()
      .get('/yo')
      .set('Authorization', `Bearer ${res.body.datos.token}`)
      .expect(200);
    esperarContrato(yo.body, 'Usuario');
    expect(yo.body.datos).toEqual(res.body.datos.usuario);
    expect(yo.body.datos).toMatchObject({
      rol: 'vecino',
      comercioId: null,
      favoritos: [],
      rubrosDeInteres: [],
      avisosActivos: true,
    });
  });
});

describe('AGENTS §7.1 / §7.3 — POST /auth/ingreso con nulos y cuerpos raros (verificación, 2ª pasada)', () => {
  let t: AppDePrueba;
  beforeAll(async () => {
    t = await crearApp();
    await crearUsuario(t, { email: 'ana@mail.com' });
  });
  afterAll(() => t.cerrar());

  it.each([
    ['email null', { email: null, contrasena: CONTRASENA_DE_PRUEBA }],
    ['contraseña null', { email: 'ana@mail.com', contrasena: null }],
    ['los dos null', { email: null, contrasena: null }],
    ['email vacío', { email: '', contrasena: CONTRASENA_DE_PRUEBA }],
    ['email objeto', { email: { $ne: '' }, contrasena: CONTRASENA_DE_PRUEBA }],
    ['contraseña objeto', { email: 'ana@mail.com', contrasena: { $ne: '' } }],
    ['cuerpo vacío', {}],
  ])('400 VALIDACION_FALLIDA: %s', async (_n, cuerpo) => {
    const res = await t.http().post('/auth/ingreso').send(cuerpo).expect(400);
    esperarError(res.body, 'VALIDACION_FALLIDA');
    esperarMensajeHumano(res.body);
  });

  it.each([
    ['null', 'null'],
    ['una lista', '[{"email":"ana@mail.com","contrasena":"clave-de-prueba"}]'],
    ['un texto JSON', '"ana@mail.com"'],
  ])('400 VALIDACION_FALLIDA si el cuerpo JSON es %s', async (_n, crudo) => {
    const res = await t
      .http()
      .post('/auth/ingreso')
      .set('Content-Type', 'application/json')
      .send(crudo);
    expect(res.status).toBe(400);
    esperarError(res.body, 'VALIDACION_FALLIDA');
  });

  it('un email sin forma de email: 400 o 401, nunca 500', async () => {
    const res = await t
      .http()
      .post('/auth/ingreso')
      .send({ email: "ana' OR '1'='1", contrasena: CONTRASENA_DE_PRUEBA });
    expect([400, 401]).toContain(res.status);
    esperarError(res.body);
    esperarMensajeHumano(res.body);
  });

  it('una contraseña enorme: 400 o 401, nunca 500', async () => {
    const res = await t
      .http()
      .post('/auth/ingreso')
      .send({ email: 'ana@mail.com', contrasena: 'x'.repeat(50_000) });
    expect([400, 401]).toContain(res.status);
    esperarError(res.body);
  });

  it('un comodín de LIKE en el email no ingresa a otra cuenta', async () => {
    const res = await t
      .http()
      .post('/auth/ingreso')
      .send({ email: '%@mail.com', contrasena: CONTRASENA_DE_PRUEBA });
    expect([400, 401]).toContain(res.status);
    esperarError(res.body);
  });

  it('dos ingresos seguidos dan dos sesiones que sirven las dos', async () => {
    const pedir = () =>
      t
        .http()
        .post('/auth/ingreso')
        .send({ email: 'ana@mail.com', contrasena: CONTRASENA_DE_PRUEBA })
        .expect(200);
    const [a, b] = await Promise.all([pedir(), pedir()]);
    for (const r of [a, b]) {
      esperarContrato(r.body, 'Sesion');
      await t.http().get('/yo').set('Authorization', `Bearer ${r.body.datos.token}`).expect(200);
    }
  });
});

describe('AGENTS §7.2 — Tokens con cargas y cabeceras raras (verificación, 2ª pasada)', () => {
  let t: AppDePrueba;
  let id: string;
  beforeAll(async () => {
    t = await crearApp();
    id = (await crearUsuario(t)).id;
  });
  afterAll(() => t.cerrar());

  const ahora = () => segundos('2026-10-03T12:00:00-03:00');

  it.each([
    ['sub numérico', () => ({ sub: 512, rol: 'vecino', iat: ahora(), exp: ahora() + 3600 })],
    ['sub null', () => ({ sub: null, rol: 'vecino', iat: ahora(), exp: ahora() + 3600 })],
    ['sub vacío', () => ({ sub: '', rol: 'vecino', iat: ahora(), exp: ahora() + 3600 })],
    ['exp como texto', () => ({ sub: id, rol: 'vecino', iat: ahora(), exp: 'mañana' })],
    ['exp null', () => ({ sub: id, rol: 'vecino', iat: ahora(), exp: null })],
    [
      'sub de un usuario inexistente con el prefijo bien',
      () => ({ sub: 'usr-noexiste00000', rol: 'vecino', iat: ahora(), exp: ahora() + 3600 }),
    ],
  ])('401 NO_AUTENTICADO con %s', async (_n, carga) => {
    const token = jwt(carga());
    const res = await t.http().get('/yo').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    esperarError(res.body, 'NO_AUTENTICADO');
    esperarMensajeHumano(res.body);
  });

  it('401 con un token HS512 aunque use el mismo secreto (la API firma sólo HS256)', async () => {
    const cabecera = b64url(JSON.stringify({ alg: 'HS512', typ: 'JWT' }));
    const cuerpo = b64url(
      JSON.stringify({ sub: id, rol: 'vecino', iat: ahora(), exp: ahora() + 3600 }),
    );
    const firma = createHmac('sha512', SECRETO).update(`${cabecera}.${cuerpo}`).digest('base64url');
    const res = await t
      .http()
      .get('/yo')
      .set('Authorization', `Bearer ${cabecera}.${cuerpo}.${firma}`);
    expect(res.status).toBe(401);
    esperarError(res.body, 'NO_AUTENTICADO');
  });

  it.each([
    ['Bearer con dos espacios', (tk: string) => `Bearer  ${tk}`],
    ['dos tokens', (tk: string) => `Bearer ${tk} ${tk}`],
    ['token con basura al final', (tk: string) => `Bearer ${tk}x`],
    ['sólo la palabra Bearer', () => 'Bearer'],
    ['Bearer con un texto no ASCII', () => 'Bearer ñandú.ñandú.ñandú'],
  ])('%s: 200 o 401, nunca 500', async (_n, armar) => {
    const token = jwt({ sub: id, rol: 'vecino', iat: ahora(), exp: ahora() + 3600 });
    const res = await t.http().get('/yo').set('Authorization', armar(token));
    expect([200, 401]).toContain(res.status);
    if (res.status === 401) esperarError(res.body, 'NO_AUTENTICADO');
  });

  it('un token de un usuario inexistente en un endpoint público se ignora (A7)', async () => {
    const token = jwt({
      sub: 'usr-noexiste00000',
      rol: 'vecino',
      iat: ahora(),
      exp: ahora() + 3600,
    });
    await t.http().get('/salud').set('Authorization', `Bearer ${token}`).expect(200);
  });
});

describe('AGENTS §7.1 / A9 — PATCH /yo con nulos y cuerpos raros (verificación, 2ª pasada)', () => {
  let t: AppDePrueba;
  beforeEach(async () => {
    t = await crearApp();
  });
  afterEach(() => t.cerrar());

  it.each([
    ['avisosActivos null', { avisosActivos: null }],
    ['rubrosDeInteres null', { rubrosDeInteres: null }],
    ['favoritos null', { favoritos: null }],
    ['comercioId null', { comercioId: null }],
    ['rol null', { rol: null }],
    ['email null', { email: null }],
    ['nombre objeto', { nombre: { texto: 'Ana' } }],
    ['nombre booleano', { nombre: false }],
    ['nombre con sólo tabulaciones', { nombre: '\t\t' }],
  ])('400 VALIDACION_FALLIDA: %s (y no cambia nada)', async (_n, cuerpo) => {
    const v = await crearUsuario(t, { nombre: 'Original' });
    const res = await t.http().patch('/yo').set(v.auth).send(cuerpo).expect(400);
    esperarError(res.body, 'VALIDACION_FALLIDA');
    esperarMensajeHumano(res.body);
    const yo = await t.http().get('/yo').set(v.auth).expect(200);
    expect(yo.body.datos).toMatchObject({ nombre: 'Original', rol: 'vecino', comercioId: null });
  });

  it.each([
    ['null', 'null'],
    ['una lista', '[{"nombre":"Ana"}]'],
    ['un texto JSON', '"Ana"'],
  ])('400 VALIDACION_FALLIDA si el cuerpo JSON es %s', async (_n, crudo) => {
    const v = await crearUsuario(t, { nombre: 'Original' });
    const res = await t
      .http()
      .patch('/yo')
      .set(v.auth)
      .set('Content-Type', 'application/json')
      .send(crudo);
    expect(res.status).toBe(400);
    esperarError(res.body, 'VALIDACION_FALLIDA');
  });

  it('__proto__ con rol no convierte al vecino en comercio', async () => {
    const v = await crearUsuario(t, { nombre: 'Original' });
    const res = await t
      .http()
      .patch('/yo')
      .set(v.auth)
      .set('Content-Type', 'application/json')
      .send('{"nombre":"Cambiada","__proto__":{"rol":"comercio","comercioId":"com-118"}}');
    expect([200, 400]).toContain(res.status);
    const yo = await t.http().get('/yo').set(v.auth).expect(200);
    expect(yo.body.datos).toMatchObject({ rol: 'vecino', comercioId: null });
  });

  it('la respuesta del PATCH cumple el contrato y es igual a GET /yo (cuenta de comercio)', async () => {
    const c = await crearUsuario(t, {
      rol: 'comercio',
      comercioId: 'com-118',
      avisosActivos: false,
    });
    const res = await t.http().patch('/yo').set(c.auth).send({ nombre: 'El Tornillo' }).expect(200);
    esperarContrato(res.body, 'Usuario');
    const yo = await t.http().get('/yo').set(c.auth).expect(200);
    expect(res.body.datos).toEqual(yo.body.datos);
    expect(yo.body.datos).toMatchObject({
      nombre: 'El Tornillo',
      rol: 'comercio',
      comercioId: 'com-118',
      avisosActivos: false,
    });
  });

  it('PATCH /yo con un token firmado con otro secreto: 401 y no cambia', async () => {
    const v = await crearUsuario(t, { nombre: 'Original' });
    const ahora = segundos('2026-10-03T12:00:00-03:00');
    const falso = jwt(
      { sub: v.id, rol: 'vecino', iat: ahora, exp: ahora + 3600 },
      { secreto: 'otro' },
    );
    const res = await t
      .http()
      .patch('/yo')
      .set('Authorization', `Bearer ${falso}`)
      .send({ nombre: 'Hackeada' })
      .expect(401);
    esperarError(res.body, 'NO_AUTENTICADO');
    const yo = await t.http().get('/yo').set(v.auth).expect(200);
    expect(yo.body.datos.nombre).toBe('Original');
  });
});

describe('AGENTS §9 / A1–A4 — /dispositivos con nulos, cuerpos raros y concurrencia (verificación, 2ª pasada)', () => {
  let t: AppDePrueba;
  beforeEach(async () => {
    t = await crearApp();
  });
  afterEach(() => t.cerrar());

  it.each([
    ['token null', { tokenExpo: null, plataforma: 'ios' }],
    ['plataforma null', { tokenExpo: TOKEN, plataforma: null }],
    ['los dos null', { tokenExpo: null, plataforma: null }],
    ['cuerpo vacío', {}],
    ['token lista', { tokenExpo: [TOKEN], plataforma: 'ios' }],
    ['plataforma numérica', { tokenExpo: TOKEN, plataforma: 1 }],
    ['plataforma vacía', { tokenExpo: TOKEN, plataforma: '' }],
    ['sincronizado de más', { tokenExpo: TOKEN, plataforma: 'ios', sincronizado: true }],
  ])('POST 400 VALIDACION_FALLIDA: %s', async (_n, cuerpo) => {
    const v = await crearUsuario(t);
    const res = await t.http().post('/dispositivos').set(v.auth).send(cuerpo).expect(400);
    esperarError(res.body, 'VALIDACION_FALLIDA');
    esperarMensajeHumano(res.body);
    const prueba = await t.http().post('/dispositivos/prueba').set(v.auth).expect(200);
    expect(prueba.body.datos.dispositivos).toBe(0);
  });

  it.each([
    ['null', 'null'],
    ['una lista', `[{"tokenExpo":"${TOKEN}","plataforma":"ios"}]`],
  ])('POST 400 VALIDACION_FALLIDA si el cuerpo JSON es %s', async (_n, crudo) => {
    const v = await crearUsuario(t);
    const res = await t
      .http()
      .post('/dispositivos')
      .set(v.auth)
      .set('Content-Type', 'application/json')
      .send(crudo);
    expect(res.status).toBe(400);
    esperarError(res.body, 'VALIDACION_FALLIDA');
  });

  it('un token con espacios alrededor: 400 o se guarda sin los espacios, nunca otra cosa', async () => {
    const v = await crearUsuario(t);
    const res = await t
      .http()
      .post('/dispositivos')
      .set(v.auth)
      .send({ tokenExpo: `  ${TOKEN} `, plataforma: 'ios' });
    expect([201, 400]).toContain(res.status);
    if (res.status === 201) {
      esperarContrato(res.body, 'Dispositivo');
      expect(res.body.datos.tokenExpo).toBe(TOKEN);
    } else esperarError(res.body, 'VALIDACION_FALLIDA');
  });

  it('AGENTS §9 — dos usuarios registran el mismo token a la vez: queda de uno solo, nunca 500', async () => {
    const a = await crearUsuario(t);
    const b = await crearUsuario(t);
    const [ra, rb] = await Promise.all([
      t.http().post('/dispositivos').set(a.auth).send({ tokenExpo: TOKEN, plataforma: 'ios' }),
      t.http().post('/dispositivos').set(b.auth).send({ tokenExpo: TOKEN, plataforma: 'android' }),
    ]);
    expect(ra.status).toBe(201);
    expect(rb.status).toBe(201);
    const pa = await t.http().post('/dispositivos/prueba').set(a.auth).expect(200);
    const pb = await t.http().post('/dispositivos/prueba').set(b.auth).expect(200);
    expect(pa.body.datos.dispositivos + pb.body.datos.dispositivos).toBe(1);
  });

  it('AGENTS §10.5 — el mismo POST cinco veces a la vez: todos 201 iguales y un solo teléfono', async () => {
    const v = await crearUsuario(t);
    const respuestas = await Promise.all(
      Array.from({ length: 5 }, () =>
        t.http().post('/dispositivos').set(v.auth).send({ tokenExpo: TOKEN, plataforma: 'ios' }),
      ),
    );
    for (const r of respuestas) {
      expect(r.status).toBe(201);
      esperarContrato(r.body, 'Dispositivo');
      expect(r.body).toEqual(respuestas[0].body);
    }
    const prueba = await t.http().post('/dispositivos/prueba').set(v.auth).expect(200);
    expect(prueba.body.datos.dispositivos).toBe(1);
  });

  it('A1 — la prueba con dos teléfonos cuenta 2 y manda a los dos tokens', async () => {
    const v = await crearUsuario(t);
    await t
      .http()
      .post('/dispositivos')
      .set(v.auth)
      .send({ tokenExpo: TOKEN, plataforma: 'ios' })
      .expect(201);
    await t
      .http()
      .post('/dispositivos')
      .set(v.auth)
      .send({ tokenExpo: OTRO_TOKEN, plataforma: 'android' })
      .expect(201);
    const res = await t.http().post('/dispositivos/prueba').set(v.auth).expect(200);
    esperarContrato(res.body, 'PruebaPush');
    expect(res.body.datos).toEqual({ dispositivos: 2 });
    await t.avisos.esperarPendientes();
    expect(t.enviador.enviados.flatMap((m) => m.tokens).sort()).toEqual([OTRO_TOKEN, TOKEN].sort());
  });

  it('A2 — DELETE con algo que no es un token de Expo: 204 o 400, nunca 500', async () => {
    const v = await crearUsuario(t);
    const res = await t.http().delete('/dispositivos/cualquier-cosa').set(v.auth);
    expect([204, 400]).toContain(res.status);
    if (res.status === 400) esperarError(res.body, 'VALIDACION_FALLIDA');
  });

  it('A2 — DELETE del token de otro con un token de sesión de comercio: el otro lo conserva', async () => {
    const vecino = await crearUsuario(t);
    const comercio = await crearUsuario(t, { rol: 'comercio', comercioId: 'com-118' });
    await t
      .http()
      .post('/dispositivos')
      .set(vecino.auth)
      .send({ tokenExpo: TOKEN, plataforma: 'ios' })
      .expect(201);
    await t
      .http()
      .delete(`/dispositivos/${encodeURIComponent(TOKEN)}`)
      .set(comercio.auth)
      .expect(204);
    const prueba = await t.http().post('/dispositivos/prueba').set(vecino.auth).expect(200);
    expect(prueba.body.datos.dispositivos).toBe(1);
  });
});

describe('AGENTS §8 / A5 — Archivos: rangos y subidas que faltaban (verificación, 2ª pasada)', () => {
  let t: AppDePrueba;
  let auth: { Authorization: string };
  let ruta: string;
  let video: Buffer;
  beforeAll(async () => {
    t = await crearApp();
    auth = (await crearUsuario(t)).auth;
    video = conPatron(mp4(1000));
    const res = await t
      .http()
      .post('/archivos')
      .set(auth)
      .attach('archivo', video, 'v.mp4')
      .expect(201);
    ruta = new URL(res.body.datos.url).pathname;
  });
  afterAll(() => t.cerrar());

  it('206 con bytes=0- (todo el archivo como rango), con Content-Type de video', async () => {
    const res = await t.http().get(ruta).set('Range', 'bytes=0-').buffer(true).expect(206);
    expect(res.headers['content-range']).toBe('bytes 0-999/1000');
    expect(res.headers['content-type']).toBe('video/mp4');
    expect(res.headers['accept-ranges']).toBe('bytes');
    expect(Buffer.compare(res.body as Buffer, video)).toBe(0);
  });

  it('bytes=-0 (sufijo vacío): 416 o 200, nunca 206 vacío ni 500', async () => {
    const res = await t.http().get(ruta).set('Range', 'bytes=-0').buffer(true);
    expect([200, 416]).toContain(res.status);
  });

  it('una unidad que no es bytes se ignora: 200 entero', async () => {
    const res = await t.http().get(ruta).set('Range', 'items=0-5').buffer(true).expect(200);
    expect((res.body as Buffer).length).toBe(1000);
  });

  it('If-None-Match con el ETag: 304 o 200, nunca 500', async () => {
    const primero = await t.http().get(ruta).buffer(true).expect(200);
    const etag = primero.headers.etag as string;
    expect(etag).toBeTruthy();
    const res = await t.http().get(ruta).set('If-None-Match', etag).buffer(true);
    expect([200, 304]).toContain(res.status);
  });

  it('413 con un PNG de 5 MB + 1 byte', async () => {
    const grande = Buffer.alloc(5 * MB + 1, 0x22);
    grande.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    const res = await t
      .http()
      .post('/archivos')
      .set(auth)
      .attach('archivo', grande, 'g.png')
      .expect(413);
    esperarError(res.body, 'ARCHIVO_DEMASIADO_GRANDE');
  });

  it('un multipart roto: 400, nunca 500', async () => {
    const res = await t
      .http()
      .post('/archivos')
      .set(auth)
      .set('Content-Type', 'multipart/form-data; boundary=----xyz')
      .send(
        '------xyz\r\nContent-Disposition: form-data; name="archivo"; filename="a.jpg"\r\n\r\nsin cierre',
      );
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    esperarError(res.body);
  });

  it('el campo archivo como texto (no como archivo): 400 VALIDACION_FALLIDA', async () => {
    const res = await t.http().post('/archivos').set(auth).field('archivo', 'hola').expect(400);
    esperarError(res.body, 'VALIDACION_FALLIDA');
    esperarMensajeHumano(res.body);
  });

  it('la URL subida a las 00:00 del 1/1 usa el año nuevo (zona de Buenos Aires)', async () => {
    t.reloj.fijar('2027-01-01T00:00:00-03:00');
    const v = await crearUsuario(t);
    const res = await t
      .http()
      .post('/archivos')
      .set(v.auth)
      .attach('archivo', jpeg(), 'f.jpg')
      .expect(201);
    expect(res.body.datos.url).toMatch(/\/archivos\/imagenes\/2027\/01\//);
    t.reloj.fijar('2026-10-03T12:00:00-03:00');
  });
});

// ---------------------------------------------------------------------------------------------
// 3ª pasada

describe('AGENTS §7.1 / §7.2 / A13 — Registro e ingreso: bordes de contraseña y email (verificación, 3ª pasada)', () => {
  let t: AppDePrueba;
  beforeEach(async () => {
    t = await crearApp();
  });
  afterEach(() => t.cerrar());

  async function registrarEIngresar(email: string, contrasena: string, emailIngreso = email) {
    const reg = await t
      .http()
      .post('/auth/registro')
      .send({ nombre: 'Lidia Sosa', email, contrasena })
      .expect(201);
    esperarContrato(reg.body, 'Sesion');
    const ing = await t
      .http()
      .post('/auth/ingreso')
      .send({ email: emailIngreso, contrasena })
      .expect(200);
    esperarContrato(ing.body, 'Sesion');
    expect(ing.body.datos.usuario.id).toBe(reg.body.datos.usuario.id);
    return reg;
  }

  it('A13 — una contraseña de 100 caracteres justos se registra y después ingresa', async () => {
    await registrarEIngresar('cien@mail.com', 'a'.repeat(99) + 'Z');
  });

  it('una contraseña con espacios al principio y al final ingresa escrita igual', async () => {
    await registrarEIngresar('espacios@mail.com', '  clave con espacios  ');
  });

  it('una contraseña con eñes, tildes y emoji ingresa escrita igual', async () => {
    await registrarEIngresar('unicode@mail.com', 'contraseñá-ÑANDÚ-🔒');
  });

  it('una contraseña con espacios no ingresa si se manda recortada (no se recorta en silencio sólo de un lado)', async () => {
    await t
      .http()
      .post('/auth/registro')
      .send({
        nombre: 'Lidia Sosa',
        email: 'recorte@mail.com',
        contrasena: '  clave con espacios  ',
      })
      .expect(201);
    const res = await t
      .http()
      .post('/auth/ingreso')
      .send({ email: 'recorte@mail.com', contrasena: 'clave con espacios' });
    // O se recorta en los dos lados (200) o en ninguno (401). Nunca 500 ni 400.
    expect([200, 401]).toContain(res.status);
    if (res.status === 401) esperarError(res.body, 'CREDENCIALES_INVALIDAS');
  });

  it('AGENTS §7.1 — ingresa con el email escrito en mayúsculas', async () => {
    const reg = await registrarEIngresar('lidia@mail.com', 'clave-larga', 'LIDIA@MAIL.COM');
    expect(reg.body.datos.usuario.email).toBe('lidia@mail.com');
  });

  it('AGENTS §7.1 — ingreso con una contraseña de 101 caracteres contra una cuenta real: 401 o 400, nunca 500', async () => {
    await t
      .http()
      .post('/auth/registro')
      .send({ nombre: 'Lidia Sosa', email: 'largo@mail.com', contrasena: 'clave-larga' })
      .expect(201);
    const res = await t
      .http()
      .post('/auth/ingreso')
      .send({ email: 'largo@mail.com', contrasena: 'x'.repeat(101) });
    expect([400, 401]).toContain(res.status);
    esperarError(res.body, res.status === 401 ? 'CREDENCIALES_INVALIDAS' : 'VALIDACION_FALLIDA');
    esperarMensajeHumano(res.body);
  });

  it('AGENTS §5.5 / §7.1 — cinco registros simultáneos con el mismo email (mayúsculas distintas): uno 201 y cuatro 409', async () => {
    const emails = [
      'par@mail.com',
      'PAR@mail.com',
      'Par@Mail.com',
      ' par@mail.com',
      'pAR@MAIL.COM',
    ];
    const respuestas = await Promise.all(
      emails.map((email) =>
        t.http().post('/auth/registro').send({ nombre: 'Par', email, contrasena: 'clave-larga' }),
      ),
    );
    const estados = respuestas.map((r) => r.status).sort();
    expect(estados).toEqual([201, 409, 409, 409, 409]);
    for (const r of respuestas.filter((x) => x.status === 409)) {
      esperarError(r.body, 'EMAIL_YA_REGISTRADO');
      esperarMensajeHumano(r.body);
    }
  });
});

describe('AGENTS §8 — URLs de archivos con cabeceras Host raras (verificación, 3ª pasada)', () => {
  let t: AppDePrueba;
  let auth: { Authorization: string };
  beforeAll(async () => {
    t = await crearApp();
    auth = (await crearUsuario(t)).auth;
  });
  afterAll(() => t.cerrar());

  it.each([
    ['IPv6', '[::1]:3000'],
    ['sin puerto', '192.168.0.10'],
    ['un nombre con mayúsculas', 'MiCompu.local:3000'],
  ])('Host %s: la URL es absoluta, con ese origen, y se puede bajar', async (_n, host) => {
    const res = await t
      .http()
      .post('/archivos')
      .set(auth)
      .set('Host', host)
      .attach('archivo', jpeg(), 'foto.jpg')
      .expect(201);
    esperarContrato(res.body, 'ArchivoSubido');
    const url = new URL(res.body.datos.url);
    expect(url.protocol).toBe('http:');
    expect(url.host.toLowerCase()).toBe(new URL(`http://${host}`).host.toLowerCase());
    await t.http().get(url.pathname).expect(200);
  });

  it('un Host con caracteres inválidos no rompe la subida (201 con URL válida, o 400), nunca 500', async () => {
    const res = await t
      .http()
      .post('/archivos')
      .set(auth)
      .set('Host', 'mala"<script>')
      .attach('archivo', jpeg(), 'foto.jpg');
    expect([201, 400]).toContain(res.status);
    if (res.status === 201) {
      esperarContrato(res.body, 'ArchivoSubido');
      expect(() => new URL(res.body.datos.url)).not.toThrow();
      expect(res.body.datos.url).not.toContain('<script>');
    } else {
      esperarError(res.body);
    }
  });
});
