// Verificación independiente de M8 — Notificaciones para completar (AGENTS §19.3). Caja negra.
// Corre con los puertos reales (los vacíos de main).
import { crearApp, type AppDePrueba } from '../utilities/create-app.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import {
  crearCuadrilla,
  crearTipo,
  crearZona,
  cuadradoAlrededorDe,
} from '../utilities/catalogs.js';
import {
  crearOperador,
  crearVecino,
  type UsuarioDePrueba,
} from '../utilities/users.js';
import { crearCambio, crearReporte, ROCAMORA } from '../utilities/reports.js';

const MENSAJE = 'Esta parte la programan ustedes. Mirá docs/NOTIFICATIONS.md.';
const TOKEN = 'ExponentPushToken[ver8-abc123]';

let ctx: AppDePrueba;
let op: UsuarioDePrueba;
let autor: UsuarioDePrueba;
let ana: UsuarioDePrueba;
let tipoId: string;
let cua: string;
let n = 0;

async function rep(
  estado: 'recibido' | 'en_revision' | 'asignado' = 'recibido',
) {
  const r = await crearReporte(ctx, {
    autorId: autor.usuario.id,
    tipoId,
    zonaId: 'zon-norte',
    estado,
    codigo: `GCHU-2026-${String(60000 + ++n)}`,
  });
  await crearCambio(ctx, { reporteId: r.id });
  return r;
}

beforeAll(async () => {
  ctx = await crearApp({ puertosReales: true });
  op = await crearOperador(ctx, { zonaId: 'zon-norte' });
  autor = await crearVecino(ctx);
  ana = await crearVecino(ctx);
  tipoId = (await crearTipo(ctx, { id: 'tip-bache' })).id;
  await crearZona(ctx, {
    id: 'zon-norte',
    limite: cuadradoAlrededorDe(ROCAMORA.latitud, ROCAMORA.longitud),
  });
  cua = (await crearCuadrilla(ctx, { zonaId: 'zon-norte' })).id;
});
afterAll(() => ctx.cerrar());

const post = (u: UsuarioDePrueba | null, ruta: string, cuerpo?: object) => {
  let r = ctx.http().post(ruta);
  if (u) r = r.set(...u.auth);
  return cuerpo ? r.send(cuerpo) : r;
};

describe('AGENTS §19.3 — los tres endpoints responden 501 con el sobre exacto', () => {
  it.each([
    ['POST /dispositivos', 'post', '/dispositivos'],
    [
      'DELETE /dispositivos/:t',
      'delete',
      `/dispositivos/${encodeURIComponent(TOKEN)}`,
    ],
    ['POST /dispositivos/prueba', 'post', '/dispositivos/prueba'],
  ] as const)('%s', async (_n, metodo, ruta) => {
    const u = await crearVecino(ctx);
    const base = ctx
      .http()
      [metodo](ruta)
      .set(...u.auth);
    const res =
      metodo === 'post' && ruta === '/dispositivos'
        ? await base.send({ tokenExpo: TOKEN, plataforma: 'android' })
        : await base;
    esperarError(res, 501, 'NO_IMPLEMENTADO');
    expect(Object.keys(res.body)).toEqual(['error']);
    expect(Object.keys(res.body.error).sort()).toEqual(['codigo', 'mensaje']);
    expect(res.body.error.mensaje).toBe(MENSAJE);
  });

  it('también para un operador', async () => {
    esperarError(
      await post(op, '/dispositivos/prueba'),
      501,
      'NO_IMPLEMENTADO',
    );
  });

  it('el 501 se repite (no queda nada a medias)', async () => {
    const u = await crearVecino(ctx);
    for (let i = 0; i < 2; i++)
      esperarError(
        await post(u, '/dispositivos', { tokenExpo: TOKEN, plataforma: 'ios' }),
        501,
        'NO_IMPLEMENTADO',
      );
  });
});

describe('AGENTS §19.3 / §7.3 — 401 y 400 van antes del 501', () => {
  it.each([
    ['post', '/dispositivos'],
    ['post', '/dispositivos/prueba'],
    ['delete', `/dispositivos/${encodeURIComponent(TOKEN)}`],
  ] as const)('sin token: %s %s → 401', async (m, ruta) => {
    const res = await ctx
      .http()
      [m](ruta)
      .send(m === 'post' ? { tokenExpo: TOKEN, plataforma: 'ios' } : undefined);
    esperarError(res, 401, 'NO_AUTENTICADO');
  });

  it('token mal firmado → 401', async () => {
    const res = await ctx
      .http()
      .post('/dispositivos/prueba')
      .set('Authorization', 'Bearer abc.def.ghi');
    esperarError(res, 401, 'NO_AUTENTICADO');
  });

  it.each([
    ['sin cuerpo', {}],
    ['plataforma inválida', { tokenExpo: TOKEN, plataforma: 'windows' }],
    ['sin plataforma', { tokenExpo: TOKEN }],
    ['token vacío', { tokenExpo: '', plataforma: 'ios' }],
    ['token que no es de Expo', { tokenExpo: 'hola', plataforma: 'ios' }],
    ['tipo equivocado', { tokenExpo: 123, plataforma: 'ios' }],
    ['campo de más', { tokenExpo: TOKEN, plataforma: 'ios', extra: 1 }],
  ])('POST /dispositivos %s → 400 VALIDACION_FALLIDA', async (_n, cuerpo) => {
    esperarError(
      await post(ana, '/dispositivos', cuerpo),
      400,
      'VALIDACION_FALLIDA',
    );
  });

  it('POST /dispositivos/prueba con campos de más → 400 (o 501), nunca 500', async () => {
    const res = await post(ana, '/dispositivos/prueba', { x: 1 });
    expect([400, 501]).toContain(res.status);
  });
});

describe('AGENTS §19.3 — los flujos que avisan siguen respondiendo bien', () => {
  it('PATCH /estado: 200 con Reporte', async () => {
    const r = await rep();
    const res = await ctx
      .http()
      .patch(`/reportes/${r.id}/estado`)
      .set(...op.auth)
      .send({ estado: 'en_revision' });
    expect(res.status).toBe(200);
    esperarContrato(res, 'Reporte');
    expect(res.body.datos.estado).toBe('en_revision');
  });

  it('PATCH /estado a rechazado con motivo: 200', async () => {
    const r = await rep();
    const res = await ctx
      .http()
      .patch(`/reportes/${r.id}/estado`)
      .set(...op.auth)
      .send({ estado: 'rechazado', comentario: 'No corresponde.' });
    expect(res.status).toBe(200);
    esperarContrato(res, 'Reporte');
  });

  it('PATCH /cuadrilla: 200 y asignado', async () => {
    const r = await rep('en_revision');
    const res = await ctx
      .http()
      .patch(`/reportes/${r.id}/cuadrilla`)
      .set(...op.auth)
      .send({ cuadrillaId: cua });
    expect(res.status).toBe(200);
    esperarContrato(res, 'Reporte');
    expect(res.body.datos.estado).toBe('asignado');
  });

  it('POST /duplicado: 200/201 con Reporte', async () => {
    const orig = await rep();
    const dup = await rep();
    const res = await ctx
      .http()
      .post(`/reportes/${dup.id}/duplicado`)
      .set(...op.auth)
      .send({ originalId: orig.id });
    expect([200, 201]).toContain(res.status);
    esperarContrato(res, 'Reporte');
    expect(res.body.datos.duplicadoDe).toBe(orig.id);
  });

  it('POST /adhesiones: 201, luego 200 al repetir', async () => {
    const r = await rep();
    const a = await post(ana, `/reportes/${r.id}/adhesiones`);
    expect(a.status).toBe(201);
    esperarContrato(a, 'Reporte');
    expect(a.body.datos.adhesiones).toBe(1);
    const b = await post(ana, `/reportes/${r.id}/adhesiones`);
    expect(b.status).toBe(200);
    expect(b.body.datos.adhesiones).toBe(1);
  });

  it('PATCH /yo con avisos prendidos y apagados: 200 y Usuario', async () => {
    for (const v of [true, false, true]) {
      const res = await ctx
        .http()
        .patch('/yo')
        .set(...ana.auth)
        .send({ avisosActivos: v });
      expect(res.status).toBe(200);
      esperarContrato(res, 'Usuario');
      expect(res.body.datos.avisosActivos).toBe(v);
    }
  });

  it('un error de negocio sigue siendo el de negocio (no un 501)', async () => {
    const r = await rep();
    esperarError(
      await ctx
        .http()
        .patch(`/reportes/${r.id}/estado`)
        .set(...op.auth)
        .send({ estado: 'rechazado' }),
      422,
      'MOTIVO_REQUERIDO',
    );
  });

  it('el autor con avisos apagados y sin dispositivos: igual responde bien', async () => {
    const v = await crearVecino(ctx, { avisosActivos: false });
    const r = await crearReporte(ctx, {
      autorId: v.usuario.id,
      tipoId,
      zonaId: 'zon-norte',
      codigo: `GCHU-2026-${String(60000 + ++n)}`,
    });
    await crearCambio(ctx, { reporteId: r.id });
    const res = await ctx
      .http()
      .patch(`/reportes/${r.id}/estado`)
      .set(...op.auth)
      .send({ estado: 'en_revision' });
    expect(res.status).toBe(200);
  });

  it('la push no sale hacia Expo mientras el enviador está vacío', async () => {
    await ctx.esperarAvisos();
    expect(ctx.notificador.enviadas).toHaveLength(0);
  });
});

describe('AGENTS §19.3 — el resto de la API no cambió', () => {
  it('GET /salud', async () => {
    const res = await ctx.http().get('/salud');
    expect(res.status).toBe(200);
    esperarContrato(res, 'Salud');
  });

  it('GET /yo y /yo/reportes', async () => {
    const a = await ctx
      .http()
      .get('/yo')
      .set(...autor.auth);
    expect(a.status).toBe(200);
    esperarContrato(a, 'Usuario');
    const b = await ctx
      .http()
      .get('/yo/reportes')
      .set(...autor.auth);
    expect(b.status).toBe(200);
    esperarContrato(b, 'Reporte');
  });

  it('catálogos y mapa públicos', async () => {
    for (const [ruta, tipo] of [
      ['/tipos-de-reporte', 'TipoDeReporte'],
      ['/zonas', 'Zona'],
      ['/reportes', 'Reporte'],
    ] as const) {
      const res = await ctx.http().get(ruta);
      expect(res.status, ruta).toBe(200);
      esperarContrato(res, tipo);
    }
  });

  it('bandeja: operador 200, vecino 403', async () => {
    const a = await ctx
      .http()
      .get('/bandeja')
      .set(...op.auth);
    expect(a.status).toBe(200);
    esperarContrato(a, 'Reporte');
    esperarError(
      await ctx
        .http()
        .get('/bandeja')
        .set(...ana.auth),
      403,
      'SIN_PERMISO',
    );
  });

  it('ruta inexistente → 404 RUTA_NO_ENCONTRADA', async () => {
    esperarError(
      await ctx
        .http()
        .get('/dispositivos/x/y/z')
        .set(...ana.auth),
      404,
      'RUTA_NO_ENCONTRADA',
    );
  });

  it('GET /dispositivos (no existe) no es 501', async () => {
    const res = await ctx
      .http()
      .get('/dispositivos')
      .set(...ana.auth);
    expect(res.status).toBe(404);
  });
});

describe('AGENTS §11.5 / §19.3 — Swagger marca los tres endpoints', () => {
  it.each([
    ['/dispositivos', 'post'],
    ['/dispositivos/{tokenExpo}', 'delete'],
    ['/dispositivos/prueba', 'post'],
  ])(
    '%s %s menciona que lo completan los alumnos y el 501',
    async (ruta, m) => {
      const res = await ctx.http().get('/docs-json');
      const op_ = res.body.paths[ruta]?.[m];
      expect(op_, `${m} ${ruta}`).toBeDefined();
      const texto = JSON.stringify(op_);
      expect(texto).toMatch(/ustedes|alumnos/i);
      expect(Object.keys(op_.responses)).toContain('501');
    },
  );

  it('los demás endpoints no dicen que estén pendientes', async () => {
    const res = await ctx.http().get('/docs-json');
    const otros = Object.entries(res.body.paths as Record<string, object>)
      .filter(([p]) => !p.startsWith('/dispositivos'))
      .map(([, v]) => JSON.stringify(v))
      .join('');
    expect(otros).not.toMatch(/completan ustedes|501/i);
  });
});
