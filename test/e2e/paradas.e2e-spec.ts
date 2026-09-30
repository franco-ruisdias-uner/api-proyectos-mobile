import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { crearLinea, crearParada } from '../utilidades/red.js';

// Centro de referencia: Alameda y Urquiza.
const CENTRO = { latitud: -31.7333, longitud: -60.5241 };

interface ParadaJson {
  id: string;
  nombre: string;
  lineaIds: string[];
}
const ids = (r: { body: { datos: ParadaJson[] } }) => r.body.datos.map((p) => p.id);

describe('Espec. M1 — GET /paradas/:id (PRD §1, tipo Parada)', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
  });
  afterAll(() => ctx.cerrar());

  it('devuelve la Parada del PRD con lineaIds calculado desde los recorridos (R2)', async () => {
    const parada = await crearParada(ctx, {
      id: 'par-101',
      nombre: 'Alameda y Urquiza',
      latitud: -31.7333,
      longitud: -60.5241,
    });
    await crearLinea(ctx, {
      id: 'lin-14',
      numero: '14',
      recorridos: [{ sentido: 'ida', paradaIds: [parada.id] }],
    });
    await crearLinea(ctx, {
      id: 'lin-05',
      numero: '5',
      recorridos: [{ sentido: 'ida', paradaIds: [parada.id] }],
    });
    await crearLinea(ctx, { id: 'lin-99', numero: '99' });
    const r = await ctx.http.get('/paradas/par-101').expect(200);
    esperarContrato(r.body, 'Parada');
    expect(r.body.datos).toEqual({
      id: 'par-101',
      nombre: 'Alameda y Urquiza',
      coordenadas: { latitud: -31.7333, longitud: -60.5241 },
      lineaIds: ['lin-05', 'lin-14'],
      sentido: 'ida',
      refugio: true,
      codigoQr: 'PARANA:par-101',
    });
  });

  it('una parada sin QR ni refugio trae codigoQr: null y refugio: false; sin líneas, lineaIds: []', async () => {
    const parada = await crearParada(ctx, { codigoQr: null, refugio: false, sentido: 'vuelta' });
    const r = await ctx.http.get(`/paradas/${parada.id}`).expect(200);
    esperarContrato(r.body, 'Parada');
    expect(r.body.datos).toMatchObject({
      codigoQr: null,
      refugio: false,
      lineaIds: [],
      sentido: 'vuelta',
    });
  });

  it('PARADA_NO_ENCONTRADA (404), también con un id mal formado o de otra mayúscula', async () => {
    await crearParada(ctx, { id: 'par-abc' });
    for (const id of ['par-nada', 'lin-05', 'x', 'PAR-ABC']) {
      const r = await ctx.http.get(`/paradas/${id}`);
      esperarError(r, 404, 'PARADA_NO_ENCONTRADA');
      expect(r.body.error.mensaje).toBe('No existe esa parada.');
    }
  });
});

describe('Espec. M1 — GET /paradas (lista, filtros y orden)', () => {
  let ctx: AppDePrueba;
  let lin5: string;
  let lin14: string;
  beforeAll(async () => {
    ctx = await crearApp();
    const colon = await crearParada(ctx, {
      id: 'par-001',
      nombre: 'Colón y Urquiza',
      sentido: 'ida',
      latitud: -31.7333,
      longitud: -60.5241,
    });
    const newbery = await crearParada(ctx, {
      id: 'par-002',
      nombre: 'Almafuerte y Newbery',
      sentido: 'ida',
      latitud: -31.7484,
      longitud: -60.5079,
    });
    const corrientes = await crearParada(ctx, {
      id: 'par-003',
      nombre: 'Corrientes y 25 de Mayo',
      sentido: 'vuelta',
      latitud: -31.7345,
      longitud: -60.523,
    });
    await crearParada(ctx, {
      id: 'par-004',
      nombre: 'Huérfana',
      sentido: 'ida',
      latitud: -31.75,
      longitud: -60.55,
    });
    lin5 = (
      await crearLinea(ctx, {
        numero: '5',
        recorridos: [
          { sentido: 'ida', paradaIds: [colon.id, newbery.id] },
          { sentido: 'vuelta', paradaIds: [corrientes.id] },
        ],
      })
    ).id;
    lin14 = (
      await crearLinea(ctx, {
        numero: '14',
        recorridos: [{ sentido: 'ida', paradaIds: [colon.id] }],
      })
    ).id;
  });
  afterAll(() => ctx.cerrar());

  it('es público, cumple el contrato y por defecto va ordenada por nombre', async () => {
    const r = await ctx.http.get('/paradas').expect(200);
    esperarContrato(r.body, 'Parada');
    expect(ids(r)).toEqual(['par-002', 'par-001', 'par-003', 'par-004']);
    expect(r.body.meta).toEqual({ total: 4, pagina: 1, porPagina: 20 });
    expect(r.body.datos[1].lineaIds).toEqual([lin5, lin14]);
  });

  it('q busca en el nombre sin distinguir tildes ni mayúsculas', async () => {
    for (const q of ['colon', 'COLÓN', 'colón y urq', 'NEWBERY', '  25   de mayo ']) {
      const r = await ctx.http.get('/paradas').query({ q }).expect(200);
      expect(r.body.meta.total).toBe(1);
    }
    const huerfana = await ctx.http.get('/paradas').query({ q: 'huerfana' });
    expect(ids(huerfana)).toEqual(['par-004']);
  });

  it('q sin resultados da lista vacía; q vacío no filtra', async () => {
    const vacia = await ctx.http.get('/paradas?q=zzzz').expect(200);
    expect(vacia.body).toEqual({ datos: [], meta: { total: 0, pagina: 1, porPagina: 20 } });
    expect((await ctx.http.get('/paradas?q=').expect(200)).body.meta.total).toBe(4);
  });

  it('q con % o _ no funciona como comodín', async () => {
    expect((await ctx.http.get('/paradas').query({ q: '%' })).body.meta.total).toBe(0);
    expect((await ctx.http.get('/paradas').query({ q: 'co_on' })).body.meta.total).toBe(0);
    expect((await ctx.http.get('/paradas').query({ q: 'a\\b' })).body.meta.total).toBe(0);
  });

  it('lineaId deja las paradas de esa línea, en cualquier sentido', async () => {
    expect(ids(await ctx.http.get('/paradas').query({ lineaId: lin5 }))).toEqual([
      'par-002',
      'par-001',
      'par-003',
    ]);
    expect(ids(await ctx.http.get('/paradas').query({ lineaId: lin14 }))).toEqual(['par-001']);
  });

  it('lineaId inexistente (bien formado) da lista vacía', async () => {
    const r = await ctx.http.get('/paradas?lineaId=lin-nada').expect(200);
    expect(r.body.datos).toEqual([]);
  });

  it('sentido filtra por ida o vuelta', async () => {
    expect(ids(await ctx.http.get('/paradas?sentido=vuelta'))).toEqual(['par-003']);
    expect(ids(await ctx.http.get('/paradas').query({ sentido: 'ida', lineaId: lin5 }))).toEqual([
      'par-002',
      'par-001',
    ]);
  });

  it('latitud + longitud + radioMetros: sólo las cercanas', async () => {
    const r = await ctx.http
      .get('/paradas')
      .query({ ...CENTRO, radioMetros: 500 })
      .expect(200);
    esperarContrato(r.body, 'Parada');
    expect(ids(r)).toEqual(['par-001', 'par-003']);
    expect(r.body.meta.total).toBe(2);
    const lejos = await ctx.http.get('/paradas').query({ ...CENTRO, radioMetros: 5000 });
    expect(lejos.body.meta.total).toBe(4);
  });

  it('orden=distancia ordena de cerca a lejos y no agrega el campo distancia (AGENTS §4.5)', async () => {
    const r = await ctx.http
      .get('/paradas')
      .query({ ...CENTRO, orden: 'distancia' })
      .expect(200);
    expect(ids(r)).toEqual(['par-001', 'par-003', 'par-002', 'par-004']);
    expect(Object.keys(r.body.datos[0]).sort()).toEqual([
      'codigoQr',
      'coordenadas',
      'id',
      'lineaIds',
      'nombre',
      'refugio',
      'sentido',
    ]);
  });

  it('pagina después de filtrar: meta.total es el filtrado', async () => {
    const r = await ctx.http.get('/paradas?pagina=2&porPagina=2').expect(200);
    expect(ids(r)).toEqual(['par-003', 'par-004']);
    expect(r.body.meta).toEqual({ total: 4, pagina: 2, porPagina: 2 });
    const fuera = await ctx.http.get('/paradas?pagina=5&porPagina=2').expect(200);
    expect(fuera.body).toEqual({ datos: [], meta: { total: 4, pagina: 5, porPagina: 2 } });
  });

  it('porPagina llega hasta 1000 (para guardarlas en el teléfono) y no más', async () => {
    await ctx.http.get('/paradas?porPagina=1000').expect(200);
    esperarError(await ctx.http.get('/paradas?porPagina=1001'), 400, 'VALIDACION_FALLIDA');
  });

  it.each([
    ['sentido=al_lado', 'sentido'],
    ['orden=precio', 'orden'],
    ['orden=distancia', 'latitud'],
    ['latitud=-31.7', 'longitud'],
    ['longitud=-60.5', 'latitud'],
    ['radioMetros=500', 'latitud'],
    ['latitud=-31.7&longitud=-60.5&radioMetros=0', 'radio'],
    ['latitud=-31.7&longitud=-60.5&radioMetros=-5', 'radio'],
    ['latitud=-31.7&longitud=-60.5&radioMetros=abc', 'radio'],
    ['latitud=91&longitud=-60.5&radioMetros=5', 'latitud'],
    ['latitud=-31.7&longitud=181&radioMetros=5', 'longitud'],
    ['latitud=&longitud=-60.5&radioMetros=5', 'latitud'],
    ['latitud=NaN&longitud=-60.5&radioMetros=5', 'latitud'],
    ['latitud=Infinity&longitud=-60.5&radioMetros=5', 'latitud'],
    ['lineaId=par-101', 'línea'],
    ['lineaId=lin-05&lineaId=lin-14', 'línea'],
    ['q=' + 'a'.repeat(101), 'búsqueda'],
    ['cercanas=1', 'cercanas'],
  ])('VALIDACION_FALLIDA con ?%s', async (consulta, palabra) => {
    const r = await ctx.http.get(`/paradas?${consulta}`);
    esperarError(r, 400, 'VALIDACION_FALLIDA');
    expect(r.body.error.mensaje.toLowerCase()).toContain(palabra.toLowerCase());
  });
});

describe('Espec. M1 + R4 — GET /paradas/qr/:codigo', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
    await crearParada(ctx, { id: 'par-101', nombre: 'Alameda y Urquiza' });
    await crearParada(ctx, { id: 'par-sinqr', codigoQr: null });
  });
  afterAll(() => ctx.cerrar());

  it('resuelve PARANA:par-101 a la Parada, sin sesión', async () => {
    const r = await ctx.http.get('/paradas/qr/PARANA:par-101').expect(200);
    esperarContrato(r.body, 'Parada');
    expect(r.body.datos.id).toBe('par-101');
    await ctx.http.get('/paradas/qr/PARANA%3Apar-101').expect(200);
  });

  it.each([
    ['cualquier otra cosa', 'hola'],
    ['el id sin prefijo', 'par-101'],
    ['otra mayúscula', 'parana:par-101'],
    ['una parada que no existe', 'PARANA:par-999'],
    ['una parada que no tiene QR', 'PARANA:par-sinqr'],
    ['otra entidad', 'PARANA:lin-05'],
    ['una URL', 'https%3A%2F%2Fejemplo.com%2F'],
    ['un byte nulo', 'PARANA:par-101%00'],
    ['un texto larguísimo', 'PARANA:par-' + 'x'.repeat(5000)],
    ['sólo espacios', '%20%20'],
    ['comillas y SQL', "PARANA:par-101'%20OR%201=1--"],
  ])('QR_NO_RECONOCIDO (404, nunca 500) con %s', async (_caso, codigo) => {
    const r = await ctx.http.get(`/paradas/qr/${codigo}`);
    esperarError(r, 404, 'QR_NO_RECONOCIDO');
    expect(r.body.error.mensaje).toBe('Ese código no es de una parada de Paraná.');
  });
});
