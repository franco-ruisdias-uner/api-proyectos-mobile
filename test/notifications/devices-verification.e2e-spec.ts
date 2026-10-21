// Consigna de notificaciones (AGENTS §19): verificación adversarial de /dispositivos.
// Estos tests eran del verificador de M0; se mudaron acá porque prueban lo que programan los alumnos.
import { crearApp as crearAppBase } from '../utilities/create-app.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import { crearUsuario } from '../utilities/users.js';
import type { AppDePrueba } from '../utilities/create-app.js';

const TOKEN = 'ExponentPushToken[vvvvvvvvvvvvvvvvvvvvvv]';
const OTRO_TOKEN = 'ExpoPushToken[wwwwwwwwwwwwwwwwwwwwww]';
const crearApp = () => crearAppBase({ almacenReal: true });

const JERGA =
  /should|must|property|undefined|null\b|Cannot|Error:|Exception|Unauthorized|Forbidden|Not Found|Bad Request|Internal|SQL|SQLITE|QueryFailed|JSON|stack|\bstring\b|\bnumber\b|\bboolean\b|\bundefined\b/i;

function esperarMensajeHumano(cuerpo: unknown) {
  const { mensaje } = (cuerpo as { error: { mensaje: string } }).error;
  expect(mensaje).not.toMatch(JERGA);
  expect(mensaje.length).toBeLessThan(200);
}

describe('AGENTS §9 / A1–A4 — /dispositivos (el alumno tiene que lograr que…)', () => {
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

describe('AGENTS §9 / A1–A4 — /dispositivos con nulos, cuerpos raros y concurrencia (casos raros y concurrencia)', () => {
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
