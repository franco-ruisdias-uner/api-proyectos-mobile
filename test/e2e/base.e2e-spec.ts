// Lo común de la API (AGENTS §4, §11.4): sobre, errores, salud, simulación, Swagger.
import { type AppDePrueba, crearApp } from '../utilities/create-app.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import type { Salud } from '../../contract/api.js';

describe('GET /salud — lo primero que prueban desde el teléfono', () => {
  let a: AppDePrueba;
  beforeAll(async () => {
    a = await crearApp();
  });
  afterAll(() => a.cerrar());

  it('es público y responde motor, almacén y versión en el sobre', async () => {
    const res = await a.http().get('/salud').expect(200);
    const salud = esperarContrato<Salud>(res.body, 'Salud');
    expect(salud.estado).toBe('ok');
    expect(salud.motor).toBe(process.env.DB_MOTOR ?? 'better-sqlite3');
    expect(salud.almacen).toBe('local');
    expect(salud.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('CORS abierto (la app puede correr en Expo web)', async () => {
    const res = await a
      .http()
      .get('/salud')
      .set('Origin', 'http://localhost:8081')
      .expect(200);
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });
});

describe('AGENTS §4.6 — Errores genéricos con el sobre exacto', () => {
  let a: AppDePrueba;
  beforeAll(async () => {
    a = await crearApp();
  });
  afterAll(() => a.cerrar());

  it('RUTA_NO_ENCONTRADA (404) para una ruta que no existe, sin sesión', async () => {
    esperarError(await a.http().get('/no-existe'), 404, 'RUTA_NO_ENCONTRADA');
  });

  it('RUTA_NO_ENCONTRADA (404) con sesión válida', async () => {
    const { registrarJugador } = await import('../utilities/users.js');
    const { token } = await registrarJugador(a);
    esperarError(
      await a.http().get('/no-existe').set('Authorization', `Bearer ${token}`),
      404,
      'RUTA_NO_ENCONTRADA',
    );
  });

  it('VALIDACION_FALLIDA (400) con un JSON mal formado', async () => {
    const res = await a
      .http()
      .post('/auth/ingreso')
      .set('Content-Type', 'application/json')
      .send('{"email": ');
    esperarError(res, 400, 'VALIDACION_FALLIDA');
    expect(res.body.error.mensaje).toBe(
      'El cuerpo del pedido no es un JSON válido.',
    );
  });

  it('NO_AUTENTICADO (401) sin token, con token mal firmado y con basura', async () => {
    esperarError(await a.http().get('/yo'), 401, 'NO_AUTENTICADO');
    esperarError(
      await a.http().get('/yo').set('Authorization', 'Bearer abc.def.ghi'),
      401,
      'NO_AUTENTICADO',
    );
    esperarError(
      await a.http().get('/yo').set('Authorization', 'Token xyz'),
      401,
      'NO_AUTENTICADO',
    );
  });
});

describe('AGENTS §11.4 — Simulación de fallas con X-Simular', () => {
  let a: AppDePrueba;
  beforeAll(async () => {
    a = await crearApp({ entorno: { SIMULACION_HABILITADA: 'true' } });
  });
  afterAll(() => a.cerrar());

  it('X-Simular: error-500 devuelve ERROR_INTERNO con el sobre de error', async () => {
    esperarError(
      await a.http().get('/salud').set('X-Simular', 'error-500'),
      500,
      'ERROR_INTERNO',
    );
  });

  it('funciona también en un endpoint con sesión, antes de pedir el token', async () => {
    esperarError(
      await a.http().get('/yo').set('X-Simular', 'error-500'),
      500,
      'ERROR_INTERNO',
    );
  });

  it('X-Simular: demora-300 responde bien pero tarde', async () => {
    const inicio = performance.now();
    const res = await a
      .http()
      .get('/salud')
      .set('X-Simular', 'demora-300')
      .expect(200);
    expect(performance.now() - inicio).toBeGreaterThanOrEqual(290);
    esperarContrato(res.body, 'Salud');
  });

  it('sin la cabecera, todo normal', async () => {
    await a.http().get('/salud').expect(200);
  });
});

describe('AGENTS §11.4 — Con la simulación apagada, la cabecera se ignora', () => {
  let a: AppDePrueba;
  beforeAll(async () => {
    a = await crearApp();
  });
  afterAll(() => a.cerrar());

  it('X-Simular: error-500 no hace nada', async () => {
    await a.http().get('/salud').set('X-Simular', 'error-500').expect(200);
  });
});

describe('AGENTS §11.5 — Swagger en /docs', () => {
  let a: AppDePrueba;
  beforeAll(async () => {
    a = await crearApp();
  });
  afterAll(() => a.cerrar());

  it('publica el documento con los endpoints de la base', async () => {
    const res = await a.http().get('/docs-json').expect(200);
    const rutas = Object.keys(
      (res.body as { paths: Record<string, unknown> }).paths,
    );
    expect(rutas).toEqual(
      expect.arrayContaining([
        '/salud',
        '/auth/registro',
        '/auth/ingreso',
        '/yo',
        '/archivos',
        '/dispositivos',
      ]),
    );
  });
});
