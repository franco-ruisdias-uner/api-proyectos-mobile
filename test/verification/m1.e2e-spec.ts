// Verificación independiente de M1 — Catálogo (verificador-contrato, AGENTS §12).
// Caja negra: sólo HTTP contra la app completa. No lee src/ (salvo el Sembrador, para sembrar).
import { JwtService } from '@nestjs/jwt';
import type { Categoria, Lugar } from '../../contract/types.js';
import { Sembrador } from '../../src/seeds/seed.js';
import { crearApp, type AppDePrueba } from '../utilities/create-app.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import {
  claveDe,
  conSesion,
  crearCategoria,
  crearLugar,
  MUESTRAS,
  registrarTurista,
  subirArchivo,
} from '../utilities/builders.js';

const ids = (body: { datos: { id: string }[] }) => body.datos.map((l) => l.id);
const PLAZA = { latitud: -32.2236, longitud: -58.1427 };
/** Metros por grado de latitud con el radio medio de la Tierra (6.371 km). */
const M_POR_GRADO = (2 * Math.PI * 6371000) / 360;
const gradosLongitud = (metros: number, latitud: number) =>
  metros / (M_POR_GRADO * Math.cos((latitud * Math.PI) / 180));

/** Un error que no es 500 y que viene con el sobre exacto. */
function esperarSinRomper(res: { status: number; body: unknown }) {
  expect(res.status, JSON.stringify(res.body)).toBeLessThan(500);
  if (res.status >= 400) {
    const cuerpo = res.body as { error?: { codigo: string; mensaje: string } };
    expect(Object.keys(cuerpo)).toEqual(['error']);
    expect(Object.keys(cuerpo.error ?? {}).sort()).toEqual(['codigo', 'mensaje']);
  }
}

// ───────────────────────────────────────────────────────────────────────────────────────────
describe('PRD §5 y AGENTS §7.3 — Para mirar no hace falta cuenta, aunque el teléfono mande un token', () => {
  let ctx: AppDePrueba;
  let vencido: string;
  let valido: string;
  beforeAll(async () => {
    ctx = await crearApp();
    await crearLugar(ctx, { id: 'lug-publico', conQr: true });
    const sesion = await registrarTurista(ctx);
    valido = sesion.token;
    vencido = await ctx.app
      .get(JwtService)
      .signAsync({ sub: sesion.usuario.id, rol: 'turista' }, { expiresIn: -10 });
  });
  afterAll(() => ctx.cerrar());

  const RUTAS = ['/categorias', '/lugares', '/lugares/lug-publico', '/lugares/qr/COLON%3Alug-publico'];

  it.each(RUTAS)('%s con un token válido: 200', async (ruta) => {
    await ctx.http().get(ruta).set(conSesion(valido)).expect(200);
  });

  // El teléfono guarda el token en secure-store y lo manda siempre: si venció, el catálogo
  // tiene que seguir viéndose (PRD §5: "Para mirar ... no quiero que le pidan cuenta a nadie").
  it.each(RUTAS)('%s con un token vencido: igual responde 200', async (ruta) => {
    const res = await ctx.http().get(ruta).set(conSesion(vencido));
    expect(res.status, JSON.stringify(res.body)).toBe(200);
  });

  it.each(RUTAS)('%s con un token mal formado: igual responde 200', async (ruta) => {
    const res = await ctx.http().get(ruta).set('Authorization', 'Bearer basura.basura.basura');
    expect(res.status, JSON.stringify(res.body)).toBe(200);
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────
describe('AGENTS §4.3 — actualizadoEn: -03:00, sin milisegundos y sin redondear', () => {
  it.each([
    [
      '31/12 23:59:59.999 (se trunca, no pasa al año siguiente)',
      '2026-12-31T23:59:59.999-03:00',
      '2026-12-31T23:59:59-03:00',
    ],
    ['1/1 00:00', '2027-01-01T00:00:00-03:00', '2027-01-01T00:00:00-03:00'],
    ['último día del mes, 23:59:30.500', '2026-11-30T23:59:30.500-03:00', '2026-11-30T23:59:30-03:00'],
    ['dado en Z', '2026-11-15T02:30:00Z', '2026-11-14T23:30:00-03:00'],
  ])('lugar cargado con %s', async (_caso, cargado, esperado) => {
    const ctx = await crearApp();
    try {
      const id = await crearLugar(ctx, { actualizadoEn: new Date(cargado) });
      const res = await ctx.http().get(`/lugares/${id}`).expect(200);
      esperarContrato(res.body, 'Lugar');
      expect(res.body.datos.actualizadoEn).toBe(esperado);
    } finally {
      await ctx.cerrar();
    }
  });

  it('sin actualizadoEn explícito toma el reloj (31/12 23:59:59.600 → sin milisegundos, mismo día)', async () => {
    const ctx = await crearApp({ ahora: '2026-12-31T23:59:59.600-03:00' });
    try {
      const id = await crearLugar(ctx);
      const res = await ctx.http().get(`/lugares/${id}`).expect(200);
      expect(res.body.datos.actualizadoEn).toBe('2026-12-31T23:59:59-03:00');
    } finally {
      await ctx.cerrar();
    }
  });

  it('el teléfono que sincroniza con el actualizadoEn que recibió no vuelve a recibir el mismo lugar', async () => {
    const ctx = await crearApp();
    try {
      const id = await crearLugar(ctx, { actualizadoEn: new Date('2026-11-10T09:00:00.700-03:00') });
      const primero = await ctx
        .http()
        .get('/lugares')
        .query({ actualizadoDesde: '2026-11-01T00:00:00-03:00' })
        .expect(200);
      expect(ids(primero.body)).toEqual([id]);
      const marca = primero.body.datos[0].actualizadoEn as string;
      const segundo = await ctx.http().get('/lugares').query({ actualizadoDesde: marca }).expect(200);
      expect(ids(segundo.body), `con actualizadoDesde=${marca} vuelve a venir`).toEqual([]);
    } finally {
      await ctx.cerrar();
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────
describe('R3 / D1 — Temporadas en los cortes de año, mes y medianoche', () => {
  let ctx: AppDePrueba;
  let termas: string;
  let soloVerano: string;
  let todoElAnio: string;
  beforeAll(async () => {
    ctx = await crearApp();
    termas = await crearLugar(ctx, {
      id: 'lug-termas-v',
      nombre: 'Termas',
      conQr: true,
      horarios: [
        { dia: 1, abre: '08:00', cierra: '22:00', temporada: 'verano' },
        { dia: 1, abre: '09:00', cierra: '20:00', temporada: 'invierno' },
      ],
      actualizadoEn: new Date('2026-10-01T10:00:00-03:00'),
    });
    soloVerano = await crearLugar(ctx, {
      nombre: 'Balneario de verano',
      horarios: [{ dia: 6, abre: '10:00', cierra: '19:00', temporada: 'verano' }],
      actualizadoEn: new Date('2026-10-01T10:00:00-03:00'),
    });
    todoElAnio = await crearLugar(ctx, {
      nombre: 'Museo',
      horarios: [{ dia: 2, abre: '09:00', cierra: '12:00', temporada: 'todo-el-anio' }],
      actualizadoEn: new Date('2026-10-01T10:00:00-03:00'),
    });
  });
  afterAll(() => ctx.cerrar());

  it.each([
    ['2026-11-30T23:59:59-03:00', '2026-10-01T10:00:00-03:00'],
    ['2026-12-01T00:00:00-03:00', '2026-12-01T00:00:00-03:00'],
    ['2026-12-31T23:59:59-03:00', '2026-12-01T00:00:00-03:00'],
    ['2027-01-01T00:00:00-03:00', '2026-12-01T00:00:00-03:00'],
    ['2027-02-28T23:59:59-03:00', '2026-12-01T00:00:00-03:00'],
    ['2027-03-31T23:59:59-03:00', '2026-12-01T00:00:00-03:00'],
    ['2027-04-01T00:00:00-03:00', '2027-04-01T00:00:00-03:00'],
    ['2027-11-30T23:59:59-03:00', '2027-04-01T00:00:00-03:00'],
    // 1/4 02:00 UTC todavía es 31/3 en Buenos Aires: sigue el verano.
    ['2026-04-01T02:00:00Z', '2025-12-01T00:00:00-03:00'],
  ])('con el reloj en %s, actualizadoEn de las termas es %s', async (ahora, esperado) => {
    ctx.reloj.fijar(ahora);
    const res = await ctx.http().get(`/lugares/${termas}`).expect(200);
    esperarContrato(res.body, 'Lugar');
    // Antes del 1/10/2026 el lugar no estaba cargado todavía, pero la regla es la misma:
    // el más nuevo entre la edición y el comienzo de la temporada vigente.
    const edicion = '2026-10-01T10:00:00-03:00';
    const esperadoReal = new Date(esperado) > new Date(edicion) ? esperado : edicion;
    expect(res.body.datos.actualizadoEn).toBe(esperadoReal);
  });

  it('un lugar sin horarios de temporada no cambia su actualizadoEn en diciembre', async () => {
    ctx.reloj.fijar('2026-12-15T12:00:00-03:00');
    const res = await ctx.http().get(`/lugares/${todoElAnio}`).expect(200);
    expect(res.body.datos.actualizadoEn).toBe('2026-10-01T10:00:00-03:00');
  });

  it('si se editó después del comienzo de la temporada, manda la edición', async () => {
    ctx.reloj.fijar('2026-12-20T12:00:00-03:00');
    const id = await crearLugar(ctx, {
      horarios: [{ dia: 1, abre: '08:00', cierra: '22:00', temporada: 'verano' }],
      actualizadoEn: new Date('2026-12-10T08:15:00-03:00'),
    });
    const res = await ctx.http().get(`/lugares/${id}`).expect(200);
    expect(res.body.datos.actualizadoEn).toBe('2026-12-10T08:15:00-03:00');
  });

  it('un lugar que sólo abre en verano: en invierno sale sin horarios (todos los días cerrado)', async () => {
    ctx.reloj.fijar('2026-07-15T12:00:00-03:00');
    const invierno = await ctx.http().get(`/lugares/${soloVerano}`).expect(200);
    esperarContrato(invierno.body, 'Lugar');
    expect(invierno.body.datos.horarios).toEqual([]);
    ctx.reloj.fijar('2027-01-15T12:00:00-03:00');
    const verano = await ctx.http().get(`/lugares/${soloVerano}`).expect(200);
    expect(verano.body.datos.horarios).toEqual([{ dia: 6, abre: '10:00', cierra: '19:00' }]);
  });

  it('el listado y el QR devuelven los mismos horarios y actualizadoEn que el detalle', async () => {
    for (const ahora of ['2027-01-15T12:00:00-03:00', '2026-07-15T12:00:00-03:00']) {
      ctx.reloj.fijar(ahora);
      const detalle = (await ctx.http().get(`/lugares/${termas}`).expect(200)).body.datos;
      const qr = (
        await ctx
          .http()
          .get(`/lugares/qr/${encodeURIComponent('COLON:' + termas)}`)
          .expect(200)
      ).body.datos;
      const lista = await ctx.http().get('/lugares').query({ q: 'termas' }).expect(200);
      expect(qr).toEqual(detalle);
      expect(lista.body.datos).toEqual([detalle]);
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────
describe('PRD §2 — Cercanía: el radio mide metros de verdad', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
  });
  afterAll(() => ctx.cerrar());

  it('en Colón: a 990 m entra en un radio de 1000 y a 1010 m no (norte y este)', async () => {
    const cat = (await crearCategoria(ctx)).id;
    const norteAdentro = await crearLugar(ctx, {
      categoriaId: cat,
      nombre: 'Norte adentro',
      coordenadas: { latitud: PLAZA.latitud + 990 / M_POR_GRADO, longitud: PLAZA.longitud },
    });
    await crearLugar(ctx, {
      categoriaId: cat,
      nombre: 'Norte afuera',
      coordenadas: { latitud: PLAZA.latitud + 1010 / M_POR_GRADO, longitud: PLAZA.longitud },
    });
    const esteAdentro = await crearLugar(ctx, {
      categoriaId: cat,
      nombre: 'Este adentro',
      coordenadas: { latitud: PLAZA.latitud, longitud: PLAZA.longitud + gradosLongitud(990, PLAZA.latitud) },
    });
    await crearLugar(ctx, {
      categoriaId: cat,
      nombre: 'Este afuera',
      coordenadas: { latitud: PLAZA.latitud, longitud: PLAZA.longitud + gradosLongitud(1010, PLAZA.latitud) },
    });
    const res = await ctx
      .http()
      .get('/lugares')
      .query({ ...PLAZA, radioMetros: 1000, categoriaId: cat })
      .expect(200);
    esperarContrato(res.body, 'Lugar');
    expect(ids(res.body)).toEqual([esteAdentro, norteAdentro]);
    expect(res.body.meta.total).toBe(2);
  });

  it('lejos del ecuador (latitud 60): un lugar a 150 km al este entra en un radio de 151 km', async () => {
    const cat = (await crearCategoria(ctx)).id;
    const punto = { latitud: 60, longitud: 10 };
    const cerca = await crearLugar(ctx, {
      categoriaId: cat,
      coordenadas: { latitud: 60, longitud: 10 + gradosLongitud(150000, 60) },
    });
    await crearLugar(ctx, {
      categoriaId: cat,
      coordenadas: { latitud: 60, longitud: 10 + gradosLongitud(165000, 60) },
    });
    const res = await ctx
      .http()
      .get('/lugares')
      .query({ ...punto, radioMetros: 151000, categoriaId: cat, orden: 'distancia' })
      .expect(200);
    expect(ids(res.body)).toEqual([cerca]);
  });

  it('del otro lado del antimeridiano (a 2 km): entra en un radio de 5 km', async () => {
    const cat = (await crearCategoria(ctx)).id;
    const otroLado = await crearLugar(ctx, {
      categoriaId: cat,
      coordenadas: { latitud: 0, longitud: -179.99 },
    });
    const res = await ctx
      .http()
      .get('/lugares')
      .query({ latitud: 0, longitud: 179.99, radioMetros: 5000, categoriaId: cat })
      .expect(200);
    expect(ids(res.body)).toEqual([otroLado]);
  });

  it('actualizadoDesde con radio: trae los dados de baja que están dentro del radio', async () => {
    const cat = (await crearCategoria(ctx)).id;
    const baja = await crearLugar(ctx, { categoriaId: cat, coordenadas: PLAZA, activo: false });
    await crearLugar(ctx, {
      categoriaId: cat,
      coordenadas: { latitud: -31.8667, longitud: -58.2833 },
      activo: false,
    });
    const res = await ctx
      .http()
      .get('/lugares')
      .query({ ...PLAZA, radioMetros: 2000, categoriaId: cat, actualizadoDesde: '2000-01-01T00:00:00-03:00' })
      .expect(200);
    expect(ids(res.body)).toEqual([baja]);
    expect(res.body.datos[0].activo).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────
describe('R5 y AGENTS §4.2 / §4.6 — Parámetros raros: 400 con el sobre, nunca 500', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
    await crearLugar(ctx, { id: 'lug-004', nombre: 'Molino Forclaz', conQr: true });
  });
  afterAll(() => ctx.cerrar());

  it.each([
    'pagina=0',
    'pagina=-1',
    'pagina=1.5',
    'pagina=abc',
    'porPagina=0',
    'porPagina=-5',
    'latitud=NaN&longitud=-58',
    'latitud=Infinity&longitud=-58',
    'latitud=-32,5&longitud=-58',
    'latitud=-32&latitud=-33&longitud=-58',
    'orden=nombre&orden=distancia',
    'categoriaId=cat-a&categoriaId=cat-b',
    'latitud=-32&longitud=-58&radioMetros=abc',
    'actualizadoDesde=2026-02-30T10:00:00-03:00',
    'actualizadoDesde=2026-13-01T10:00:00-03:00',
    'actualizadoDesde=2026-11-10T25:00:00-03:00',
    'actualizadoDesde=',
    'actualizadoDesde=2026-11-10T09:00:00-03:00&actualizadoDesde=2026-11-11T09:00:00-03:00',
  ])('GET /lugares?%s → 400 VALIDACION_FALLIDA', async (consulta) => {
    const res = await ctx.http().get(`/lugares?${consulta}`);
    esperarError(res, 400, 'VALIDACION_FALLIDA');
  });

  it.each(['pagina=0', 'porPagina=0', 'pagina=-1', 'otro=1', 'orden=nombre'])(
    'GET /categorias?%s → 400 VALIDACION_FALLIDA',
    async (consulta) => {
      esperarError(await ctx.http().get(`/categorias?${consulta}`), 400, 'VALIDACION_FALLIDA');
    },
  );

  it('GET /lugares con una página enorme: lista vacía con el total, o 400; nunca 500', async () => {
    const lejos = await ctx.http().get('/lugares?pagina=1000000').expect(200);
    expect(lejos.body).toEqual({ datos: [], meta: { total: 1, pagina: 1000000, porPagina: 20 } });
    esperarSinRomper(await ctx.http().get('/lugares?pagina=99999999999999999999'));
  });

  it('GET /categorias con una página enorme: lista vacía con el total, o 400; nunca 500', async () => {
    const lejos = await ctx.http().get('/categorias?pagina=1000000').expect(200);
    expect(lejos.body.datos).toEqual([]);
    esperarSinRomper(await ctx.http().get('/categorias?pagina=99999999999999999999'));
  });

  // PostgreSQL rechaza el byte 0 en un texto: si llega a la base, sale un 500.
  it('un byte nulo en el id del detalle → 404 LUGAR_NO_ENCONTRADO', async () => {
    esperarError(await ctx.http().get('/lugares/lug-004%00'), 404, 'LUGAR_NO_ENCONTRADO');
  });

  it('un byte nulo en el QR → 404 QR_NO_RECONOCIDO', async () => {
    esperarError(await ctx.http().get('/lugares/qr/COLON%3Alug-004%00'), 404, 'QR_NO_RECONOCIDO');
  });

  it('un byte nulo en q → 200 o 400, no 500', async () => {
    esperarSinRomper(await ctx.http().get('/lugares?q=%00'));
    esperarSinRomper(await ctx.http().get('/lugares?q=molino%00'));
  });

  it('un byte nulo en categoriaId → lista vacía, no 500', async () => {
    const cat = await ctx.http().get('/lugares?categoriaId=%00');
    expect(cat.status, JSON.stringify(cat.body)).toBe(200);
    expect(cat.body.datos).toEqual([]);
  });

  it('un id larguísimo en el detalle → 404 LUGAR_NO_ENCONTRADO', async () => {
    esperarError(await ctx.http().get(`/lugares/lug-${'x'.repeat(3000)}`), 404, 'LUGAR_NO_ENCONTRADO');
  });

  it('un escape % roto en el detalle: sobre de error, no 500', async () => {
    esperarSinRomper(await ctx.http().get('/lugares/lug-%E0%A4%A'));
  });

  it('una búsqueda larguísima o con UTF-8 roto: no 500', async () => {
    const larga = await ctx
      .http()
      .get('/lugares')
      .query({ q: 'molino'.repeat(600) });
    esperarSinRomper(larga);
    if (larga.status === 200) expect(larga.body.datos).toEqual([]);
    esperarSinRomper(await ctx.http().get('/lugares?q=%C3%28'));
  });

  it.each([
    ['POST', '/lugares'],
    ['PUT', '/lugares/lug-004'],
    ['DELETE', '/lugares/lug-004'],
    ['PATCH', '/lugares/lug-004'],
    ['POST', '/categorias'],
  ])('%s %s no existe: 404 RUTA_NO_ENCONTRADA con el sobre', async (metodo, ruta) => {
    const http = ctx.http();
    const pedido =
      metodo === 'POST'
        ? http.post(ruta)
        : metodo === 'PUT'
          ? http.put(ruta)
          : metodo === 'PATCH'
            ? http.patch(ruta)
            : http.delete(ruta);
    esperarError(await pedido.send({}), 404, 'RUTA_NO_ENCONTRADA');
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────
describe('R1 y AGENTS §4.3 — Lo que se carga es lo que sale (en los cuatro motores)', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
  });
  afterAll(() => ctx.cerrar());

  it('coordenadas con muchos decimales, emoji y tildes, texto de 5.000 caracteres, orden de las imágenes', async () => {
    const { token } = await registrarTurista(ctx);
    const fotos = [
      claveDe(await subirArchivo(ctx, token, MUESTRAS.png(300))),
      claveDe(await subirArchivo(ctx, token, MUESTRAS.jpg(300), 'b.jpg')),
      claveDe(await subirArchivo(ctx, token, MUESTRAS.png(400))),
    ];
    const audio = claveDe(await subirArchivo(ctx, token, MUESTRAS.m4a(), 'guia.m4a'));
    const descripcion = 'Ñandubay ☕ '.repeat(500);
    const id = await crearLugar(ctx, {
      nombre: 'Café ☕ del Puerto — Güemes y Ñandubay',
      coordenadas: { latitud: -32.19041234567891, longitud: -58.19327654321098 },
      descripcion,
      imagenes: fotos,
      telefono: '+54 9 3447 42-1234',
      sitioWeb: 'https://ejemplo.ar/café?x=1&y=2',
      precioEntrada: 0,
      audioguia: { clave: audio, duracionSegundos: 1, idioma: 'pt' },
      conQr: true,
      accesible: true,
    });
    const res = await ctx.http().get(`/lugares/${id}`).set('Host', 'api.ejemplo:8080').expect(200);
    esperarContrato(res.body, 'Lugar');
    const l = res.body.datos as Lugar;
    expect(l.nombre).toBe('Café ☕ del Puerto — Güemes y Ñandubay');
    expect(l.coordenadas).toEqual({ latitud: -32.19041234567891, longitud: -58.19327654321098 });
    expect(l.descripcion).toBe(descripcion);
    expect(l.imagenes).toEqual(fotos.map((f) => `http://api.ejemplo:8080/archivos/${f}`));
    expect(l.telefono).toBe('+54 9 3447 42-1234');
    expect(l.sitioWeb).toBe('https://ejemplo.ar/café?x=1&y=2');
    expect(l.precioEntrada).toBe(0);
    expect(l.audioguia).toEqual({
      url: `http://api.ejemplo:8080/archivos/${audio}`,
      duracionSegundos: 1,
      idioma: 'pt',
    });
    expect(l.codigoQr).toBe(`COLON:${id}`);
    expect(l.accesible).toBe(true);
    expect(Object.keys(l).sort()).toEqual(
      [
        'id',
        'nombre',
        'categoriaId',
        'descripcionCorta',
        'descripcion',
        'coordenadas',
        'direccion',
        'imagenes',
        'horarios',
        'telefono',
        'sitioWeb',
        'precioEntrada',
        'audioguia',
        'codigoQr',
        'accesible',
        'activo',
        'actualizadoEn',
      ].sort(),
    );
  });

  it.each([
    ['cafe', 'Café'],
    ['GUEMES', 'Güemes'],
    ['ñandú', 'Ñandubay'],
    ['☕', 'emoji'],
    ['puerto — güemes', 'raya'],
  ])('q=«%s» encuentra el lugar (%s)', async (q) => {
    const res = await ctx.http().get('/lugares').query({ q }).expect(200);
    expect(res.body.datos.map((l: Lugar) => l.nombre)).toContain('Café ☕ del Puerto — Güemes y Ñandubay');
  });

  it('q con sólo espacios no filtra', async () => {
    const todos = await ctx.http().get('/lugares').expect(200);
    const espacios = await ctx.http().get('/lugares').query({ q: '   ' }).expect(200);
    expect(espacios.body.meta.total).toBe(todos.body.meta.total);
  });

  it.each(['https://api.colon.tur.ar', 'https://api.colon.tur.ar/'])(
    'con URL_PUBLICA=%s las URLs salen con ese origen y sin doble barra',
    async (urlPublica) => {
      const otra = await crearApp({ entorno: { URL_PUBLICA: urlPublica } });
      try {
        const { token } = await registrarTurista(otra);
        const foto = claveDe(await subirArchivo(otra, token));
        const id = await crearLugar(otra, { imagenes: [foto] });
        const res = await otra.http().get(`/lugares/${id}`).set('Host', '10.0.0.5:3000').expect(200);
        expect(res.body.datos.imagenes).toEqual([`https://api.colon.tur.ar/archivos/${foto}`]);
      } finally {
        await otra.cerrar();
      }
    },
  );
});

// ───────────────────────────────────────────────────────────────────────────────────────────
describe('R6 / D5 — QR que no son de Mi Ciudad', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
    await crearLugar(ctx, { id: 'lug-004', nombre: 'Molino Forclaz', conQr: true });
  });
  afterAll(() => ctx.cerrar());

  it('el QR devuelve exactamente lo mismo que el detalle', async () => {
    const detalle = await ctx.http().get('/lugares/lug-004').expect(200);
    const qr = await ctx.http().get('/lugares/qr/COLON%3Alug-004').expect(200);
    esperarContrato(qr.body, 'Lugar');
    expect(qr.body).toEqual(detalle.body);
  });

  it.each([
    ['doblemente codificado', '/lugares/qr/COLON%253Alug-004'],
    ['un espacio en el medio', `/lugares/qr/${encodeURIComponent('COLON: lug-004')}`],
    ['un tab en el medio', `/lugares/qr/${encodeURIComponent('COLON:\tlug-004')}`],
    ['sin los dos puntos', '/lugares/qr/COLONlug-004'],
    ['el id solo', '/lugares/qr/lug-004'],
    ['una URL con el id adentro', `/lugares/qr/${encodeURIComponent('https://colon.tur.ar/COLON:lug-004')}`],
    ['con query', `/lugares/qr/${encodeURIComponent('COLON:lug-004?utm=1')}`],
    ['dos veces el prefijo', `/lugares/qr/${encodeURIComponent('COLON:COLON:lug-004')}`],
    ['punto y barra', '/lugares/qr/..%2F..%2Fetc%2Fpasswd'],
  ])('%s → 404 QR_NO_RECONOCIDO', async (_caso, ruta) => {
    esperarError(await ctx.http().get(ruta), 404, 'QR_NO_RECONOCIDO');
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────
describe('R18 — PATCH /yo con las categorías del catálogo sembrado', () => {
  let ctx: AppDePrueba;
  let token: string;
  beforeAll(async () => {
    ctx = await crearApp();
    await ctx.app.get(Sembrador).sembrar();
    token = (await registrarTurista(ctx)).token;
  });
  afterAll(() => ctx.cerrar());

  it('acepta todas las categorías que devuelve GET /categorias, incluida una sin lugares', async () => {
    const cats = (await ctx.http().get('/categorias?porPagina=100').expect(200)).body.datos as Categoria[];
    const res = await ctx
      .http()
      .patch('/yo')
      .set(conSesion(token))
      .send({ preferencias: { categoriasFavoritas: cats.map((c) => c.id) } })
      .expect(200);
    esperarContrato(res.body, 'Usuario');
    expect(res.body.datos.preferencias.categoriasFavoritas).toEqual(cats.map((c) => c.id));
  });

  // AGENTS §7.3: los ids se validan con su prefijo antes de ir a la base → 400. Un id con el
  // prefijo cat- que no existe → 422 CATEGORIA_NO_ENCONTRADA (R18).
  it('un id de lugar no es una categoría → 400 por el prefijo', async () => {
    esperarError(
      await ctx
        .http()
        .patch('/yo')
        .set(conSesion(token))
        .send({ preferencias: { categoriasFavoritas: ['lug-004'] } }),
      400,
      'VALIDACION_FALLIDA',
    );
  });

  it('cat-bodegas, sembrada sin lugares, se acepta; cat-vinos no existe → CATEGORIA_NO_ENCONTRADA', async () => {
    await ctx
      .http()
      .patch('/yo')
      .set(conSesion(token))
      .send({ preferencias: { categoriasFavoritas: ['cat-bodegas'] } })
      .expect(200);
    esperarError(
      await ctx
        .http()
        .patch('/yo')
        .set(conSesion(token))
        .send({ preferencias: { categoriasFavoritas: ['cat-vinos'] } }),
      422,
      'CATEGORIA_NO_ENCONTRADA',
    );
  });

  it('elementos que no son texto → 400 VALIDACION_FALLIDA', async () => {
    esperarError(
      await ctx
        .http()
        .patch('/yo')
        .set(conSesion(token))
        .send({ preferencias: { categoriasFavoritas: [3] } }),
      400,
      'VALIDACION_FALLIDA',
    );
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────
describe('Especificación §8 y PRD §1, §6 — El catálogo sembrado', () => {
  let ctx: AppDePrueba;
  let lugares: Lugar[];
  let categorias: Categoria[];
  beforeAll(async () => {
    ctx = await crearApp();
    await ctx.app.get(Sembrador).sembrar();
    const todos = await ctx
      .http()
      .get('/lugares')
      .query({ porPagina: 500, actualizadoDesde: '2000-01-01T00:00:00-03:00' })
      .expect(200);
    esperarContrato(todos.body, 'Lugar');
    lugares = todos.body.datos;
    const cats = await ctx.http().get('/categorias?porPagina=100').expect(200);
    esperarContrato(cats.body, 'Categoria');
    categorias = cats.body.datos;
  });
  afterAll(() => ctx.cerrar());

  it('PRD §6 — las audioguías que nombra Valeria existen: Molino Forclaz, Casa de la Cultura, puerto viejo, Iglesia', () => {
    for (const nombre of [/molino forclaz/i, /casa de la cultura/i, /puerto viejo/i, /iglesia/i]) {
      const l = lugares.find((x) => nombre.test(x.nombre));
      expect(l, `no hay un lugar ${nombre}`).toBeDefined();
      expect(l?.audioguia, `${l?.nombre} sin audioguía`).not.toBeNull();
    }
  });

  it('D5 — todo codigoQr es COLON:<id del mismo lugar>', () => {
    for (const l of lugares) if (l.codigoQr !== null) expect(l.codigoQr).toBe(`COLON:${l.id}`);
  });

  it('ids con su prefijo: lug- y cat-', () => {
    for (const l of lugares) expect(l.id).toMatch(/^lug-/);
    for (const c of categorias) expect(c.id).toMatch(/^cat-/);
    expect(categorias.map((c) => c.id)).toEqual(expect.arrayContaining(['cat-museos', 'cat-playas']));
  });

  it('coordenadas reales de Colón y alrededores (a menos de 100 km de la plaza)', () => {
    const rad = (g: number) => (g * Math.PI) / 180;
    for (const l of lugares) {
      const { latitud, longitud } = l.coordenadas;
      const a =
        Math.sin(rad(latitud - PLAZA.latitud) / 2) ** 2 +
        Math.cos(rad(latitud)) *
          Math.cos(rad(PLAZA.latitud)) *
          Math.sin(rad(longitud - PLAZA.longitud) / 2) ** 2;
      const km = 2 * 6371 * Math.asin(Math.sqrt(a));
      expect(km, l.nombre).toBeLessThan(100);
    }
  });

  it('horarios bien formados: día 0 a 6, HH:MM, sin tramos repetidos', () => {
    for (const l of lugares) {
      const vistos = new Set<string>();
      for (const h of l.horarios) {
        expect([0, 1, 2, 3, 4, 5, 6]).toContain(h.dia);
        expect(h.abre, l.nombre).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
        expect(h.cierra, l.nombre).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
        const clave = `${h.dia} ${h.abre}`;
        expect(vistos.has(clave), `${l.nombre} repite ${clave}`).toBe(false);
        vistos.add(clave);
      }
    }
  });

  it('textos obligatorios no vacíos', () => {
    for (const l of lugares) {
      expect(l.nombre.trim().length, l.id).toBeGreaterThan(0);
      expect(l.descripcionCorta.trim().length, l.id).toBeGreaterThan(0);
      expect(l.descripcion.trim().length, l.id).toBeGreaterThan(0);
      expect(l.direccion.trim().length, l.id).toBeGreaterThan(0);
    }
  });

  it('AGENTS §4.2 — el listado por defecto pagina de a 20 y las páginas encajan con porPagina=500', async () => {
    const todo = (await ctx.http().get('/lugares?porPagina=500').expect(200)).body;
    const activos = lugares.filter((l) => l.activo).length;
    expect(todo.meta).toEqual({ total: activos, pagina: 1, porPagina: 500 });
    const p1 = (await ctx.http().get('/lugares').expect(200)).body;
    const p2 = (await ctx.http().get('/lugares?pagina=2').expect(200)).body;
    expect(p1.meta).toEqual({ total: activos, pagina: 1, porPagina: 20 });
    expect(p1.datos).toHaveLength(Math.min(20, activos));
    expect([...ids(p1), ...ids(p2)]).toEqual(ids(todo));
  });

  it('PRD §1 — buscar «palmar» encuentra El Palmar y «colon», las termas', async () => {
    const palmar = await ctx.http().get('/lugares').query({ q: 'palmar' }).expect(200);
    expect(palmar.body.datos.some((l: Lugar) => /palmar/i.test(l.nombre))).toBe(true);
    const colon = await ctx.http().get('/lugares').query({ q: 'colon' }).expect(200);
    expect(colon.body.datos.some((l: Lugar) => l.id === 'lug-001')).toBe(true);
  });

  it('PRD §1 — filtrar por cada categoría del PRD devuelve sólo lugares de esa categoría', async () => {
    for (const c of categorias) {
      const res = await ctx.http().get('/lugares').query({ categoriaId: c.id, porPagina: 500 }).expect(200);
      esperarContrato(res.body, 'Lugar');
      for (const l of res.body.datos as Lugar[]) expect(l.categoriaId).toBe(c.id);
      expect(res.body.meta.total).toBe(lugares.filter((l) => l.activo && l.categoriaId === c.id).length);
    }
  });

  it('sembrado a las 23:59:59 del 31/12, todo cumple el contrato', async () => {
    const otra = await crearApp({ ahora: '2026-12-31T23:59:59-03:00' });
    try {
      await otra.app.get(Sembrador).sembrar();
      const res = await otra
        .http()
        .get('/lugares')
        .query({ porPagina: 500, actualizadoDesde: '2000-01-01T00:00:00-03:00' })
        .expect(200);
      esperarContrato(res.body, 'Lugar');
      otra.reloj.fijar('2027-01-01T00:00:00-03:00');
      const despues = await otra.http().get('/lugares?porPagina=500').expect(200);
      esperarContrato(despues.body, 'Lugar');
    } finally {
      await otra.cerrar();
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────
describe('AGENTS §11.5 — Swagger documenta los endpoints de M1', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
  });
  afterAll(() => ctx.cerrar());

  it('las cuatro rutas, los filtros de /lugares y los códigos de error', async () => {
    const doc = (await ctx.http().get('/docs-json').expect(200)).body as {
      paths: Record<string, Record<string, { parameters?: { name: string }[] }>>;
    };
    for (const ruta of ['/categorias', '/lugares', '/lugares/{id}', '/lugares/qr/{codigo}']) {
      expect(doc.paths[ruta]?.get, ruta).toBeDefined();
    }
    const params = (doc.paths['/lugares'].get.parameters ?? []).map((p) => p.name);
    expect(params).toEqual(
      expect.arrayContaining([
        'categoriaId',
        'q',
        'latitud',
        'longitud',
        'radioMetros',
        'orden',
        'accesible',
        'actualizadoDesde',
        'pagina',
        'porPagina',
      ]),
    );
    expect(JSON.stringify(doc.paths['/lugares/{id}'].get)).toContain('LUGAR_NO_ENCONTRADO');
    expect(JSON.stringify(doc.paths['/lugares/qr/{codigo}'].get)).toContain('QR_NO_RECONOCIDO');
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────
describe('M1-1 (re-verificación) — Bordes de las correcciones: tope de página, polos y filtros raros', () => {
  let ctx: AppDePrueba;
  let molino: string;
  beforeAll(async () => {
    ctx = await crearApp();
    molino = await crearLugar(ctx, {
      id: 'lug-004',
      nombre: 'Molino Forclaz',
      categoriaId: (await crearCategoria(ctx, { id: 'cat-museos' })).id,
    });
  });
  afterAll(() => ctx.cerrar());

  it.each(['/lugares', '/categorias'])(
    '%s: pagina=1000000 es el tope (lista vacía con el total)',
    async (ruta) => {
      const res = await ctx.http().get(`${ruta}?pagina=1000000&porPagina=100`).expect(200);
      esperarContrato(res.body, ruta === '/lugares' ? 'Lugar' : 'Categoria');
      expect(res.body).toEqual({ datos: [], meta: { total: 1, pagina: 1000000, porPagina: 100 } });
    },
  );

  it.each(['/lugares', '/categorias'])('%s: pagina=1000001 → 400 VALIDACION_FALLIDA', async (ruta) => {
    esperarError(await ctx.http().get(`${ruta}?pagina=1000001`), 400, 'VALIDACION_FALLIDA');
  });

  it('/lugares con porPagina=500 y la página tope no rompe', async () => {
    const res = await ctx.http().get('/lugares?pagina=1000000&porPagina=500');
    esperarSinRomper(res);
    expect(res.status).toBe(200);
  });

  it.each([
    ['pagina=1e6', 'notación exponencial'],
    ['pagina=%201', 'con espacio'],
    ['pagina=0x10', 'hexadecimal'],
  ])('GET /lugares?%s (%s): 200 o 400, nunca 500', async (consulta) => {
    esperarSinRomper(await ctx.http().get(`/lugares?${consulta}`));
  });

  it('cerca del polo sur: un lugar del otro lado del polo, a ~2 km, entra en un radio de 5 km', async () => {
    const cat = (await crearCategoria(ctx)).id;
    const otroLado = await crearLugar(ctx, {
      categoriaId: cat,
      coordenadas: { latitud: -89.99, longitud: 180 },
    });
    await crearLugar(ctx, { categoriaId: cat, coordenadas: { latitud: -89.5, longitud: 0 } });
    const res = await ctx
      .http()
      .get('/lugares')
      .query({ latitud: -89.99, longitud: 0, radioMetros: 5000, categoriaId: cat, orden: 'distancia' })
      .expect(200);
    expect(ids(res.body)).toEqual([otroLado]);
  });

  it('antimeridiano con orden=distancia: el más cercano primero, del otro lado', async () => {
    const cat = (await crearCategoria(ctx)).id;
    const cruzando = await crearLugar(ctx, {
      categoriaId: cat,
      nombre: 'A',
      coordenadas: { latitud: 0, longitud: -179.995 },
    });
    const mismoLado = await crearLugar(ctx, {
      categoriaId: cat,
      nombre: 'B',
      coordenadas: { latitud: 0, longitud: 179.97 },
    });
    const res = await ctx
      .http()
      .get('/lugares')
      .query({ latitud: 0, longitud: 179.99, radioMetros: 10000, categoriaId: cat, orden: 'distancia' })
      .expect(200);
    expect(ids(res.body)).toEqual([cruzando, mismoLado]);
  });

  it('el prefiltro por latitud no mete lugares fuera del radio (antimeridiano, 5 km)', async () => {
    const cat = (await crearCategoria(ctx)).id;
    await crearLugar(ctx, { categoriaId: cat, coordenadas: { latitud: 0, longitud: 0 } });
    await crearLugar(ctx, { categoriaId: cat, coordenadas: { latitud: 0, longitud: -179.9 } }); // ~11 km
    const res = await ctx
      .http()
      .get('/lugares')
      .query({ latitud: 0, longitud: 179.99, radioMetros: 5000, categoriaId: cat })
      .expect(200);
    expect(res.body).toEqual({ datos: [], meta: { total: 0, pagina: 1, porPagina: 20 } });
  });

  it.each([
    ['con byte nulo al final', 'cat-museos%00'],
    ['con byte nulo al principio', '%00cat-museos'],
    ['con un carácter de control', 'cat-muse%01os'],
    ['con salto de línea', encodeURIComponent('cat-museos\n')],
    ['larguísimo', 'x'.repeat(3000)],
    ['con un espacio de ancho cero', encodeURIComponent('cat-museos​')],
    ['con tilde', encodeURIComponent('cat-muséos')],
    ['con emoji', encodeURIComponent('cat-museos☕')],
  ])('categoriaId %s → lista vacía, no 500', async (_caso, valor) => {
    const res = await ctx.http().get(`/lugares?categoriaId=${valor}`);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    esperarContrato(res.body, 'Lugar');
    expect(res.body.datos).toEqual([]);
  });

  it('un categoriaId válido sigue filtrando', async () => {
    const res = await ctx.http().get('/lugares?categoriaId=cat-museos').expect(200);
    expect(ids(res.body)).toEqual([molino]);
  });

  it.each([
    ['%00', 'sólo un byte nulo: no filtra'],
    ['molino%00', 'byte nulo al final'],
    ['molino%09forclaz', 'tab entre palabras'],
    ['molino%0Aforclaz', 'salto de línea entre palabras'],
    ['%00molino%00%00forclaz%00', 'bytes nulos por todos lados'],
    ['molino%7Fforclaz', 'DEL entre palabras'],
  ])('q=%s (%s) encuentra el molino, no 500', async (q) => {
    const res = await ctx.http().get(`/lugares?q=${q}`);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    esperarContrato(res.body, 'Lugar');
    expect(ids(res.body)).toContain(molino);
  });

  it.each(['%0B', '%1F', '%C2%80', '%EF%BF%BF', '%F0%9F%92%A9'])('q=%s no rompe', async (q) => {
    esperarSinRomper(await ctx.http().get(`/lugares?q=${q}`));
  });

  it('un byte nulo en actualizadoDesde → 400, no 500', async () => {
    esperarError(
      await ctx.http().get('/lugares?actualizadoDesde=2026-11-10T09:00:00-03:00%00'),
      400,
      'VALIDACION_FALLIDA',
    );
  });

  it('un byte nulo en orden → 400, no 500', async () => {
    esperarError(await ctx.http().get('/lugares?orden=nombre%00'), 400, 'VALIDACION_FALLIDA');
  });
});
