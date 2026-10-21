// M1 — Espacios: GET /deportes, GET /espacios, GET /espacios/:id (ESPECIFICACION §4).
import type { Deporte, Espacio } from '../../contract/types.js';
import { type AppDePrueba, crearApp } from '../utilities/create-app.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import { crearDeporte, crearEspacio } from '../utilities/venues.js';

describe('GET /deportes — PRD §2, públicos', () => {
  let a: AppDePrueba;
  beforeAll(async () => {
    a = await crearApp();
  });
  afterAll(() => a.cerrar());

  it('sin deportes: lista vacía con meta', async () => {
    const res = await a.http().get('/deportes').expect(200);
    expect(esperarContrato<Deporte[]>(res.body, 'Deporte')).toEqual([]);
    expect(res.body.meta).toEqual({ total: 0, pagina: 1, porPagina: 20 });
  });

  it('200 sin sesión, con todos los campos del Deporte', async () => {
    const d = await crearDeporte(a, {
      id: 'dep-futbol5',
      nombre: 'Fútbol 5',
      icono: 'football-outline',
      color: '#2E7D32',
    });
    const res = await a.http().get('/deportes').expect(200);
    const datos = esperarContrato<Deporte[]>(res.body, 'Deporte');
    expect(datos).toContainEqual({
      id: d.id,
      nombre: 'Fútbol 5',
      icono: 'football-outline',
      color: '#2E7D32',
    });
  });

  it('paginación: una página fuera de rango da datos [] con el total correcto', async () => {
    await crearDeporte(a);
    await crearDeporte(a);
    const p1 = await a.http().get('/deportes?porPagina=2').expect(200);
    expect(p1.body.datos).toHaveLength(2);
    expect(p1.body.meta).toEqual({ total: 3, pagina: 1, porPagina: 2 });
    const p9 = await a.http().get('/deportes?pagina=9&porPagina=2').expect(200);
    expect(p9.body.datos).toEqual([]);
    expect(p9.body.meta.total).toBe(3);
  });

  it('400 con paginación mal formada', async () => {
    esperarError(
      await a.http().get('/deportes?pagina=0'),
      400,
      'VALIDACION_FALLIDA',
    );
    esperarError(
      await a.http().get('/deportes?porPagina=101'),
      400,
      'VALIDACION_FALLIDA',
    );
  });
});

describe('GET /espacios — PRD §2, sólo activos, con filtros', () => {
  let a: AppDePrueba;
  let futbol: string;
  let tenis: string;
  beforeAll(async () => {
    a = await crearApp();
    futbol = (await crearDeporte(a)).id;
    tenis = (await crearDeporte(a)).id;
    await crearEspacio(a, {
      id: 'esp-02',
      nombre: 'Cancha 2 — Fútbol 5',
      deporteId: futbol,
      complejo: 'Polideportivo Municipal',
      techado: false,
      iluminacion: true,
    });
    await crearEspacio(a, {
      id: 'esp-03',
      nombre: 'Gimnasio',
      deporteId: futbol,
      complejo: '—',
      techado: true,
      iluminacion: true,
    });
    await crearEspacio(a, {
      id: 'esp-07',
      nombre: 'Tenis 1',
      deporteId: tenis,
      complejo: 'Parque Berduc',
      techado: false,
      iluminacion: false,
    });
    await crearEspacio(a, {
      id: 'esp-99',
      nombre: 'Cerrada',
      deporteId: tenis,
      complejo: 'Parque Berduc',
      activo: false,
    });
  });
  afterAll(() => a.cerrar());

  const ids = (cuerpo: { datos: Espacio[] }) => cuerpo.datos.map((e) => e.id);

  it('200 sin sesión; cumple el contrato y excluye los inactivos', async () => {
    const res = await a.http().get('/espacios').expect(200);
    esperarContrato<Espacio[]>(res.body, 'Espacio');
    expect(ids(res.body)).toEqual(['esp-02', 'esp-03', 'esp-07']);
    expect(res.body.meta).toEqual({ total: 3, pagina: 1, porPagina: 20 });
  });

  it('el Espacio trae todos los campos del PRD con sus valores', async () => {
    const res = await a.http().get('/espacios').expect(200);
    const e = res.body.datos[0] as Espacio;
    expect(e).toEqual({
      id: 'esp-02',
      nombre: 'Cancha 2 — Fútbol 5',
      deporteId: futbol,
      complejo: 'Polideportivo Municipal',
      superficie: 'Césped sintético',
      techado: false,
      iluminacion: true,
      capacidad: 10,
      precioPorHora: 8000,
      coordenadas: { latitud: -31.8644, longitud: -59.0272 },
      imagenes: [],
      videoUrl: null,
      reglas: 'Usar calzado deportivo.',
      activo: true,
    });
  });

  it.each([
    ['deporteId', () => `deporteId=${tenis}`, ['esp-07']],
    ['complejo', () => 'complejo=Parque Berduc', ['esp-07']],
    [
      'complejo sin tildes ni mayúsculas',
      () => 'complejo=polideportivo municipal',
      ['esp-02'],
    ],
    ['iluminacion=true', () => 'iluminacion=true', ['esp-02', 'esp-03']],
    ['iluminacion=false', () => 'iluminacion=false', ['esp-07']],
    ['techado=true', () => 'techado=true', ['esp-03']],
    ['techado=false', () => 'techado=false', ['esp-02', 'esp-07']],
    [
      'filtros combinados',
      () => `deporteId=${futbol}&techado=true`,
      ['esp-03'],
    ],
    ['sin coincidencias', () => 'complejo=No existe', []],
  ])('filtro %s', async (_n, query, esperados) => {
    const res = await a.http().get(`/espacios?${query()}`).expect(200);
    esperarContrato<Espacio[]>(res.body, 'Espacio');
    expect(ids(res.body)).toEqual(esperados);
    expect(res.body.meta.total).toBe(esperados.length);
  });

  it('un filtro por un deporte inexistente da lista vacía, no error', async () => {
    const res = await a.http().get('/espacios?deporteId=dep-nada').expect(200);
    expect(res.body.datos).toEqual([]);
  });

  it('400 si un booleano no es true ni false', async () => {
    esperarError(
      await a.http().get('/espacios?techado=quizas'),
      400,
      'VALIDACION_FALLIDA',
    );
  });

  it('paginación: meta.total es el filtrado y el orden es estable', async () => {
    const p1 = await a.http().get('/espacios?porPagina=2').expect(200);
    expect(ids(p1.body)).toEqual(['esp-02', 'esp-03']);
    expect(p1.body.meta).toEqual({ total: 3, pagina: 1, porPagina: 2 });
    const p2 = await a.http().get('/espacios?porPagina=2&pagina=2').expect(200);
    expect(ids(p2.body)).toEqual(['esp-07']);
    const p9 = await a.http().get('/espacios?porPagina=2&pagina=9').expect(200);
    expect(p9.body.datos).toEqual([]);
    expect(p9.body.meta.total).toBe(3);
  });

  it('400 con un parámetro desconocido', async () => {
    esperarError(
      await a.http().get('/espacios?color=rojo'),
      400,
      'VALIDACION_FALLIDA',
    );
  });
});

describe('GET /espacios/:id', () => {
  let a: AppDePrueba;
  beforeAll(async () => {
    a = await crearApp();
  });
  afterAll(() => a.cerrar());

  it('200 sin sesión con el Espacio', async () => {
    const d = await crearDeporte(a);
    await crearEspacio(a, { id: 'esp-02', deporteId: d.id });
    const res = await a.http().get('/espacios/esp-02').expect(200);
    const e = esperarContrato<Espacio>(res.body, 'Espacio');
    expect(e.id).toBe('esp-02');
    expect(e.deporteId).toBe(d.id);
  });

  it('las imágenes y el video salen como URLs absolutas con el origen del pedido', async () => {
    const d = await crearDeporte(a);
    await crearEspacio(a, {
      id: 'esp-10',
      deporteId: d.id,
      imagenes: ['imagenes/2026/09/a.jpg', 'imagenes/2026/09/b.jpg'],
      videoUrl: 'videos/2026/09/v.mp4',
    });
    const res = await a
      .http()
      .get('/espacios/esp-10')
      .set('Host', '10.0.0.5:3000')
      .expect(200);
    const e = esperarContrato<Espacio>(res.body, 'Espacio');
    expect(e.imagenes).toEqual([
      'http://10.0.0.5:3000/archivos/imagenes/2026/09/a.jpg',
      'http://10.0.0.5:3000/archivos/imagenes/2026/09/b.jpg',
    ]);
    expect(e.videoUrl).toBe(
      'http://10.0.0.5:3000/archivos/videos/2026/09/v.mp4',
    );
  });

  it('un espacio inactivo se puede consultar y dice activo: false', async () => {
    const d = await crearDeporte(a);
    await crearEspacio(a, { id: 'esp-11', deporteId: d.id, activo: false });
    const res = await a.http().get('/espacios/esp-11').expect(200);
    expect(esperarContrato<Espacio>(res.body, 'Espacio').activo).toBe(false);
  });

  it('404 ESPACIO_NO_ENCONTRADO si no existe', async () => {
    esperarError(
      await a.http().get('/espacios/esp-404'),
      404,
      'ESPACIO_NO_ENCONTRADO',
    );
  });

  it('404 ESPACIO_NO_ENCONTRADO si el id no tiene la forma de un espacio', async () => {
    esperarError(
      await a.http().get('/espacios/usr-207'),
      404,
      'ESPACIO_NO_ENCONTRADO',
    );
    esperarError(
      await a.http().get('/espacios/123'),
      404,
      'ESPACIO_NO_ENCONTRADO',
    );
  });
});
