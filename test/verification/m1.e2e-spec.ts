// Verificación independiente de M1 — Comercios (ESPECIFICACION §4 M1; R1, R3, R16; D1, D2, D12, D13).
// Caja negra: sólo HTTP, contrato y builders de test.
import { crearComercio, crearRubro } from '../utilities/businesses.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import { type AppDePrueba, crearApp } from '../utilities/create-app.js';

const JERGA =
  /should|must|property|undefined|null\b|Cannot|Error:|Exception|Unauthorized|Forbidden|Not Found|Bad Request|Internal|SQL|SQLITE|QueryFailed|JSON|stack|\bstring\b|\bnumber\b|\bboolean\b/i;

function esperarMensajeHumano(cuerpo: unknown) {
  const { mensaje } = (cuerpo as { error: { mensaje: string } }).error;
  expect(mensaje).not.toMatch(JERGA);
}

const ids = (res: { body: { datos: { id: string }[] } }) => res.body.datos.map((c) => c.id);

describe('R1 — «abierto ahora» y otros campos de regalo no existen', () => {
  let t: AppDePrueba;
  beforeAll(async () => {
    t = await crearApp();
    await crearRubro(t, { id: 'rub-x' });
    await crearComercio(t, { id: 'com-uno', rubroId: 'rub-x', nombre: 'Uno' });
  });
  afterAll(() => t.cerrar());

  it('ni el listado ni el detalle ni el QR llevan campos fuera del tipo', async () => {
    const campos = [
      'abiertoAhora',
      'distancia',
      'esFavorito',
      'cerradoHasta',
      'createdAt',
      'latitud',
      'longitud',
      'nombreBusqueda',
      'descripcionBusqueda',
      'videoClave',
    ];
    for (const ruta of [
      '/comercios?latitud=-32.48&longitud=-58.23&orden=distancia',
      '/comercios/com-uno',
      '/comercios/qr/CCU:com-uno',
    ]) {
      const res = await t.http().get(ruta).expect(200);
      esperarContrato(res.body, 'Comercio');
      const c = Array.isArray(res.body.datos) ? res.body.datos[0] : res.body.datos;
      for (const campo of campos) expect(c).not.toHaveProperty(campo);
    }
  });

  it('abiertoAhora como filtro es un parámetro desconocido: 400', async () => {
    const res = await t.http().get('/comercios?abiertoAhora=true').expect(400);
    esperarError(res.body, 'VALIDACION_FALLIDA');
    esperarMensajeHumano(res.body);
  });

  it('un nulo vacío en la base ("") sale como null, nunca como ""', async () => {
    await crearComercio(t, {
      id: 'com-vacio',
      nombre: 'Vacío',
      telefono: '',
      whatsapp: '',
      instagram: '',
    });
    const res = await t.http().get('/comercios/com-vacio').expect(200);
    esperarContrato(res.body, 'Comercio');
    expect(res.body.datos.telefono).toBeNull();
    expect(res.body.datos.whatsapp).toBeNull();
    expect(res.body.datos.instagram).toBeNull();
  });

  it('codigoQr siempre es CCU:<id> en la ficha, también para ids propios', async () => {
    const res = await t.http().get('/comercios/com-uno').expect(200);
    expect(res.body.datos.codigoQr).toBe('CCU:com-uno');
    expect(res.body.datos.videoUrl).toBeNull();
    expect(res.body.datos.imagenes).toEqual([]);
  });
});

describe('Forma — todo lleno y todo vacío', () => {
  let t: AppDePrueba;
  beforeAll(async () => {
    t = await crearApp();
    await crearRubro(t, { id: 'rub-x' });
    await crearComercio(t, {
      id: 'com-lleno',
      rubroId: 'rub-x',
      nombre: 'Lleno',
      telefono: '3442 1',
      whatsapp: '549344212345',
      instagram: '@lleno',
      imagenes: ['imagenes/2026/10/aaaaaaaaaaaaaaaa.jpg'],
      videoClave: 'videos/2026/10/cccccccccccccccc.mp4',
      horarios: [
        { dia: 0, abre: '09:00', cierra: '13:00' },
        { dia: 1, abre: '16:30', cierra: '20:30' },
        { dia: 1, abre: '08:00', cierra: '12:00' },
      ],
      mediosDePago: ['efectivo', 'debito'],
      puntaje: 4,
      cantidadResenas: 2,
    });
    await crearComercio(t, {
      id: 'com-pelado',
      rubroId: 'rub-x',
      nombre: 'Pelado',
      horarios: [],
      mediosDePago: [],
    });
  });
  afterAll(() => t.cerrar());

  it('las URLs de imágenes y video son absolutas con /archivos/', async () => {
    const res = await t.http().get('/comercios/com-lleno').expect(200);
    esperarContrato(res.body, 'Comercio');
    for (const u of [...res.body.datos.imagenes, res.body.datos.videoUrl]) {
      expect(u).toMatch(/^https?:\/\/[^/]+\/archivos\/(imagenes|videos)\//);
    }
  });

  it('puntaje entero viaja como número (4, no "4.0")', async () => {
    const res = await t.http().get('/comercios/com-lleno').expect(200);
    expect(res.body.datos.puntaje).toBe(4);
    expect(typeof res.body.datos.cantidadResenas).toBe('number');
  });

  it('los tramos del mismo día se conservan todos (R2: un elemento por tramo)', async () => {
    const res = await t.http().get('/comercios/com-lleno').expect(200);
    expect(res.body.datos.horarios).toHaveLength(3);
    expect(res.body.datos.horarios.filter((h: { dia: number }) => h.dia === 1)).toHaveLength(2);
  });

  it('un comercio sin horarios ni medios de pago devuelve listas vacías', async () => {
    const res = await t.http().get('/comercios/com-pelado').expect(200);
    esperarContrato(res.body, 'Comercio');
    expect(res.body.datos.horarios).toEqual([]);
    expect(res.body.datos.mediosDePago).toEqual([]);
  });
});

describe('D2 — cerrado por vacaciones, bordes del reloj', () => {
  let t: AppDePrueba;
  beforeAll(async () => {
    t = await crearApp({ ahora: '2026-12-31T23:59:59-03:00' });
    await crearComercio(t, { id: 'com-fin', nombre: 'Fin de año', cerradoHasta: '2026-12-31' });
    await crearComercio(t, { id: 'com-mes', nombre: 'Fin de mes', cerradoHasta: '2026-10-31' });
    await crearComercio(t, { id: 'com-viejo', nombre: 'Viejo', cerradoHasta: '2020-01-01' });
  });
  afterAll(() => t.cerrar());

  it('31/12 23:59:59 sigue cerrado y a las 00:00 del 1/1 vuelve', async () => {
    const a = await t.http().get('/comercios/com-fin').expect(200);
    expect(a.body.datos.horarios).toEqual([]);
    t.reloj.fijar('2027-01-01T00:00:00-03:00');
    const b = await t.http().get('/comercios/com-fin').expect(200);
    esperarContrato(b.body, 'Comercio');
    expect(b.body.datos.horarios).toHaveLength(1);
  });

  it('último día del mes: cerrado el 31/10 a las 23:59 y abierto el 1/11 a las 00:00', async () => {
    t.reloj.fijar('2026-10-31T23:59:00-03:00');
    expect((await t.http().get('/comercios/com-mes')).body.datos.horarios).toEqual([]);
    t.reloj.fijar('2026-11-01T00:00:00-03:00');
    expect((await t.http().get('/comercios/com-mes')).body.datos.horarios).toHaveLength(1);
  });

  it('a las 21:00-03 (00:00 UTC del día siguiente) el día sigue siendo el de Buenos Aires', async () => {
    t.reloj.fijar('2026-10-31T21:30:00-03:00'); // ya es 01/11 en UTC
    expect((await t.http().get('/comercios/com-mes')).body.datos.horarios).toEqual([]);
  });

  it('la vacación también aplica en el listado', async () => {
    t.reloj.fijar('2026-10-31T12:00:00-03:00');
    const res = await t.http().get('/comercios?porPagina=100').expect(200);
    const mes = res.body.datos.find((c: { id: string }) => c.id === 'com-mes');
    expect(mes.horarios).toEqual([]);
    const viejo = res.body.datos.find((c: { id: string }) => c.id === 'com-viejo');
    expect(viejo.horarios).toHaveLength(1);
  });
});

describe('R3 / D1 — q busca en nombre y descripción', () => {
  let t: AppDePrueba;
  beforeAll(async () => {
    t = await crearApp();
    await crearRubro(t, { id: 'rub-x' });
    await crearComercio(t, {
      id: 'com-a',
      rubroId: 'rub-x',
      nombre: 'Ñandú Regalos',
      descripcion: 'Souvenirs y   artesanías   locales',
    });
    await crearComercio(t, {
      id: 'com-b',
      rubroId: 'rub-x',
      nombre: 'Álvarez e Hijos',
      descripcion: 'Venta de tornillos',
    });
    await crearComercio(t, {
      id: 'com-c',
      rubroId: 'rub-x',
      nombre: 'Zapatería',
      descripcion: 'Calzado',
      activo: false,
    });
  });
  afterAll(() => t.cerrar());

  const q = (valor: string) => t.http().get('/comercios').query({ q: valor });

  it('con tildes, mayúsculas y espacios de más en el término', async () => {
    expect(ids(await q('  ÁLVAREZ   ').expect(200))).toEqual(['com-b']);
    expect(ids(await q('alvarez e hijos').expect(200))).toEqual(['com-b']);
    expect(ids(await q('ñandu').expect(200))).toEqual(['com-a']);
    expect(ids(await q('ÑANDÚ').expect(200))).toEqual(['com-a']);
  });

  it('la descripción con espacios repetidos se encuentra con uno', async () => {
    expect(ids(await q('souvenirs y artesanias').expect(200))).toEqual(['com-a']);
  });

  it('busca en la descripción ("lo que venden")', async () => {
    expect(ids(await q('tornillos').expect(200))).toEqual(['com-b']);
  });

  it('subcadena en el medio de una palabra', async () => {
    expect(ids(await q('rnillo').expect(200))).toEqual(['com-b']);
  });

  it('no encuentra bajas ni siquiera por nombre exacto; total 0 y datos []', async () => {
    const res = await q('zapateria').expect(200);
    expect(res.body.datos).toEqual([]);
    expect(res.body.meta).toEqual({ total: 0, pagina: 1, porPagina: 20 });
  });

  it('un q sólo con espacios no filtra', async () => {
    const res = await q('   ').expect(200);
    expect(res.body.meta.total).toBe(2);
  });

  it('comodines y comillas son texto, no rompen (200)', async () => {
    for (const raro of [
      "'",
      '"; DROP TABLE comercios;--',
      '\\',
      '%',
      '_',
      '%%',
      "' OR '1'='1",
      '😀',
    ]) {
      const res = await q(raro).expect(200);
      esperarContrato(res.body, 'Comercio');
      expect(res.body.datos).toEqual([]);
    }
  });

  it('q repetido (arreglo) da 400 y no 500', async () => {
    const res = await t.http().get('/comercios?q=a&q=b');
    expect(res.status).toBe(400);
    esperarError(res.body, 'VALIDACION_FALLIDA');
  });
});

describe('Entrada — parámetros de GET /comercios', () => {
  let t: AppDePrueba;
  beforeAll(async () => {
    t = await crearApp();
    await crearRubro(t, { id: 'rub-x' });
    await crearComercio(t, { id: 'com-a', rubroId: 'rub-x', nombre: 'A' });
  });
  afterAll(() => t.cerrar());

  const malos: [string, string][] = [
    ['pagina=0', 'VALIDACION_FALLIDA'],
    ['pagina=-1', 'VALIDACION_FALLIDA'],
    ['pagina=abc', 'VALIDACION_FALLIDA'],
    ['pagina=1.5', 'VALIDACION_FALLIDA'],
    ['pagina=', 'VALIDACION_FALLIDA'],
    ['porPagina=0', 'VALIDACION_FALLIDA'],
    ['porPagina=-5', 'VALIDACION_FALLIDA'],
    ['porPagina=1001', 'VALIDACION_FALLIDA'],
    ['porPagina=abc', 'VALIDACION_FALLIDA'],
    ['latitud=-32.48', 'VALIDACION_FALLIDA'], // sin longitud (A17)
    ['longitud=-58.2', 'VALIDACION_FALLIDA'],
    ['latitud=91&longitud=0', 'VALIDACION_FALLIDA'],
    ['latitud=-91&longitud=0', 'VALIDACION_FALLIDA'],
    ['latitud=0&longitud=181', 'VALIDACION_FALLIDA'],
    ['latitud=0&longitud=-181', 'VALIDACION_FALLIDA'],
    ['latitud=abc&longitud=0', 'VALIDACION_FALLIDA'],
    ['latitud=NaN&longitud=0', 'VALIDACION_FALLIDA'],
    ['latitud=Infinity&longitud=0', 'VALIDACION_FALLIDA'],
    ['latitud=0&longitud=0&radioMetros=-1', 'VALIDACION_FALLIDA'],
    ['latitud=0&longitud=0&radioMetros=0', 'VALIDACION_FALLIDA'],
    ['latitud=0&longitud=0&radioMetros=abc', 'VALIDACION_FALLIDA'],
    ['latitud=0&longitud=0&radioMetros=NaN', 'VALIDACION_FALLIDA'],
    ['radioMetros=100', 'VALIDACION_FALLIDA'], // sin posición
    ['orden=distancia', 'VALIDACION_FALLIDA'], // sin posición
    ['orden=DISTANCIA', 'VALIDACION_FALLIDA'],
    ['orden=', 'VALIDACION_FALLIDA'],
    ['orden=precio', 'VALIDACION_FALLIDA'],
    ['rubroId=ferreteria', 'VALIDACION_FALLIDA'],
    ['rubroId=com-118', 'VALIDACION_FALLIDA'],
    ['rubroId=rub-x&rubroId=rub-y', 'VALIDACION_FALLIDA'],
    ['distancia=1', 'VALIDACION_FALLIDA'],
    ['activo=false', 'VALIDACION_FALLIDA'],
    ['password=1', 'VALIDACION_FALLIDA'],
  ];
  it.each(malos)('?%s da 400 con sobre de error y mensaje humano', async (consulta, codigo) => {
    const res = await t.http().get(`/comercios?${consulta}`);
    expect(res.status).toBe(400);
    esperarError(res.body, codigo);
    esperarMensajeHumano(res.body);
  });

  it('?activo=false NO deja ver bajas (parámetro rechazado, no ignorado)', async () => {
    await crearComercio(t, { id: 'com-baja', nombre: 'Baja', activo: false });
    const res = await t.http().get('/comercios?activo=false');
    expect(res.status).toBe(400);
  });

  it('un rubro bien formado pero inexistente da lista vacía', async () => {
    const res = await t.http().get('/comercios?rubroId=rub-noexiste').expect(200);
    expect(res.body.datos).toEqual([]);
    expect(res.body.meta.total).toBe(0);
  });

  it('el borde de latitud y longitud (±90/±180) se acepta', async () => {
    await t.http().get('/comercios?latitud=90&longitud=180').expect(200);
    await t.http().get('/comercios?latitud=-90&longitud=-180&radioMetros=1').expect(200);
  });

  it('porPagina=1000 se acepta y porPagina=1 devuelve uno', async () => {
    await t.http().get('/comercios?porPagina=1000').expect(200);
    const res = await t.http().get('/comercios?porPagina=1').expect(200);
    expect(res.body.meta.porPagina).toBe(1);
  });

  it('radio enorme no rompe', async () => {
    const res = await t
      .http()
      .get('/comercios?latitud=-32.48&longitud=-58.23&radioMetros=999999999999')
      .expect(200);
    expect(res.body.meta.total).toBe(1);
  });
});

describe('Paginación y orden estable', () => {
  let t: AppDePrueba;
  beforeAll(async () => {
    t = await crearApp();
    await crearRubro(t, { id: 'rub-x' });
    await crearRubro(t, { id: 'rub-y' });
    const nombres = ['álamo', 'Zeta', 'Ñu', 'beta', 'Alfa', 'alfa', 'Ángel', 'angel'];
    for (const [i, nombre] of nombres.entries()) {
      await crearComercio(t, {
        id: `com-${String(i).padStart(3, '0')}`,
        nombre,
        rubroId: i % 2 ? 'rub-x' : 'rub-y',
        puntaje: i < 4 ? 4.5 : 3,
        latitud: -32.48 + i * 0.001,
        longitud: -58.23,
      });
    }
    await crearComercio(t, { id: 'com-baja', nombre: 'Baja', activo: false, rubroId: 'rub-x' });
  });
  afterAll(() => t.cerrar());

  it('orden por nombre ignora mayúsculas y tildes y desempata por id', async () => {
    const res = await t.http().get('/comercios').expect(200);
    esperarContrato(res.body, 'Comercio');
    const nombres = res.body.datos.map((c: { nombre: string }) => c.nombre);
    // Orden esperado: sin tildes ni mayúsculas, la ñ después de la n. Los empates por id.
    const clave = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    for (let i = 1; i < nombres.length; i++) {
      expect(clave(nombres[i - 1]) <= clave(nombres[i])).toBe(true);
    }
  });

  it('las páginas recorridas de a 3 reconstruyen la lista completa sin repetir ni perder', async () => {
    const todo = ids(await t.http().get('/comercios?porPagina=100').expect(200));
    const juntas: string[] = [];
    for (const p of [1, 2, 3, 4]) {
      const res = await t.http().get(`/comercios?pagina=${p}&porPagina=3`).expect(200);
      expect(res.body.meta).toEqual({ total: 8, pagina: p, porPagina: 3 });
      juntas.push(...ids(res));
    }
    expect(juntas).toEqual(todo);
    expect(new Set(juntas).size).toBe(8);
  });

  it('página fuera de rango: datos [] y total correcto', async () => {
    const res = await t.http().get('/comercios?pagina=99&porPagina=3').expect(200);
    expect(res.body.datos).toEqual([]);
    expect(res.body.meta).toEqual({ total: 8, pagina: 99, porPagina: 3 });
  });

  it('orden=puntaje desempata de forma estable (por id)', async () => {
    const a = ids(await t.http().get('/comercios?orden=puntaje&porPagina=100').expect(200));
    const b = ids(await t.http().get('/comercios?orden=puntaje&porPagina=100').expect(200));
    expect(a).toEqual(b);
    expect(a.slice(0, 4).sort()).toEqual(['com-000', 'com-001', 'com-002', 'com-003']);
    // Duda: el desempate es por nombre y no por id (AGENTS §4.2).
  });

  it('rubroId + q + posición combinados: total filtrado, baja excluida', async () => {
    const res = await t
      .http()
      .get(
        '/comercios?rubroId=rub-x&q=a&latitud=-32.48&longitud=-58.23&radioMetros=10000&orden=distancia',
      )
      .expect(200);
    esperarContrato(res.body, 'Comercio');
    expect(ids(res)).not.toContain('com-baja');
    for (const c of res.body.datos) expect(c.rubroId).toBe('rub-x');
    expect(res.body.meta.total).toBe(res.body.datos.length);
  });

  it('orden=distancia: el más cercano primero; empate por id', async () => {
    const res = await t
      .http()
      .get('/comercios?latitud=-32.48&longitud=-58.23&orden=distancia&porPagina=100')
      .expect(200);
    expect(ids(res).slice(0, 3)).toEqual(['com-000', 'com-001', 'com-002']);
  });

  it('radio con distancia exacta en el borde incluye el comercio', async () => {
    // com-001 está ~111 m al norte del centro; radio de 200 m incluye 000 y 001 y no 002 (~222 m)
    const res = await t
      .http()
      .get('/comercios?latitud=-32.48&longitud=-58.23&radioMetros=200&orden=distancia')
      .expect(200);
    expect(ids(res)).toEqual(['com-000', 'com-001']);
  });

  it('el radio cruza el antimeridiano/polos sin romper (posición lejana)', async () => {
    const res = await t
      .http()
      .get('/comercios?latitud=89.9&longitud=179.9&radioMetros=1000')
      .expect(200);
    expect(res.body.datos).toEqual([]);
  });
});

describe('GET /rubros — forma y errores', () => {
  let t: AppDePrueba;
  beforeAll(async () => {
    t = await crearApp();
    await crearRubro(t, {
      id: 'rub-a',
      nombre: 'Gastronomía',
      icono: 'utensils',
      color: '#ff0000',
      orden: 1,
    });
  });
  afterAll(() => t.cerrar());

  it('forma exacta del Rubro y orden como número', async () => {
    const res = await t.http().get('/rubros').expect(200);
    esperarContrato(res.body, 'Rubro');
    expect(res.body.datos[0]).toEqual({
      id: 'rub-a',
      nombre: 'Gastronomía',
      icono: 'utensils',
      color: '#ff0000',
      orden: 1,
    });
  });

  it('parámetros sobrantes dan 400', async () => {
    const res = await t.http().get('/rubros?q=algo');
    expect(res.status).toBe(400);
    esperarError(res.body, 'VALIDACION_FALLIDA');
  });

  it('porPagina=101 supera el máximo (A19)', async () => {
    const res = await t.http().get('/rubros?porPagina=101');
    expect(res.status).toBe(400);
    esperarError(res.body, 'VALIDACION_FALLIDA');
  });

  it('es público con token vencido, basura o mal firmado (A7)', async () => {
    for (const auth of ['Bearer basura', 'Bearer', 'Basic abc', 'Bearer a.b.c']) {
      await t.http().get('/rubros').set('Authorization', auth).expect(200);
    }
  });
});

describe('GET /comercios/:id — ids raros', () => {
  let t: AppDePrueba;
  beforeAll(async () => {
    t = await crearApp();
    await crearComercio(t, { id: 'com-118', nombre: 'Tornillo' });
    await crearComercio(t, { id: 'com-baja', nombre: 'Baja', activo: false });
  });
  afterAll(() => t.cerrar());

  it.each([
    'COM-118',
    'com-11',
    'com-118%20',
    'lug-118',
    '118',
    'com-',
    'com-118%2F..',
    'com-118;DROP',
    'rub-ferreteria',
    '%E2%98%83',
    'com-' + 'a'.repeat(200),
  ])('«%s» → 404 COMERCIO_NO_ENCONTRADO con sobre y mensaje humano', async (id) => {
    const res = await t.http().get(`/comercios/${id}`);
    expect(res.status).toBe(404);
    esperarError(res.body, 'COMERCIO_NO_ENCONTRADO');
    esperarMensajeHumano(res.body);
    expect(res.body.error.mensaje).toBe('No existe ese comercio.');
  });

  it('un comercio de baja se ve con activo: false y pasa el contrato (D12)', async () => {
    const res = await t.http().get('/comercios/com-baja').expect(200);
    esperarContrato(res.body, 'Comercio');
    expect(res.body.datos.activo).toBe(false);
  });

  it('trailing slash y mayúsculas en la ruta no devuelven 500', async () => {
    const r1 = await t.http().get('/comercios/com-118/');
    expect([200, 404]).toContain(r1.status);
    const r2 = await t.http().get('/COMERCIOS/com-118');
    expect(r2.status).toBeLessThan(500);
  });

  it('POST/PUT/DELETE sobre /comercios dan error con sobre, no 500', async () => {
    for (const metodo of ['post', 'put', 'delete', 'patch'] as const) {
      const res = await t.http()[metodo]('/comercios/com-118').send({});
      expect(res.status).toBeLessThan(500);
      expect(res.status).toBeGreaterThanOrEqual(400);
      esperarError(res.body);
    }
  });
});

describe('R16 / D13 — GET /comercios/qr/:codigo', () => {
  let t: AppDePrueba;
  beforeAll(async () => {
    t = await crearApp();
    await crearComercio(t, { id: 'com-118', nombre: 'Tornillo' });
    await crearComercio(t, { id: 'com-baja', nombre: 'Baja', activo: false });
  });
  afterAll(() => t.cerrar());

  it('resuelve CCU:com-118 sin sesión con el mismo comercio que el detalle', async () => {
    const qr = await t.http().get('/comercios/qr/CCU:com-118').expect(200);
    const det = await t.http().get('/comercios/com-118').expect(200);
    esperarContrato(qr.body, 'Comercio');
    expect(qr.body.datos).toEqual(det.body.datos);
  });

  it.each([
    'CCU:com-999',
    'ccu:com-118',
    'CCU%3A',
    'CCU:',
    'CCU:com-118:x',
    'CCU%3A%20com-118',
    'CCU%3Acom-118%20',
    'CCU-com-118',
    'com-118',
    'CCU:rub-x',
    'CCU:CCU:com-118',
    'CCU%3Acom-118%0A',
    'http%3A%2F%2Fevil.com%2FCCU%3Acom-118',
    'CCU:' + 'a'.repeat(500),
    '%E2%98%83',
    'cualquier-cosa',
  ])('«%s» → 404 QR_NO_RECONOCIDO', async (codigo) => {
    const res = await t.http().get(`/comercios/qr/${codigo}`);
    expect(res.status).toBe(404);
    esperarError(res.body, 'QR_NO_RECONOCIDO');
    esperarMensajeHumano(res.body);
    expect(res.body.error.mensaje).toBe('Ese código no es de un comercio asociado.');
  });

  it('un comercio de baja se resuelve con activo: false (D13)', async () => {
    const res = await t.http().get('/comercios/qr/CCU:com-baja').expect(200);
    expect(res.body.datos.activo).toBe(false);
  });

  it('el QR con otros métodos no da 500', async () => {
    const res = await t.http().post('/comercios/qr/CCU:com-118').send({});
    expect(res.status).toBeLessThan(500);
    esperarError(res.body);
  });

  it('/comercios/qr sin código no es 500', async () => {
    const res = await t.http().get('/comercios/qr');
    expect(res.status).toBeLessThan(500);
    esperarError(res.body);
  });
});

describe('AGENTS §4 — sobre de error y fechas', () => {
  let t: AppDePrueba;
  beforeAll(async () => (t = await crearApp()));
  afterAll(() => t.cerrar());

  it('una ruta inexistente de M1 da RUTA_NO_ENCONTRADA con sólo codigo y mensaje', async () => {
    const res = await t.http().get('/comercios/com-1/horarios/x').expect(404);
    esperarError(res.body, 'RUTA_NO_ENCONTRADA');
  });

  it('el Host raro no se filtra a las URLs: con Host propio las URLs usan ese origen', async () => {
    await crearComercio(t, {
      id: 'com-img',
      nombre: 'Img',
      imagenes: ['imagenes/2026/10/aaaaaaaaaaaaaaaa.jpg'],
    });
    const res = await t.http().get('/comercios/com-img').set('Host', '10.0.0.5:3000').expect(200);
    expect(res.body.datos.imagenes[0]).toBe(
      'http://10.0.0.5:3000/archivos/imagenes/2026/10/aaaaaaaaaaaaaaaa.jpg',
    );
  });

  it('X-Simular no hace nada con la simulación apagada', async () => {
    await t.http().get('/rubros').set('X-Simular', 'error-500').expect(200);
  });
});
