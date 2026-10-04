// Verificación independiente de M1 — Espacios (ESPECIFICACION §4 M1, §8; DECISIONES M1-1 a M1-4).
// Caja negra: sólo HTTP contra la app completa. Complementa test/e2e/espacios sin repetirlo.
import type { Deporte, Espacio } from '../../contrato/tipos.js';
import { sembrar } from '../../src/semillas/sembrar.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { crearDeporte, crearEspacio } from '../utilidades/espacios.js';
import { registrarJugador } from '../utilidades/usuarios.js';

const CLAVES_ESPACIO = [
  'activo',
  'capacidad',
  'complejo',
  'coordenadas',
  'deporteId',
  'iluminacion',
  'id',
  'imagenes',
  'nombre',
  'precioPorHora',
  'reglas',
  'superficie',
  'techado',
  'videoUrl',
].sort();

describe('M1 — Forma exacta del Espacio y del Deporte (AGENTS §4.3, §4.5)', () => {
  let a: AppDePrueba;
  beforeAll(async () => {
    a = await crearApp();
    const d = await crearDeporte(a);
    await crearEspacio(a, { id: 'esp-01', deporteId: d.id });
    await crearEspacio(a, {
      id: 'esp-02',
      deporteId: d.id,
      imagenes: ['imagenes/2026/09/a.jpg'],
      videoUrl: 'videos/2026/09/v.mp4',
    });
  });
  afterAll(() => a.cerrar());

  it('sin campos de más ni de menos, ni en lista ni en detalle', async () => {
    const lista = await a.http().get('/espacios').expect(200);
    for (const e of lista.body.datos)
      expect(Object.keys(e).sort()).toEqual(CLAVES_ESPACIO);
    const det = await a.http().get('/espacios/esp-01').expect(200);
    expect(Object.keys(det.body.datos).sort()).toEqual(CLAVES_ESPACIO);
    expect(Object.keys(det.body.datos.coordenadas).sort()).toEqual([
      'latitud',
      'longitud',
    ]);
    expect(det.body.meta).toBeNull();
  });

  it('lista y detalle devuelven el mismo objeto para el mismo espacio', async () => {
    const lista = await a
      .http()
      .get('/espacios')
      .set('Host', 'x.test:3000')
      .expect(200);
    for (const e of lista.body.datos as Espacio[]) {
      const det = await a
        .http()
        .get(`/espacios/${e.id}`)
        .set('Host', 'x.test:3000')
        .expect(200);
      expect(det.body.datos).toEqual(e);
    }
  });

  it('opcionales en null (videoUrl) y llenos (imágenes y video) pasan el contrato', async () => {
    const vacio = await a.http().get('/espacios/esp-01').expect(200);
    const e1 = esperarContrato<Espacio>(vacio.body, 'Espacio');
    expect(e1.videoUrl).toBeNull();
    expect(e1.imagenes).toEqual([]);
    const lleno = await a.http().get('/espacios/esp-02').expect(200);
    const e2 = esperarContrato<Espacio>(lleno.body, 'Espacio');
    expect(e2.videoUrl).toMatch(/^https?:\/\/[^/]+\/archivos\/videos\//);
    expect(e2.imagenes[0]).toMatch(/^https?:\/\/[^/]+\/archivos\/imagenes\//);
  });

  it('coordenadas, capacidad y precio son números, no strings', async () => {
    const e = (await a.http().get('/espacios/esp-01').expect(200)).body
      .datos as Espacio;
    expect(typeof e.coordenadas.latitud).toBe('number');
    expect(typeof e.coordenadas.longitud).toBe('number');
    expect(Number.isInteger(e.capacidad)).toBe(true);
    expect(Number.isInteger(e.precioPorHora)).toBe(true);
    expect(typeof e.techado).toBe('boolean');
    expect(typeof e.iluminacion).toBe('boolean');
  });

  it('con sesión de jugador también anda, y un token basura en un público no rompe a nadie con 500', async () => {
    const j = await registrarJugador(a);
    await a
      .http()
      .get('/espacios')
      .set('Authorization', `Bearer ${j.token}`)
      .expect(200);
    const res = await a
      .http()
      .get('/espacios')
      .set('Authorization', 'Bearer basura');
    expect([200, 401]).toContain(res.status);
  });

  it('URLs de archivos con proxy no confiable ignoran X-Forwarded-*', async () => {
    const res = await a
      .http()
      .get('/espacios/esp-02')
      .set('X-Forwarded-Proto', 'https')
      .set('X-Forwarded-Host', 'malo.example.com')
      .expect(200);
    expect(res.body.datos.imagenes[0]).not.toContain('malo.example.com');
  });
});

describe('M1 — Rutas y métodos (ESPECIFICACION §9: no hay alta de espacios)', () => {
  let a: AppDePrueba;
  beforeAll(async () => {
    a = await crearApp();
    const d = await crearDeporte(a);
    await crearEspacio(a, { id: 'esp-01', deporteId: d.id });
  });
  afterAll(() => a.cerrar());

  it.each([
    ['post', '/espacios'],
    ['post', '/deportes'],
    ['delete', '/espacios/esp-01'],
    ['put', '/espacios/esp-01'],
  ])('%s %s no existe: sobre de error, sin 500', async (metodo, ruta) => {
    const res = await (
      a.http() as unknown as Record<
        string,
        (r: string) => Promise<import('supertest').Response>
      >
    )[metodo](ruta);
    expect([401, 403, 404, 405]).toContain(res.status);
    expect(res.body.error).toBeDefined();
    expect(Object.keys(res.body.error).sort()).toEqual(['codigo', 'mensaje']);
  });

  it('GET /espacios/:id con ids raros da 404 con sobre de error', async () => {
    for (const id of ['ESP-01', 'esp-01%20', 'esp-', 'esp-01%27--', '%00']) {
      const res = await a.http().get(`/espacios/${id}`);
      expect([404, 400]).toContain(res.status);
      esperarError(res, res.status, res.body.error?.codigo);
      expect(res.status).not.toBe(500);
    }
  });

  it('ESPACIO_NO_ENCONTRADO tiene el mensaje de la especificación', async () => {
    const res = await a.http().get('/espacios/esp-404').expect(404);
    expect(res.body.error).toEqual({
      codigo: 'ESPACIO_NO_ENCONTRADO',
      mensaje: 'No existe ese espacio.',
    });
  });
});

describe('M1 — Filtros adversariales de GET /espacios (M1-1, M1-3)', () => {
  let a: AppDePrueba;
  let d1: string;
  let d2: string;
  beforeAll(async () => {
    a = await crearApp();
    d1 = (await crearDeporte(a)).id;
    d2 = (await crearDeporte(a)).id;
    await crearEspacio(a, {
      id: 'esp-02',
      deporteId: d1,
      complejo: 'Polideportivo Municipal',
      techado: false,
      iluminacion: true,
    });
    await crearEspacio(a, {
      id: 'esp-09',
      deporteId: d1,
      complejo: '—',
      techado: true,
      iluminacion: false,
    });
    await crearEspacio(a, {
      id: 'esp-10',
      deporteId: d2,
      complejo: 'Parque Berduc',
      techado: false,
      iluminacion: false,
    });
    await crearEspacio(a, {
      id: 'esp-11',
      deporteId: d2,
      complejo: 'Parque Berduc',
      techado: true,
      iluminacion: true,
      activo: false,
    });
  });
  afterAll(() => a.cerrar());
  const ids = (c: { datos: Espacio[] }) => c.datos.map((e) => e.id);

  it('el orden es por id como texto (esp-02, esp-09, esp-10)', async () => {
    const res = await a.http().get('/espacios').expect(200);
    expect(ids(res.body)).toEqual(['esp-02', 'esp-09', 'esp-10']);
  });

  it('un inactivo nunca aparece, ni con filtros que lo encajan', async () => {
    const res = await a
      .http()
      .get('/espacios?techado=true&iluminacion=true&complejo=Parque Berduc')
      .expect(200);
    expect(res.body.datos).toEqual([]);
    expect(res.body.meta.total).toBe(0);
  });

  it('el complejo "—" se puede filtrar', async () => {
    const res = await a
      .http()
      .get(`/espacios?complejo=${encodeURIComponent('—')}`)
      .expect(200);
    expect(ids(res.body)).toEqual(['esp-09']);
  });

  it.each([
    ['mayúsculas', 'PARQUE BERDUC'],
    ['espacios de más', '  parque   berduc '],
    ['tildes ajenas', 'párque bérduc'],
  ])('complejo normaliza: %s', async (_n, valor) => {
    const res = await a
      .http()
      .get(`/espacios?complejo=${encodeURIComponent(valor)}`)
      .expect(200);
    expect(ids(res.body)).toEqual(['esp-10']);
  });

  it('el filtro complejo es coincidencia exacta, no parcial', async () => {
    const res = await a.http().get('/espacios?complejo=Parque').expect(200);
    expect(res.body.datos).toEqual([]);
  });

  it('comodines de LIKE en complejo no matchean todo', async () => {
    for (const c of ['%', '_', 'Parque%']) {
      const res = await a
        .http()
        .get(`/espacios?complejo=${encodeURIComponent(c)}`)
        .expect(200);
      expect(res.body.datos).toEqual([]);
    }
  });

  it.each(['TRUE', '1', '0', 'si', '', 'yes'])(
    'iluminacion=%j no es un booleano válido: 400',
    async (v) => {
      esperarError(
        await a.http().get(`/espacios?iluminacion=${v}`),
        400,
        'VALIDACION_FALLIDA',
      );
    },
  );

  it('techado=false filtra de verdad (no lo ignora)', async () => {
    const res = await a.http().get('/espacios?techado=false').expect(200);
    expect(ids(res.body)).toEqual(['esp-02', 'esp-10']);
  });

  it('los cuatro filtros combinados', async () => {
    const res = await a
      .http()
      .get(
        `/espacios?deporteId=${d1}&complejo=Polideportivo Municipal&iluminacion=true&techado=false`,
      )
      .expect(200);
    expect(ids(res.body)).toEqual(['esp-02']);
  });

  it('filtro repetido (deporteId dos veces) no da 500', async () => {
    const res = await a.http().get(`/espacios?deporteId=${d1}&deporteId=${d2}`);
    expect(res.status).not.toBe(500);
    if (res.status === 400) esperarError(res, 400, 'VALIDACION_FALLIDA');
  });

  it('deporteId vacío o con forma rara: sin 500', async () => {
    for (const v of ['', 'dep-%25', '%27%20OR%201=1']) {
      const res = await a.http().get(`/espacios?deporteId=${v}`);
      expect(res.status).not.toBe(500);
    }
  });

  it.each([
    'pagina=abc',
    'pagina=-1',
    'pagina=1.5',
    'porPagina=0',
    'porPagina=-3',
    'porPagina=abc',
    'porPagina=101',
  ])('paginación inválida %s: 400', async (q) => {
    esperarError(
      await a.http().get(`/espacios?${q}`),
      400,
      'VALIDACION_FALLIDA',
    );
  });

  it('porPagina=100 es válido y la meta lo refleja', async () => {
    const res = await a.http().get('/espacios?porPagina=100').expect(200);
    expect(res.body.meta).toEqual({ total: 3, pagina: 1, porPagina: 100 });
  });

  it('la combinación filtro + página fuera de rango da total filtrado', async () => {
    const res = await a
      .http()
      .get(`/espacios?deporteId=${d1}&pagina=5`)
      .expect(200);
    expect(res.body.datos).toEqual([]);
    expect(res.body.meta).toEqual({ total: 2, pagina: 5, porPagina: 20 });
  });

  it('mensaje de validación en castellano, sin jerga', async () => {
    const res = await a.http().get('/espacios?techado=quizas').expect(400);
    expect(res.body.error.mensaje).not.toMatch(
      /must|should|boolean|property|string/i,
    );
  });

  it('parámetro desconocido en /deportes y /espacios/:id', async () => {
    esperarError(
      await a.http().get('/deportes?foo=1'),
      400,
      'VALIDACION_FALLIDA',
    );
    const res = await a.http().get('/espacios/esp-02?foo=1');
    expect([200, 400]).toContain(res.status);
  });
});

describe('M1 — Deportes: orden estable y forma', () => {
  let a: AppDePrueba;
  beforeAll(async () => {
    a = await crearApp();
    for (const id of ['dep-voley', 'dep-basquet', 'dep-tenis'])
      await crearDeporte(a, { id, nombre: id });
  });
  afterAll(() => a.cerrar());

  it('orden determinístico por id y claves exactas', async () => {
    const res = await a.http().get('/deportes').expect(200);
    const ds = esperarContrato<Deporte[]>(res.body, 'Deporte');
    expect(ds.map((d) => d.id)).toEqual([
      'dep-basquet',
      'dep-tenis',
      'dep-voley',
    ]);
    for (const d of ds)
      expect(Object.keys(d).sort()).toEqual(['color', 'icono', 'id', 'nombre']);
  });
});

describe('ESPECIFICACION §8 — Semillas de M1 vía HTTP', () => {
  let a: AppDePrueba;
  beforeAll(async () => {
    a = await crearApp();
    await sembrar(a.dataSource, a.reloj);
  });
  afterAll(() => a.cerrar());

  it('hay 11 espacios activos con la distribución del PRD, todos cumplen el contrato', async () => {
    const res = await a.http().get('/espacios?porPagina=100').expect(200);
    const es = esperarContrato<Espacio[]>(res.body, 'Espacio');
    expect(es).toHaveLength(11);
    expect(res.body.meta.total).toBe(11);
    const por = (f: (e: Espacio) => boolean) => es.filter(f).length;
    expect(por((e) => e.complejo === 'Polideportivo Municipal')).toBe(3);
    expect(por((e) => e.complejo === 'Parque Berduc')).toBe(2);
    expect(por((e) => e.complejo === '—')).toBe(6);
    expect(por((e) => e.techado)).toBeGreaterThanOrEqual(1);
  });

  it('esp-02 y dep-futbol5 existen con los datos del PRD', async () => {
    const e = esperarContrato<Espacio>(
      (await a.http().get('/espacios/esp-02').expect(200)).body,
      'Espacio',
    );
    expect(e.nombre).toBe('Cancha 2 — Fútbol 5');
    expect(e.deporteId).toBe('dep-futbol5');
    expect(e.iluminacion).toBe(true);
    expect(e.techado).toBe(false);
    const ds = esperarContrato<Deporte[]>(
      (await a.http().get('/deportes').expect(200)).body,
      'Deporte',
    );
    expect(ds.map((d) => d.id)).toContain('dep-futbol5');
  });

  it('cada deporteId de un espacio existe en /deportes y las coordenadas son de Villaguay', async () => {
    const es = (await a.http().get('/espacios?porPagina=100').expect(200)).body
      .datos as Espacio[];
    const ds = (await a.http().get('/deportes?porPagina=100').expect(200)).body
      .datos as Deporte[];
    const idsD = new Set(ds.map((d) => d.id));
    for (const e of es) {
      expect(idsD.has(e.deporteId)).toBe(true);
      expect(Math.abs(e.coordenadas.latitud - -31.86)).toBeLessThan(0.1);
      expect(Math.abs(e.coordenadas.longitud - -59.03)).toBeLessThan(0.1);
      expect(e.capacidad).toBeGreaterThan(0);
      expect(e.precioPorHora).toBeGreaterThan(0);
    }
  });

  it('hay al menos un espacio sin video (caso feo del PRD)', async () => {
    const es = (await a.http().get('/espacios?porPagina=100').expect(200)).body
      .datos as Espacio[];
    expect(es.some((e) => e.videoUrl === null)).toBe(true);
  });

  it('los íconos de los deportes no están vacíos y los colores son hex', async () => {
    const ds = (await a.http().get('/deportes').expect(200)).body
      .datos as Deporte[];
    expect(ds.length).toBeGreaterThanOrEqual(5);
    for (const d of ds) {
      expect(d.icono).toMatch(/^[a-z0-9-]+$/);
      expect(d.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('filtrar por cada deporte sembrado devuelve espacios y la suma da 11', async () => {
    const ds = (await a.http().get('/deportes').expect(200)).body
      .datos as Deporte[];
    let suma = 0;
    for (const d of ds) {
      const r = await a.http().get(`/espacios?deporteId=${d.id}`).expect(200);
      suma += r.body.meta.total;
    }
    expect(suma).toBe(11);
  });
});
