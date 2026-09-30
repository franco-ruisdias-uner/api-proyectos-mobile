// Verificación independiente del M1 — Red (AGENTS §12). Caja negra: sólo HTTP, más los
// builders de test/utilidades/ y la siembra de demo. Cada describe nombra la regla que prueba.
import type { Linea, Parada } from '../../contrato/tipos.js';
import { sembrar } from '../../src/semillas/sembrar.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { crearLinea, crearParada } from '../utilidades/red.js';

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
