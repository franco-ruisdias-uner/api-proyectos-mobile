import { conOrigen } from '../../src/comun/contexto/contexto-pedido.js';
import { urlDeArchivo } from '../../src/comun/archivos/archivos.servicio.js';
import { crearComercio, crearRubro } from '../utilidades/comercios.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';

// Centro de la ciudad y puntos a distancias conocidas (1° de latitud ≈ 111 km).
const CENTRO = { latitud: -32.48, longitud: -58.23 };

describe('PRD §1 — GET /rubros', () => {
  let t: AppDePrueba;
  beforeAll(async () => {
    t = await crearApp();
    await crearRubro(t, { id: 'rub-b', nombre: 'Segundo', orden: 2 });
    await crearRubro(t, { id: 'rub-a', nombre: 'Primero', orden: 1 });
    await crearRubro(t, { id: 'rub-c', nombre: 'Empata', orden: 2 });
  });
  afterAll(() => t.cerrar());

  it('200 sin sesión, por `orden` y desempatando por id', async () => {
    const res = await t.http().get('/rubros').expect(200);
    esperarContrato(res.body, 'Rubro');
    expect(res.body.datos.map((r: { id: string }) => r.id)).toEqual(['rub-a', 'rub-b', 'rub-c']);
    expect(res.body.meta).toEqual({ total: 3, pagina: 1, porPagina: 20 });
  });

  it('pagina', async () => {
    const res = await t.http().get('/rubros?pagina=2&porPagina=2').expect(200);
    esperarContrato(res.body, 'Rubro');
    expect(res.body.datos.map((r: { id: string }) => r.id)).toEqual(['rub-c']);
    expect(res.body.meta).toEqual({ total: 3, pagina: 2, porPagina: 2 });
  });

  it('una página fuera de rango da lista vacía con el total correcto', async () => {
    const res = await t.http().get('/rubros?pagina=9').expect(200);
    expect(res.body.datos).toEqual([]);
    expect(res.body.meta.total).toBe(3);
  });

  it('400 con una paginación inválida', async () => {
    const res = await t.http().get('/rubros?pagina=0').expect(400);
    esperarError(res.body, 'VALIDACION_FALLIDA');
  });
});

describe('PRD §1 — GET /rubros sin datos', () => {
  let t: AppDePrueba;
  beforeAll(async () => (t = await crearApp()));
  afterAll(() => t.cerrar());

  it('lista vacía', async () => {
    const res = await t.http().get('/rubros').expect(200);
    esperarContrato(res.body, 'Rubro');
    expect(res.body.datos).toEqual([]);
    expect(res.body.meta.total).toBe(0);
  });
});

describe('PRD §1 — GET /comercios', () => {
  let t: AppDePrueba;
  beforeAll(async () => {
    t = await crearApp();
    await crearRubro(t, { id: 'rub-ferreteria' });
    await crearRubro(t, { id: 'rub-gastro' });
    await crearComercio(t, {
      id: 'com-118',
      nombre: 'Ferretería El Tornillo',
      descripcion: 'Pinturas, herramientas y todo para la obra.',
      rubroId: 'rub-ferreteria',
      puntaje: 4.5,
      cantidadResenas: 12,
      ...CENTRO,
    });
    await crearComercio(t, {
      id: 'com-201',
      nombre: 'Panadería Colón',
      descripcion: 'Facturas y pan casero.',
      rubroId: 'rub-gastro',
      puntaje: 4.9,
      cantidadResenas: 3,
      latitud: CENTRO.latitud + 0.01, // ≈ 1,1 km al norte
      longitud: CENTRO.longitud,
    });
    await crearComercio(t, {
      id: 'com-202',
      nombre: 'Almacén de la Esquina',
      descripcion: 'Un 100% de almacén y también _cosas_ ricas.',
      rubroId: 'rub-gastro',
      puntaje: 3,
      latitud: CENTRO.latitud + 0.05, // ≈ 5,6 km
      longitud: CENTRO.longitud,
    });
    await crearComercio(t, {
      id: 'com-203',
      nombre: 'Cerrado Para Siempre',
      rubroId: 'rub-gastro',
      activo: false,
      ...CENTRO,
    });
  });
  afterAll(() => t.cerrar());

  const ids = (res: { body: { datos: { id: string }[] } }) => res.body.datos.map((c) => c.id);

  it('200 sin sesión: sólo los activos, por nombre, con la forma exacta del contrato', async () => {
    const res = await t.http().get('/comercios').expect(200);
    esperarContrato(res.body, 'Comercio');
    expect(ids(res)).toEqual(['com-202', 'com-118', 'com-201']);
    expect(res.body.meta).toEqual({ total: 3, pagina: 1, porPagina: 20 });
  });

  it('el comercio trae todos los campos del PRD con sus valores', async () => {
    const res = await t.http().get('/comercios?rubroId=rub-ferreteria').expect(200);
    expect(res.body.datos).toEqual([
      {
        id: 'com-118',
        nombre: 'Ferretería El Tornillo',
        rubroId: 'rub-ferreteria',
        descripcion: 'Pinturas, herramientas y todo para la obra.',
        direccion: '9 de Julio 1234',
        coordenadas: CENTRO,
        telefono: null,
        whatsapp: null,
        instagram: null,
        imagenes: [],
        videoUrl: null,
        horarios: [{ dia: 1, abre: '08:00', cierra: '12:00' }],
        mediosDePago: ['efectivo'],
        puntaje: 4.5,
        cantidadResenas: 12,
        codigoQr: 'CCU:com-118',
        activo: true,
      },
    ]);
  });

  it('R1: no agrega «abierto ahora» ni distancia', async () => {
    const res = await t
      .http()
      .get(`/comercios?latitud=${CENTRO.latitud}&longitud=${CENTRO.longitud}&orden=distancia`)
      .expect(200);
    for (const c of res.body.datos) {
      expect(c).not.toHaveProperty('abiertoAhora');
      expect(c).not.toHaveProperty('distancia');
    }
  });

  describe('rubroId', () => {
    it('filtra por rubro', async () => {
      const res = await t.http().get('/comercios?rubroId=rub-gastro').expect(200);
      expect(ids(res)).toEqual(['com-202', 'com-201']);
      expect(res.body.meta.total).toBe(2);
    });

    it('un rubro sin comercios da lista vacía', async () => {
      const res = await t.http().get('/comercios?rubroId=rub-inexistente').expect(200);
      expect(res.body.datos).toEqual([]);
      expect(res.body.meta.total).toBe(0);
    });

    it('400 con un id que no tiene la forma de un rubro', async () => {
      const res = await t.http().get('/comercios?rubroId=com-118').expect(400);
      esperarError(res.body, 'VALIDACION_FALLIDA');
    });
  });

  describe('R3 — q busca en nombre y descripción sin tildes ni mayúsculas', () => {
    it.each([
      ['colon', ['com-201']],
      ['COLÓN', ['com-201']],
      ['ferreteria', ['com-118']],
      ['  el   tornillo ', ['com-118']],
      ['pinturas', ['com-118']],
      ['facturas', ['com-201']],
      ['obra', ['com-118']],
      ['zzz', []],
    ])('«%s»', async (q, esperados) => {
      const res = await t.http().get('/comercios').query({ q }).expect(200);
      esperarContrato(res.body, 'Comercio');
      expect(ids(res)).toEqual(esperados);
      expect(res.body.meta.total).toBe(esperados.length);
    });

    it('los comodines de SQL se buscan como texto: no son comodines', async () => {
      expect(ids(await t.http().get('/comercios').query({ q: '%' }).expect(200))).toEqual([
        'com-202',
      ]);
      expect(ids(await t.http().get('/comercios').query({ q: '_' }).expect(200))).toEqual([
        'com-202',
      ]);
      expect(ids(await t.http().get('/comercios').query({ q: '1%0' }).expect(200))).toEqual([]);
      expect(ids(await t.http().get('/comercios').query({ q: 'c_sas' }).expect(200))).toEqual([]);
    });

    it('un q vacío no filtra', async () => {
      const res = await t.http().get('/comercios?q=').expect(200);
      expect(res.body.meta.total).toBe(3);
    });

    it('no encuentra comercios dados de baja', async () => {
      const res = await t.http().get('/comercios').query({ q: 'siempre' }).expect(200);
      expect(res.body.datos).toEqual([]);
    });

    it('se combina con rubroId', async () => {
      const res = await t
        .http()
        .get('/comercios')
        .query({ q: 'almacen', rubroId: 'rub-gastro' })
        .expect(200);
      expect(ids(res)).toEqual(['com-202']);
    });

    it('400 con un q de más de 100 caracteres', async () => {
      const res = await t
        .http()
        .get('/comercios')
        .query({ q: 'a'.repeat(101) })
        .expect(400);
      esperarError(res.body, 'VALIDACION_FALLIDA');
    });
  });

  describe('cercanía', () => {
    const cerca = (extra: Record<string, string | number>) =>
      t
        .http()
        .get('/comercios')
        .query({ ...CENTRO, ...extra });

    it('radioMetros deja sólo lo que está dentro', async () => {
      expect(ids(await cerca({ radioMetros: 500 }).expect(200))).toEqual(['com-118']);
      expect(ids(await cerca({ radioMetros: 2000 }).expect(200))).toEqual(['com-118', 'com-201']);
      const res = await cerca({ radioMetros: 10_000 }).expect(200);
      expect(res.body.meta.total).toBe(3);
    });

    it('orden=distancia, de más cerca a más lejos', async () => {
      const res = await cerca({ orden: 'distancia' }).expect(200);
      expect(ids(res)).toEqual(['com-118', 'com-201', 'com-202']);
    });

    it('sin radio ni orden, sólo se usa para… nada: ordena por nombre', async () => {
      const res = await cerca({}).expect(200);
      expect(ids(res)).toEqual(['com-202', 'com-118', 'com-201']);
    });

    it('pagina sobre la lista ya filtrada y ordenada', async () => {
      const res = await cerca({ orden: 'distancia', porPagina: 1, pagina: 2 }).expect(200);
      expect(ids(res)).toEqual(['com-201']);
      expect(res.body.meta).toEqual({ total: 3, pagina: 2, porPagina: 1 });
    });

    it('se combina con rubroId', async () => {
      const res = await cerca({ rubroId: 'rub-gastro', orden: 'distancia' }).expect(200);
      expect(ids(res)).toEqual(['com-201', 'com-202']);
    });

    it.each([
      ['latitud sin longitud', { latitud: -32.48 }],
      ['longitud sin latitud', { longitud: -58.23 }],
      ['radioMetros sin posición', { radioMetros: 500 }],
      ['orden=distancia sin posición', { orden: 'distancia' }],
      ['latitud fuera de rango', { latitud: 91, longitud: -58.2 }],
      ['longitud fuera de rango', { latitud: -32, longitud: -181 }],
      ['latitud que no es número', { latitud: 'norte', longitud: -58.2 }],
      ['radio cero', { ...CENTRO, radioMetros: 0 }],
      ['radio negativo', { ...CENTRO, radioMetros: -5 }],
    ])('400: %s', async (_caso, query) => {
      const res = await t.http().get('/comercios').query(query).expect(400);
      esperarError(res.body, 'VALIDACION_FALLIDA');
    });
  });

  describe('orden', () => {
    it('por puntaje, de mayor a menor', async () => {
      const res = await t.http().get('/comercios?orden=puntaje').expect(200);
      expect(ids(res)).toEqual(['com-201', 'com-118', 'com-202']);
    });

    it('400 con un orden desconocido', async () => {
      const res = await t.http().get('/comercios?orden=precio').expect(400);
      esperarError(res.body, 'VALIDACION_FALLIDA');
    });
  });

  describe('paginación', () => {
    it('pagina y informa el total filtrado', async () => {
      const res = await t.http().get('/comercios?porPagina=2&pagina=2').expect(200);
      expect(ids(res)).toEqual(['com-201']);
      expect(res.body.meta).toEqual({ total: 3, pagina: 2, porPagina: 2 });
    });

    it('una página fuera de rango da lista vacía con el total correcto', async () => {
      const res = await t.http().get('/comercios?pagina=50').expect(200);
      expect(res.body.datos).toEqual([]);
      expect(res.body.meta.total).toBe(3);
    });

    it('acepta hasta 1000 por página y rechaza más', async () => {
      const ok = await t.http().get('/comercios?porPagina=1000').expect(200);
      expect(ok.body.meta.porPagina).toBe(1000);
      const mal = await t.http().get('/comercios?porPagina=1001').expect(400);
      esperarError(mal.body, 'VALIDACION_FALLIDA');
    });

    it.each(['porPagina=0', 'pagina=0', 'pagina=uno', 'porPagina=2.5'])('400 con %s', async (q) => {
      const res = await t.http().get(`/comercios?${q}`).expect(400);
      esperarError(res.body, 'VALIDACION_FALLIDA');
    });
  });

  it('400 con un parámetro que no existe', async () => {
    const res = await t.http().get('/comercios?abiertoAhora=true').expect(400);
    esperarError(res.body, 'VALIDACION_FALLIDA');
  });
});

describe('PRD §1 — Muchos comercios y el orden total', () => {
  let t: AppDePrueba;
  beforeAll(async () => {
    t = await crearApp();
    for (let i = 0; i < 30; i++) {
      // Todos con el mismo nombre y puntaje: el orden lo da el id.
      await crearComercio(t, { id: `com-${String(100 + i)}`, nombre: 'Igual', puntaje: 4 });
    }
  });
  afterAll(() => t.cerrar());

  it.each(['nombre', 'puntaje'])(
    'orden=%s empata por id y las páginas no se pisan',
    async (orden) => {
      const a = await t.http().get('/comercios').query({ orden, porPagina: 10, pagina: 1 });
      const b = await t.http().get('/comercios').query({ orden, porPagina: 10, pagina: 2 });
      const c = await t.http().get('/comercios').query({ orden, porPagina: 10, pagina: 3 });
      const todos = [...a.body.datos, ...b.body.datos, ...c.body.datos].map(
        (x: { id: string }) => x.id,
      );
      expect(todos).toEqual([...todos].sort());
      expect(new Set(todos).size).toBe(30);
      expect(a.body.meta.total).toBe(30);
    },
  );

  it('el listado completo cabe en una página de 1000 (el teléfono lo guarda)', async () => {
    const res = await t.http().get('/comercios?porPagina=1000').expect(200);
    expect(res.body.datos).toHaveLength(30);
  });
});

describe('PRD §1 — GET /comercios/:id', () => {
  let t: AppDePrueba;
  beforeAll(async () => {
    t = await crearApp({ ahora: '2026-10-03T12:00:00-03:00' });
    await crearComercio(t, {
      id: 'com-118',
      nombre: 'Ferretería El Tornillo',
      telefono: '+54 3442 421234',
      whatsapp: '5493442421234',
      instagram: '@eltornillo',
      imagenes: ['imagenes/2026/10/aaaaaaaaaaaaaaaa.jpg', 'imagenes/2026/10/bbbbbbbbbbbbbbbb.png'],
      videoClave: 'videos/2026/10/cccccccccccccccc.mp4',
      horarios: [
        { dia: 1, abre: '08:00', cierra: '12:00' },
        { dia: 1, abre: '16:30', cierra: '20:30' },
        { dia: 6, abre: '08:00', cierra: '13:00' },
      ],
      mediosDePago: ['efectivo', 'debito'],
    });
    await crearComercio(t, { id: 'com-baja', nombre: 'Dado de baja', activo: false });
    await crearComercio(t, {
      id: 'com-vacas',
      nombre: 'De vacaciones',
      cerradoHasta: '2026-10-03',
    });
    await crearComercio(t, { id: 'com-vuelve', nombre: 'Ya volvió', cerradoHasta: '2026-10-02' });
  });
  afterAll(() => t.cerrar());

  it('200 sin sesión con todos los campos: nulos como null, URLs absolutas con el origen del pedido', async () => {
    const res = await t.http().get('/comercios/com-118').set('Host', '10.0.0.5:3000').expect(200);
    esperarContrato(res.body, 'Comercio');
    const c = res.body.datos;
    expect(c.telefono).toBe('+54 3442 421234');
    expect(c.whatsapp).toBe('5493442421234');
    expect(c.instagram).toBe('@eltornillo');
    expect(c.imagenes).toEqual([
      'http://10.0.0.5:3000/archivos/imagenes/2026/10/aaaaaaaaaaaaaaaa.jpg',
      'http://10.0.0.5:3000/archivos/imagenes/2026/10/bbbbbbbbbbbbbbbb.png',
    ]);
    expect(c.videoUrl).toBe('http://10.0.0.5:3000/archivos/videos/2026/10/cccccccccccccccc.mp4');
    expect(c.horarios).toHaveLength(3);
    expect(c.horarios.filter((h: { dia: number }) => h.dia === 1)).toHaveLength(2);
    expect(c.codigoQr).toBe('CCU:com-118');
    expect(c.activo).toBe(true);
  });

  it('con X-Forwarded-* y CONFIAR_PROXY las URLs salen https', async () => {
    const p = await crearApp({ variables: { CONFIAR_PROXY: 'true' } });
    try {
      await crearComercio(p, {
        id: 'com-001',
        imagenes: ['imagenes/2026/10/aaaaaaaaaaaaaaaa.jpg'],
      });
      const res = await p
        .http()
        .get('/comercios/com-001')
        .set('X-Forwarded-Proto', 'https')
        .set('X-Forwarded-Host', 'api.ejemplo.ar')
        .expect(200);
      expect(res.body.datos.imagenes[0]).toBe(
        'https://api.ejemplo.ar/archivos/imagenes/2026/10/aaaaaaaaaaaaaaaa.jpg',
      );
    } finally {
      await p.cerrar();
    }
  });

  it('un comercio dado de baja se devuelve con activo: false (D12)', async () => {
    const res = await t.http().get('/comercios/com-baja').expect(200);
    esperarContrato(res.body, 'Comercio');
    expect(res.body.datos.activo).toBe(false);
  });

  it('D2: cerrado por vacaciones, horarios vacíos hasta el último día de cierre inclusive', async () => {
    const res = await t.http().get('/comercios/com-vacas').expect(200);
    esperarContrato(res.body, 'Comercio');
    expect(res.body.datos.horarios).toEqual([]);
    expect(res.body.datos).not.toHaveProperty('cerradoHasta');
  });

  it('D2: cuando termina el cierre vuelven los horarios (el día cambia a medianoche de Buenos Aires)', async () => {
    const vuelve = await t.http().get('/comercios/com-vuelve').expect(200);
    expect(vuelve.body.datos.horarios).toHaveLength(1);

    t.reloj.fijar('2026-10-03T23:59:59-03:00');
    expect((await t.http().get('/comercios/com-vacas').expect(200)).body.datos.horarios).toEqual(
      [],
    );
    t.reloj.fijar('2026-10-04T00:00:00-03:00');
    expect(
      (await t.http().get('/comercios/com-vacas').expect(200)).body.datos.horarios,
    ).toHaveLength(1);
    t.reloj.fijar('2026-10-03T12:00:00-03:00');
  });

  it('404 COMERCIO_NO_ENCONTRADO si no existe', async () => {
    const res = await t.http().get('/comercios/com-nada').expect(404);
    esperarError(res.body, 'COMERCIO_NO_ENCONTRADO');
  });

  it.each(['abc', 'rub-ferreteria', 'com-', 'com-%20x', 'com-a.b'])(
    '404 COMERCIO_NO_ENCONTRADO con el id «%s» (no es de un comercio)',
    async (id) => {
      const res = await t.http().get(`/comercios/${id}`).expect(404);
      esperarError(res.body, 'COMERCIO_NO_ENCONTRADO');
    },
  );

  it('un token inválido en un endpoint público se ignora', async () => {
    await t.http().get('/comercios/com-118').set('Authorization', 'Bearer basura').expect(200);
  });
});

describe('PRD §1 — GET /comercios/qr/:codigo (D13, R16)', () => {
  let t: AppDePrueba;
  beforeAll(async () => {
    t = await crearApp();
    await crearComercio(t, { id: 'com-118', nombre: 'Ferretería El Tornillo' });
    await crearComercio(t, { id: 'com-baja', activo: false });
  });
  afterAll(() => t.cerrar());

  it('200 sin sesión: resuelve CCU:<comercioId>', async () => {
    const res = await t.http().get('/comercios/qr/CCU:com-118').expect(200);
    esperarContrato(res.body, 'Comercio');
    expect(res.body.datos.id).toBe('com-118');
  });

  it('también con los dos puntos codificados', async () => {
    const res = await t.http().get('/comercios/qr/CCU%3Acom-118').expect(200);
    expect(res.body.datos.id).toBe('com-118');
  });

  it('el codigoQr de la ficha se resuelve a esa misma ficha', async () => {
    const ficha = (await t.http().get('/comercios/com-118').expect(200)).body.datos;
    const res = await t
      .http()
      .get(`/comercios/qr/${encodeURIComponent(ficha.codigoQr)}`)
      .expect(200);
    expect(res.body.datos).toEqual(ficha);
  });

  it('un comercio dado de baja también se resuelve, con activo: false', async () => {
    const res = await t.http().get('/comercios/qr/CCU:com-baja').expect(200);
    expect(res.body.datos.activo).toBe(false);
  });

  it.each([
    ['CCU:com-nada'],
    ['com-118'],
    ['CCU:'],
    ['ccu:com-118'],
    ['CCU:rub-ferreteria'],
    ['https%3A%2F%2Fejemplo.ar%2Fx'],
    ['CCU:com-118%20'],
    ['CCU:' + 'a'.repeat(500)],
  ])('404 QR_NO_RECONOCIDO con «%s», nunca 500', async (codigo) => {
    const res = await t.http().get(`/comercios/qr/${codigo}`).expect(404);
    esperarError(res.body, 'QR_NO_RECONOCIDO');
  });
});

describe('PRD §1 — un código con % mal formado', () => {
  let t: AppDePrueba;
  beforeAll(async () => (t = await crearApp()));
  afterAll(() => t.cerrar());

  it('da 400 con el sobre de error, no 500', async () => {
    const res = await t.http().get('/comercios/qr/%E0%A4%A').expect(400);
    esperarError(res.body);
  });
});

describe('AGENTS §8 — las URLs de archivos usan el origen del pedido', () => {
  it('urlDeArchivo fuera de un pedido no se usa: el mapeador lo hace dentro del pedido', () => {
    expect(conOrigen('http://10.0.0.5:3000', () => urlDeArchivo('imagenes/x.jpg'))).toBe(
      'http://10.0.0.5:3000/archivos/imagenes/x.jpg',
    );
  });
});
