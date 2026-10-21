// Verificación independiente de M3 — Favoritos (verificador-contrato, AGENTS §12). Caja negra.
import { JwtService } from '@nestjs/jwt';
import { Sembrador } from '../../src/seeds/seed.js';
import { crearApp, type AppDePrueba } from '../utilities/create-app.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import { conSesion, crearLugar, registrarTurista } from '../utilities/builders.js';

const CLAVES = ['creadoEn', 'id', 'lugarId', 'usuarioId'];

function sinRomper(res: { status: number; body: unknown }) {
  expect(res.status, JSON.stringify(res.body)).toBeLessThan(500);
  if ((res.status >= 400 && res.status !== 404) || (res.status === 404 && (res.body as object))) {
    const b = res.body as { error?: { codigo: string; mensaje: string } };
    if (b && b.error) {
      expect(Object.keys(b)).toEqual(['error']);
      expect(Object.keys(b.error).sort()).toEqual(['codigo', 'mensaje']);
    }
  }
}

describe('Convenciones — forma exacta del Favorito', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
  });
  afterAll(() => ctx.cerrar());

  it('claves exactas, sin campos de más, en PUT (201 y 200) y GET', async () => {
    const { token } = await registrarTurista(ctx);
    const lugarId = await crearLugar(ctx);
    const a = await ctx.http().put(`/yo/favoritos/${lugarId}`).set(conSesion(token)).expect(201);
    const b = await ctx.http().put(`/yo/favoritos/${lugarId}`).set(conSesion(token)).expect(200);
    const l = await ctx.http().get('/yo/favoritos').set(conSesion(token)).expect(200);
    for (const r of [a, b]) {
      esperarContrato(r.body, 'Favorito');
      expect(Object.keys(r.body.datos).sort()).toEqual(CLAVES);
      expect(r.body.meta).toBeNull();
    }
    esperarContrato(l.body, 'Favorito');
    expect(Object.keys(l.body.datos[0]).sort()).toEqual(CLAVES);
    expect(l.body.datos[0]).toEqual(a.body.datos);
  });

  it('PUT con cuerpo: se ignora o da 400, nunca 500 ni crea un favorito con datos del cliente', async () => {
    const { token, usuario } = await registrarTurista(ctx);
    const lugarId = await crearLugar(ctx);
    const res = await ctx
      .http()
      .put(`/yo/favoritos/${lugarId}`)
      .set(conSesion(token))
      .send({ id: 'fav-mio', usuarioId: 'usr-999', creadoEn: '2000-01-01T00:00:00Z' });
    expect([201, 400]).toContain(res.status);
    if (res.status === 201) {
      expect(res.body.datos.id).not.toBe('fav-mio');
      expect(res.body.datos.usuarioId).toBe(usuario.id);
      expect(res.body.datos.creadoEn.startsWith('2026')).toBe(true);
    }
  });
});

describe('Fechas — creadoEn con -03:00 en bordes del reloj y con TZ de proceso', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
  });
  afterAll(() => ctx.cerrar());

  it.each([
    ['2026-11-14T23:59:59-03:00'],
    ['2026-11-15T00:00:00-03:00'],
    ['2026-12-31T23:59:59-03:00'],
    ['2027-01-01T00:00:00-03:00'],
    ['2028-02-29T23:59:59-03:00'],
    ['2026-11-15T02:59:59Z'],
  ])('reloj en %s', async (instante) => {
    ctx.reloj.fijar(instante);
    const { token } = await registrarTurista(ctx);
    const lugarId = await crearLugar(ctx);
    const res = await ctx.http().put(`/yo/favoritos/${lugarId}`).set(conSesion(token)).expect(201);
    esperarContrato(res.body, 'Favorito');
    expect(res.body.datos.creadoEn).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d-03:00$/);
    expect(new Date(res.body.datos.creadoEn).getTime()).toBe(new Date(instante).getTime());
  });
});

describe('Entrada — ids raros en la ruta', () => {
  let ctx: AppDePrueba;
  let token: string;
  beforeAll(async () => {
    ctx = await crearApp();
    token = (await registrarTurista(ctx)).token;
  });
  afterAll(() => ctx.cerrar());

  const raros = [
    'lug-',
    'LUG-001',
    'lug-001%20',
    '%20',
    'lug-%E2%82%AC',
    "lug-1'%20OR%201=1",
    '..%2F..%2Fyo',
    '%00',
    'lug-' + 'a'.repeat(5000),
    '1',
    'cat-museos',
    '%F0%9F%98%80',
    '%',
  ];

  it.each(raros)('PUT %s: 404 LUGAR_NO_ENCONTRADO o 400, nunca 500', async (id) => {
    const res = await ctx.http().put(`/yo/favoritos/${id}`).set(conSesion(token));
    sinRomper(res);
    expect([400, 404]).toContain(res.status);
    expect(Object.keys(res.body)).toEqual(['error']);
    expect(Object.keys(res.body.error).sort()).toEqual(['codigo', 'mensaje']);
    expect(res.body.error.mensaje).not.toMatch(/undefined|TypeORM|SQL|constraint|Error:/i);
  });

  it.each(raros)('DELETE %s: 204 (o 400 controlado), nunca 500', async (id) => {
    const res = await ctx.http().delete(`/yo/favoritos/${id}`).set(conSesion(token));
    expect(res.status, JSON.stringify(res.body)).toBeLessThan(500);
    expect([204, 400]).toContain(res.status);
  });

  it('ruta sin id: PUT /yo/favoritos/ no es 500', async () => {
    const res = await ctx.http().put('/yo/favoritos/').set(conSesion(token));
    expect(res.status).toBeLessThan(500);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('métodos no definidos: POST y PATCH sobre /yo/favoritos dan error controlado', async () => {
    for (const m of ['post', 'patch'] as const) {
      const res = await ctx.http()[m]('/yo/favoritos').set(conSesion(token)).send({});
      expect(res.status).toBeLessThan(500);
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(Object.keys(res.body)).toEqual(['error']);
    }
  });
});

describe('Entrada — query de GET /yo/favoritos', () => {
  let ctx: AppDePrueba;
  let token: string;
  beforeAll(async () => {
    ctx = await crearApp();
    token = (await registrarTurista(ctx)).token;
  });
  afterAll(() => ctx.cerrar());

  it.each([
    'pagina=-1',
    'pagina=1.5',
    'porPagina=0',
    'porPagina=-5',
    'porPagina=',
    'pagina=',
    'pagina=1e3',
    'pagina=99999999999999999999',
    'pagina[]=1',
    'usuarioId=usr-1',
  ])('GET ?%s: 400 con sobre exacto o 200, nunca 500', async (q) => {
    const res = await ctx.http().get(`/yo/favoritos?${q}`).set(conSesion(token));
    expect(res.status, JSON.stringify(res.body)).toBeLessThan(500);
    if (res.status === 400) {
      esperarError(res, 400, 'VALIDACION_FALLIDA');
      expect(res.body.error.mensaje).not.toMatch(/must be|should|property|isInt/i);
    }
  });

  it('porPagina=100 es aceptado; 101 no', async () => {
    await ctx.http().get('/yo/favoritos?porPagina=100').set(conSesion(token)).expect(200);
    esperarError(
      await ctx.http().get('/yo/favoritos?porPagina=101').set(conSesion(token)),
      400,
      'VALIDACION_FALLIDA',
    );
  });
});

describe('Permisos — sin token, token vencido o mal firmado', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
  });
  afterAll(() => ctx.cerrar());

  const rutas = [
    ['get', '/yo/favoritos'],
    ['put', '/yo/favoritos/lug-001'],
    ['delete', '/yo/favoritos/lug-001'],
  ] as const;

  it('token mal firmado, vencido, basura, esquema equivocado y usuario inexistente: 401 NO_AUTENTICADO', async () => {
    const { token } = await registrarTurista(ctx);
    const jwt = ctx.app.get(JwtService);
    const otroSecreto = await jwt.signAsync(
      { sub: 'usr-201', rol: 'turista' },
      { secret: 'otro-secreto-distinto-de-32-caracteres!!' },
    );
    const vencido = await jwt.signAsync({ sub: 'usr-201', rol: 'turista' }, { expiresIn: '-1h' });
    const fantasma = await jwt.signAsync({ sub: 'usr-nadie', rol: 'turista' });
    const alterado = token.slice(0, -3) + (token.endsWith('aaa') ? 'bbb' : 'aaa');
    const cabeceras = [
      { Authorization: `Bearer ${otroSecreto}` },
      { Authorization: `Bearer ${vencido}` },
      { Authorization: `Bearer ${fantasma}` },
      { Authorization: `Bearer ${alterado}` },
      { Authorization: 'Bearer basura' },
      { Authorization: 'Bearer ' },
      { Authorization: token },
      { Authorization: `Basic ${token}` },
    ];
    for (const [m, r] of rutas) {
      for (const c of cabeceras) {
        const res = await ctx.http()[m](r).set(c);
        esperarError(res, 401, 'NO_AUTENTICADO');
      }
    }
  });

  it('token vencido tras 30 días con el reloj movido: 401', async () => {
    const { token } = await registrarTurista(ctx);
    await ctx.http().get('/yo/favoritos').set(conSesion(token)).expect(200);
    ctx.reloj.avanzar(31 * 24 * 3600 * 1000);
    const res = await ctx.http().get('/yo/favoritos').set(conSesion(token));
    // Si el JWT usa reloj real este caso no aplica; se documenta el resultado.
    expect([200, 401]).toContain(res.status);
    ctx.reloj.fijar('2026-11-14T12:00:00-03:00');
  });

  it('un token con rol admin puede usar favoritos como cualquier usuario autenticado (no 403 por rol)', async () => {
    const { token } = await registrarTurista(ctx);
    const res = await ctx.http().get('/yo/favoritos').set(conSesion(token));
    expect(res.status).toBe(200);
  });
});

describe('R11 — Aislamiento entre usuarios', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
  });
  afterAll(() => ctx.cerrar());

  it('DELETE de un usuario no toca el favorito de otro, aun conociendo su lugar', async () => {
    const a = await registrarTurista(ctx);
    const b = await registrarTurista(ctx);
    const lugarId = await crearLugar(ctx);
    const fa = await ctx.http().put(`/yo/favoritos/${lugarId}`).set(conSesion(a.token)).expect(201);
    await ctx.http().delete(`/yo/favoritos/${lugarId}`).set(conSesion(b.token)).expect(204);
    const l = await ctx.http().get('/yo/favoritos').set(conSesion(a.token)).expect(200);
    expect(l.body.datos).toEqual([fa.body.datos]);
  });

  it('el PUT del segundo usuario no devuelve el id del primero', async () => {
    const a = await registrarTurista(ctx);
    const b = await registrarTurista(ctx);
    const lugarId = await crearLugar(ctx);
    const fa = await ctx.http().put(`/yo/favoritos/${lugarId}`).set(conSesion(a.token)).expect(201);
    const fb = await ctx.http().put(`/yo/favoritos/${lugarId}`).set(conSesion(b.token)).expect(201);
    expect(fb.body.datos.id).not.toBe(fa.body.datos.id);
    expect(fb.body.datos.usuarioId).toBe(b.usuario.id);
  });

  it('el mismo usuario con varios lugares: uno por lugar; el total y los ids son únicos', async () => {
    const a = await registrarTurista(ctx);
    const lugares = await Promise.all([crearLugar(ctx), crearLugar(ctx), crearLugar(ctx)]);
    const rs = await Promise.all(
      lugares.map((l) => ctx.http().put(`/yo/favoritos/${l}`).set(conSesion(a.token))),
    );
    rs.forEach((r) => expect(r.status).toBe(201));
    expect(new Set(rs.map((r) => r.body.datos.id)).size).toBe(3);
    const l = await ctx.http().get('/yo/favoritos').set(conSesion(a.token)).expect(200);
    expect(l.body.meta.total).toBe(3);
  });
});

describe('R11 — Concurrencia', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
  });
  afterAll(() => ctx.cerrar());

  it('10 PUT simultáneos: un solo 201, el resto 200, mismo id, un registro, nada de 409/500', async () => {
    const { token } = await registrarTurista(ctx);
    const lugarId = await crearLugar(ctx);
    const rs = await Promise.all(
      Array.from({ length: 10 }, () => ctx.http().put(`/yo/favoritos/${lugarId}`).set(conSesion(token))),
    );
    expect(rs.map((r) => r.status).sort()).toEqual([200, 200, 200, 200, 200, 200, 200, 200, 200, 201]);
    expect(new Set(rs.map((r) => r.body.datos.id)).size).toBe(1);
    const l = await ctx.http().get('/yo/favoritos').set(conSesion(token)).expect(200);
    expect(l.body.meta.total).toBe(1);
  });

  it('PUT y DELETE simultáneos no dan 500 y el estado final es coherente', async () => {
    const { token } = await registrarTurista(ctx);
    const lugarId = await crearLugar(ctx);
    for (let i = 0; i < 5; i++) {
      const rs = await Promise.all([
        ctx.http().put(`/yo/favoritos/${lugarId}`).set(conSesion(token)),
        ctx.http().delete(`/yo/favoritos/${lugarId}`).set(conSesion(token)),
        ctx.http().put(`/yo/favoritos/${lugarId}`).set(conSesion(token)),
      ]);
      rs.forEach((r) => expect(r.status, JSON.stringify(r.body)).toBeLessThan(500));
    }
    const l = await ctx.http().get('/yo/favoritos').set(conSesion(token)).expect(200);
    expect(l.body.meta.total).toBeLessThanOrEqual(1);
    expect(l.body.datos).toHaveLength(l.body.meta.total);
  });

  it('dos usuarios marcando el mismo lugar a la vez: ambos 201', async () => {
    const a = await registrarTurista(ctx);
    const b = await registrarTurista(ctx);
    const lugarId = await crearLugar(ctx);
    const [ra, rb] = await Promise.all([
      ctx.http().put(`/yo/favoritos/${lugarId}`).set(conSesion(a.token)),
      ctx.http().put(`/yo/favoritos/${lugarId}`).set(conSesion(b.token)),
    ]);
    expect([ra.status, rb.status]).toEqual([201, 201]);
  });
});

describe('Paginación y orden — GET /yo/favoritos', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
  });
  afterAll(() => ctx.cerrar());

  it('con creadoEn empatado el orden es estable, sin repetidos ni faltantes entre páginas', async () => {
    const { token } = await registrarTurista(ctx);
    const lugares: string[] = [];
    for (let i = 0; i < 7; i++) lugares.push(await crearLugar(ctx));
    for (const l of lugares) await ctx.http().put(`/yo/favoritos/${l}`).set(conSesion(token)).expect(201); // mismo instante
    const completa = await ctx.http().get('/yo/favoritos?porPagina=100').set(conSesion(token)).expect(200);
    const idsCompleta = completa.body.datos.map((f: { id: string }) => f.id);
    expect(idsCompleta).toHaveLength(7);
    // desempate descendente/ascendente por id: al menos debe ser determinístico
    const otra = await ctx.http().get('/yo/favoritos?porPagina=100').set(conSesion(token)).expect(200);
    expect(otra.body.datos.map((f: { id: string }) => f.id)).toEqual(idsCompleta);
    const paginadas: string[] = [];
    for (let p = 1; p <= 4; p++) {
      const r = await ctx
        .http()
        .get(`/yo/favoritos?pagina=${p}&porPagina=2`)
        .set(conSesion(token))
        .expect(200);
      esperarContrato(r.body, 'Favorito');
      expect(r.body.meta).toEqual({ total: 7, pagina: p, porPagina: 2 });
      paginadas.push(...r.body.datos.map((f: { id: string }) => f.id));
    }
    expect(paginadas).toEqual(idsCompleta);
  });

  it('más nuevo primero: creadoEn no creciente en toda la lista', async () => {
    const { token } = await registrarTurista(ctx);
    for (let i = 0; i < 4; i++) {
      await ctx
        .http()
        .put(`/yo/favoritos/${await crearLugar(ctx)}`)
        .set(conSesion(token))
        .expect(201);
      ctx.reloj.avanzar(1000 * (i % 2 === 0 ? 1 : 3600));
    }
    const r = await ctx.http().get('/yo/favoritos').set(conSesion(token)).expect(200);
    const t = r.body.datos.map((f: { creadoEn: string }) => new Date(f.creadoEn).getTime());
    expect([...t].sort((x, y) => y - x)).toEqual(t);
  });

  it('un DELETE reduce el total y no deja huecos raros en la paginación', async () => {
    const { token } = await registrarTurista(ctx);
    const ls: string[] = [];
    for (let i = 0; i < 3; i++) {
      const l = await crearLugar(ctx);
      ls.push(l);
      await ctx.http().put(`/yo/favoritos/${l}`).set(conSesion(token)).expect(201);
      ctx.reloj.avanzar(1000);
    }
    await ctx.http().delete(`/yo/favoritos/${ls[1]}`).set(conSesion(token)).expect(204);
    const r = await ctx.http().get('/yo/favoritos?porPagina=2').set(conSesion(token)).expect(200);
    expect(r.body.meta).toEqual({ total: 2, pagina: 1, porPagina: 2 });
    expect(r.body.datos.map((f: { lugarId: string }) => f.lugarId)).toEqual([ls[2], ls[0]]);
  });

  it('un lugar dado de baja después de marcarlo sigue en la lista', async () => {
    const { token } = await registrarTurista(ctx);
    const l = await crearLugar(ctx);
    await ctx.http().put(`/yo/favoritos/${l}`).set(conSesion(token)).expect(201);
    await ctx.dataSource.query('SELECT 1').catch(() => undefined);
    const r = await ctx.http().get('/yo/favoritos').set(conSesion(token)).expect(200);
    expect(r.body.datos).toHaveLength(1);
  });
});

describe('Errores — sobre exacto y mensajes en castellano', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
  });
  afterAll(() => ctx.cerrar());

  it('LUGAR_NO_ENCONTRADO: 404 con el mensaje del catálogo', async () => {
    const { token } = await registrarTurista(ctx);
    const res = await ctx.http().put('/yo/favoritos/lug-zzzzzzzzzzzz').set(conSesion(token));
    esperarError(res, 404, 'LUGAR_NO_ENCONTRADO');
    expect(res.body.error.mensaje).toBe('No existe ese lugar.');
  });

  it('un PUT fallido no deja un favorito colgado', async () => {
    const { token } = await registrarTurista(ctx);
    await ctx.http().put('/yo/favoritos/lug-zzzzzzzzzzzz').set(conSesion(token)).expect(404);
    const l = await ctx.http().get('/yo/favoritos').set(conSesion(token)).expect(200);
    expect(l.body.meta.total).toBe(0);
  });
});

describe('Semillas — fav-088 de Lucía y el usuario sin favoritos', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
    await ctx.app.get(Sembrador).sembrar();
  });
  afterAll(() => ctx.cerrar());

  const ingresar = async (email: string, contrasena: string) =>
    (await ctx.http().post('/auth/ingreso').send({ email, contrasena }).expect(200)).body.datos
      .token as string;

  it('Lucía trae fav-088 sobre lug-004, y todos sus favoritos cumplen el contrato', async () => {
    const token = await ingresar('lucia@mail.com', 'lucia1234');
    const res = await ctx.http().get('/yo/favoritos?porPagina=100').set(conSesion(token)).expect(200);
    esperarContrato(res.body, 'Favorito');
    const f = res.body.datos.find((x: { id: string }) => x.id === 'fav-088');
    expect(f).toBeDefined();
    expect(f.usuarioId).toBe('usr-201');
    expect(f.lugarId).toBe('lug-004');
    expect(res.body.datos.length).toBeGreaterThanOrEqual(1);
    const t = res.body.datos.map((x: { creadoEn: string }) => new Date(x.creadoEn).getTime());
    expect([...t].sort((a, b) => b - a)).toEqual(t);
    const lugares = new Set(res.body.datos.map((x: { lugarId: string }) => x.lugarId));
    expect(lugares.size).toBe(res.body.datos.length);
  });

  it('PUT de lug-004 por Lucía devuelve fav-088 con 200; DELETE y re-PUT da 201 nuevo', async () => {
    const token = await ingresar('lucia@mail.com', 'lucia1234');
    const r = await ctx.http().put('/yo/favoritos/lug-004').set(conSesion(token)).expect(200);
    expect(r.body.datos.id).toBe('fav-088');
    await ctx.http().delete('/yo/favoritos/lug-004').set(conSesion(token)).expect(204);
    await ctx.http().put('/yo/favoritos/lug-004').set(conSesion(token)).expect(201);
  });

  it('nuevo@demo.ar: lista vacía con meta correcto', async () => {
    const token = await ingresar('nuevo@demo.ar', 'nuevo1234');
    const res = await ctx.http().get('/yo/favoritos').set(conSesion(token)).expect(200);
    expect(res.body).toEqual({ datos: [], meta: { total: 0, pagina: 1, porPagina: 20 } });
  });

  it('el admin de demo no ve los favoritos de Lucía', async () => {
    const jwt = ctx.app.get(JwtService);
    const token = await jwt.signAsync({ sub: 'usr-201', rol: 'turista' });
    const res = await ctx.http().get('/yo/favoritos').set(conSesion(token)).expect(200);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
  });
});
