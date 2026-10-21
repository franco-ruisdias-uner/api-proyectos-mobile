import { crearApp, type AppDePrueba } from '../utilities/create-app.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import {
  claveDe,
  crearCategoria,
  crearLugar,
  MUESTRAS,
  registrarTurista,
  subirArchivo,
} from '../utilities/builders.js';

type LugarRespuesta = { id: string; nombre: string; [k: string]: unknown };
const ids = (body: { datos: LugarRespuesta[] }) => body.datos.map((l) => l.id);

// Puntos reales de Colón (E. R.) para las pruebas de distancia.
const PLAZA = { latitud: -32.2236, longitud: -58.1427 };
const TERMAS = { latitud: -32.2135, longitud: -58.1455 }; // ~1,1 km de la plaza
const MOLINO = { latitud: -32.1904, longitud: -58.1932 }; // ~6 km
const PALMAR = { latitud: -31.8667, longitud: -58.2833 }; // ~42 km

describe('PRD §1 — GET /lugares/:id', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
  });
  afterAll(() => ctx.cerrar());

  it('R1 — un lugar sin datos opcionales trae todos los campos, con null donde no hay', async () => {
    const id = await crearLugar(ctx, { nombre: 'Playa sin nada' });
    const res = await ctx.http().get(`/lugares/${id}`).expect(200);
    esperarContrato(res.body, 'Lugar');
    expect(res.body.datos).toMatchObject({
      id,
      nombre: 'Playa sin nada',
      imagenes: [],
      horarios: [],
      telefono: null,
      sitioWeb: null,
      precioEntrada: null,
      audioguia: null,
      codigoQr: null,
      accesible: false,
      activo: true,
      actualizadoEn: '2026-11-14T12:00:00-03:00',
    });
  });

  it('es público: no pide sesión', async () => {
    const id = await crearLugar(ctx);
    await ctx.http().get(`/lugares/${id}`).expect(200);
  });

  it('un lugar con todo cargado, con URLs absolutas del origen del pedido', async () => {
    const { token } = await registrarTurista(ctx);
    const foto = claveDe(await subirArchivo(ctx, token));
    const audio = claveDe(await subirArchivo(ctx, token, MUESTRAS.m4a(), 'guia.m4a'));
    const categoria = await crearCategoria(ctx, { id: 'cat-museos' });
    const id = await crearLugar(ctx, {
      id: 'lug-004',
      nombre: 'Molino Forclaz',
      categoriaId: categoria.id,
      descripcionCorta: 'Molino de viento de 1888 levantado por colonos suizos.',
      descripcion: 'Construido en 1888 por Juan Bautista Forclaz ...',
      coordenadas: MOLINO,
      direccion: 'Colonia San José, Ruta Provincial 26',
      imagenes: [foto],
      horarios: [
        { dia: 2, abre: '09:00', cierra: '19:00', temporada: 'todo-el-anio' },
        { dia: 6, abre: '10:00', cierra: '20:00', temporada: 'todo-el-anio' },
      ],
      telefono: '345-4421234',
      sitioWeb: 'https://molino.example.ar',
      precioEntrada: 1500,
      audioguia: { clave: audio, duracionSegundos: 252, idioma: 'es' },
      conQr: true,
      accesible: false,
      actualizadoEn: new Date('2026-08-01T10:30:00-03:00'),
    });
    const res = await ctx.http().get(`/lugares/${id}`).set('Host', '10.0.0.5:3000').expect(200);
    esperarContrato(res.body, 'Lugar');
    expect(res.body.datos).toEqual({
      id: 'lug-004',
      nombre: 'Molino Forclaz',
      categoriaId: 'cat-museos',
      descripcionCorta: 'Molino de viento de 1888 levantado por colonos suizos.',
      descripcion: 'Construido en 1888 por Juan Bautista Forclaz ...',
      coordenadas: MOLINO,
      direccion: 'Colonia San José, Ruta Provincial 26',
      imagenes: [`http://10.0.0.5:3000/archivos/${foto}`],
      horarios: [
        { dia: 2, abre: '09:00', cierra: '19:00' },
        { dia: 6, abre: '10:00', cierra: '20:00' },
      ],
      telefono: '345-4421234',
      sitioWeb: 'https://molino.example.ar',
      precioEntrada: 1500,
      audioguia: { url: `http://10.0.0.5:3000/archivos/${audio}`, duracionSegundos: 252, idioma: 'es' },
      codigoQr: 'COLON:lug-004',
      accesible: false,
      activo: true,
      actualizadoEn: '2026-08-01T10:30:00-03:00',
    });
  });

  it('R19 — la audioguía se baja por partes (Range → 206)', async () => {
    const { token } = await registrarTurista(ctx);
    const audio = claveDe(await subirArchivo(ctx, token, MUESTRAS.m4a(4096), 'guia.m4a'));
    const id = await crearLugar(ctx, { audioguia: { clave: audio, duracionSegundos: 200, idioma: 'es' } });
    const lugar = await ctx.http().get(`/lugares/${id}`).expect(200);
    const ruta = new URL(lugar.body.datos.audioguia.url).pathname;
    const parte = await ctx.http().get(ruta).set('Range', 'bytes=100-199').expect(206);
    expect(parte.headers['content-range']).toBe('bytes 100-199/4096');
    expect(Buffer.from(parte.body as Buffer).length).toBe(100);
  });

  it('precioEntrada 0 es gratis y sale 0, no null', async () => {
    const id = await crearLugar(ctx, { precioEntrada: 0 });
    const res = await ctx.http().get(`/lugares/${id}`).expect(200);
    expect(res.body.datos.precioEntrada).toBe(0);
  });

  it('D6 — el detalle devuelve también un lugar dado de baja, con activo: false', async () => {
    const id = await crearLugar(ctx, { activo: false });
    const res = await ctx.http().get(`/lugares/${id}`).expect(200);
    esperarContrato(res.body, 'Lugar');
    expect(res.body.datos.activo).toBe(false);
  });

  it('R2 — un lugar que abre mañana y tarde trae dos elementos con el mismo día; un día sin elementos está cerrado', async () => {
    const id = await crearLugar(ctx, {
      horarios: [
        { dia: 3, abre: '16:00', cierra: '20:00', temporada: 'todo-el-anio' },
        { dia: 3, abre: '09:00', cierra: '12:00', temporada: 'todo-el-anio' },
        { dia: 0, abre: '10:00', cierra: '13:00', temporada: 'todo-el-anio' },
      ],
    });
    const res = await ctx.http().get(`/lugares/${id}`).expect(200);
    expect(res.body.datos.horarios).toEqual([
      { dia: 0, abre: '10:00', cierra: '13:00' },
      { dia: 3, abre: '09:00', cierra: '12:00' },
      { dia: 3, abre: '16:00', cierra: '20:00' },
    ]);
    expect(res.body.datos.horarios.some((h: { dia: number }) => h.dia === 1)).toBe(false);
  });

  it.each([
    ['lug-noexiste', 'no existe'],
    ['otra-cosa', 'no tiene el prefijo lug-'],
    ['cat-museos', 'es de otra entidad'],
  ])('LUGAR_NO_ENCONTRADO con %s (%s)', async (id) => {
    esperarError(await ctx.http().get(`/lugares/${id}`), 404, 'LUGAR_NO_ENCONTRADO');
  });

  it('LUGAR_NO_ENCONTRADO con el id en otras mayúsculas (igual en los cuatro motores)', async () => {
    const id = await crearLugar(ctx, { id: 'lug-mayus' });
    await ctx.http().get(`/lugares/${id}`).expect(200);
    esperarError(await ctx.http().get('/lugares/lug-MAYUS'), 404, 'LUGAR_NO_ENCONTRADO');
  });
});

describe('R3 / D1 — Los horarios que se devuelven son los de la temporada vigente', () => {
  let ctx: AppDePrueba;
  let id: string;
  beforeAll(async () => {
    ctx = await crearApp();
    id = await crearLugar(ctx, {
      nombre: 'Termas',
      horarios: [
        { dia: 1, abre: '08:00', cierra: '22:00', temporada: 'verano' },
        { dia: 1, abre: '09:00', cierra: '20:00', temporada: 'invierno' },
        { dia: 2, abre: '10:00', cierra: '12:00', temporada: 'todo-el-anio' },
      ],
      actualizadoEn: new Date('2026-01-10T10:00:00-03:00'),
    });
  });
  afterAll(() => ctx.cerrar());

  const INVIERNO = [
    { dia: 1, abre: '09:00', cierra: '20:00' },
    { dia: 2, abre: '10:00', cierra: '12:00' },
  ];
  const VERANO = [
    { dia: 1, abre: '08:00', cierra: '22:00' },
    { dia: 2, abre: '10:00', cierra: '12:00' },
  ];

  it.each([
    ['2026-11-30T23:59:59-03:00', 'invierno', INVIERNO],
    ['2026-12-01T00:00:00-03:00', 'verano', VERANO],
    ['2026-12-31T23:59:00-03:00', 'verano', VERANO],
    ['2027-01-01T00:00:00-03:00', 'verano', VERANO],
    ['2027-03-31T23:59:59-03:00', 'verano', VERANO],
    ['2027-04-01T00:00:00-03:00', 'invierno', INVIERNO],
    ['2026-07-15T12:00:00-03:00', 'invierno', INVIERNO],
  ])('%s → %s', async (ahora, _temporada, esperado) => {
    ctx.reloj.fijar(ahora);
    const res = await ctx.http().get(`/lugares/${id}`).expect(200);
    esperarContrato(res.body, 'Lugar');
    expect(res.body.datos.horarios).toEqual(esperado);
  });

  it('el corte es a medianoche de Buenos Aires, no de UTC (1/12 01:00 UTC todavía es 30/11)', async () => {
    ctx.reloj.fijar('2026-12-01T01:00:00Z');
    const res = await ctx.http().get(`/lugares/${id}`).expect(200);
    expect(res.body.datos.horarios).toEqual(INVIERNO);
  });

  it('D1 — cuando cambia la temporada, actualizadoEn pasa a ser el comienzo de la temporada', async () => {
    ctx.reloj.fijar('2026-12-05T10:00:00-03:00');
    const res = await ctx.http().get(`/lugares/${id}`).expect(200);
    expect(res.body.datos.actualizadoEn).toBe('2026-12-01T00:00:00-03:00');
    ctx.reloj.fijar('2026-04-05T10:00:00-03:00');
    const otoño = await ctx.http().get(`/lugares/${id}`).expect(200);
    expect(otoño.body.datos.actualizadoEn).toBe('2026-04-01T00:00:00-03:00');
  });
});

describe('PRD §1 y §2 — GET /lugares', () => {
  let ctx: AppDePrueba;
  let museos: string;
  let playas: string;
  const lugar: Record<string, string> = {};

  beforeAll(async () => {
    ctx = await crearApp();
    museos = (await crearCategoria(ctx, { id: 'cat-museos' })).id;
    playas = (await crearCategoria(ctx, { id: 'cat-playas' })).id;
    await crearCategoria(ctx, { id: 'cat-vacia' });
    lugar.termas = await crearLugar(ctx, {
      nombre: 'Termas de Colón',
      categoriaId: playas,
      coordenadas: TERMAS,
      accesible: true,
    });
    lugar.molino = await crearLugar(ctx, {
      nombre: 'Molino Forclaz',
      categoriaId: museos,
      coordenadas: MOLINO,
    });
    lugar.palmar = await crearLugar(ctx, {
      nombre: 'Parque Nacional El Palmar',
      categoriaId: playas,
      coordenadas: PALMAR,
      accesible: true,
    });
    lugar.casa = await crearLugar(ctx, {
      nombre: 'Ábaco: Casa de la Cultura',
      categoriaId: museos,
      coordenadas: PLAZA,
    });
    lugar.baja = await crearLugar(ctx, {
      nombre: 'Balneario cerrado',
      categoriaId: playas,
      coordenadas: PLAZA,
      activo: false,
    });
  });
  afterAll(() => ctx.cerrar());

  it('es público y, sin filtros, trae sólo los activos por nombre (sin distinguir tildes)', async () => {
    const res = await ctx.http().get('/lugares').expect(200);
    esperarContrato(res.body, 'Lugar');
    expect(ids(res.body)).toEqual([lugar.casa, lugar.molino, lugar.palmar, lugar.termas]);
    expect(res.body.meta).toEqual({ total: 4, pagina: 1, porPagina: 20 });
  });

  it('paginación: meta correcto, página fuera de rango vacía con el total', async () => {
    const p2 = await ctx.http().get('/lugares?pagina=2&porPagina=3').expect(200);
    esperarContrato(p2.body, 'Lugar');
    expect(ids(p2.body)).toEqual([lugar.termas]);
    expect(p2.body.meta).toEqual({ total: 4, pagina: 2, porPagina: 3 });
    const fuera = await ctx.http().get('/lugares?pagina=5&porPagina=3').expect(200);
    expect(fuera.body).toEqual({ datos: [], meta: { total: 4, pagina: 5, porPagina: 3 } });
  });

  it('porPagina llega a 500 (el teléfono guarda el catálogo entero)', async () => {
    const res = await ctx.http().get('/lugares?porPagina=500').expect(200);
    expect(res.body.meta.porPagina).toBe(500);
    esperarError(await ctx.http().get('/lugares?porPagina=501'), 400, 'VALIDACION_FALLIDA');
  });

  describe('filtro categoriaId', () => {
    it('sólo esa categoría', async () => {
      const res = await ctx.http().get(`/lugares?categoriaId=${museos}`).expect(200);
      esperarContrato(res.body, 'Lugar');
      expect(ids(res.body)).toEqual([lugar.casa, lugar.molino]);
      expect(res.body.meta.total).toBe(2);
    });

    it.each(['cat-noexiste', 'cat-vacia', 'CAT-MUSEOS', 'museos'])(
      '%s da lista vacía, no error',
      async (categoriaId) => {
        const res = await ctx.http().get(`/lugares?categoriaId=${categoriaId}`).expect(200);
        esperarContrato(res.body, 'Lugar');
        expect(res.body).toEqual({ datos: [], meta: { total: 0, pagina: 1, porPagina: 20 } });
      },
    );
  });

  describe('filtro q: busca en el nombre sin distinguir mayúsculas ni tildes', () => {
    it.each([
      ['colon', 'termas'],
      ['COLÓN', 'termas'],
      ['  termas   de ', 'termas'],
      ['forclaz', 'molino'],
      ['ábaco', 'casa'],
      ['abaco', 'casa'],
    ])('«%s» encuentra %s', async (q, clave) => {
      const res = await ctx.http().get('/lugares').query({ q }).expect(200);
      esperarContrato(res.body, 'Lugar');
      expect(ids(res.body)).toEqual([lugar[clave]]);
    });

    it('no busca en la descripción', async () => {
      const res = await ctx.http().get('/lugares').query({ q: 'conocer' }).expect(200);
      expect(res.body.datos).toEqual([]);
    });

    it.each(['%', '_', '\\', 'a%', '%o%'])('«%s» no funciona como comodín', async (q) => {
      const res = await ctx.http().get('/lugares').query({ q }).expect(200);
      expect(res.body.datos).toEqual([]);
    });

    it('una búsqueda vacía no filtra', async () => {
      const res = await ctx.http().get('/lugares?q=').expect(200);
      expect(res.body.meta.total).toBe(4);
    });

    it('se combina con la categoría', async () => {
      const res = await ctx.http().get('/lugares').query({ q: 'cultura', categoriaId: museos }).expect(200);
      expect(ids(res.body)).toEqual([lugar.casa]);
    });
  });

  describe('PRD §2 — cercanía', () => {
    it('radioMetros: sólo los lugares dentro del radio', async () => {
      const res = await ctx
        .http()
        .get('/lugares')
        .query({ ...PLAZA, radioMetros: 2000 })
        .expect(200);
      esperarContrato(res.body, 'Lugar');
      expect(ids(res.body)).toEqual([lugar.casa, lugar.termas]);
    });

    it('R4 — orden=distancia ordena del más cerca al más lejos sin agregar la distancia', async () => {
      const res = await ctx
        .http()
        .get('/lugares')
        .query({ ...PLAZA, orden: 'distancia' })
        .expect(200);
      esperarContrato(res.body, 'Lugar');
      expect(ids(res.body)).toEqual([lugar.casa, lugar.termas, lugar.molino, lugar.palmar]);
      for (const l of res.body.datos) {
        expect(Object.keys(l)).not.toContain('distancia');
        expect(Object.keys(l)).not.toContain('abiertoAhora');
      }
    });

    it('orden=distancia con radio y paginado', async () => {
      const res = await ctx
        .http()
        .get('/lugares')
        .query({ ...PLAZA, orden: 'distancia', radioMetros: 10000, porPagina: 2, pagina: 2 })
        .expect(200);
      expect(ids(res.body)).toEqual([lugar.molino]);
      expect(res.body.meta).toEqual({ total: 3, pagina: 2, porPagina: 2 });
    });

    it('con el punto pero sin orden ni radio, ordena por nombre y trae todos', async () => {
      const res = await ctx.http().get('/lugares').query(PLAZA).expect(200);
      expect(ids(res.body)).toEqual([lugar.casa, lugar.molino, lugar.palmar, lugar.termas]);
    });

    it('orden=nombre explícito', async () => {
      const res = await ctx
        .http()
        .get('/lugares')
        .query({ ...PLAZA, orden: 'nombre' })
        .expect(200);
      expect(ids(res.body)).toEqual([lugar.casa, lugar.molino, lugar.palmar, lugar.termas]);
    });
  });

  it('accesible=true: sólo los accesibles para silla de ruedas', async () => {
    const res = await ctx.http().get('/lugares?accesible=true').expect(200);
    esperarContrato(res.body, 'Lugar');
    expect(ids(res.body)).toEqual([lugar.palmar, lugar.termas]);
  });

  describe('R5 y validaciones de los filtros', () => {
    it.each([
      ['orden=distancia', 'Para ordenar por distancia hace falta tu ubicación (latitud y longitud).'],
      ['latitud=-32.2', 'Mandá la latitud y la longitud juntas.'],
      ['longitud=-58.1', 'Mandá la latitud y la longitud juntas.'],
      ['radioMetros=500', 'Para buscar cerca hace falta tu ubicación (latitud y longitud).'],
      ['latitud=91&longitud=-58', 'La latitud tiene que estar entre -90 y 90.'],
      ['latitud=-90.5&longitud=-58', 'La latitud tiene que estar entre -90 y 90.'],
      ['latitud=-32&longitud=181', 'La longitud tiene que estar entre -180 y 180.'],
      ['latitud=-32&longitud=-180.01', 'La longitud tiene que estar entre -180 y 180.'],
      ['latitud=abc&longitud=-58', 'La latitud tiene que ser un número.'],
      ['latitud=&longitud=-58', 'La latitud tiene que ser un número.'],
      [
        'latitud=-32&longitud=-58&radioMetros=0',
        'El radio tiene que ser un número entero de metros, de 1 a 200000.',
      ],
      [
        'latitud=-32&longitud=-58&radioMetros=1.5',
        'El radio tiene que ser un número entero de metros, de 1 a 200000.',
      ],
      [
        'latitud=-32&longitud=-58&radioMetros=200001',
        'El radio tiene que ser un número entero de metros, de 1 a 200000.',
      ],
      ['orden=precio', 'El orden tiene que ser «nombre» o «distancia».'],
      ['accesible=si', 'El filtro de accesibilidad sólo acepta «true».'],
      ['accesible=false', 'El filtro de accesibilidad sólo acepta «true».'],
      [
        'actualizadoDesde=ayer',
        'La fecha de «actualizadoDesde» tiene que tener fecha, hora y zona, como 2026-08-01T10:30:00-03:00.',
      ],
      [
        'actualizadoDesde=2026-08-01',
        'La fecha de «actualizadoDesde» tiene que tener fecha, hora y zona, como 2026-08-01T10:30:00-03:00.',
      ],
      [
        'actualizadoDesde=2026-08-01T10:30:00',
        'La fecha de «actualizadoDesde» tiene que tener fecha, hora y zona, como 2026-08-01T10:30:00-03:00.',
      ],
      ['q=a&q=b', 'La búsqueda tiene que ser un texto.'],
      ['otro=1', 'El pedido trae datos que no corresponden.'],
    ])('VALIDACION_FALLIDA con %s', async (consulta, mensaje) => {
      const res = await ctx.http().get(`/lugares?${consulta}`);
      esperarError(res, 400, 'VALIDACION_FALLIDA');
      expect(res.body.error.mensaje).toBe(mensaje);
    });

    it('coordenadas en el borde del rango son válidas', async () => {
      await ctx.http().get('/lugares?latitud=-90&longitud=180').expect(200);
      await ctx.http().get('/lugares?latitud=90&longitud=-180&orden=distancia').expect(200);
    });
  });

  it('las URLs de las imágenes salen con el origen del pedido', async () => {
    const { token } = await registrarTurista(ctx);
    const foto = claveDe(await subirArchivo(ctx, token));
    const c = (await crearCategoria(ctx)).id;
    await crearLugar(ctx, { categoriaId: c, imagenes: [foto] });
    const res = await ctx.http().get(`/lugares?categoriaId=${c}`).set('Host', '10.0.0.5:3000').expect(200);
    expect(res.body.datos[0].imagenes).toEqual([`http://10.0.0.5:3000/archivos/${foto}`]);
  });
});

describe('PRD §2 — El radio mide metros de verdad en cualquier parte del mundo', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
  });
  afterAll(() => ctx.cerrar());

  it('del otro lado del antimeridiano (a ~2 km) entra en un radio de 5 km', async () => {
    const id = await crearLugar(ctx, { coordenadas: { latitud: 0, longitud: -179.99 } });
    const res = await ctx
      .http()
      .get('/lugares')
      .query({ latitud: 0, longitud: 179.99, radioMetros: 5000, orden: 'distancia' })
      .expect(200);
    expect(ids(res.body)).toEqual([id]);
  });

  it('cerca del polo, un radio grande abarca todas las longitudes', async () => {
    const id = await crearLugar(ctx, { coordenadas: { latitud: 89.9, longitud: 0 } });
    const res = await ctx
      .http()
      .get('/lugares')
      .query({ latitud: 89.9, longitud: 180, radioMetros: 30000 })
      .expect(200);
    expect(ids(res.body)).toEqual([id]);
  });
});

describe('AGENTS §4.6 — Un byte nulo en los filtros no rompe (PostgreSQL no lo acepta en un texto)', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
    await crearLugar(ctx, { nombre: 'Molino Forclaz' });
  });
  afterAll(() => ctx.cerrar());

  it.each(['categoriaId=%00', 'categoriaId=cat-museos%00'])(
    '%s → lista vacía (un id que no existe)',
    async (consulta) => {
      const res = await ctx.http().get(`/lugares?${consulta}`).expect(200);
      expect(res.body).toEqual({ datos: [], meta: { total: 0, pagina: 1, porPagina: 20 } });
    },
  );

  it('un categoriaId larguísimo también es un id que no existe → lista vacía', async () => {
    const res = await ctx
      .http()
      .get('/lugares')
      .query({ categoriaId: 'cat-' + 'x'.repeat(3000) })
      .expect(200);
    expect(res.body.datos).toEqual([]);
  });

  it('q de más de 100 letras → 400 VALIDACION_FALLIDA', async () => {
    const res = await ctx
      .http()
      .get('/lugares')
      .query({ q: 'x'.repeat(101) });
    esperarError(res, 400, 'VALIDACION_FALLIDA');
    expect(res.body.error.mensaje).toBe('La búsqueda puede tener hasta 100 letras.');
  });

  it('en q, un caracter de control cuenta como un espacio', async () => {
    const res = await ctx.http().get('/lugares?q=molino%00').expect(200);
    expect(res.body.datos.map((l: LugarRespuesta) => l.nombre)).toEqual(['Molino Forclaz']);
    const vacia = await ctx.http().get('/lugares?q=%00').expect(200);
    expect(vacia.body.meta.total).toBe(1);
  });
});

describe('AGENTS §4.2 — Orden determinístico de GET /lugares', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
  });
  afterAll(() => ctx.cerrar());

  it('empate de nombre: desempata por id', async () => {
    const b = await crearLugar(ctx, { id: 'lug-empate-b', nombre: 'Empate' });
    const a = await crearLugar(ctx, { id: 'lug-empate-a', nombre: 'empate' });
    const res = await ctx.http().get('/lugares').expect(200);
    expect(ids(res.body)).toEqual([a, b]);
  });

  it('empate de distancia: desempata por nombre y después por id', async () => {
    const punto = { latitud: -32.3, longitud: -58.3 };
    const c = await crearLugar(ctx, { id: 'lug-dist-c', nombre: 'Zeta', coordenadas: punto });
    const b = await crearLugar(ctx, { id: 'lug-dist-b', nombre: 'Alfa', coordenadas: punto });
    const a = await crearLugar(ctx, { id: 'lug-dist-a', nombre: 'Alfa', coordenadas: punto });
    const res = await ctx
      .http()
      .get('/lugares')
      .query({ ...punto, orden: 'distancia', radioMetros: 10 })
      .expect(200);
    expect(ids(res.body)).toEqual([a, b, c]);
  });
});

describe('Especificación §4 — GET /lugares?actualizadoDesde (el teléfono actualiza su copia)', () => {
  let ctx: AppDePrueba;
  let viejo: string;
  let nuevo: string;
  let baja: string;
  beforeAll(async () => {
    ctx = await crearApp({ ahora: '2026-11-14T12:00:00-03:00' });
    viejo = await crearLugar(ctx, { nombre: 'Viejo', actualizadoEn: new Date('2026-08-01T10:30:00-03:00') });
    nuevo = await crearLugar(ctx, { nombre: 'Nuevo', actualizadoEn: new Date('2026-11-10T09:00:00-03:00') });
    baja = await crearLugar(ctx, {
      nombre: 'Dado de baja',
      activo: false,
      actualizadoEn: new Date('2026-11-12T09:00:00-03:00'),
    });
  });
  afterAll(() => ctx.cerrar());

  it('D6 — devuelve los actualizados después, incluidos los dados de baja', async () => {
    const res = await ctx
      .http()
      .get('/lugares')
      .query({ actualizadoDesde: '2026-11-01T00:00:00-03:00' })
      .expect(200);
    esperarContrato(res.body, 'Lugar');
    expect(ids(res.body)).toEqual([baja, nuevo]);
    expect(res.body.datos[0].activo).toBe(false);
  });

  it('es estrictamente posterior: con el mismo instante no vuelve a venir', async () => {
    const res = await ctx
      .http()
      .get('/lugares')
      .query({ actualizadoDesde: '2026-11-12T09:00:00-03:00' })
      .expect(200);
    expect(res.body.datos).toEqual([]);
  });

  it('acepta el instante con Z o con milisegundos', async () => {
    const z = await ctx
      .http()
      .get('/lugares')
      .query({ actualizadoDesde: '2026-11-10T11:59:59Z' })
      .expect(200);
    expect(ids(z.body)).toEqual([baja, nuevo]);
    const ms = await ctx
      .http()
      .get('/lugares')
      .query({ actualizadoDesde: '2026-11-10T09:00:00.500-03:00' })
      .expect(200);
    expect(ids(ms.body)).toEqual([baja]);
  });

  it('desde muy atrás: todos, activos y dados de baja', async () => {
    const res = await ctx
      .http()
      .get('/lugares')
      .query({ actualizadoDesde: '2000-01-01T00:00:00-03:00' })
      .expect(200);
    expect(ids(res.body)).toEqual([baja, nuevo, viejo]);
  });

  it('D1 — un lugar con horario de temporada vuelve a venir cuando cambia la temporada', async () => {
    const termas = await crearLugar(ctx, {
      nombre: 'Termas',
      horarios: [
        { dia: 1, abre: '08:00', cierra: '22:00', temporada: 'verano' },
        { dia: 1, abre: '09:00', cierra: '20:00', temporada: 'invierno' },
      ],
      actualizadoEn: new Date('2026-10-01T10:00:00-03:00'),
    });
    // En noviembre (invierno), el teléfono sincronizó el 5/11: nada nuevo de las termas.
    const antes = await ctx.http().get('/lugares').query({ actualizadoDesde: '2026-11-05T00:00:00-03:00' });
    expect(ids(antes.body)).not.toContain(termas);
    // Empieza el verano: las termas vuelven a venir, con los horarios de verano.
    ctx.reloj.fijar('2026-12-02T10:00:00-03:00');
    const despues = await ctx.http().get('/lugares').query({ actualizadoDesde: '2026-11-05T00:00:00-03:00' });
    esperarContrato(despues.body, 'Lugar');
    const t = despues.body.datos.find((l: LugarRespuesta) => l.id === termas);
    expect(t).toMatchObject({
      actualizadoEn: '2026-12-01T00:00:00-03:00',
      horarios: [{ dia: 1, abre: '08:00', cierra: '22:00' }],
    });
    // Y una vez que el teléfono la tiene, no vuelve.
    const luego = await ctx.http().get('/lugares').query({ actualizadoDesde: '2026-12-01T00:00:00-03:00' });
    expect(ids(luego.body)).not.toContain(termas);
    ctx.reloj.fijar('2026-11-14T12:00:00-03:00');
  });
});
