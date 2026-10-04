// Verificación independiente de M0 — Base (AGENTS §4, §7, §8, §9, §11.4; ESPECIFICACION §1).
// Caja negra: sólo HTTP contra la app completa. Complementa test/e2e/ sin repetirlo.
import { createHmac } from 'node:crypto';
import type {
  ArchivoSubido,
  Dispositivo,
  PruebaDePush,
  Salud,
  Sesion,
} from '../../contrato/api.js';
import type { Usuario } from '../../contrato/tipos.js';
import {
  type AppDePrueba,
  AHORA_POR_DEFECTO,
  JWT_SECRETO_PRUEBA,
  crearApp,
} from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { jpeg, mp4, png } from '../utilidades/archivos.js';
import { crearUsuario, registrarJugador } from '../utilidades/usuarios.js';

const MB = 1024 * 1024;

/** Palabras que delatan un mensaje técnico o en inglés (AGENTS §4.6). */
const JERGA =
  /\b(must|should|property|constraint|undefined|null|string|number|boolean|array|object|error|exception|invalid|unexpected|json|jwt|bearer|statusCode|contrasena|tokenExpo)\b/i;

function esperarMensajeHumano(mensaje: string): void {
  expect(mensaje).not.toMatch(JERGA);
  expect(mensaje.length).toBeLessThan(140);
}

const b64url = (v: string | Buffer) => Buffer.from(v).toString('base64url');

function firmarJwt(
  payload: Record<string, unknown>,
  secreto = JWT_SECRETO_PRUEBA,
  alg = 'HS256',
): string {
  const cabecera = b64url(JSON.stringify({ alg, typ: 'JWT' }));
  const cuerpo = b64url(JSON.stringify(payload));
  if (alg === 'none') return `${cabecera}.${cuerpo}.`;
  const firma = createHmac('sha256', secreto)
    .update(`${cabecera}.${cuerpo}`)
    .digest('base64url');
  return `${cabecera}.${cuerpo}.${firma}`;
}

function leerJwt(token: string): Record<string, unknown> {
  const [cabecera, cuerpo] = token.split('.');
  return {
    ...(JSON.parse(Buffer.from(cuerpo, 'base64url').toString()) as Record<
      string,
      unknown
    >),
    _cabecera: JSON.parse(Buffer.from(cabecera, 'base64url').toString()),
  };
}

const segundos = (iso: string) => Math.floor(Date.parse(iso) / 1000);

const registroValido = () => ({
  nombre: 'Lucía Benítez',
  email: `lucia-${Math.random().toString(36).slice(2)}@mail.com`,
  contrasena: 'clave-segura-123',
  telefono: '3455-401122',
});

// ---------------------------------------------------------------------------

describe('AGENTS §7.2 — El token: HS256, sub, rol y 30 días medidos con el Reloj', () => {
  let a: AppDePrueba;
  beforeAll(async () => {
    a = await crearApp();
  });
  afterAll(() => a.cerrar());

  it('el token del registro trae sub = id, rol jugador, HS256 y vence a los 30 días del reloj', async () => {
    const j = await registrarJugador(a);
    const p = leerJwt(j.token);
    expect(p._cabecera).toMatchObject({ alg: 'HS256' });
    expect(p.sub).toBe(j.usuario.id);
    expect(p.rol).toBe('jugador');
    expect(p.exp).toBe(segundos(AHORA_POR_DEFECTO) + 30 * 24 * 60 * 60);
  });

  it('el token del ingreso de un encargado trae su rol', async () => {
    const e = await crearUsuario(a, 'encargado');
    expect(leerJwt(e.token).rol).toBe('encargado');
  });

  it('NO_AUTENTICADO (401) con alg "none"', async () => {
    const j = await registrarJugador(a);
    const falso = firmarJwt(
      {
        sub: j.usuario.id,
        rol: 'administrador',
        exp: segundos(AHORA_POR_DEFECTO) + 3600,
      },
      '',
      'none',
    );
    esperarError(
      await a.http().get('/yo').set('Authorization', `Bearer ${falso}`),
      401,
      'NO_AUTENTICADO',
    );
  });

  it('M0-3 — NO_AUTENTICADO (401) con un token bien firmado de un usuario que no existe', async () => {
    const t = firmarJwt({
      sub: 'usr-noexisteeste',
      rol: 'jugador',
      iat: segundos(AHORA_POR_DEFECTO),
      exp: segundos(AHORA_POR_DEFECTO) + 3600,
    });
    esperarError(
      await a.http().get('/yo').set('Authorization', `Bearer ${t}`),
      401,
      'NO_AUTENTICADO',
    );
  });

  it('NO_AUTENTICADO (401) con un token bien firmado pero con exp en el pasado del reloj', async () => {
    const j = await registrarJugador(a);
    const t = firmarJwt({
      sub: j.usuario.id,
      rol: 'jugador',
      iat: segundos(AHORA_POR_DEFECTO) - 7200,
      exp: segundos(AHORA_POR_DEFECTO) - 1,
    });
    esperarError(
      await a.http().get('/yo').set('Authorization', `Bearer ${t}`),
      401,
      'NO_AUTENTICADO',
    );
  });

  it('/yo devuelve el rol de la base, no el que diga el token', async () => {
    const j = await registrarJugador(a);
    const t = firmarJwt({
      sub: j.usuario.id,
      rol: 'administrador',
      iat: segundos(AHORA_POR_DEFECTO),
      exp: segundos(AHORA_POR_DEFECTO) + 3600,
    });
    const res = await a.http().get('/yo').set('Authorization', `Bearer ${t}`);
    // O lo rechaza (rol que no coincide) o devuelve el rol real; nunca "administrador".
    if (res.status === 200) {
      expect(esperarContrato<Usuario>(res.body, 'Usuario').rol).toBe('jugador');
    } else {
      esperarError(res, 401, 'NO_AUTENTICADO');
    }
  });

  it.each([
    ['Bearer vacío', 'Bearer '],
    ['Bearer con dos partes', 'Bearer abc def'],
    ['sólo el token, sin Bearer', 'eyJhbGciOiJIUzI1NiJ9.e30.x'],
    ['token truncado', 'TRUNCAR'],
  ])('NO_AUTENTICADO (401): %s', async (_caso, cabecera) => {
    let valor = cabecera;
    if (cabecera === 'TRUNCAR') {
      const j = await registrarJugador(a);
      valor = `Bearer ${j.token.slice(0, -3)}`;
    }
    const res = await a.http().get('/yo').set('Authorization', valor);
    esperarError(res, 401, 'NO_AUTENTICADO');
    esperarMensajeHumano(res.body.error.mensaje);
  });

  it('el mismo jugador ingresa dos veces y los dos tokens sirven', async () => {
    const j = await registrarJugador(a);
    const r = await a
      .http()
      .post('/auth/ingreso')
      .send({ email: j.usuario.email, contrasena: j.contrasena })
      .expect(200);
    const s = esperarContrato<Sesion>(r.body, 'Sesion');
    await a
      .http()
      .get('/yo')
      .set('Authorization', `Bearer ${s.token}`)
      .expect(200);
    await a
      .http()
      .get('/yo')
      .set('Authorization', `Bearer ${j.token}`)
      .expect(200);
  });
});

describe('ESPECIFICACION §1 — Registro: sólo crea jugadores y el teléfono es obligatorio', () => {
  let a: AppDePrueba;
  beforeAll(async () => {
    a = await crearApp();
  });
  afterAll(() => a.cerrar());

  it.each([
    ['id', { id: 'usr-hacker' }],
    ['espaciosFavoritos', { espaciosFavoritos: ['esp-02'] }],
    ['cancelacionesTardias', { cancelacionesTardias: -5 }],
    ['ausencias', { ausencias: 3 }],
    ['rol jugador explícito', { rol: 'jugador' }],
    ['contrasenaHash', { contrasenaHash: 'x' }],
    ['password en inglés', { password: 'clave-segura-123' }],
  ])('VALIDACION_FALLIDA (400) por un campo de más: %s', async (_c, extra) => {
    const res = await a
      .http()
      .post('/auth/registro')
      .send({ ...registroValido(), ...extra });
    esperarError(res, 400, 'VALIDACION_FALLIDA');
    esperarMensajeHumano(res.body.error.mensaje);
  });

  it.each([
    ['teléfono numérico', { telefono: 3455401122 }],
    ['teléfono null', { telefono: null }],
    ['email numérico', { email: 12345 }],
    ['nombre como lista', { nombre: ['Lucía'] }],
    ['email vacío', { email: '' }],
    ['contraseña vacía', { contrasena: '' }],
    ['nombre como objeto', { nombre: { texto: 'Lucía' } }],
  ])('VALIDACION_FALLIDA (400) por tipo equivocado: %s', async (_c, cambio) => {
    const res = await a
      .http()
      .post('/auth/registro')
      .send({ ...registroValido(), ...cambio });
    esperarError(res, 400, 'VALIDACION_FALLIDA');
    esperarMensajeHumano(res.body.error.mensaje);
  });

  it('VALIDACION_FALLIDA (400) si el cuerpo es una lista', async () => {
    const res = await a.http().post('/auth/registro').send([registroValido()]);
    esperarError(res, 400, 'VALIDACION_FALLIDA');
  });

  it('VALIDACION_FALLIDA (400) sin cuerpo', async () => {
    const res = await a.http().post('/auth/registro');
    esperarError(res, 400, 'VALIDACION_FALLIDA');
    esperarMensajeHumano(res.body.error.mensaje);
  });

  it('VALIDACION_FALLIDA (400) con el cuerpo como texto plano', async () => {
    const res = await a
      .http()
      .post('/auth/registro')
      .set('Content-Type', 'text/plain')
      .send(JSON.stringify(registroValido()));
    esperarError(res, 400, 'VALIDACION_FALLIDA');
  });

  it('una contraseña de 8 caracteres justos alcanza', async () => {
    const res = await a
      .http()
      .post('/auth/registro')
      .send({ ...registroValido(), contrasena: '12345678' })
      .expect(201);
    esperarContrato<Sesion>(res.body, 'Sesion');
  });

  it('una contraseña con tildes y ñ ingresa después con la misma', async () => {
    const cuerpo = { ...registroValido(), contrasena: 'contraseña-ñandú-ÁÉ' };
    await a.http().post('/auth/registro').send(cuerpo).expect(201);
    await a
      .http()
      .post('/auth/ingreso')
      .send({ email: cuerpo.email, contrasena: cuerpo.contrasena })
      .expect(200);
    esperarError(
      await a
        .http()
        .post('/auth/ingreso')
        .send({ email: cuerpo.email, contrasena: 'contrasena-nandu-AE' }),
      401,
      'CREDENCIALES_INVALIDAS',
    );
  });

  it('la contraseña distingue mayúsculas', async () => {
    const j = await registrarJugador(a);
    esperarError(
      await a.http().post('/auth/ingreso').send({
        email: j.usuario.email,
        contrasena: j.contrasena.toUpperCase(),
      }),
      401,
      'CREDENCIALES_INVALIDAS',
    );
  });

  it('un nombre con tildes y ñ vuelve igual', async () => {
    const res = await a
      .http()
      .post('/auth/registro')
      .send({ ...registroValido(), nombre: 'José Ñáñez' })
      .expect(201);
    expect(esperarContrato<Sesion>(res.body, 'Sesion').usuario.nombre).toBe(
      'José Ñáñez',
    );
  });

  it('el usuario del registro es el mismo que devuelven /yo y el ingreso', async () => {
    const cuerpo = registroValido();
    const reg = esperarContrato<Sesion>(
      (await a.http().post('/auth/registro').send(cuerpo).expect(201)).body,
      'Sesion',
    );
    const yo = esperarContrato<Usuario>(
      (
        await a
          .http()
          .get('/yo')
          .set('Authorization', `Bearer ${reg.token}`)
          .expect(200)
      ).body,
      'Usuario',
    );
    const ing = esperarContrato<Sesion>(
      (
        await a
          .http()
          .post('/auth/ingreso')
          .send({ email: cuerpo.email, contrasena: cuerpo.contrasena })
          .expect(200)
      ).body,
      'Sesion',
    );
    expect(yo).toEqual(reg.usuario);
    expect(ing.usuario).toEqual(reg.usuario);
    expect(Object.keys(yo).sort()).toEqual(
      [
        'id',
        'nombre',
        'email',
        'telefono',
        'rol',
        'espaciosFavoritos',
        'cancelacionesTardias',
        'ausencias',
      ].sort(),
    );
  });

  it('EMAIL_YA_REGISTRADO (409) también si el email ya era de un encargado', async () => {
    const e = await crearUsuario(a, 'encargado');
    const res = await a
      .http()
      .post('/auth/registro')
      .send({ ...registroValido(), email: e.usuario.email });
    esperarError(res, 409, 'EMAIL_YA_REGISTRADO');
    esperarMensajeHumano(res.body.error.mensaje);
  });

  it('el registro devuelve 201 con meta: null y sin cabeceras raras de cuerpo', async () => {
    const res = await a
      .http()
      .post('/auth/registro')
      .send(registroValido())
      .expect(201);
    expect(res.body.meta).toBeNull();
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});

describe('AGENTS §7.1 — Ingreso: validación del cuerpo', () => {
  let a: AppDePrueba;
  beforeAll(async () => {
    a = await crearApp();
  });
  afterAll(() => a.cerrar());

  it.each([
    [
      'campo de más',
      { email: 'a@b.ar', contrasena: 'clave-segura-123', recordar: true },
    ],
    ['sin email', { contrasena: 'clave-segura-123' }],
    ['email numérico', { email: 5, contrasena: 'clave-segura-123' }],
    ['contraseña numérica', { email: 'a@b.ar', contrasena: 12345678 }],
  ])('VALIDACION_FALLIDA (400): %s', async (_c, cuerpo) => {
    const res = await a.http().post('/auth/ingreso').send(cuerpo);
    esperarError(res, 400, 'VALIDACION_FALLIDA');
    esperarMensajeHumano(res.body.error.mensaje);
  });

  it('CREDENCIALES_INVALIDAS con mensaje humano y sin revelar si el email existe', async () => {
    const res = await a
      .http()
      .post('/auth/ingreso')
      .send({ email: 'nadie@prueba.ar', contrasena: 'clave-segura-123' });
    esperarError(res, 401, 'CREDENCIALES_INVALIDAS');
    esperarMensajeHumano(res.body.error.mensaje);
    expect(res.body.error.mensaje).not.toMatch(/no existe|no está registrado/i);
  });

  it('dos ingresos simultáneos del mismo usuario: los dos 200', async () => {
    const j = await registrarJugador(a);
    const rs = await Promise.all(
      [1, 2].map(() =>
        a
          .http()
          .post('/auth/ingreso')
          .send({ email: j.usuario.email, contrasena: j.contrasena }),
      ),
    );
    rs.forEach((r) => {
      expect(r.status).toBe(200);
      esperarContrato<Sesion>(r.body, 'Sesion');
    });
  });
});

describe('AGENTS §7.3 — Seguro por defecto, pero lo público no se cae por un token vencido', () => {
  let a: AppDePrueba;
  beforeAll(async () => {
    a = await crearApp();
  });
  afterAll(() => a.cerrar());

  it('/salud responde 200 aunque la app mande un token vencido', async () => {
    const j = await registrarJugador(a);
    a.reloj.avanzarMinutos(31 * 24 * 60);
    try {
      const res = await a
        .http()
        .get('/salud')
        .set('Authorization', `Bearer ${j.token}`)
        .expect(200);
      esperarContrato<Salud>(res.body, 'Salud');
    } finally {
      a.reloj.avanzarMinutos(-31 * 24 * 60);
    }
  });

  it('/salud responde 200 con un token basura', async () => {
    await a
      .http()
      .get('/salud')
      .set('Authorization', 'Bearer basura')
      .expect(200);
  });
});

describe('AGENTS §4.1 y §4.6 — Sobre de error en lo que no es una ruta conocida', () => {
  let a: AppDePrueba;
  beforeAll(async () => {
    a = await crearApp();
  });
  afterAll(() => a.cerrar());

  it.each([
    ['PUT', '/salud'],
    ['DELETE', '/auth/registro'],
    ['GET', '/auth/ingreso'],
    ['POST', '/no-existe'],
    ['GET', '/archivos'],
    ['GET', '/dispositivos'],
  ])(
    '%s %s → 404 RUTA_NO_ENCONTRADA (o 401 si pide sesión) con sobre exacto',
    async (metodo, ruta) => {
      const http = a.http();
      const pedido =
        metodo === 'PUT'
          ? http.put(ruta)
          : metodo === 'DELETE'
            ? http.delete(ruta)
            : metodo === 'POST'
              ? http.post(ruta).send({})
              : http.get(ruta);
      const res = await pedido;
      if (res.status === 401) esperarError(res, 401, 'NO_AUTENTICADO');
      else if (
        ruta === '/archivos' &&
        res.status === 404 &&
        res.body.error?.codigo === 'ARCHIVO_NO_ENCONTRADO'
      )
        esperarError(res, 404, 'ARCHIVO_NO_ENCONTRADO');
      else esperarError(res, 404, 'RUTA_NO_ENCONTRADA');
      esperarMensajeHumano(res.body.error.mensaje);
    },
  );

  it('PATCH /yo no existe todavía en M0 (M0-4), pero responde con el sobre', async () => {
    const j = await registrarJugador(a);
    const res = await a
      .http()
      .patch('/yo')
      .set('Authorization', `Bearer ${j.token}`)
      .send({ nombre: 'Otro' });
    expect(res.status).toBe(404);
    esperarError(res, 404, 'RUTA_NO_ENCONTRADA');
  });

  it('un JSON mal formado a una ruta protegida devuelve un sobre de error, nunca 500', async () => {
    const res = await a
      .http()
      .post('/dispositivos')
      .set('Content-Type', 'application/json')
      .send('{"tokenExpo": ');
    expect([400, 401]).toContain(res.status);
    esperarError(
      res,
      res.status,
      res.status === 400 ? 'VALIDACION_FALLIDA' : 'NO_AUTENTICADO',
    );
  });

  it('un cuerpo JSON enorme no da 500 ni rompe el sobre', async () => {
    const res = await a
      .http()
      .post('/auth/registro')
      .send({ ...registroValido(), nombre: 'x'.repeat(2 * MB) });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    esperarError(res, res.status, res.body.error?.codigo);
    esperarMensajeHumano(res.body.error.mensaje);
  });

  it('un nombre larguísimo pero dentro del límite del cuerpo no da 500', async () => {
    const res = await a
      .http()
      .post('/auth/registro')
      .send({ ...registroValido(), nombre: 'Ñ'.repeat(5000) });
    expect(res.status).not.toBe(500);
    if (res.status === 201) esperarContrato<Sesion>(res.body, 'Sesion');
    else esperarError(res, 400, 'VALIDACION_FALLIDA');
  });

  it('un email larguísimo no da 500', async () => {
    const res = await a
      .http()
      .post('/auth/registro')
      .send({ ...registroValido(), email: `${'a'.repeat(300)}@mail.com` });
    expect(res.status).not.toBe(500);
    if (res.status !== 201) esperarError(res, 400, 'VALIDACION_FALLIDA');
  });
});

describe('AGENTS §11.4 — X-Simular', () => {
  let a: AppDePrueba;
  beforeAll(async () => {
    a = await crearApp({ entorno: { SIMULACION_HABILITADA: 'true' } });
  });
  afterAll(() => a.cerrar());

  it('ERROR_INTERNO con un mensaje genérico, en castellano y sin detalles', async () => {
    const res = await a.http().get('/salud').set('X-Simular', 'error-500');
    esperarError(res, 500, 'ERROR_INTERNO');
    esperarMensajeHumano(res.body.error.mensaje);
    expect(JSON.stringify(res.body)).not.toMatch(
      /stack|at \w+ \(|simulad[oa]? por/i,
    );
  });

  it('error-500 también en un POST con cuerpo inválido (no se valida antes de simular)', async () => {
    esperarError(
      await a
        .http()
        .post('/auth/registro')
        .set('X-Simular', 'error-500')
        .send({ cualquier: 'cosa' }),
      500,
      'ERROR_INTERNO',
    );
  });

  it('un valor desconocido de X-Simular no rompe nada', async () => {
    await a.http().get('/salud').set('X-Simular', 'otra-cosa').expect(200);
    await a.http().get('/salud').set('X-Simular', 'demora-abc').expect(200);
  });

  it('error-500 sobre una ruta inexistente sigue siendo un sobre de error', async () => {
    const res = await a.http().get('/no-existe').set('X-Simular', 'error-500');
    expect([404, 500]).toContain(res.status);
    esperarError(
      res,
      res.status,
      res.status === 500 ? 'ERROR_INTERNO' : 'RUTA_NO_ENCONTRADA',
    );
  });
});

describe('AGENTS §8 — Archivos: tipos admitidos, bordes de tamaño y fechas', () => {
  let a: AppDePrueba;
  let token: string;
  beforeAll(async () => {
    a = await crearApp();
    ({ token } = await registrarJugador(a));
  });
  afterAll(() => a.cerrar());

  const subir = (contenido: Buffer, nombre: string) =>
    a
      .http()
      .post('/archivos')
      .set('Authorization', `Bearer ${token}`)
      .attach('archivo', contenido, nombre);

  const webp = (n = 2048) => {
    const b = Buffer.alloc(n, 0x55);
    b.write('RIFF', 0, 'latin1');
    b.writeUInt32LE(n - 8, 4);
    b.write('WEBPVP8 ', 8, 'latin1');
    return b;
  };
  const mp3Id3 = (n = 4096) => {
    const b = Buffer.alloc(n, 0x00);
    b.write('ID3', 0, 'latin1');
    b.set([0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], 3);
    b.set([0xff, 0xfb, 0x90, 0x64], 10);
    return b;
  };
  const mp3Frame = (n = 4096) => {
    const b = Buffer.alloc(n, 0x00);
    b.set([0xff, 0xfb, 0x90, 0x64], 0);
    return b;
  };
  const aacAdts = (n = 4096) => {
    const b = Buffer.alloc(n, 0x00);
    b.set([0xff, 0xf1, 0x50, 0x80, 0x02, 0x1f, 0xfc], 0);
    return b;
  };
  const gif = () => Buffer.from('GIF89a' + 'x'.repeat(200), 'latin1');

  it.each([
    ['webp', webp(), 'f.webp', 'imagen'],
    ['mp3 con ID3', mp3Id3(), 'a.mp3', 'audio'],
    ['mp3 sin ID3', mp3Frame(), 'a.mp3', 'audio'],
    ['aac (ADTS)', aacAdts(), 'a.aac', 'audio'],
  ])('201: %s es un tipo admitido', async (_c, contenido, nombre, tipo) => {
    const res = await subir(contenido, nombre);
    expect(res.status).toBe(201);
    const s = esperarContrato<ArchivoSubido>(res.body, 'ArchivoSubido');
    expect(s.tipo).toBe(tipo);
    expect(s.bytes).toBe(contenido.length);
  });

  it('TIPO_DE_ARCHIVO_NO_PERMITIDO (415): un gif', async () => {
    const res = await subir(gif(), 'f.gif');
    esperarError(res, 415, 'TIPO_DE_ARCHIVO_NO_PERMITIDO');
    esperarMensajeHumano(res.body.error.mensaje);
  });

  it('TIPO_DE_ARCHIVO_NO_PERMITIDO (415): un archivo vacío', async () => {
    const res = await subir(Buffer.alloc(0), 'f.jpg');
    expect([400, 415]).toContain(res.status);
    esperarError(
      res,
      res.status,
      res.status === 400
        ? 'VALIDACION_FALLIDA'
        : 'TIPO_DE_ARCHIVO_NO_PERMITIDO',
    );
  });

  it('un jpeg con nombre .png se guarda como jpeg (manda la firma)', async () => {
    const res = await subir(jpeg(), 'engaño.png').expect(201);
    const s = esperarContrato<ArchivoSubido>(res.body, 'ArchivoSubido');
    expect(s.url).toMatch(/\.jpg$/);
    const bajada = await a.http().get(new URL(s.url).pathname).expect(200);
    expect(bajada.headers['content-type']).toBe('image/jpeg');
  });

  it('ARCHIVO_DEMASIADO_GRANDE (413): png de 5 MB + 1', async () => {
    const res = await subir(png(5 * MB + 1), 'f.png');
    esperarError(res, 413, 'ARCHIVO_DEMASIADO_GRANDE');
    esperarMensajeHumano(res.body.error.mensaje);
  });

  it('un video de 12 MB entra (el límite de video es 30 MB)', async () => {
    const res = await subir(mp4(12 * MB), 'v.mp4').expect(201);
    expect(esperarContrato<ArchivoSubido>(res.body, 'ArchivoSubido').tipo).toBe(
      'video',
    );
  });

  it('la URL de un archivo nunca termina con el nombre que mandó el teléfono aunque tenga ../', async () => {
    const res = await subir(jpeg(), '../../etc/passwd.jpg').expect(201);
    expect(res.body.datos.url).not.toMatch(/passwd|\.\./);
  });

  it('dos subidas iguales generan dos claves distintas', async () => {
    const [r1, r2] = await Promise.all([
      subir(jpeg(), 'a.jpg'),
      subir(jpeg(), 'a.jpg'),
    ]);
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    expect(r1.body.datos.url).not.toBe(r2.body.datos.url);
  });

  it('VALIDACION_FALLIDA (400) si el archivo viene en otro campo', async () => {
    const res = await a
      .http()
      .post('/archivos')
      .set('Authorization', `Bearer ${token}`)
      .attach('foto', jpeg(), 'f.jpg');
    expect(res.status).toBe(400);
    esperarError(res, 400, 'VALIDACION_FALLIDA');
    esperarMensajeHumano(res.body.error.mensaje);
  });

  it('VALIDACION_FALLIDA (400) si se manda JSON en vez de multipart', async () => {
    const res = await a
      .http()
      .post('/archivos')
      .set('Authorization', `Bearer ${token}`)
      .send({ archivo: 'data:image/jpeg;base64,/9j/' });
    esperarError(res, 400, 'VALIDACION_FALLIDA');
  });

  it('NO_AUTENTICADO (401) con un token vencido', async () => {
    a.reloj.avanzarMinutos(31 * 24 * 60);
    try {
      esperarError(await subir(jpeg(), 'f.jpg'), 401, 'NO_AUTENTICADO');
    } finally {
      a.reloj.avanzarMinutos(-31 * 24 * 60);
    }
  });
});

describe('AGENTS §6 y §17.1 — La clave usa año y mes en hora argentina (bordes de fecha)', () => {
  it.each([
    [
      '30/09 a las 23:30 (ya es octubre en UTC)',
      '2026-09-30T23:30:00-03:00',
      '/imagenes/2026/09/',
    ],
    [
      '31/12 a las 23:59 (ya es año nuevo en UTC)',
      '2026-12-31T23:59:00-03:00',
      '/imagenes/2026/12/',
    ],
    ['01/01 a las 00:00', '2027-01-01T00:00:00-03:00', '/imagenes/2027/01/'],
    [
      '31/10 a las 21:00 con Z (00:00 UTC del 1/11)',
      '2026-11-01T00:00:00Z',
      '/imagenes/2026/10/',
    ],
  ])('%s', async (_c, ahora, carpeta) => {
    const a = await crearApp({ ahora });
    try {
      const { token } = await registrarJugador(a);
      const res = await a
        .http()
        .post('/archivos')
        .set('Authorization', `Bearer ${token}`)
        .attach('archivo', jpeg(), 'f.jpg')
        .expect(201);
      expect(res.body.datos.url).toContain(carpeta);
    } finally {
      await a.cerrar();
    }
  });
});

describe('AGENTS §17.1 — GET /archivos/<clave> con Range', () => {
  let a: AppDePrueba;
  let ruta: string;
  const contenido = png(1000);
  beforeAll(async () => {
    a = await crearApp();
    const { token } = await registrarJugador(a);
    const res = await a
      .http()
      .post('/archivos')
      .set('Authorization', `Bearer ${token}`)
      .attach('archivo', contenido, 'f.png')
      .expect(201);
    ruta = new URL(res.body.datos.url as string).pathname;
  });
  afterAll(() => a.cerrar());

  it('Content-Type image/png', async () => {
    const res = await a.http().get(ruta).buffer(true).expect(200);
    expect(res.headers['content-type']).toBe('image/png');
  });

  it('bytes=0- → 206 con todo el archivo y Content-Range completo', async () => {
    const res = await a
      .http()
      .get(ruta)
      .set('Range', 'bytes=0-')
      .buffer(true)
      .expect(206);
    expect(res.headers['content-range']).toBe('bytes 0-999/1000');
    expect(Buffer.compare(res.body as Buffer, contenido)).toBe(0);
  });

  it('bytes=0-0 → 206 con un byte', async () => {
    const res = await a
      .http()
      .get(ruta)
      .set('Range', 'bytes=0-0')
      .buffer(true)
      .expect(206);
    expect(res.headers['content-range']).toBe('bytes 0-0/1000');
    expect(res.headers['content-length']).toBe('1');
  });

  it('un fin más allá del archivo se recorta al último byte (RFC 9110)', async () => {
    const res = await a
      .http()
      .get(ruta)
      .set('Range', 'bytes=990-5000')
      .buffer(true)
      .expect(206);
    expect(res.headers['content-range']).toBe('bytes 990-999/1000');
    expect(Buffer.compare(res.body as Buffer, contenido.subarray(990))).toBe(0);
  });

  it('bytes=-2000 (más que el archivo) → el archivo entero', async () => {
    const res = await a
      .http()
      .get(ruta)
      .set('Range', 'bytes=-2000')
      .buffer(true);
    expect([200, 206]).toContain(res.status);
    expect(Buffer.compare(res.body as Buffer, contenido)).toBe(0);
  });

  it('bytes=1000- (empieza justo en el total) → 416 RANGO_NO_VALIDO', async () => {
    const res = await a.http().get(ruta).set('Range', 'bytes=1000-');
    esperarError(res, 416, 'RANGO_NO_VALIDO');
    expect(res.headers['content-range']).toBe('bytes */1000');
    esperarMensajeHumano(res.body.error.mensaje);
  });

  it('un Range mal escrito no da 500', async () => {
    for (const r of ['bytes=abc', 'bytes=20-10', 'items=0-5', 'bytes=']) {
      const res = await a.http().get(ruta).set('Range', r).buffer(true);
      expect(res.status, r).not.toBe(500);
      if (res.status === 416) esperarError(res, 416, 'RANGO_NO_VALIDO');
    }
  });

  it('una clave inexistente de otra carpeta → ARCHIVO_NO_ENCONTRADO con mensaje humano', async () => {
    const res = await a.http().get('/archivos/videos/2026/09/nada.mp4');
    esperarError(res, 404, 'ARCHIVO_NO_ENCONTRADO');
    esperarMensajeHumano(res.body.error.mensaje);
  });
});

describe('AGENTS §9 — /dispositivos: bordes', () => {
  let a: AppDePrueba;
  beforeAll(async () => {
    a = await crearApp();
  });
  afterAll(() => a.cerrar());

  const alta = (token: string, tokenExpo: string, plataforma = 'android') =>
    a
      .http()
      .post('/dispositivos')
      .set('Authorization', `Bearer ${token}`)
      .send({ tokenExpo, plataforma });

  const prueba = async (token: string) => {
    a.enviador.vaciar();
    const res = await a
      .http()
      .post('/dispositivos/prueba')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await a.avisos.esperarEnvios();
    return esperarContrato<PruebaDePush>(res.body, 'PruebaDePush');
  };

  it('prueba sin dispositivos: { dispositivos: 0 } y no se manda nada', async () => {
    const j = await registrarJugador(a);
    expect(await prueba(j.token)).toEqual({ dispositivos: 0 });
    expect(a.enviador.enviados).toEqual([]);
  });

  it('el mensaje de prueba va en castellano, con datos de texto, y sólo a mis teléfonos', async () => {
    const j = await registrarJugador(a);
    const otro = await registrarJugador(a);
    await alta(j.token, 'ExponentPushToken[mio-1]').expect(201);
    await alta(j.token, 'ExponentPushToken[mio-2]', 'ios').expect(201);
    await alta(otro.token, 'ExponentPushToken[ajeno]').expect(201);
    expect(await prueba(j.token)).toEqual({ dispositivos: 2 });
    const tokens = a.enviador.enviados.flatMap((m) => m.tokens).sort();
    expect(tokens).toEqual([
      'ExponentPushToken[mio-1]',
      'ExponentPushToken[mio-2]',
    ]);
    for (const m of a.enviador.enviados) {
      expect(m.titulo.trim()).not.toBe('');
      expect(m.cuerpo.trim()).not.toBe('');
      expect(m.cuerpo).not.toMatch(/\b(test|push notification)\b/i);
      for (const v of Object.values(m.datos)) expect(typeof v).toBe('string');
    }
  });

  it('cambiar la plataforma del mismo token: 201 con la nueva, sigue siendo uno', async () => {
    const j = await registrarJugador(a);
    await alta(j.token, 'ExponentPushToken[cambia]', 'android').expect(201);
    const res = await alta(j.token, 'ExponentPushToken[cambia]', 'ios').expect(
      201,
    );
    expect(
      esperarContrato<Dispositivo>(res.body, 'Dispositivo').plataforma,
    ).toBe('ios');
    expect(await prueba(j.token)).toEqual({ dispositivos: 1 });
  });

  it('dos altas simultáneas del mismo token: las dos 201 y queda uno', async () => {
    const j = await registrarJugador(a);
    const rs = await Promise.all([
      alta(j.token, 'ExponentPushToken[simultaneo]'),
      alta(j.token, 'ExponentPushToken[simultaneo]'),
    ]);
    expect(rs.map((r) => r.status)).toEqual([201, 201]);
    rs.forEach((r) => esperarContrato<Dispositivo>(r.body, 'Dispositivo'));
    expect(await prueba(j.token)).toEqual({ dispositivos: 1 });
  });

  it('dos usuarios dan de alta el mismo token a la vez: nunca 500 y queda en uno solo', async () => {
    const uno = await registrarJugador(a);
    const dos = await registrarJugador(a);
    const rs = await Promise.all([
      alta(uno.token, 'ExponentPushToken[disputado]'),
      alta(dos.token, 'ExponentPushToken[disputado]'),
    ]);
    rs.forEach((r) => expect(r.status).not.toBe(500));
    const total =
      (await prueba(uno.token)).dispositivos +
      (await prueba(dos.token)).dispositivos;
    expect(total).toBe(1);
  });

  it('AGENTS §9 — un token que Expo informa como inválido se borra', async () => {
    const j = await registrarJugador(a);
    await alta(j.token, 'ExponentPushToken[invalido]').expect(201);
    await alta(j.token, 'ExponentPushToken[valido]').expect(201);
    a.enviador.invalidos = ['ExponentPushToken[invalido]'];
    try {
      expect(await prueba(j.token)).toEqual({ dispositivos: 2 });
    } finally {
      a.enviador.invalidos = [];
    }
    expect(await prueba(j.token)).toEqual({ dispositivos: 1 });
  });

  it('el DELETE de un token que es de otro usuario no se lo saca al dueño', async () => {
    const duenio = await registrarJugador(a);
    const intruso = await registrarJugador(a);
    const t = 'ExponentPushToken[delduenio]';
    await alta(duenio.token, t).expect(201);
    const res = await a
      .http()
      .delete(`/dispositivos/${encodeURIComponent(t)}`)
      .set('Authorization', `Bearer ${intruso.token}`);
    expect([204, 403]).toContain(res.status);
    if (res.status === 403) esperarError(res, 403, 'SIN_PERMISO');
    expect(await prueba(duenio.token)).toEqual({ dispositivos: 1 });
  });

  it.each([
    ['tokenExpo vacío', { tokenExpo: '', plataforma: 'ios' }],
    ['tokenExpo numérico', { tokenExpo: 123, plataforma: 'ios' }],
    [
      'plataforma web',
      { tokenExpo: 'ExponentPushToken[web]', plataforma: 'web' },
    ],
    [
      'plataforma en mayúsculas',
      { tokenExpo: 'ExponentPushToken[may]', plataforma: 'IOS' },
    ],
    ['sin plataforma', { tokenExpo: 'ExponentPushToken[sinp]' }],
    [
      'token sin corchete final',
      { tokenExpo: 'ExponentPushToken[abc', plataforma: 'ios' },
    ],
  ])('VALIDACION_FALLIDA (400): %s, con mensaje humano', async (_c, cuerpo) => {
    const j = await registrarJugador(a);
    const res = await a
      .http()
      .post('/dispositivos')
      .set('Authorization', `Bearer ${j.token}`)
      .send(cuerpo);
    esperarError(res, 400, 'VALIDACION_FALLIDA');
    esperarMensajeHumano(res.body.error.mensaje);
  });

  it('una prueba con cuerpo de más no da 500', async () => {
    const j = await registrarJugador(a);
    const res = await a
      .http()
      .post('/dispositivos/prueba')
      .set('Authorization', `Bearer ${j.token}`)
      .send({ mensaje: 'hola' });
    expect(res.status).not.toBe(500);
    if (res.status === 400) esperarError(res, 400, 'VALIDACION_FALLIDA');
  });

  it('un encargado también puede registrar su teléfono', async () => {
    const e = await crearUsuario(a, 'encargado');
    const res = await alta(
      e.token,
      'ExponentPushToken[encargado]',
      'ios',
    ).expect(201);
    esperarContrato<Dispositivo>(res.body, 'Dispositivo');
  });

  it('NO_AUTENTICADO (401) con token vencido en /dispositivos/prueba', async () => {
    const j = await registrarJugador(a);
    a.reloj.avanzarMinutos(31 * 24 * 60);
    try {
      esperarError(
        await a
          .http()
          .post('/dispositivos/prueba')
          .set('Authorization', `Bearer ${j.token}`),
        401,
        'NO_AUTENTICADO',
      );
    } finally {
      a.reloj.avanzarMinutos(-31 * 24 * 60);
    }
  });
});

describe('AGENTS §11.5 — Swagger documenta todo M0', () => {
  let a: AppDePrueba;
  beforeAll(async () => {
    a = await crearApp();
  });
  afterAll(() => a.cerrar());

  it('/docs-json trae /dispositivos/prueba, el DELETE de dispositivos y la bajada de archivos', async () => {
    const res = await a.http().get('/docs-json').expect(200);
    const paths = (
      res.body as { paths: Record<string, Record<string, unknown>> }
    ).paths;
    const rutas = Object.keys(paths);
    expect(rutas).toContain('/dispositivos/prueba');
    expect(rutas.some((r) => /^\/dispositivos\/\{tokenExpo\}$/.test(r))).toBe(
      true,
    );
    expect(rutas.some((r) => r.startsWith('/archivos/'))).toBe(true);
    expect(Object.keys(paths['/auth/registro'])).toContain('post');
    expect(Object.keys(paths['/yo'])).toContain('get');
  });

  it('/docs (la página) es pública', async () => {
    await a.http().get('/docs').redirects(2).expect(200);
  });
});

describe('ESPECIFICACION §1 — Usuario sin datos internos', () => {
  let a: AppDePrueba;
  beforeAll(async () => {
    a = await crearApp();
  });
  afterAll(() => a.cerrar());

  it('ni el ingreso de un administrador ni /yo filtran hash, fechas internas ni nada fuera del tipo', async () => {
    const ad = await crearUsuario(a, 'administrador');
    const res = await a
      .http()
      .get('/yo')
      .set('Authorization', `Bearer ${ad.token}`)
      .expect(200);
    const u = esperarContrato<Usuario>(res.body, 'Usuario');
    expect(u.rol).toBe('administrador');
    expect(JSON.stringify(res.body)).not.toMatch(
      /contrasena|hash|creadoEn|createdAt|password|emailBusqueda/i,
    );
  });
});
