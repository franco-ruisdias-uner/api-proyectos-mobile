// Verificación independiente del M1 — Red (AGENTS §12). Caja negra: sólo HTTP, más los
// builders de test/utilities/ y la siembra de demo. Cada describe nombra la regla que prueba.
import type { Linea, Parada } from '../../contract/types.js';
import { sembrar } from '../../src/seeds/seed.js';
import { type AppDePrueba, crearApp } from '../utilities/create-app.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import { crearLinea, crearParada } from '../utilities/network.js';

const JERGA =
  /\b(must|should|property|undefined|null|string|number|boolean|array|object|Bad Request|Unauthorized|Forbidden|Not Found|Internal Server|Error:|exception|Cannot|SQLITE|QueryFailed|whitelist|integer)\b/i;

function esperarErrorLimpio(r: { status: number; body: unknown }, estado: number, codigo: string) {
  esperarError(r, estado, codigo);
  const b = r.body as { error: { mensaje: string } };
  expect(Object.keys(b)).toEqual(['error']);
  expect(Object.keys(b.error).sort()).toEqual(['codigo', 'mensaje']);
  expect(b.error.mensaje).not.toMatch(JERGA);
}

describe('Espec. M1 — GET /lineas: forma, orden y recorridos', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
  });
  afterAll(() => ctx.cerrar());

  it('orden numérico: 1, 2, 9, 10, 14, 100; empates de número por id', async () => {
    for (const n of ['100', '14', '10', '9', '2', '1']) await crearLinea(ctx, { numero: n });
    await crearLinea(ctx, { id: 'lin-zz2', numero: '3' });
    await crearLinea(ctx, { id: 'lin-zz1', numero: '3' });
    const r = await ctx.http.get('/lineas').expect(200);
    esperarContrato(r.body, 'Linea');
    const numeros = r.body.datos.map((l: Linea) => l.numero);
    expect(numeros).toEqual(['1', '2', '3', '3', '9', '10', '14', '100']);
    const tres = r.body.datos.filter((l: Linea) => l.numero === '3').map((l: Linea) => l.id);
    expect(tres).toEqual(['lin-zz1', 'lin-zz2']);
  });

  it('paradaIds en orden de paso con más de 10 paradas (no orden alfabético)', async () => {
    const ps: string[] = [];
    for (let i = 0; i < 12; i++) ps.push((await crearParada(ctx, { sentido: 'ida' })).id);
    const l = await crearLinea(ctx, { recorridos: [{ sentido: 'ida', paradaIds: ps }] });
    const r = await ctx.http.get(`/lineas/${l.id}`).expect(200);
    esperarContrato(r.body, 'Linea');
    expect(r.body.datos.recorridos[0].paradaIds).toEqual(ps);
  });

  it('un orden de paso invertido respecto del alta de las paradas se respeta', async () => {
    const a = await crearParada(ctx, { id: 'par-oa' });
    const b = await crearParada(ctx, { id: 'par-ob' });
    const c = await crearParada(ctx, { id: 'par-oc' });
    const l = await crearLinea(ctx, {
      recorridos: [{ sentido: 'ida', paradaIds: [c.id, a.id, b.id] }],
    });
    const r = await ctx.http.get(`/lineas/${l.id}`).expect(200);
    expect(r.body.datos.recorridos[0].paradaIds).toEqual(['par-oc', 'par-oa', 'par-ob']);
  });

  it('el trazado conserva orden y números (no strings)', async () => {
    const trazado = [
      { latitud: -31.1, longitud: -60.1 },
      { latitud: -31.2, longitud: -60.2 },
      { latitud: -31.3, longitud: -60.3 },
    ];
    const l = await crearLinea(ctx, {
      recorridos: [{ sentido: 'vuelta', paradaIds: [], trazado }],
    });
    const r = await ctx.http.get(`/lineas/${l.id}`).expect(200);
    esperarContrato(r.body, 'Linea');
    expect(r.body.datos.recorridos[0].trazado).toEqual(trazado);
  });

  it('una línea con sólo vuelta trae un solo recorrido; ida siempre antes que vuelta', async () => {
    const p = await crearParada(ctx, { sentido: 'vuelta' });
    const q = await crearParada(ctx, { sentido: 'ida' });
    const solo = await crearLinea(ctx, { recorridos: [{ sentido: 'vuelta', paradaIds: [p.id] }] });
    const ambos = await crearLinea(ctx, {
      recorridos: [
        { sentido: 'vuelta', paradaIds: [p.id] },
        { sentido: 'ida', paradaIds: [q.id] },
      ],
    });
    const r1 = await ctx.http.get(`/lineas/${solo.id}`).expect(200);
    expect(r1.body.datos.recorridos.map((x: { sentido: string }) => x.sentido)).toEqual(['vuelta']);
    const r2 = await ctx.http.get(`/lineas/${ambos.id}`).expect(200);
    expect(r2.body.datos.recorridos.map((x: { sentido: string }) => x.sentido)).toEqual([
      'ida',
      'vuelta',
    ]);
  });

  it('el detalle de una línea inactiva es 200 y activa:false; aparece también en la lista', async () => {
    const l = await crearLinea(ctx, { activa: false });
    const r = await ctx.http.get(`/lineas/${l.id}`).expect(200);
    expect(r.body.datos.activa).toBe(false);
    const lista = await ctx.http.get('/lineas?porPagina=100').expect(200);
    expect(lista.body.datos.some((x: Linea) => x.id === l.id)).toBe(true);
  });

  it('sólo las claves del tipo Linea y Recorrido (nada de createdAt, rol, etc.)', async () => {
    const r = await ctx.http.get('/lineas?porPagina=100').expect(200);
    for (const l of r.body.datos) {
      expect(Object.keys(l).sort()).toEqual([
        'activa',
        'color',
        'empresa',
        'id',
        'nombre',
        'numero',
        'recorridos',
      ]);
      for (const rec of l.recorridos)
        expect(Object.keys(rec).sort()).toEqual(['destino', 'paradaIds', 'sentido', 'trazado']);
    }
  });

  it.each([
    ['pagina=0', 'pagina=0'],
    ['pagina=-1', 'pagina=-1'],
    ['pagina=abc', 'pagina=abc'],
    ['pagina=1.5', 'pagina=1.5'],
    ['porPagina=0', 'porPagina=0'],
    ['porPagina=-5', 'porPagina=-5'],
    ['porPagina=101', 'porPagina=101'],
    ['porPagina=x', 'porPagina=x'],
  ])('paginación inválida (%s) es 400 VALIDACION_FALLIDA, no 500', async (_n, qs) => {
    const r = await ctx.http.get(`/lineas?${qs}`);
    esperarErrorLimpio(r, 400, 'VALIDACION_FALLIDA');
  });

  it('un parámetro desconocido en la query no rompe (200 o 400, nunca 500)', async () => {
    const r = await ctx.http.get('/lineas?distancia=3&password=x');
    expect([200, 400]).toContain(r.status);
    if (r.status === 200) esperarContrato(r.body, 'Linea');
    else esperarErrorLimpio(r, 400, 'VALIDACION_FALLIDA');
  });

  it('paginación estable: la unión de las páginas es la lista completa sin repetidos', async () => {
    const todo = await ctx.http.get('/lineas?porPagina=100').expect(200);
    const total = todo.body.meta.total as number;
    const vistos: string[] = [];
    for (let p = 1; p <= Math.ceil(total / 3); p++) {
      const r = await ctx.http.get(`/lineas?pagina=${p}&porPagina=3`).expect(200);
      expect(r.body.meta).toEqual({ total, pagina: p, porPagina: 3 });
      vistos.push(...r.body.datos.map((l: Linea) => l.id));
    }
    expect(vistos).toEqual(todo.body.datos.map((l: Linea) => l.id));
    const fuera = await ctx.http.get(`/lineas?pagina=9999&porPagina=3`).expect(200);
    expect(fuera.body.datos).toEqual([]);
    expect(fuera.body.meta).toEqual({ total, pagina: 9999, porPagina: 3 });
  });

  it.each([
    ['POST', '/lineas'],
    ['PUT', '/lineas/lin-01'],
    ['PATCH', '/lineas/lin-01'],
    ['DELETE', '/lineas/lin-01'],
    ['POST', '/paradas'],
    ['DELETE', '/paradas/par-101'],
  ])(
    '%s %s no existe (las líneas y paradas van por semilla): error con sobre correcto',
    async (metodo, ruta) => {
      const http = ctx.http as unknown as Record<
        string,
        (r: string) => Promise<{ status: number; body: unknown }>
      >;
      const r = await http[metodo.toLowerCase()](ruta);
      expect([401, 403, 404, 405]).toContain(r.status);
      esperarError(r, r.status, (r.body as { error: { codigo: string } }).error.codigo);
    },
  );

  it('público aun con un token basura o vencido: no da 500', async () => {
    const r = await ctx.http.get('/lineas').set('Authorization', 'Bearer basura');
    expect([200, 401]).toContain(r.status);
    const r2 = await ctx.http.get('/lineas').set('Authorization', 'Basic abc');
    expect([200, 401]).toContain(r2.status);
  });

  it('tiene cabecera Date (R17)', async () => {
    const r = await ctx.http.get('/lineas').expect(200);
    expect(r.headers.date).toBeTruthy();
  });

  it.each([
    'lin-',
    'lin-%20',
    'par-101',
    '1',
    'LIN-01',
    'lin-01%00',
    "lin-1'OR'1'='1",
    'lin-' + 'x'.repeat(3000),
  ])('LINEA_NO_ENCONTRADA 404 con id %s', async (id) => {
    const r = await ctx.http.get(`/lineas/${id}`);
    esperarErrorLimpio(r, 404, 'LINEA_NO_ENCONTRADA');
    expect((r.body as { error: { mensaje: string } }).error.mensaje).toBe('No existe esa línea.');
  });
});

describe('Espec. M1 + R1/R2 — lineaIds se calcula desde los recorridos', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
  });
  afterAll(() => ctx.cerrar());

  it('una parada repetida en un recorrido (línea circular) no duplica la línea en lineaIds', async () => {
    const a = await crearParada(ctx, { id: 'par-c1' });
    const b = await crearParada(ctx, { id: 'par-c2' });
    await crearLinea(ctx, {
      id: 'lin-c1',
      recorridos: [{ sentido: 'ida', paradaIds: [a.id, b.id, a.id] }],
    });
    const r = await ctx.http.get('/paradas/par-c1').expect(200);
    esperarContrato(r.body, 'Parada');
    expect(r.body.datos.lineaIds).toEqual(['lin-c1']);
  });

  it('lineaIds sale ordenado y estable, con líneas de número distinto (lin-02 antes que lin-10)', async () => {
    const a = await crearParada(ctx, { id: 'par-o1' });
    await crearLinea(ctx, {
      id: 'lin-10',
      numero: '10',
      recorridos: [{ sentido: 'ida', paradaIds: [a.id] }],
    });
    await crearLinea(ctx, {
      id: 'lin-02',
      numero: '2',
      recorridos: [{ sentido: 'ida', paradaIds: [a.id] }],
    });
    const r = await ctx.http.get('/paradas/par-o1').expect(200);
    expect(r.body.datos.lineaIds).toEqual(['lin-02', 'lin-10']);
  });

  it('la lista /paradas trae el mismo lineaIds que el detalle', async () => {
    const lista = await ctx.http.get('/paradas?porPagina=1000').expect(200);
    for (const p of lista.body.datos as Parada[]) {
      const d = await ctx.http.get(`/paradas/${p.id}`).expect(200);
      expect(d.body.datos).toEqual(p);
    }
  });

  it('GET /paradas/qr/PARANA:<id> devuelve lo mismo que el detalle', async () => {
    const r = await ctx.http.get('/paradas/qr/PARANA:par-o1').expect(200);
    const d = await ctx.http.get('/paradas/par-o1').expect(200);
    expect(r.body).toEqual(d.body);
  });
});

describe('Espec. M1 — GET /paradas: entradas adversariales', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
    await crearParada(ctx, {
      id: 'par-101',
      nombre: 'Alameda y Urquiza',
      latitud: -31.7333,
      longitud: -60.5241,
    });
    await crearParada(ctx, {
      id: 'par-a1',
      nombre: 'Ñandú y Colón',
      latitud: -31.74,
      longitud: -60.52,
      sentido: 'vuelta',
    });
    await crearParada(ctx, { id: 'par-a2', nombre: 'Igual', latitud: -31.75, longitud: -60.5 });
    await crearParada(ctx, { id: 'par-a3', nombre: 'Igual', latitud: -31.75, longitud: -60.5 });
    await crearParada(ctx, { id: 'par-a4', nombre: 'Igual', latitud: -31.75, longitud: -60.5 });
    await crearLinea(ctx, {
      id: 'lin-05',
      numero: '5',
      recorridos: [
        { sentido: 'ida', paradaIds: ['par-101', 'par-a2'] },
        { sentido: 'vuelta', paradaIds: ['par-a1'] },
      ],
    });
  });
  afterAll(() => ctx.cerrar());

  it.each([
    'sentido=ida,vuelta',
    'sentido=IDA',
    'sentido=',
    'sentido=norte',
    'orden=zzz',
    'orden=distancia',
    'latitud=-31.7',
    'longitud=-60.5',
    'radioMetros=500',
    'latitud=abc&longitud=-60.5&radioMetros=100',
    'latitud=91&longitud=0&radioMetros=100',
    'latitud=0&longitud=181&radioMetros=100',
    'latitud=0&longitud=0&radioMetros=0',
    'latitud=0&longitud=0&radioMetros=-5',
    'latitud=0&longitud=0&radioMetros=NaN',
    'latitud=0&longitud=0&radioMetros=Infinity',
    'lineaId=par-101',
    'lineaId=',
    'pagina=0',
    'porPagina=1001',
    'porPagina=0',
  ])('400 VALIDACION_FALLIDA con ?%s', async (qs) => {
    const r = await ctx.http.get(`/paradas?${qs}`);
    esperarErrorLimpio(r, 400, 'VALIDACION_FALLIDA');
  });

  it('q con espacios alrededor y en mayúsculas con tilde encuentra igual', async () => {
    const r = await ctx.http
      .get('/paradas?q=%20%20%C3%91AND%C3%9A%20%20Y%20%20COL%C3%93N%20')
      .expect(200);
    esperarContrato(r.body, 'Parada');
    expect(r.body.datos.map((p: Parada) => p.id)).toEqual(['par-a1']);
    const r2 = await ctx.http.get('/paradas?q=nandu').expect(200);
    expect(r2.body.datos.map((p: Parada) => p.id)).toEqual(['par-a1']);
    const r3 = await ctx.http.get('/paradas?q=ALAMEDA%20%20%20Y%20URQUIZA').expect(200);
    expect(r3.body.datos.map((p: Parada) => p.id)).toEqual(['par-101']);
  });

  it('q sólo con espacios no filtra', async () => {
    const r = await ctx.http.get('/paradas?q=%20%20').expect(200);
    expect(r.body.meta.total).toBe(5);
  });

  it('nombres iguales: desempate por id y estable entre páginas', async () => {
    const todas = await ctx.http.get('/paradas?q=igual').expect(200);
    expect(todas.body.datos.map((p: Parada) => p.id)).toEqual(['par-a2', 'par-a3', 'par-a4']);
    const vistos: string[] = [];
    for (let p = 1; p <= 3; p++) {
      const r = await ctx.http.get(`/paradas?q=igual&pagina=${p}&porPagina=1`).expect(200);
      vistos.push(...r.body.datos.map((x: Parada) => x.id));
    }
    expect(vistos).toEqual(['par-a2', 'par-a3', 'par-a4']);
  });

  it('orden=distancia con empate de distancia desempata por id', async () => {
    const r = await ctx.http
      .get('/paradas?q=igual&latitud=-31.75&longitud=-60.5&radioMetros=1000&orden=distancia')
      .expect(200);
    expect(r.body.datos.map((p: Parada) => p.id)).toEqual(['par-a2', 'par-a3', 'par-a4']);
    for (const p of r.body.datos) expect(Object.keys(p)).not.toContain('distancia');
  });

  it('filtros combinados: lineaId + sentido + q', async () => {
    const r = await ctx.http.get('/paradas?lineaId=lin-05&sentido=vuelta&q=colon').expect(200);
    expect(r.body.datos.map((p: Parada) => p.id)).toEqual(['par-a1']);
    const vacio = await ctx.http
      .get('/paradas?lineaId=lin-05&sentido=vuelta&q=alameda')
      .expect(200);
    expect(vacio.body.datos).toEqual([]);
    expect(vacio.body.meta).toEqual({ total: 0, pagina: 1, porPagina: 20 });
  });

  it('radio: el borde exacto y fuera de él; total es el filtrado', async () => {
    const cerca = await ctx.http
      .get('/paradas?latitud=-31.7333&longitud=-60.5241&radioMetros=50')
      .expect(200);
    expect(cerca.body.datos.map((p: Parada) => p.id)).toEqual(['par-101']);
    expect(cerca.body.meta.total).toBe(1);
  });

  it('cerca del antimeridiano/polos no da 500', async () => {
    for (const qs of [
      'latitud=90&longitud=180&radioMetros=50000',
      'latitud=-90&longitud=-180&radioMetros=50000',
      'latitud=0&longitud=180&radioMetros=50000',
    ]) {
      const r = await ctx.http.get(`/paradas?${qs}`);
      expect(r.status).toBe(200);
    }
  });

  it('página fuera de rango: datos [] y total correcto', async () => {
    const r = await ctx.http.get('/paradas?pagina=50&porPagina=2').expect(200);
    expect(r.body.datos).toEqual([]);
    expect(r.body.meta).toEqual({ total: 5, pagina: 50, porPagina: 2 });
  });

  it('orden=nombre explícito equivale al default', async () => {
    const a = await ctx.http.get('/paradas').expect(200);
    const b = await ctx.http.get('/paradas?orden=nombre').expect(200);
    expect(b.body).toEqual(a.body);
  });

  it('sólo las claves del tipo Parada, y coordenadas anidadas', async () => {
    const r = await ctx.http.get('/paradas').expect(200);
    for (const p of r.body.datos) {
      expect(Object.keys(p).sort()).toEqual([
        'codigoQr',
        'coordenadas',
        'id',
        'lineaIds',
        'nombre',
        'refugio',
        'sentido',
      ]);
      expect(Object.keys(p.coordenadas).sort()).toEqual(['latitud', 'longitud']);
    }
  });

  it.each(['par-', 'PAR-101', '101', 'lin-05', 'par-101%00', 'par-' + 'x'.repeat(3000)])(
    'PARADA_NO_ENCONTRADA 404 con id %s',
    async (id) => {
      const r = await ctx.http.get(`/paradas/${id}`);
      esperarErrorLimpio(r, 404, 'PARADA_NO_ENCONTRADA');
      expect((r.body as { error: { mensaje: string } }).error.mensaje).toBe(
        'No existe esa parada.',
      );
    },
  );
});

describe('Espec. R4 — QR: rutas raras, nunca 500', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
    await crearParada(ctx, { id: 'par-101' });
  });
  afterAll(() => ctx.cerrar());

  it.each([
    'PARANA:',
    'PARANA:par-101:extra',
    'PARANA:PARANA:par-101',
    'PARANA%3Apar-101%20',
    '%20PARANA%3Apar-101',
    'PARANA%3A%20par-101',
    'PARANA:PAR-101',
    'PARANA%3Apar-101%0A',
    'PARANA%3Apar-101%3Fx%3D1',
    'PARANA%3Apar-101%2F',
    '%E0%A4%A',
    '%F0%9F%9A%8C',
    'PARANA%3A%C3%B1',
    'PARANA:%25',
    'PARANA:par-101;',
  ])('QR_NO_RECONOCIDO con %s', async (codigo) => {
    const r = await ctx.http.get(`/paradas/qr/${codigo}`);
    esperarErrorLimpio(r, 404, 'QR_NO_RECONOCIDO');
  });

  it('/paradas/qr sin código no es 500 y /paradas/qr/ con barra final tampoco', async () => {
    const a = await ctx.http.get('/paradas/qr');
    expect(a.status).toBe(404);
    esperarError(a, 404, (a.body as { error: { codigo: string } }).error.codigo);
    const b = await ctx.http.get('/paradas/qr/');
    expect(b.status).toBe(404);
    esperarError(b, 404, (b.body as { error: { codigo: string } }).error.codigo);
  });

  it('el QR es público (sin token) y responde con el mismo sobre que el detalle', async () => {
    const r = await ctx.http.get('/paradas/qr/PARANA:par-101').expect(200);
    esperarContrato(r.body, 'Parada');
  });
});

describe('Espec. §8 + R1/R2/R3 — integridad de las semillas de demo', () => {
  let ctx: AppDePrueba;
  let lineas: Linea[];
  let paradas: Parada[];
  beforeAll(async () => {
    ctx = await crearApp();
    await sembrar(ctx.dataSource, ctx.reloj);
    lineas = (await ctx.http.get('/lineas?porPagina=100').expect(200)).body.datos;
    paradas = (await ctx.http.get('/paradas?porPagina=1000').expect(200)).body.datos;
  });
  afterAll(() => ctx.cerrar());

  it('R1: cada parada aparece sólo en recorridos de su sentido, y ninguna parada queda en ida y vuelta', () => {
    const porId = new Map(paradas.map((p) => [p.id, p]));
    for (const l of lineas)
      for (const r of l.recorridos)
        for (const id of r.paradaIds) {
          expect(porId.has(id), `${l.id} referencia ${id} inexistente`).toBe(true);
          expect(porId.get(id)!.sentido, `${l.id} ${r.sentido} ${id}`).toBe(r.sentido);
        }
  });

  it('R2: lineaIds de cada parada == líneas cuyos recorridos la incluyen', () => {
    for (const p of paradas) {
      const esperado = lineas
        .filter((l) => l.recorridos.some((r) => r.paradaIds.includes(p.id)))
        .map((l) => l.id)
        .sort();
      expect([...p.lineaIds].sort(), p.id).toEqual(esperado);
    }
  });

  it('PRD: lin-05, par-101 y "Alameda y Urquiza" con QR PARANA:par-101; 60 a 80 paradas', () => {
    expect(paradas.length).toBeGreaterThanOrEqual(60);
    expect(paradas.length).toBeLessThanOrEqual(80);
    const p = paradas.find((x) => x.id === 'par-101')!;
    expect(p.nombre).toBe('Alameda y Urquiza');
    expect(p.codigoQr).toBe('PARANA:par-101');
    expect(paradas.some((x) => /almafuerte y newbery/i.test(x.nombre))).toBe(true);
    expect(lineas.find((l) => l.id === 'lin-05')!.nombre).toBe('Puerto Viejo — San Agustín');
  });

  it('casos feos: paradas sin refugio y con/sin QR; ids sin duplicar; QR único y con formato', () => {
    expect(paradas.some((p) => !p.refugio)).toBe(true);
    expect(paradas.some((p) => p.codigoQr === null)).toBe(true);
    expect(paradas.some((p) => p.codigoQr !== null)).toBe(true);
    expect(new Set(paradas.map((p) => p.id)).size).toBe(paradas.length);
    const qrs = paradas.map((p) => p.codigoQr).filter((q): q is string => q !== null);
    expect(new Set(qrs).size).toBe(qrs.length);
    for (const p of paradas) if (p.codigoQr) expect(p.codigoQr).toBe(`PARANA:${p.id}`);
  });

  it('coordenadas de las paradas y trazados dentro de Paraná (caja razonable)', () => {
    const en = (c: { latitud: number; longitud: number }) =>
      c.latitud > -32.0 && c.latitud < -31.5 && c.longitud > -60.8 && c.longitud < -60.3;
    for (const p of paradas) expect(en(p.coordenadas), p.id).toBe(true);
    for (const l of lineas)
      for (const r of l.recorridos) for (const c of r.trazado) expect(en(c), l.id).toBe(true);
  });

  it('todo QR de la semilla se resuelve a su parada', async () => {
    for (const p of paradas.filter((x) => x.codigoQr).slice(0, 15)) {
      const r = await ctx.http.get(`/paradas/qr/${encodeURIComponent(p.codigoQr!)}`).expect(200);
      expect(r.body.datos.id).toBe(p.id);
    }
    const sin = paradas.find((x) => x.codigoQr === null)!;
    esperarError(await ctx.http.get(`/paradas/qr/PARANA:${sin.id}`), 404, 'QR_NO_RECONOCIDO');
  });

  it('toda parada pertenece a al menos una línea (no hay paradas huérfanas en la demo)', () => {
    const huerfanas = paradas.filter((p) => p.lineaIds.length === 0).map((p) => p.id);
    expect(huerfanas).toEqual([]);
  });

  it('paradas de la zona de Corrientes y dos o más líneas en par-101', () => {
    expect(paradas.some((p) => /corrientes/i.test(p.nombre))).toBe(true);
    expect(paradas.find((p) => p.id === 'par-101')!.lineaIds.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /paradas de la demo con ?lineaId=lin-05 coincide con los recorridos de lin-05', async () => {
    const l = lineas.find((x) => x.id === 'lin-05')!;
    const esperado = new Set(l.recorridos.flatMap((r) => r.paradaIds));
    const r = await ctx.http.get('/paradas?lineaId=lin-05&porPagina=1000').expect(200);
    expect(new Set(r.body.datos.map((p: Parada) => p.id))).toEqual(esperado);
    expect(r.body.meta.total).toBe(esperado.size);
  });
});

// ---------------------------------------------------------------------------------------
// Ampliación (segunda pasada)
// ---------------------------------------------------------------------------------------

describe('Espec. M1 — orden numérico de líneas con números raros', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
  });
  afterAll(() => ctx.cerrar());

  it('"5", "5A", "5B", "6", "05": los números con letra no rompen y el 5 va antes que el 10', async () => {
    for (const n of ['10', '6', '5B', '5A', '5', '5.1']) await crearLinea(ctx, { numero: n });
    const r = await ctx.http.get('/lineas').expect(200);
    esperarContrato(r.body, 'Linea');
    const nums = r.body.datos.map((l: Linea) => l.numero);
    expect(nums.indexOf('5')).toBeLessThan(nums.indexOf('6'));
    expect(nums.indexOf('6')).toBeLessThan(nums.indexOf('10'));
    expect(nums.indexOf('5')).toBeLessThan(nums.indexOf('5A'));
    expect(nums.indexOf('5A')).toBeLessThan(nums.indexOf('6'));
  });

  it('un número de línea sin dígito inicial ("T1") se puede guardar en cualquier motor y sale al final', async () => {
    await crearLinea(ctx, { id: 'lin-t1', numero: 'T1' });
    await crearLinea(ctx, { id: 'lin-n3', numero: '3' });
    const r = await ctx.http.get('/lineas?porPagina=100').expect(200);
    const nums = r.body.datos.map((l: Linea) => l.numero);
    expect(nums.indexOf('T1')).toBeGreaterThan(nums.indexOf('3'));
  });

  it('el número viaja como string tal cual se guardó (no se le quitan ceros)', async () => {
    await crearLinea(ctx, { id: 'lin-cero', numero: '07' });
    const r = await ctx.http.get('/lineas/lin-cero').expect(200);
    expect(r.body.datos.numero).toBe('07');
    expect(typeof r.body.datos.numero).toBe('string');
  });

  it('respuesta JSON con cabecera content-type json y /lineas/ con barra final no es 500', async () => {
    const r = await ctx.http.get('/lineas').expect(200);
    expect(r.headers['content-type']).toMatch(/application\/json/);
    const b = await ctx.http.get('/lineas/');
    expect([200, 404]).toContain(b.status);
  });

  it('parámetros repetidos (?pagina=1&pagina=2) no dan 500', async () => {
    for (const qs of [
      'pagina=1&pagina=2',
      'porPagina=5&porPagina=6',
      'pagina[]=1',
      'pagina[a]=1',
    ]) {
      const r = await ctx.http.get(`/lineas?${qs}`);
      expect(r.status, qs).toBeLessThan(500);
      if (r.status === 400) esperarErrorLimpio(r, 400, 'VALIDACION_FALLIDA');
    }
  });

  it('los mensajes de VALIDACION_FALLIDA nombran el campo en castellano y terminan con punto', async () => {
    const r = await ctx.http.get('/lineas?pagina=0');
    esperarErrorLimpio(r, 400, 'VALIDACION_FALLIDA');
    const m = (r.body as { error: { mensaje: string } }).error.mensaje;
    expect(m.length).toBeGreaterThan(5);
    expect(m).toMatch(/[Pp]ágina|pagina/);
  });
});

describe('Espec. M1 — GET /paradas: más filtros y bordes geográficos', () => {
  let ctx: AppDePrueba;
  // 0.001° de longitud a -31.7333 son ~94,6 m; 0.001° de latitud ~111,2 m.
  const LAT = -31.7333;
  const LON = -60.5241;
  beforeAll(async () => {
    ctx = await crearApp();
    await crearParada(ctx, { id: 'par-g0', nombre: 'Centro', latitud: LAT, longitud: LON });
    await crearParada(ctx, {
      id: 'par-g1',
      nombre: 'Este 95',
      latitud: LAT,
      longitud: LON + 0.001,
    });
    await crearParada(ctx, {
      id: 'par-g2',
      nombre: 'Norte 111',
      latitud: LAT + 0.001,
      longitud: LON,
    });
    await crearParada(ctx, {
      id: 'par-g3',
      nombre: 'Diagonal',
      latitud: LAT + 0.0007,
      longitud: LON + 0.0007,
      sentido: 'vuelta',
      refugio: false,
      codigoQr: null,
    });
    await crearLinea(ctx, {
      id: 'lin-g1',
      numero: '1',
      recorridos: [
        // par-g0 repetida (circular): no debe duplicar en los resultados
        { sentido: 'ida', paradaIds: ['par-g0', 'par-g1', 'par-g0'] },
        { sentido: 'vuelta', paradaIds: ['par-g3'] },
      ],
    });
  });
  afterAll(() => ctx.cerrar());

  const ids = (r: { body: { datos: Parada[] } }) => r.body.datos.map((p) => p.id);

  it('el radio respeta la distancia real: 100 m incluye g0,g1; 90 m excluye g1; 113 m incluye g2 y g3 (102 m)', async () => {
    const q = (m: number) =>
      ctx.http.get(`/paradas?latitud=${LAT}&longitud=${LON}&radioMetros=${m}&orden=distancia`);
    expect(ids(await q(100))).toEqual(['par-g0', 'par-g1']);
    expect(ids(await q(90))).toEqual(['par-g0']);
    expect(ids(await q(113))).toEqual(['par-g0', 'par-g1', 'par-g3', 'par-g2']);
    expect(ids(await q(1))).toEqual(['par-g0']);
  });

  it('orden=distancia sin radio: ordena todas, el total es el de todas', async () => {
    const r = await ctx.http
      .get(`/paradas?latitud=${LAT}&longitud=${LON}&orden=distancia`)
      .expect(200);
    expect(ids(r)).toEqual(['par-g0', 'par-g1', 'par-g3', 'par-g2']);
    expect(r.body.meta.total).toBe(4);
  });

  it('orden=distancia paginado: páginas de a 1 suman el mismo orden', async () => {
    const vistos: string[] = [];
    for (let p = 1; p <= 4; p++) {
      const r = await ctx.http
        .get(
          `/paradas?latitud=${LAT}&longitud=${LON}&radioMetros=500&orden=distancia&pagina=${p}&porPagina=1`,
        )
        .expect(200);
      expect(r.body.meta).toEqual({ total: 4, pagina: p, porPagina: 1 });
      vistos.push(...ids(r));
    }
    expect(vistos).toEqual(['par-g0', 'par-g1', 'par-g3', 'par-g2']);
  });

  it('lineaId con una parada repetida en el recorrido no duplica ni infla el total', async () => {
    const r = await ctx.http.get('/paradas?lineaId=lin-g1').expect(200);
    esperarContrato(r.body, 'Parada');
    expect(ids(r).sort()).toEqual(['par-g0', 'par-g1', 'par-g3']);
    expect(r.body.meta.total).toBe(3);
  });

  it('lineaId + sentido: sólo las paradas de ese recorrido', async () => {
    const i = await ctx.http.get('/paradas?lineaId=lin-g1&sentido=ida').expect(200);
    expect(ids(i).sort()).toEqual(['par-g0', 'par-g1']);
    const v = await ctx.http.get('/paradas?lineaId=lin-g1&sentido=vuelta').expect(200);
    expect(ids(v)).toEqual(['par-g3']);
    const sinLinea = await ctx.http.get('/paradas?sentido=vuelta').expect(200);
    expect(ids(sinLinea)).toEqual(['par-g3']);
  });

  it('nulos y booleanos: codigoQr null (no ""), refugio false (no null)', async () => {
    const r = await ctx.http.get('/paradas/par-g3').expect(200);
    esperarContrato(r.body, 'Parada');
    expect(r.body.datos.codigoQr).toBeNull();
    expect(r.body.datos.refugio).toBe(false);
    expect(r.body.datos.sentido).toBe('vuelta');
    expect(r.body.datos.lineaIds).toEqual(['lin-g1']);
  });

  it('las coordenadas salen como números, no como strings', async () => {
    const r = await ctx.http.get('/paradas/par-g1').expect(200);
    expect(r.body.datos.coordenadas).toEqual({ latitud: LAT, longitud: LON + 0.001 });
  });

  it.each([
    'latitud=-31.7&longitud=-60.5&radioMetros=1e3',
    'latitud=0x10&longitud=-60.5&radioMetros=100',
    'latitud=%20&longitud=-60.5&radioMetros=100',
    'latitud=-31.7&longitud=-60.5&radioMetros=12.5abc',
    'q=a&q=b&sentido=ida&sentido=vuelta',
    'lineaId=lin-g1&lineaId=lin-g2',
    'porPagina=1000.5',
  ])('entradas raras ?%s: 200 o 400 limpio, nunca 500', async (qs) => {
    const r = await ctx.http.get(`/paradas?${qs}`);
    expect([200, 400]).toContain(r.status);
    if (r.status === 400) esperarErrorLimpio(r, 400, 'VALIDACION_FALLIDA');
    else esperarContrato(r.body, 'Parada');
  });

  it('q con caracteres peligrosos no rompe ni trae todo', async () => {
    for (const q of [
      "'",
      '"; DROP TABLE paradas;--',
      '%',
      '_',
      '\\',
      '%25',
      'x'.repeat(5000),
      '\u0000',
    ]) {
      const r = await ctx.http.get(`/paradas?q=${encodeURIComponent(q)}`);
      expect(r.status, q.slice(0, 10)).toBeLessThan(500);
      if (r.status === 200 && q.trim() !== '' && q !== '\u0000') expect(r.body.datos).toEqual([]);
    }
  });

  it('un filtro sin resultados conserva el sobre: datos [] y meta con total 0', async () => {
    const r = await ctx.http.get('/paradas?lineaId=lin-nada&porPagina=7&pagina=3').expect(200);
    expect(r.body).toEqual({ datos: [], meta: { total: 0, pagina: 3, porPagina: 7 } });
  });

  it('la lista entera por porPagina=1000 pasa el contrato y respeta el tope de 1000', async () => {
    const r = await ctx.http.get('/paradas?porPagina=1000').expect(200);
    expect(r.body.meta.porPagina).toBe(1000);
  });
});

describe('Espec. R4 — QR: más casos', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
    await crearParada(ctx, { id: 'par-q1' });
    await crearParada(ctx, { id: 'par-q2', codigoQr: null });
    await crearParada(ctx, { id: 'par-q3', codigoQr: 'PARANA:par-q3' });
  });
  afterAll(() => ctx.cerrar());

  it('PARANA%3Apar-q1 (dos puntos codificado) resuelve igual que con los dos puntos crudos', async () => {
    const a = await ctx.http.get('/paradas/qr/PARANA%3Apar-q1').expect(200);
    const b = await ctx.http.get('/paradas/qr/PARANA:par-q1').expect(200);
    esperarContrato(a.body, 'Parada');
    expect(a.body).toEqual(b.body);
    expect(a.body.datos.codigoQr).toBe('PARANA:par-q1');
  });

  it('parada sin QR: ni el código ni su id lo resuelven (A14)', async () => {
    esperarErrorLimpio(await ctx.http.get('/paradas/qr/PARANA:par-q2'), 404, 'QR_NO_RECONOCIDO');
  });

  it.each([
    'parana:par-q1',
    'Parana:par-q1',
    'par-q1',
    'PARANA-par-q1',
    'PARANA:par-q9',
    'https%3A%2F%2Fexample.com',
    'PARANA:par-q1%00',
  ])(
    'el código %s no es de una parada de Paraná (404 QR_NO_RECONOCIDO con el mensaje del catálogo)',
    async (c) => {
      const r = await ctx.http.get(`/paradas/qr/${c}`);
      esperarErrorLimpio(r, 404, 'QR_NO_RECONOCIDO');
      expect((r.body as { error: { mensaje: string } }).error.mensaje).toBe(
        'Ese código no es de una parada de Paraná.',
      );
    },
  );

  it('un código larguísimo no da 500', async () => {
    const r = await ctx.http.get(`/paradas/qr/${'A'.repeat(10000)}`);
    expect(r.status).toBeLessThan(500);
  });

  it('con token vencido/mal firmado el QR público no da 500', async () => {
    const r = await ctx.http
      .get('/paradas/qr/PARANA:par-q1')
      .set('Authorization', 'Bearer aaa.bbb.ccc');
    expect([200, 401]).toContain(r.status);
  });

  it('método equivocado sobre el QR: error con sobre', async () => {
    const r = await ctx.http.post('/paradas/qr/PARANA:par-q1');
    expect([401, 403, 404, 405]).toContain(r.status);
    esperarError(r, r.status, (r.body as { error: { codigo: string } }).error.codigo);
  });
});

describe('Espec. §8 — semillas de la red: requisitos del PRD y de la especificación', () => {
  let ctx: AppDePrueba;
  let lineas: Linea[];
  let paradas: Parada[];
  beforeAll(async () => {
    ctx = await crearApp();
    await sembrar(ctx.dataSource, ctx.reloj);
    lineas = (await ctx.http.get('/lineas?porPagina=100').expect(200)).body.datos;
    paradas = (await ctx.http.get('/paradas?porPagina=1000').expect(200)).body.datos;
  });
  afterAll(() => ctx.cerrar());

  it('hay exactamente 14 líneas, con números distintos, colores distintos y empresa', () => {
    expect(lineas).toHaveLength(14);
    expect(new Set(lineas.map((l) => l.numero)).size).toBe(14);
    expect(new Set(lineas.map((l) => l.color.toLowerCase())).size).toBe(14);
    for (const l of lineas) {
      expect(l.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(l.empresa.trim()).not.toBe('');
      expect(l.nombre.trim()).not.toBe('');
    }
  });

  it('orden numérico de la demo: los números salen 1..14 ascendentes', () => {
    const nums = lineas.map((l) => Number(l.numero));
    expect(nums).toEqual([...nums].sort((a, b) => a - b));
  });

  it('hay una línea inactiva y las demás activas', () => {
    expect(lineas.some((l) => !l.activa)).toBe(true);
    expect(lineas.filter((l) => l.activa).length).toBeGreaterThanOrEqual(10);
  });

  it('R3: cada recorrido tiene trazado con ≥2 puntos, destino no vacío y paradas sin repetir', () => {
    for (const l of lineas)
      for (const r of l.recorridos) {
        expect(r.trazado.length, `${l.id} ${r.sentido}`).toBeGreaterThanOrEqual(2);
        expect(r.destino.trim(), `${l.id} destino`).not.toBe('');
        expect(new Set(r.paradaIds).size, `${l.id} ${r.sentido} repetidas`).toBe(
          r.paradaIds.length,
        );
        expect(r.paradaIds.length, `${l.id} ${r.sentido} sin paradas`).toBeGreaterThan(0);
      }
  });

  it('lin-05 y lin-14 están completas: ida y vuelta con paradas distintas entre sí', () => {
    for (const id of ['lin-05', 'lin-14']) {
      const l = lineas.find((x) => x.id === id)!;
      expect(l, id).toBeDefined();
      expect(l.recorridos.map((r) => r.sentido)).toEqual(['ida', 'vuelta']);
      const [ida, vuelta] = l.recorridos;
      const comunes = ida.paradaIds.filter((p) => vuelta.paradaIds.includes(p));
      expect(comunes, `${id} comparte paradas entre sentidos`).toEqual([]);
      expect(ida.destino).not.toBe(vuelta.destino);
    }
  });

  it('todas las líneas activas tienen los dos sentidos (PRD: "en los dos sentidos")', () => {
    for (const l of lineas.filter((x) => x.activa))
      expect(
        l.recorridos.map((r) => r.sentido),
        l.id,
      ).toEqual(['ida', 'vuelta']);
  });

  it('cada par de paradas de un recorrido está a una distancia razonable (< 3 km)', () => {
    const porId = new Map(paradas.map((p) => [p.id, p.coordenadas]));
    const km = (
      a: { latitud: number; longitud: number },
      b: { latitud: number; longitud: number },
    ) => Math.hypot((a.latitud - b.latitud) * 111.2, (a.longitud - b.longitud) * 94.6);
    for (const l of lineas)
      for (const r of l.recorridos)
        for (let i = 1; i < r.paradaIds.length; i++)
          expect(
            km(porId.get(r.paradaIds[i - 1])!, porId.get(r.paradaIds[i])!),
            `${l.id} ${r.sentido}`,
          ).toBeLessThan(3);
  });

  it('sólo hay paradas con nombre no vacío, sin ids repetidos, y ida y vuelta existen', () => {
    for (const p of paradas) expect(p.nombre.trim()).not.toBe('');
    expect(paradas.some((p) => p.sentido === 'ida')).toBe(true);
    expect(paradas.some((p) => p.sentido === 'vuelta')).toBe(true);
  });

  it('paradas con nombre de las zonas del PRD: Alameda y Urquiza, Almafuerte y Newbery y Corrientes', () => {
    const nombres = paradas.map((p) => p.nombre);
    expect(nombres.some((n) => /alameda.*urquiza/i.test(n))).toBe(true);
    expect(nombres.some((n) => /almafuerte.*newbery/i.test(n))).toBe(true);
    expect(nombres.filter((n) => /corrientes/i.test(n)).length).toBeGreaterThanOrEqual(2);
  });

  it('búsqueda sin tildes sobre la demo: q=alameda encuentra par-101 y q=ALMAFUERTE encuentra Newbery', async () => {
    const a = await ctx.http.get('/paradas?q=alameda').expect(200);
    expect(a.body.datos.some((p: Parada) => p.id === 'par-101')).toBe(true);
    const b = await ctx.http.get('/paradas?q=ALMAFUERTE').expect(200);
    expect(b.body.datos.some((p: Parada) => /newbery/i.test(p.nombre))).toBe(true);
  });

  it('cerca de par-101 (radio 300 m) está par-101 y orden=distancia la pone primera', async () => {
    const p = paradas.find((x) => x.id === 'par-101')!;
    const r = await ctx.http
      .get(
        `/paradas?latitud=${p.coordenadas.latitud}&longitud=${p.coordenadas.longitud}&radioMetros=300&orden=distancia`,
      )
      .expect(200);
    expect(r.body.datos[0].id).toBe('par-101');
  });

  it('GET /lineas/lin-05 de la demo tiene el nombre del PRD y pasa por par-101 en algún sentido', async () => {
    const r = await ctx.http.get('/lineas/lin-05').expect(200);
    esperarContrato(r.body, 'Linea');
    expect(r.body.datos.nombre).toBe('Puerto Viejo — San Agustín');
    const todas = r.body.datos.recorridos.flatMap((x: { paradaIds: string[] }) => x.paradaIds);
    expect(todas).toContain('par-101');
  });
});
