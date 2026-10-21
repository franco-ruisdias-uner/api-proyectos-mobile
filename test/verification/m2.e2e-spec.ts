// Verificación independiente de M2 — Promociones (lectura) (ESPECIFICACION §4 M2; R4, R5; D4).
// Caja negra: sólo HTTP, contrato y builders de test.
import { sign } from 'node:crypto';
import { crearComercio, crearRubro } from '../utilities/businesses.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import { type AppDePrueba, crearApp } from '../utilities/create-app.js';
import { crearPromocion } from '../utilities/promotions.js';
import { crearUsuario } from '../utilities/users.js';

void sign;

const JERGA =
  /should|must|property|undefined|null\b|Cannot|Error:|Exception|Unauthorized|Forbidden|Not Found|Bad Request|Internal|SQL|SQLITE|QueryFailed|JSON|stack|\bstring\b|\bnumber\b|\bboolean\b/i;
const mensajeDe = (b: unknown) => (b as { error: { mensaje: string } }).error.mensaje;
const ids = (res: { body: { datos: { id: string }[] } }) => res.body.datos.map((p) => p.id);
const MIN = 60_000;
const DIA = 24 * 60 * MIN;
const en = (t: AppDePrueba, ms: number) => new Date(t.reloj.ahora().getTime() + ms);

async function base(t: AppDePrueba) {
  await crearRubro(t, { id: 'rub-x' });
  await crearComercio(t, { id: 'com-1', rubroId: 'rub-x' });
}

describe('R5 — límites exactos de vigente / por vencer / próxima (D4)', () => {
  let t: AppDePrueba;
  beforeAll(async () => {
    t = await crearApp();
    await base(t);
    await crearPromocion(t, { id: 'pro-hastaahora', comercioId: 'com-1', hasta: en(t, 0) });
    await crearPromocion(t, { id: 'pro-hastaayer1ms', comercioId: 'com-1', hasta: en(t, -1) });
    await crearPromocion(t, { id: 'pro-desdeahora', comercioId: 'com-1', desde: en(t, 0) });
    await crearPromocion(t, {
      id: 'pro-desde1ms',
      comercioId: 'com-1',
      desde: en(t, 1),
      hasta: en(t, DIA),
    });
    await crearPromocion(t, { id: 'pro-hasta3d', comercioId: 'com-1', hasta: en(t, 3 * DIA) });
    await crearPromocion(t, {
      id: 'pro-hasta3d1s',
      comercioId: 'com-1',
      hasta: en(t, 3 * DIA + 1000),
    });
    await crearPromocion(t, {
      id: 'pro-desde7d',
      comercioId: 'com-1',
      desde: en(t, 7 * DIA),
      hasta: en(t, 20 * DIA),
    });
    await crearPromocion(t, {
      id: 'pro-desde7d1s',
      comercioId: 'com-1',
      desde: en(t, 7 * DIA + 1000),
      hasta: en(t, 20 * DIA),
    });
  });
  afterAll(() => t.cerrar());

  it('vigentes: incluye hasta==ahora y desde==ahora; excluye vencida por 1ms y desde en el futuro', async () => {
    const res = await t.http().get('/promociones?porPagina=100').expect(200);
    const l = ids(res);
    expect(l).toContain('pro-hastaahora');
    expect(l).toContain('pro-desdeahora');
    expect(l).not.toContain('pro-hastaayer1ms');
    expect(l).not.toContain('pro-desde1ms');
    expect(l).not.toContain('pro-desde7d');
  });

  it('por-vencer: 3 días exactos entra, 3 días y 1 segundo no; nunca una próxima', async () => {
    const l = ids(await t.http().get('/promociones?estado=por-vencer&porPagina=100').expect(200));
    expect(l).toContain('pro-hasta3d');
    expect(l).toContain('pro-hastaahora');
    expect(l).not.toContain('pro-hasta3d1s');
    expect(l).not.toContain('pro-desde1ms');
  });

  it('proximas: 7 días exactos entra, 7 días y 1 segundo no; una que empieza ya no es próxima', async () => {
    const l = ids(await t.http().get('/promociones?estado=proximas&porPagina=100').expect(200));
    expect(l).toContain('pro-desde1ms');
    expect(l).toContain('pro-desde7d');
    expect(l).not.toContain('pro-desde7d1s');
    expect(l).not.toContain('pro-desdeahora');
  });

  it('con milisegundos en la base, el instante sale sin milisegundos y con -03:00', async () => {
    await crearPromocion(t, {
      id: 'pro-ms1',
      comercioId: 'com-1',
      desde: new Date('2026-10-02T15:00:00.789Z'),
      hasta: new Date('2026-10-20T15:30:45.123Z'),
    });
    const res = await t.http().get('/promociones/pro-ms1').expect(200);
    esperarContrato(res.body, 'Promocion');
    expect(res.body.datos.desde).toBe('2026-10-02T12:00:00-03:00');
    expect(res.body.datos.hasta).toBe('2026-10-20T12:30:45-03:00');
  });
});

describe('Reloj — medianoche, fin de mes y 31/12 en Buenos Aires', () => {
  let t: AppDePrueba;
  beforeAll(async () => {
    t = await crearApp({ ahora: '2026-12-31T23:59:59-03:00' });
    await base(t);
    await crearPromocion(t, {
      id: 'pro-ano',
      comercioId: 'com-1',
      desde: new Date('2026-12-01T03:00:00Z'),
      hasta: new Date('2027-01-01T02:59:59Z'), // 23:59:59 del 31/12 en BA
    });
    await crearPromocion(t, {
      id: 'pro-enero',
      comercioId: 'com-1',
      desde: new Date('2027-01-01T03:00:00Z'), // 00:00 del 1/1 en BA
      hasta: new Date('2027-01-31T02:59:59Z'),
    });
  });
  afterAll(() => t.cerrar());

  it('23:59:59 del 31/12: pro-ano vigente y por vencer, pro-enero próxima', async () => {
    const v = await t.http().get('/promociones').expect(200);
    expect(ids(v)).toEqual(['pro-ano']);
    esperarContrato(v.body, 'Promocion');
    expect(v.body.datos[0].hasta).toBe('2026-12-31T23:59:59-03:00');
    expect(ids(await t.http().get('/promociones?estado=por-vencer').expect(200))).toEqual([
      'pro-ano',
    ]);
    const p = await t.http().get('/promociones?estado=proximas').expect(200);
    expect(ids(p)).toEqual(['pro-enero']);
    expect(p.body.datos[0].desde).toBe('2027-01-01T00:00:00-03:00');
  });

  it('00:00 del 1/1: se invierten', async () => {
    t.reloj.fijar('2027-01-01T00:00:00-03:00');
    expect(ids(await t.http().get('/promociones').expect(200))).toEqual(['pro-enero']);
    await t.http().get('/promociones/pro-ano').expect(410);
    expect(ids(await t.http().get('/promociones?estado=proximas').expect(200))).toEqual([]);
  });

  it('el reloj del proceso no influye: 02:59:59Z del 1/1 todavía es 31/12 en BA', async () => {
    t.reloj.fijar('2027-01-01T02:59:59Z');
    expect(ids(await t.http().get('/promociones').expect(200))).toEqual(['pro-ano']);
  });
});

describe('Orden, desempate y paginación estable', () => {
  let t: AppDePrueba;
  const mismo = new Date('2026-10-10T15:00:00Z');
  beforeAll(async () => {
    t = await crearApp();
    await base(t);
    for (const id of ['pro-e', 'pro-b', 'pro-d', 'pro-a', 'pro-c'])
      await crearPromocion(t, { id, comercioId: 'com-1', hasta: mismo });
    await crearPromocion(t, { id: 'pro-temprana', comercioId: 'com-1', hasta: en(t, DIA) });
    for (const id of ['pro-q3', 'pro-q1', 'pro-q2'])
      await crearPromocion(t, {
        id,
        comercioId: 'com-1',
        desde: en(t, 2 * DIA),
        hasta: en(t, 30 * DIA),
      });
  });
  afterAll(() => t.cerrar());

  it('vigentes: por hasta asc y empates por id', async () => {
    const res = await t.http().get('/promociones').expect(200);
    expect(ids(res)).toEqual(['pro-temprana', 'pro-a', 'pro-b', 'pro-c', 'pro-d', 'pro-e']);
  });

  it('próximas: por desde asc y empates por id', async () => {
    const res = await t.http().get('/promociones?estado=proximas').expect(200);
    expect(ids(res)).toEqual(['pro-q1', 'pro-q2', 'pro-q3']);
  });

  it('recorrer las páginas de a 2 no repite ni pierde nada', async () => {
    const todos: string[] = [];
    for (let pagina = 1; pagina <= 4; pagina++) {
      const res = await t.http().get(`/promociones?pagina=${pagina}&porPagina=2`).expect(200);
      expect(res.body.meta).toEqual({ total: 6, pagina, porPagina: 2 });
      todos.push(...ids(res));
    }
    expect(todos).toEqual(['pro-temprana', 'pro-a', 'pro-b', 'pro-c', 'pro-d', 'pro-e']);
  });

  it('página fuera de rango: datos [] y total correcto, en cada estado', async () => {
    for (const [estado, total] of [
      ['vigentes', 6],
      ['por-vencer', 1],
      ['proximas', 3],
    ] as const) {
      const res = await t.http().get(`/promociones?estado=${estado}&pagina=50`).expect(200);
      esperarContrato(res.body, 'Promocion');
      expect(res.body.datos).toEqual([]);
      expect(res.body.meta).toEqual({ total, pagina: 50, porPagina: 20 });
    }
  });

  it('porPagina=100 es el máximo válido y porPagina=1 anda', async () => {
    await t.http().get('/promociones?porPagina=100').expect(200);
    const res = await t.http().get('/promociones?porPagina=1').expect(200);
    expect(res.body.datos).toHaveLength(1);
  });
});

describe('Entrada — parámetros inválidos', () => {
  let t: AppDePrueba;
  beforeAll(async () => {
    t = await crearApp();
    await base(t);
  });
  afterAll(() => t.cerrar());

  it.each([
    'estado=VIGENTES',
    'estado=por_vencer',
    'estado=vencidas',
    'estado=vigentes&estado=proximas',
    'pagina=-1',
    'pagina=abc',
    'pagina=1.5',
    'porPagina=0',
    'porPagina=-5',
    'porPagina=1.5',
    'porPagina=abc',
    'abiertoAhora=true',
    'distancia=1',
    'latitud=-32.4',
    'q=algo',
    'rubroId=rub-',
    'rubroId=RUB-x',
    'comercioId=com-',
    'comercioId=pro-441',
    'comercioId=',
    'rubroId=',
  ])('400 con ?%s, con sobre exacto y mensaje en castellano', async (consulta) => {
    const res = await t.http().get(`/promociones?${consulta}`).expect(400);
    esperarError(res.body, 'VALIDACION_FALLIDA');
    expect(mensajeDe(res.body)).not.toMatch(JERGA);
    expect(mensajeDe(res.body).length).toBeGreaterThan(5);
  });

  it('un inyección en rubroId no es 500', async () => {
    const res = await t
      .http()
      .get(`/promociones?rubroId=${encodeURIComponent("rub-x' OR 1=1 --")}`);
    expect([400, 200]).toContain(res.status);
  });
});

describe('Forma — nulos, llenos y campos de más', () => {
  let t: AppDePrueba;
  beforeAll(async () => {
    t = await crearApp();
    await base(t);
    await crearPromocion(t, {
      id: 'pro-vacia',
      comercioId: 'com-1',
      descuento: null,
      imagenClave: null,
      soloApp: false,
    });
    await crearPromocion(t, {
      id: 'pro-llena',
      comercioId: 'com-1',
      descuento: 100,
      soloApp: true,
      usos: 12,
      imagenClave: 'imagenes/2026/10/abc123.jpg',
    });
  });
  afterAll(() => t.cerrar());

  it('imagenUrl null cuando no hay imagen; absoluta con el Host del pedido cuando hay', async () => {
    const a = await t.http().get('/promociones/pro-vacia').expect(200);
    esperarContrato(a.body, 'Promocion');
    expect(a.body.datos.imagenUrl).toBeNull();
    expect(a.body.datos.descuento).toBeNull();
    const b = await t.http().get('/promociones/pro-llena').set('Host', '10.0.0.5:3000').expect(200);
    esperarContrato(b.body, 'Promocion');
    expect(b.body.datos.imagenUrl).toBe(
      'http://10.0.0.5:3000/archivos/imagenes/2026/10/abc123.jpg',
    );
    expect(b.body.datos).toMatchObject({ descuento: 100, soloApp: true, usos: 12, activa: true });
    const l = await t.http().get('/promociones').set('Host', '10.0.0.5:3000').expect(200);
    esperarContrato(l.body, 'Promocion');
    const llena = l.body.datos.find((p: { id: string }) => p.id === 'pro-llena');
    expect(llena.imagenUrl).toMatch(/^http:\/\/10\.0\.0\.5:3000\/archivos\//);
  });

  it('con X-Forwarded-Proto y CONFIAR_PROXY las URLs son https', async () => {
    const tp = await crearApp({ variables: { CONFIAR_PROXY: 'true' } });
    try {
      await crearComercio(tp, { id: 'com-1', rubroId: 'rub-x' });
      await crearPromocion(tp, {
        id: 'pro-img',
        comercioId: 'com-1',
        imagenClave: 'imagenes/2026/10/z.jpg',
      });
      const res = await tp
        .http()
        .get('/promociones/pro-img')
        .set('X-Forwarded-Proto', 'https')
        .set('X-Forwarded-Host', 'api.ejemplo.com')
        .expect(200);
      expect(res.body.datos.imagenUrl).toBe(
        'https://api.ejemplo.com/archivos/imagenes/2026/10/z.jpg',
      );
    } finally {
      await tp.cerrar();
    }
  });

  it('ningún campo fuera del tipo (cantidad exacta de claves)', async () => {
    const res = await t.http().get('/promociones/pro-llena').expect(200);
    expect(Object.keys(res.body.datos).sort()).toEqual(
      [
        'activa',
        'comercioId',
        'desde',
        'descuento',
        'detalle',
        'hasta',
        'id',
        'imagenUrl',
        'soloApp',
        'titulo',
        'usos',
      ].sort(),
    );
    expect(Object.keys(res.body)).toEqual(['datos', 'meta']);
  });

  it('no se mezclan los campos del comercio ni del uso', async () => {
    const res = await t.http().get('/promociones').expect(200);
    for (const p of res.body.datos) {
      for (const campo of [
        'comercio',
        'rubroId',
        'codigo',
        'imagenClave',
        'createdAt',
        'cupo',
        'abiertoAhora',
        'distancia',
      ])
        expect(p).not.toHaveProperty(campo);
    }
  });
});

describe('R4 — qué se oculta y con qué código', () => {
  let t: AppDePrueba;
  beforeAll(async () => {
    t = await crearApp();
    await crearRubro(t, { id: 'rub-x' });
    await crearComercio(t, { id: 'com-1', rubroId: 'rub-x' });
    await crearComercio(t, { id: 'com-baja', rubroId: 'rub-x', activo: false });
    await crearPromocion(t, { id: 'pro-oka', comercioId: 'com-1' });
    await crearPromocion(t, {
      id: 'pro-vencida',
      comercioId: 'com-1',
      desde: en(t, -10 * DIA),
      hasta: en(t, -MIN),
    });
    await crearPromocion(t, { id: 'pro-baja', comercioId: 'com-1', activa: false });
    await crearPromocion(t, { id: 'pro-cbaja', comercioId: 'com-baja' });
    await crearPromocion(t, {
      id: 'pro-cbaja-prox',
      comercioId: 'com-baja',
      desde: en(t, DIA),
      hasta: en(t, 5 * DIA),
    });
    await crearPromocion(t, {
      id: 'pro-cbaja-vencida',
      comercioId: 'com-baja',
      hasta: en(t, -DIA),
    });
    await crearPromocion(t, {
      id: 'pro-baja-prox',
      comercioId: 'com-1',
      activa: false,
      desde: en(t, DIA),
      hasta: en(t, 5 * DIA),
    });
  });
  afterAll(() => t.cerrar());

  it('filtrar explícitamente por el comercio dado de baja no revela sus promos', async () => {
    for (const estado of ['vigentes', 'proximas', 'por-vencer']) {
      const res = await t
        .http()
        .get(`/promociones?comercioId=com-baja&estado=${estado}`)
        .expect(200);
      expect(res.body.datos).toEqual([]);
      expect(res.body.meta.total).toBe(0);
    }
  });

  it('filtrar por comercioId de la vencida o de la baja no las trae', async () => {
    const l = ids(await t.http().get('/promociones?comercioId=com-1&porPagina=100').expect(200));
    expect(l).toEqual(['pro-oka']);
  });

  it('próxima de comercio inactivo o dada de baja: 404 en el detalle', async () => {
    for (const id of ['pro-cbaja-prox', 'pro-baja-prox', 'pro-cbaja-vencida', 'pro-cbaja']) {
      const res = await t.http().get(`/promociones/${id}`).expect(404);
      esperarError(res.body, 'PROMOCION_NO_ENCONTRADA');
      expect(mensajeDe(res.body)).toBe('No existe esa promoción.');
    }
  });

  it('410 PROMO_VENCIDA con sobre exacto (sólo codigo y mensaje) y el reloj que avanza la vence', async () => {
    const res = await t.http().get('/promociones/pro-vencida').expect(410);
    esperarError(res.body, 'PROMO_VENCIDA');
    expect(Object.keys(res.body.error).sort()).toEqual(['codigo', 'mensaje']);
    await t.http().get('/promociones/pro-oka').expect(200);
    t.reloj.fijar('2026-12-01T12:00:00-03:00');
    await t.http().get('/promociones/pro-oka').expect(410);
    expect(ids(await t.http().get('/promociones').expect(200))).toEqual([]);
  });
});

describe('Permisos — es público', () => {
  let t: AppDePrueba;
  beforeAll(async () => {
    t = await crearApp();
    await base(t);
    await crearPromocion(t, { id: 'pro-uno', comercioId: 'com-1' });
  });
  afterAll(() => t.cerrar());

  it.each(['Bearer basura', 'Bearer a.b.c', 'Basic xxx', 'Bearer '])(
    'token inválido «%s» no rompe un endpoint público (A7)',
    async (cab) => {
      await t.http().get('/promociones').set('Authorization', cab).expect(200);
      await t.http().get('/promociones/pro-uno').set('Authorization', cab).expect(200);
    },
  );

  it('token firmado con otro secreto también se ignora', async () => {
    const u = await crearUsuario(t);
    const partes = u.auth.Authorization.split('.');
    const roto = `${partes[0]}.${partes[1]}.firmaadulterada`;
    await t.http().get('/promociones').set('Authorization', roto).expect(200);
  });

  it('un comercio y un vecino ven lo mismo', async () => {
    const u = await crearUsuario(t);
    const a = await t.http().get('/promociones').set(u.auth).expect(200);
    const b = await t.http().get('/promociones').expect(200);
    expect(a.body).toEqual(b.body);
  });
});

describe('Rutas y métodos', () => {
  let t: AppDePrueba;
  beforeAll(async () => {
    t = await crearApp();
    await base(t);
    await crearPromocion(t, { id: 'pro-uno', comercioId: 'com-1' });
  });
  afterAll(() => t.cerrar());

  it('los verbos de escritura sobre /promociones no existen en M2 (sobre de error, no 500)', async () => {
    const pedidos = [
      () => t.http().post('/promociones').send({}),
      () => t.http().delete('/promociones/pro-uno'),
      () => t.http().put('/promociones/pro-uno').send({}),
    ];
    for (const pedir of pedidos) {
      const res = await pedir();
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
      expect(Object.keys(res.body)).toEqual(['error']);
      expect(Object.keys(res.body.error).sort()).toEqual(['codigo', 'mensaje']);
    }
  });

  it('el id distingue mayúsculas y prefijos: PRO-uno, com-1, id con espacios o largo → 404 PROMOCION_NO_ENCONTRADA', async () => {
    for (const id of ['PRO-uno', 'com-1', 'pro-uno%20', 'x'.repeat(300), 'pro-uno;drop']) {
      const res = await t.http().get(`/promociones/${id}`);
      expect(res.status).toBe(404);
      esperarError(res.body, 'PROMOCION_NO_ENCONTRADA');
    }
  });

  it('GET /promociones/ con barra final responde con la lista', async () => {
    const res = await t.http().get('/promociones/');
    expect(res.status).toBe(200);
  });
});

describe('Filtros combinados y rubroId', () => {
  let t: AppDePrueba;
  beforeAll(async () => {
    t = await crearApp();
    await crearRubro(t, { id: 'rub-a' });
    await crearRubro(t, { id: 'rub-b' });
    await crearComercio(t, { id: 'com-a1', rubroId: 'rub-a' });
    await crearComercio(t, { id: 'com-a2', rubroId: 'rub-a' });
    await crearComercio(t, { id: 'com-b1', rubroId: 'rub-b' });
    await crearPromocion(t, { id: 'pro-a1', comercioId: 'com-a1', hasta: en(t, DIA) });
    await crearPromocion(t, { id: 'pro-a2', comercioId: 'com-a2', hasta: en(t, 5 * DIA) });
    await crearPromocion(t, { id: 'pro-b1', comercioId: 'com-b1', hasta: en(t, 2 * DIA) });
    await crearPromocion(t, {
      id: 'pro-a2p',
      comercioId: 'com-a2',
      desde: en(t, 2 * DIA),
      hasta: en(t, 9 * DIA),
    });
  });
  afterAll(() => t.cerrar());

  it('rubroId + estado', async () => {
    expect(
      ids(await t.http().get('/promociones?rubroId=rub-a&estado=por-vencer').expect(200)),
    ).toEqual(['pro-a1']);
    expect(
      ids(await t.http().get('/promociones?rubroId=rub-a&estado=proximas').expect(200)),
    ).toEqual(['pro-a2p']);
    expect(ids(await t.http().get('/promociones?rubroId=rub-a').expect(200))).toEqual([
      'pro-a1',
      'pro-a2',
    ]);
  });

  it('rubroId + comercioId consistentes y cruzados', async () => {
    expect(
      ids(await t.http().get('/promociones?rubroId=rub-a&comercioId=com-a2').expect(200)),
    ).toEqual(['pro-a2']);
    const x = await t.http().get('/promociones?rubroId=rub-b&comercioId=com-a2').expect(200);
    expect(x.body.meta.total).toBe(0);
  });

  it('el total del meta es el filtrado también con paginación y filtros', async () => {
    const res = await t.http().get('/promociones?rubroId=rub-a&porPagina=1&pagina=2').expect(200);
    expect(res.body.meta).toEqual({ total: 2, pagina: 2, porPagina: 1 });
    expect(ids(res)).toEqual(['pro-a2']);
  });
});
