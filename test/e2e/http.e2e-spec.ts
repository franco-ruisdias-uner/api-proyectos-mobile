import { esperarError } from '../utilidades/contrato.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { crearUsuario } from '../utilidades/usuarios.js';

// Lo que main.ts le pone a la app antes de las rutas: cabeceras de seguridad (helmet), CORS
// y el límite de pedidos (@nestjs/throttler).

describe('Cabeceras de seguridad (helmet)', () => {
  let c: AppDePrueba;
  beforeAll(async () => (c = await crearApp()));
  afterAll(() => c.cerrar());

  it('van en todas las respuestas, y no se anuncia Express', async () => {
    const r = await c.http().get('/salud').expect(200);
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(r.headers['strict-transport-security']).toBeDefined();
    expect(r.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(r.headers['x-powered-by']).toBeUndefined();
  });

  it('Swagger anda por http en la red local: el CSP no pide pasar a https', async () => {
    const r = await c.http().get('/salud').expect(200);
    expect(r.headers['content-security-policy']).toBeDefined();
    expect(r.headers['content-security-policy']).not.toMatch(
      /upgrade-insecure-requests/,
    );
  });

  it('los archivos se pueden usar desde otro origen (Expo web)', async () => {
    const r = await c.http().get('/salud').expect(200);
    expect(r.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });
});

describe('CORS con CORS_ORIGINS', () => {
  let c: AppDePrueba;
  beforeAll(
    async () =>
      (c = await crearApp({
        entorno: { CORS_ORIGINS: 'http://localhost:8081' },
      })),
  );
  afterAll(() => c.cerrar());

  it('un origen de la lista recibe permiso', async () => {
    const r = await c
      .http()
      .get('/salud')
      .set('Origin', 'http://localhost:8081')
      .expect(200);
    expect(r.headers['access-control-allow-origin']).toBe(
      'http://localhost:8081',
    );
  });

  it('otro origen no (el navegador bloquea la respuesta)', async () => {
    const r = await c
      .http()
      .get('/salud')
      .set('Origin', 'https://otro.com')
      .expect(200);
    expect(r.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('el preflight deja mandar Authorization', async () => {
    const r = await c
      .http()
      .options('/yo')
      .set('Origin', 'http://localhost:8081')
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'authorization')
      .expect(204);
    expect(r.headers['access-control-allow-headers']).toMatch(/authorization/i);
  });
});

describe('Límite de pedidos: 429 DEMASIADOS_PEDIDOS', () => {
  let c: AppDePrueba;
  beforeAll(
    async () =>
      (c = await crearApp({
        entorno: { THROTTLE_LIMIT: '5', LOGIN_THROTTLE_LIMIT: '3' },
      })),
  );
  afterAll(() => c.cerrar());

  it('el ingreso se frena después de LOGIN_THROTTLE_LIMIT intentos con el mismo legajo', async () => {
    const usuario = await crearUsuario(c);
    for (let i = 0; i < 3; i++) {
      await c
        .http()
        .post('/auth/ingreso')
        .send({ legajo: usuario.legajo, contrasena: 'mal' })
        .expect(401);
    }
    const r = await c
      .http()
      .post('/auth/ingreso')
      .send({ legajo: usuario.legajo, contrasena: usuario.contrasena })
      .expect(429);
    esperarError(r.body, 'DEMASIADOS_PEDIDOS');
    expect(Number(r.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('desde la misma IP, otro legajo puede ingresar (un curso entero comparte el wifi)', async () => {
    const otro = await crearUsuario(c);
    await c
      .http()
      .post('/auth/ingreso')
      .send({ legajo: otro.legajo, contrasena: otro.contrasena })
      .expect(200);
  });

  it('el resto de las rutas se frena después de THROTTLE_LIMIT pedidos', async () => {
    for (let i = 0; i < 5; i++) await c.http().get('/salud').expect(200);
    const r = await c.http().get('/salud').expect(429);
    esperarError(r.body, 'DEMASIADOS_PEDIDOS');
  });
});
