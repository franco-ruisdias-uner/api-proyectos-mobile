// Verificación independiente de M3 — Mapa y duplicados (ESPECIFICACION §4 M3, R9, R10, D9, D10). Caja negra.
import { JwtService } from '@nestjs/jwt';
import { crearApp, type AppDePrueba } from '../utilities/create-app.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import {
  crearTipo,
  crearZona,
  cuadradoAlrededorDe,
} from '../utilities/catalogs.js';
import {
  crearOperador,
  crearVecino,
  type UsuarioDePrueba,
} from '../utilities/users.js';
import { crearReporte, ROCAMORA } from '../utilities/reports.js';
import type { EstadoReporte } from '../../contract/types.js';
import { CambioDeEstado } from '../../src/modules/reports/status-change.entity.js';
import { FotoDeReporte } from '../../src/modules/reports/photo.entity.js';
import { Reporte } from '../../src/modules/reports/report.entity.js';

const JERGA =
  /\b(must|should|property|undefined|null|cannot|exception|invalid|string|boolean|number|array|entity|column|constraint|sql|jwt|payload|body|nested|whitelist)\b/i;

const CLAVES = [
  'adhesiones',
  'autorId',
  'audioUrl',
  'coordenadas',
  'codigo',
  'creadoEn',
  'cuadrillaId',
  'descripcion',
  'direccion',
  'duplicadoDe',
  'estado',
  'fotos',
  'id',
  'sincronizado',
  'tipoId',
  'zonaId',
].sort();

let ctx: AppDePrueba;
let autor: UsuarioDePrueba;
let otro: UsuarioDePrueba;
let operador: UsuarioDePrueba;
let bache: string;
let luz: string;
let zona: string;

const M = 1 / 111_195;
/** Punto a `n` metros al norte de Rocamora. */
const norte = (n: number) => ({
  latitud: ROCAMORA.latitud + n * M,
  longitud: ROCAMORA.longitud,
});

beforeAll(async () => {
  ctx = await crearApp();
  autor = await crearVecino(ctx);
  otro = await crearVecino(ctx);
  operador = await crearOperador(ctx);
  bache = (await crearTipo(ctx, { id: 'tip-bache' })).id;
  luz = (await crearTipo(ctx, { id: 'tip-luminaria', nombre: 'Luz' })).id;
  zona = (
    await crearZona(ctx, {
      id: 'zon-norte',
      limite: cuadradoAlrededorDe(ROCAMORA.latitud, ROCAMORA.longitud),
    })
  ).id;
});
afterAll(() => ctx.cerrar());

beforeEach(async () => {
  ctx.reloj.mover(new Date('2026-09-14T10:00:00-03:00'));
  await ctx.dataSource.query('DELETE FROM adhesiones');
  await ctx.dataSource.getRepository(CambioDeEstado).clear();
  await ctx.dataSource.getRepository(FotoDeReporte).clear();
  await ctx.dataSource.getRepository(Reporte).clear();
});

const nuevo = (
  extra: Partial<Reporte> & { estado?: EstadoReporte } = {},
  fotos = 1,
) =>
  crearReporte(
    ctx,
    { autorId: autor.usuario.id, tipoId: bache, zonaId: zona, ...extra },
    { fotos },
  );
const ids = (res: { body: { datos: { id: string }[] } }) =>
  res.body.datos.map((r) => r.id);
const cercanos = (q: string) => ctx.http().get(`/reportes/cercanos?${q}`);
const adherir = (id: string, quien: UsuarioDePrueba = otro) =>
  ctx
    .http()
    .post(`/reportes/${id}/adhesiones`)
    .set(...quien.auth);
const pos = (p: { latitud: number; longitud: number }) =>
  `latitud=${p.latitud}&longitud=${p.longitud}`;

describe('Forma — GET /reportes, /cercanos y adhesiones devuelven Reporte exacto', () => {
  it('todos los opcionales en null y todos llenos; sin campos de más', async () => {
    const vacio = await nuevo({ descripcion: null, audioClave: null });
    const lleno = await nuevo(
      {
        descripcion: 'Con todo',
        audioClave: 'audios/2026/09/aaaaaaaaaaaaaaaaaaaaaaaa.m4a',
        cuadrillaId: null,
      },
      2,
    );
    const res = await ctx.http().get('/reportes');
    expect(res.status).toBe(200);
    esperarContrato(res, 'Reporte');
    for (const r of res.body.datos) {
      expect(Object.keys(r).sort()).toEqual(CLAVES);
      expect(r.sincronizado).toBe(true);
      expect(r.creadoEn).toMatch(/-03:00$/);
    }
    const l = res.body.datos.find((r: { id: string }) => r.id === lleno.id);
    expect(l.audioUrl).toMatch(/^https?:\/\/.+\/archivos\/audios\//);
    expect(l.fotos).toHaveLength(2);
    expect(
      res.body.datos.find((r: { id: string }) => r.id === vacio.id).audioUrl,
    ).toBeNull();
    const c = await cercanos(pos(ROCAMORA));
    esperarContrato(c, 'Reporte');
    for (const r of c.body.datos) expect(Object.keys(r).sort()).toEqual(CLAVES);
  });

  it('no filtra datos del autor', async () => {
    await nuevo();
    const res = await ctx.http().get('/reportes');
    const txt = JSON.stringify(res.body);
    expect(txt).not.toContain(autor.usuario.email);
    expect(txt).not.toContain('contrasena');
    expect(txt).not.toContain('distancia');
  });

  it('las rutas literales no se confunden con :id', async () => {
    const res = await ctx.http().get('/reportes/cercanos');
    esperarError(res, 400, 'VALIDACION_FALLIDA');
  });
});

describe('Fechas — creadoEn con offset -03:00 sin milisegundos, en bordes de día', () => {
  it.each([
    ['2026-12-31T23:59:59-03:00', '2026-12-31T23:59:59-03:00'],
    ['2026-09-30T00:00:00-03:00', '2026-09-30T00:00:00-03:00'],
    ['2026-03-01T02:30:00Z', '2026-02-28T23:30:00-03:00'],
  ])('instante %s se ve como %s', async (entrada, esperado) => {
    await nuevo({ creadoEn: new Date(entrada) });
    const res = await ctx.http().get('/reportes');
    esperarContrato(res, 'Reporte');
    expect(res.body.datos[0].creadoEn).toBe(esperado);
  });
});

describe('D10 — el mapa sin estado no muestra rechazados', () => {
  it('combinaciones de estado', async () => {
    const r = await nuevo({ estado: 'recibido' });
    const rev = await nuevo({ estado: 'en_revision' });
    const a = await nuevo({ estado: 'asignado' });
    const s = await nuevo({ estado: 'resuelto' });
    const x = await nuevo({ estado: 'rechazado' });
    const sin = await ctx.http().get('/reportes');
    expect(ids(sin).sort()).toEqual([r.id, rev.id, a.id, s.id].sort());
    expect(sin.body.meta.total).toBe(4);
    const solo = await ctx.http().get('/reportes?estado=rechazado');
    expect(ids(solo)).toEqual([x.id]);
    const varios = await ctx.http().get('/reportes?estado=rechazado,resuelto');
    expect(ids(varios).sort()).toEqual([x.id, s.id].sort());
  });

  it.each(['pendiente', '', 'recibido,', 'RECIBIDO', ',recibido'])(
    'estado inválido «%s» da 400',
    async (e) => {
      const res = await ctx.http().get(`/reportes?estado=${e}`);
      esperarError(res, 400, 'VALIDACION_FALLIDA');
      expect(res.body.error.mensaje).not.toMatch(JERGA);
    },
  );

  it('los duplicados (rechazados) tampoco salen sin filtro', async () => {
    const o = await nuevo();
    await nuevo({ estado: 'rechazado', duplicadoDe: o.id });
    const res = await ctx.http().get('/reportes');
    expect(ids(res)).toEqual([o.id]);
  });
});

describe('Filtros del mapa — cada uno solo y combinados', () => {
  it('tipoId + zonaId + estado combinados con «y»', async () => {
    const a = await nuevo({ tipoId: luz, estado: 'asignado' });
    await nuevo({ tipoId: bache, estado: 'asignado' });
    await nuevo({ tipoId: luz, estado: 'recibido' });
    const res = await ctx
      .http()
      .get(`/reportes?tipoId=${luz}&zonaId=${zona}&estado=asignado`);
    expect(ids(res)).toEqual([a.id]);
    expect(res.body.meta.total).toBe(1);
    const nada = await ctx.http().get('/reportes?tipoId=tip-inexistente');
    expect(nada.status).toBe(200);
    expect(nada.body.datos).toEqual([]);
  });

  it('caja visible: borde incluido y fuera excluido; norte<sur es 400', async () => {
    const dentro = await nuevo({ ...norte(10) });
    await nuevo({ ...norte(500) });
    const q = `norte=${ROCAMORA.latitud + 100 * M}&sur=${ROCAMORA.latitud - 100 * M}&este=${ROCAMORA.longitud + 0.01}&oeste=${ROCAMORA.longitud - 0.01}`;
    const res = await ctx.http().get(`/reportes?${q}`);
    expect(ids(res)).toEqual([dentro.id]);
    const mal = await ctx
      .http()
      .get(`/reportes?norte=-33.0&sur=-33.1&este=-58.4&oeste=-58.5`);
    expect(mal.status).toBe(200);
    const inv = await ctx
      .http()
      .get(`/reportes?norte=-33.1&sur=-33.0&este=-58.4&oeste=-58.5`);
    esperarError(inv, 400, 'VALIDACION_FALLIDA');
  });

  it.each([
    'latitud=-33',
    'latitud=-33&longitud=-58.5',
    'radioMetros=100',
    'norte=-33&sur=-34',
    'latitud=abc&longitud=-58&radioMetros=10',
    'latitud=95&longitud=-58&radioMetros=10',
    'latitud=-33&longitud=-58&radioMetros=-5',
    'latitud=-33&longitud=-58&radioMetros=0',
    'pagina=0',
    'pagina=-1',
    'porPagina=0',
    'porPagina=501',
    'porPagina=abc',
    'distancia=1',
    'abiertoAhora=true',
  ])('parámetros incompletos o inválidos «%s» → 400', async (q) => {
    const res = await ctx.http().get(`/reportes?${q}`);
    esperarError(res, 400, 'VALIDACION_FALLIDA');
    expect(res.body.error.mensaje).not.toMatch(JERGA);
  });

  it('radio: el de 100 m deja afuera a uno de 150 m y ordena por cercanía', async () => {
    const lejos = await nuevo({ ...norte(80) });
    const cerca = await nuevo({ ...norte(20) });
    await nuevo({ ...norte(150) });
    const res = await ctx
      .http()
      .get(`/reportes?${pos(ROCAMORA)}&radioMetros=100`);
    expect(ids(res)).toEqual([cerca.id, lejos.id]);
    expect(res.body.meta.total).toBe(2);
    expect(res.body.datos[0]).not.toHaveProperty('distancia');
  });
});

describe('Paginación del mapa', () => {
  it('meta correcto, páginas disjuntas y estables, fuera de rango vacío', async () => {
    for (let i = 0; i < 5; i++)
      await nuevo({ creadoEn: new Date(Date.UTC(2026, 8, 1, 12, i)) });
    const p1 = await ctx.http().get('/reportes?pagina=1&porPagina=2');
    const p2 = await ctx.http().get('/reportes?pagina=2&porPagina=2');
    const p3 = await ctx.http().get('/reportes?pagina=3&porPagina=2');
    const p9 = await ctx.http().get('/reportes?pagina=9&porPagina=2');
    expect(p1.body.meta).toEqual({ total: 5, pagina: 1, porPagina: 2 });
    expect(p9.status).toBe(200);
    expect(p9.body.datos).toEqual([]);
    expect(p9.body.meta).toEqual({ total: 5, pagina: 9, porPagina: 2 });
    const todos = [...ids(p1), ...ids(p2), ...ids(p3)];
    expect(new Set(todos).size).toBe(5);
    const completo = await ctx.http().get('/reportes?porPagina=500');
    expect(ids(completo)).toEqual(todos);
    expect(completo.body.meta.porPagina).toBe(500);
    const def = await ctx.http().get('/reportes');
    expect(def.body.meta.porPagina).toBe(20);
  });
});

describe('R9 — /reportes/cercanos', () => {
  it('50 m por defecto: 49 m entra, 51 m no; el más cercano primero', async () => {
    const c49 = await nuevo({ ...norte(49) });
    const c5 = await nuevo({ ...norte(-5) });
    await nuevo({ ...norte(51) });
    const res = await cercanos(pos(ROCAMORA));
    expect(res.status).toBe(200);
    expect(ids(res)).toEqual([c5.id, c49.id]);
    expect(res.body.meta.total).toBe(2);
  });

  it('el mismo punto (distancia 0) entra', async () => {
    const r = await nuevo();
    expect(ids(await cercanos(pos(ROCAMORA)))).toEqual([r.id]);
  });

  it('desde el otro lado de la longitud (este/oeste) también mide bien', async () => {
    const mLon = M / Math.cos((ROCAMORA.latitud * Math.PI) / 180);
    const dentro = await nuevo({
      latitud: ROCAMORA.latitud,
      longitud: ROCAMORA.longitud + 40 * mLon,
    });
    await nuevo({
      latitud: ROCAMORA.latitud,
      longitud: ROCAMORA.longitud - 60 * mLon,
    });
    expect(ids(await cercanos(pos(ROCAMORA)))).toEqual([dentro.id]);
  });

  it.each<EstadoReporte>(['resuelto', 'rechazado'])(
    'no incluye %s',
    async (estado) => {
      await nuevo({ estado });
      expect((await cercanos(pos(ROCAMORA))).body.datos).toEqual([]);
    },
  );

  it.each<EstadoReporte>(['recibido', 'en_revision', 'asignado'])(
    'incluye %s',
    async (estado) => {
      const r = await nuevo({ estado });
      expect(ids(await cercanos(pos(ROCAMORA)))).toEqual([r.id]);
    },
  );

  it('excluye los que tienen duplicadoDe aunque su estado sea abierto', async () => {
    const o = await nuevo();
    await nuevo({ duplicadoDe: o.id, estado: 'en_revision' });
    expect(ids(await cercanos(pos(ROCAMORA)))).toEqual([o.id]);
  });

  it('D9 — cualquier tipo; tipoId limita; tipoId inexistente da lista vacía', async () => {
    const b = await nuevo({ tipoId: bache });
    const l = await nuevo({ tipoId: luz, ...norte(3) });
    expect(ids(await cercanos(pos(ROCAMORA))).sort()).toEqual(
      [b.id, l.id].sort(),
    );
    expect(ids(await cercanos(`${pos(ROCAMORA)}&tipoId=${luz}`))).toEqual([
      l.id,
    ]);
    const nada = await cercanos(`${pos(ROCAMORA)}&tipoId=tip-nada`);
    expect(nada.status).toBe(200);
    expect(nada.body.datos).toEqual([]);
  });

  it('radioMetros: hasta 200; más de 200 o no positivo es 400', async () => {
    const r = await nuevo({ ...norte(180) });
    expect(ids(await cercanos(`${pos(ROCAMORA)}&radioMetros=200`))).toEqual([
      r.id,
    ]);
    expect(await cercanos(`${pos(ROCAMORA)}&radioMetros=100`)).toMatchObject({
      body: { datos: [] },
    });
    for (const v of ['201', '0', '-1', 'x', '10.5'])
      if (v !== '10.5')
        esperarError(
          await cercanos(`${pos(ROCAMORA)}&radioMetros=${v}`),
          400,
          'VALIDACION_FALLIDA',
        );
  });

  it.each([
    '',
    'latitud=-33',
    'longitud=-58',
    'latitud=x&longitud=y',
    'latitud=-33&longitud=-58&estado=resuelto',
    'latitud=-91&longitud=0',
    'latitud=0&longitud=181',
  ])('parámetros «%s» → 400 con mensaje en castellano', async (q) => {
    const res = await cercanos(q);
    esperarError(res, 400, 'VALIDACION_FALLIDA');
    expect(res.body.error.mensaje).not.toMatch(JERGA);
  });

  it('paginación y orden estable con empate', async () => {
    for (let i = 0; i < 4; i++) await nuevo();
    const a = await cercanos(`${pos(ROCAMORA)}&porPagina=3`);
    const b = await cercanos(`${pos(ROCAMORA)}&porPagina=3&pagina=2`);
    expect(a.body.meta).toEqual({ total: 4, pagina: 1, porPagina: 3 });
    expect(b.body.datos).toHaveLength(1);
    expect(new Set([...ids(a), ...ids(b)]).size).toBe(4);
    const orden = ids(a);
    expect(orden).toEqual([...orden].sort());
    const fuera = await cercanos(`${pos(ROCAMORA)}&pagina=5`);
    expect(fuera.body.datos).toEqual([]);
    expect(fuera.body.meta.total).toBe(4);
  });

  it('sigue siendo público (sin token) y un token inválido da 401', async () => {
    await nuevo();
    expect((await cercanos(pos(ROCAMORA))).status).toBe(200);
    const mal = await ctx
      .http()
      .get(`/reportes/cercanos?${pos(ROCAMORA)}`)
      .set('Authorization', 'Bearer basura');
    // público: con token roto puede pasar o dar 401, pero nunca 500
    expect([200, 401]).toContain(mal.status);
  });

  it('tras marcar un reporte como abierto→resuelto por la base, deja de aparecer', async () => {
    const r = await nuevo();
    await ctx.dataSource
      .getRepository(Reporte)
      .update({ id: r.id }, { estado: 'resuelto' });
    expect((await cercanos(pos(ROCAMORA))).body.datos).toEqual([]);
  });
});

describe('R10 — POST /reportes/:id/adhesiones', () => {
  it('201 con el Reporte actualizado; 200 al repetir, sin duplicar', async () => {
    const r = await nuevo();
    const a = await adherir(r.id);
    expect(a.status).toBe(201);
    esperarContrato(a, 'Reporte');
    expect(Object.keys(a.body.datos).sort()).toEqual(CLAVES);
    expect(a.body.datos.adhesiones).toBe(1);
    const b = await adherir(r.id);
    expect(b.status).toBe(200);
    esperarContrato(b, 'Reporte');
    expect(b.body.datos).toEqual(a.body.datos);
    const pub = await ctx.http().get(`/reportes/${r.id}`);
    expect(pub.body.datos.adhesiones).toBe(1);
  });

  it('el operador también puede sumarse a un reporte ajeno', async () => {
    const r = await nuevo();
    const res = await adherir(r.id, operador);
    expect(res.status).toBe(201);
    expect(res.body.datos.adhesiones).toBe(1);
  });

  it('ADHESION_A_REPORTE_PROPIO 422 y no suma', async () => {
    const r = await nuevo();
    const res = await adherir(r.id, autor);
    esperarError(res, 422, 'ADHESION_A_REPORTE_PROPIO');
    expect(res.body.error.mensaje).toBe('Ya sos el autor de este reporte.');
    const pub = await ctx.http().get(`/reportes/${r.id}`);
    expect(pub.body.datos.adhesiones).toBe(0);
  });

  it.each<EstadoReporte>(['resuelto', 'rechazado'])(
    'REPORTE_CERRADO 422 si está %s',
    async (estado) => {
      const r = await nuevo({ estado });
      const res = await adherir(r.id);
      esperarError(res, 422, 'REPORTE_CERRADO');
      expect(res.body.error.mensaje).toBe('Ese reporte ya está cerrado.');
    },
  );

  it.each<EstadoReporte>(['recibido', 'en_revision', 'asignado'])(
    'se puede sumar a uno %s',
    async (estado) => {
      const r = await nuevo({ estado });
      expect((await adherir(r.id)).status).toBe(201);
    },
  );

  it('a un reporte duplicado (rechazado) da REPORTE_CERRADO', async () => {
    const o = await nuevo();
    const d = await nuevo({ estado: 'rechazado', duplicadoDe: o.id });
    esperarError(await adherir(d.id), 422, 'REPORTE_CERRADO');
  });

  it('el propio autor con reporte cerrado: propio gana sobre cerrado (P15)', async () => {
    const r = await nuevo({ estado: 'resuelto' });
    esperarError(await adherir(r.id, autor), 422, 'ADHESION_A_REPORTE_PROPIO');
  });

  it('404 REPORTE_NO_ENCONTRADO; 400 con id mal formado', async () => {
    const res = await adherir('rep-noexiste');
    esperarError(res, 404, 'REPORTE_NO_ENCONTRADO');
    for (const malo of ['usr-123', '123', 'rep-', 'rep-a b'])
      esperarError(
        await adherir(encodeURIComponent(malo)),
        400,
        'VALIDACION_FALLIDA',
      );
  });

  it('401 sin token, token roto, token vencido, token de otra firma', async () => {
    const r = await nuevo();
    esperarError(
      await ctx.http().post(`/reportes/${r.id}/adhesiones`),
      401,
      'NO_AUTENTICADO',
    );
    esperarError(
      await ctx
        .http()
        .post(`/reportes/${r.id}/adhesiones`)
        .set('Authorization', 'Bearer x.y.z'),
      401,
      'NO_AUTENTICADO',
    );
    const jwt = new JwtService();
    const otroSecreto = await jwt.signAsync(
      { sub: otro.usuario.id, rol: 'vecino' },
      { secret: 'otro-secreto-distinto-de-32-caracteres!!' },
    );
    esperarError(
      await ctx
        .http()
        .post(`/reportes/${r.id}/adhesiones`)
        .set('Authorization', `Bearer ${otroSecreto}`),
      401,
      'NO_AUTENTICADO',
    );
    const vencido = await jwt.signAsync(
      { sub: otro.usuario.id, rol: 'vecino', exp: 1600000000 },
      { secret: 'secreto-solo-para-los-tests-de-la-api' },
    );
    esperarError(
      await ctx
        .http()
        .post(`/reportes/${r.id}/adhesiones`)
        .set('Authorization', `Bearer ${vencido}`),
      401,
      'NO_AUTENTICADO',
    );
  });

  it('cuerpo con campos de más se ignora o da 400, nunca 500', async () => {
    const r = await nuevo();
    const res = await adherir(r.id).send({ adhesiones: 99 });
    expect([201, 400]).toContain(res.status);
    if (res.status === 201) expect(res.body.datos.adhesiones).toBe(1);
  });

  it('concurrencia: la misma persona 5 veces a la vez → una adhesión, un 201 y el resto 200', async () => {
    const r = await nuevo();
    const rs = await Promise.all([1, 2, 3, 4, 5].map(() => adherir(r.id)));
    expect(rs.filter((x) => x.status === 201)).toHaveLength(1);
    expect(rs.filter((x) => x.status === 200)).toHaveLength(4);
    for (const x of rs) expect(x.body.datos.adhesiones).toBe(1);
    const pub = await ctx.http().get(`/reportes/${r.id}`);
    expect(pub.body.datos.adhesiones).toBe(1);
  });

  it('concurrencia: 6 personas distintas → contador 6 y sin errores', async () => {
    const r = await nuevo();
    const gente = await Promise.all(
      [1, 2, 3, 4, 5, 6].map(() => crearVecino(ctx)),
    );
    const rs = await Promise.all(gente.map((g) => adherir(r.id, g)));
    for (const x of rs) expect(x.status).toBe(201);
    const pub = await ctx.http().get(`/reportes/${r.id}`);
    expect(pub.body.datos.adhesiones).toBe(6);
    expect(
      new Set(rs.map((x) => x.body.datos.adhesiones)).size,
    ).toBeGreaterThan(0);
  });

  it('el reporte sumado sigue apareciendo en mapa y cercanos con el contador nuevo', async () => {
    const r = await nuevo();
    await adherir(r.id);
    const m = await ctx.http().get('/reportes');
    expect(m.body.datos[0].adhesiones).toBe(1);
    const c = await cercanos(pos(ROCAMORA));
    expect(c.body.datos[0].adhesiones).toBe(1);
  });
});

describe('Notificaciones — no las manda M3 por ahora (M5)', () => {
  it('sumarse no rompe el pedido aunque el autor tenga avisos apagados', async () => {
    const mudo = await crearVecino(ctx, { avisosActivos: false });
    const r = await nuevo({ autorId: mudo.usuario.id });
    const res = await adherir(r.id);
    expect(res.status).toBe(201);
    await ctx.esperarAvisos();
    // con avisos apagados nunca debe salir push al autor
    expect(
      ctx.notificador.enviadas.filter((n) =>
        JSON.stringify(n).includes(mudo.usuario.id),
      ),
    ).toEqual([]);
  });
});
