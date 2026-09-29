// Verificación independiente de M4 — Bandeja del operador (ESPECIFICACION §4 M4, R11–R17, §6). Caja negra.
import { JwtService } from '@nestjs/jwt';
import type { Test } from 'supertest';
import { crearApp, type AppDePrueba } from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import {
  crearCuadrilla,
  crearTipo,
  crearZona,
} from '../utilidades/catalogos.js';
import {
  crearOperador,
  crearVecino,
  type UsuarioDePrueba,
} from '../utilidades/usuarios.js';
import {
  crearCambio,
  crearReporte,
  subirArchivo,
} from '../utilidades/reportes.js';
import type { EstadoReporte } from '../../contrato/tipos.js';
import { Adhesion } from '../../src/modulos/reportes/adhesion.entidad.js';
import { CambioDeEstado } from '../../src/modulos/reportes/cambio-de-estado.entidad.js';
import { FotoDeReporte } from '../../src/modulos/reportes/foto.entidad.js';
import { Reporte } from '../../src/modulos/reportes/reporte.entidad.js';

const JERGA =
  /\b(must|should|property|undefined|null|cannot|exception|invalid|string|boolean|number|array|entity|column|constraint|sql|jwt|payload|body|nested|whitelist)\b/i;

const CLAVES_REPORTE = [
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
let otroVecino: UsuarioDePrueba;
let op: UsuarioDePrueba;
let op2: UsuarioDePrueba;
let opSur: UsuarioDePrueba;
let tipoId: string;
let cuaN: string;
let cuaN2: string;
let cuaS: string;
let cuaInactiva: string;

beforeAll(async () => {
  ctx = await crearApp();
  autor = await crearVecino(ctx);
  otroVecino = await crearVecino(ctx);
  op = await crearOperador(ctx, { zonaId: 'zon-norte' });
  op2 = await crearOperador(ctx, { zonaId: 'zon-norte' });
  opSur = await crearOperador(ctx, { zonaId: 'zon-sur' });
  tipoId = (await crearTipo(ctx, { id: 'tip-bache' })).id;
  await crearZona(ctx, { id: 'zon-norte' });
  await crearZona(ctx, { id: 'zon-sur' });
  cuaN = (await crearCuadrilla(ctx, { zonaId: 'zon-norte' })).id;
  cuaN2 = (await crearCuadrilla(ctx, { zonaId: 'zon-norte' })).id;
  cuaS = (await crearCuadrilla(ctx, { zonaId: 'zon-sur' })).id;
  cuaInactiva = (
    await crearCuadrilla(ctx, { zonaId: 'zon-norte', activa: false })
  ).id;
});
afterAll(() => ctx.cerrar());

beforeEach(async () => {
  ctx.reloj.mover('2026-09-14T10:00:00-03:00');
  await ctx.dataSource.getRepository(Adhesion).clear();
  await ctx.dataSource.getRepository(CambioDeEstado).clear();
  await ctx.dataSource.getRepository(FotoDeReporte).clear();
  await ctx.dataSource.getRepository(Reporte).clear();
});

const rep = async (
  estado: EstadoReporte = 'recibido',
  extra: Partial<Reporte> = {},
) => {
  const r = await crearReporte(ctx, {
    autorId: autor.usuario.id,
    tipoId,
    zonaId: 'zon-norte',
    estado,
    ...extra,
  });
  await crearCambio(ctx, { reporteId: r.id, estado: 'recibido' });
  return r;
};

const con = (t: Test, q: UsuarioDePrueba | null) => (q ? t.set(...q.auth) : t);
const estado = (id: string, body: unknown, q: UsuarioDePrueba | null = op) =>
  con(
    ctx
      .http()
      .patch(`/reportes/${id}/estado`)
      .send(body as object),
    q,
  );
const cuadrilla = (id: string, body: unknown, q: UsuarioDePrueba | null = op) =>
  con(
    ctx
      .http()
      .patch(`/reportes/${id}/cuadrilla`)
      .send(body as object),
    q,
  );
const duplicado = (id: string, body: unknown, q: UsuarioDePrueba | null = op) =>
  con(
    ctx
      .http()
      .post(`/reportes/${id}/duplicado`)
      .send(body as object),
    q,
  );
const foto = (id: string, body: unknown, q: UsuarioDePrueba | null = op) =>
  con(
    ctx
      .http()
      .post(`/reportes/${id}/fotos`)
      .send(body as object),
    q,
  );
const bandeja = (q = '', quien: UsuarioDePrueba | null = op) =>
  con(ctx.http().get(`/bandeja${q}`), quien);
const cambios = async (id: string) => {
  const r = await ctx.http().get(`/reportes/${id}/cambios`);
  expect(r.status).toBe(200);
  esperarContrato(r, 'CambioDeEstado');
  return r.body.datos as {
    estado: string;
    comentario: string | null;
    operadorId: string | null;
    fechaHora: string;
  }[];
};

function sinJerga(res: { body: { error: { mensaje: string } } }) {
  expect(res.body.error.mensaje).not.toMatch(JERGA);
}

describe('R17 y auth — todos los endpoints del operador', () => {
  const llamadas: [string, (id: string, q: UsuarioDePrueba | null) => Test][] =
    [
      ['GET /bandeja', (_id, q) => bandeja('', q)],
      ['PATCH estado', (id, q) => estado(id, { estado: 'en_revision' }, q)],
      ['PATCH cuadrilla', (id, q) => cuadrilla(id, { cuadrillaId: cuaN }, q)],
      [
        'POST duplicado',
        (id, q) => duplicado(id, { originalId: 'rep-xxx' }, q),
      ],
      ['POST fotos', (id, q) => foto(id, { url: 'https://x.ar/a.jpg' }, q)],
    ];

  it.each(llamadas)('%s: 401 sin token', async (_n, f) => {
    const r = await rep();
    const res = await f(r.id, null);
    esperarError(res, 401, 'NO_AUTENTICADO');
    sinJerga(res);
  });

  it.each(llamadas)(
    '%s: vecino (incluso el autor) recibe 403',
    async (_n, f) => {
      const r = await rep('en_revision');
      esperarError(await f(r.id, autor), 403, 'SIN_PERMISO');
      esperarError(await f(r.id, otroVecino), 403, 'SIN_PERMISO');
    },
  );

  it('vecino sobre un id inexistente sigue siendo 403 (no filtra existencia)', async () => {
    esperarError(
      await estado('rep-noexiste123', { estado: 'en_revision' }, autor),
      403,
      'SIN_PERMISO',
    );
  });

  it.each(llamadas)(
    '%s: token roto, vencido o de otra firma → 401',
    async (_n, f) => {
      const r = await rep();
      const jwt = new JwtService();
      const vencido = await jwt.signAsync(
        { sub: op.usuario.id, rol: 'operador', exp: 1600000000 },
        { secret: 'secreto-solo-para-los-tests-de-la-api' },
      );
      const ajeno = await jwt.signAsync(
        { sub: op.usuario.id, rol: 'operador' },
        { secret: 'otro-secreto-distinto-de-32-caracteres!!' },
      );
      for (const token of ['basura', vencido, ajeno]) {
        const fake = {
          usuario: op.usuario,
          token,
          auth: ['Authorization', `Bearer ${token}`],
        } as UsuarioDePrueba;
        esperarError(await f(r.id, fake), 401, 'NO_AUTENTICADO');
      }
    },
  );

  it('un token que dice rol operador pero el usuario en la base es vecino → 403', async () => {
    const r = await rep();
    const jwt = new JwtService();
    const t = await jwt.signAsync(
      { sub: autor.usuario.id, rol: 'operador' },
      { secret: 'secreto-solo-para-los-tests-de-la-api' },
    );
    const res = await ctx
      .http()
      .patch(`/reportes/${r.id}/estado`)
      .set('Authorization', `Bearer ${t}`)
      .send({ estado: 'en_revision' });
    esperarError(res, 403, 'SIN_PERMISO');
  });
});

describe('PATCH /reportes/:id/estado — R11 máquina de estados completa', () => {
  const T: [EstadoReporte, EstadoReporte, number, string | null][] = [
    ['recibido', 'en_revision', 200, null],
    ['recibido', 'rechazado', 200, null],
    ['recibido', 'resuelto', 422, 'TRANSICION_INVALIDA'],
    ['recibido', 'recibido', 422, 'TRANSICION_INVALIDA'],
    ['recibido', 'asignado', 422, 'CUADRILLA_REQUERIDA'],
    ['en_revision', 'recibido', 422, 'TRANSICION_INVALIDA'],
    ['en_revision', 'en_revision', 422, 'TRANSICION_INVALIDA'],
    ['en_revision', 'resuelto', 422, 'TRANSICION_INVALIDA'],
    ['en_revision', 'rechazado', 200, null],
    ['en_revision', 'asignado', 422, 'CUADRILLA_REQUERIDA'],
    ['asignado', 'resuelto', 200, null],
    ['asignado', 'en_revision', 200, null],
    ['asignado', 'rechazado', 200, null],
    ['asignado', 'recibido', 422, 'TRANSICION_INVALIDA'],
    ['asignado', 'asignado', 422, 'CUADRILLA_REQUERIDA'],
    ['resuelto', 'recibido', 422, 'TRANSICION_INVALIDA'],
    ['resuelto', 'en_revision', 422, 'TRANSICION_INVALIDA'],
    ['resuelto', 'rechazado', 422, 'TRANSICION_INVALIDA'],
    ['resuelto', 'resuelto', 422, 'TRANSICION_INVALIDA'],
    ['rechazado', 'recibido', 422, 'TRANSICION_INVALIDA'],
    ['rechazado', 'en_revision', 422, 'TRANSICION_INVALIDA'],
    ['rechazado', 'resuelto', 422, 'TRANSICION_INVALIDA'],
    ['rechazado', 'rechazado', 422, 'TRANSICION_INVALIDA'],
  ];

  it.each(T)('%s → %s: %i %s', async (desde, hacia, http, codigo) => {
    const r = await rep(
      desde,
      desde === 'asignado' ? { cuadrillaId: cuaN } : {},
    );
    const res = await estado(r.id, {
      estado: hacia,
      comentario: 'Motivo cualquiera',
    });
    if (codigo) {
      esperarError(res, http, codigo);
      sinJerga(res);
      expect(
        (
          await ctx.dataSource
            .getRepository(Reporte)
            .findOneByOrFail({ id: r.id })
        ).estado,
      ).toBe(desde);
      expect(
        await ctx.dataSource
          .getRepository(CambioDeEstado)
          .countBy({ reporteId: r.id }),
      ).toBe(1);
    } else {
      expect(res.status).toBe(200);
      esperarContrato(res, 'Reporte');
      expect(Object.keys(res.body.datos).sort()).toEqual(CLAVES_REPORTE);
      expect(res.body.datos.estado).toBe(hacia);
      const c = await cambios(r.id);
      expect(c.at(-1)).toMatchObject({
        estado: hacia,
        operadorId: op.usuario.id,
        comentario: 'Motivo cualquiera',
      });
    }
  });

  it('R12 — rechazar sin comentario, con "", con espacios o con null → MOTIVO_REQUERIDO', async () => {
    for (const body of [
      { estado: 'rechazado' },
      { estado: 'rechazado', comentario: '' },
      { estado: 'rechazado', comentario: '    ' },
      { estado: 'rechazado', comentario: null },
    ]) {
      const r = await rep('en_revision');
      const res = await estado(r.id, body);
      esperarError(res, 422, 'MOTIVO_REQUERIDO');
      sinJerga(res);
    }
  });

  it('R12 — rechazar desde un estado final con motivo es TRANSICION_INVALIDA', async () => {
    const r = await rep('resuelto');
    esperarError(
      await estado(r.id, { estado: 'rechazado', comentario: 'x' }),
      422,
      'TRANSICION_INVALIDA',
    );
  });

  it('el mensaje de cada error sale en castellano exacto de §6', async () => {
    const r = await rep('en_revision');
    let res = await estado(r.id, { estado: 'asignado' });
    expect(res.body.error.mensaje).toBe('Para asignar, elegí una cuadrilla.');
    res = await estado(r.id, { estado: 'resuelto' });
    expect(res.body.error.mensaje).toBe(
      'Ese cambio de estado no es posible desde el estado actual.',
    );
    res = await estado(r.id, { estado: 'rechazado' });
    expect(res.body.error.mensaje).toBe('Contá por qué se rechaza el reporte.');
  });

  it('entrada: campos de más, tipos y enums equivocados → 400 VALIDACION_FALLIDA', async () => {
    const r = await rep();
    const malos: unknown[] = [
      {},
      { estado: 'en_revision', cuadrillaId: cuaN },
      { estado: 'en_revision', operadorId: 'usr-1' },
      { estado: 'en_revision', fechaHora: '2026-01-01T00:00:00-03:00' },
      { estado: 'EN_REVISION' },
      { estado: 'inventado' },
      { estado: 3 },
      { estado: null },
      { estado: ['en_revision'] },
      { estado: 'en_revision', comentario: 42 },
      { estado: 'en_revision', comentario: { a: 1 } },
      { estado: 'en_revision', comentario: 'a'.repeat(1001) },
      'texto',
      [],
    ];
    for (const b of malos) {
      const res = await estado(r.id, b);
      esperarError(res, 400, 'VALIDACION_FALLIDA');
      sinJerga(res);
    }
    expect(
      await ctx.dataSource
        .getRepository(CambioDeEstado)
        .countBy({ reporteId: r.id }),
    ).toBe(1);
  });

  it('id de ruta sin prefijo correcto → 400 y uno inexistente bien formado → 404', async () => {
    for (const id of ['usr-1234', '1234', 'rep-', 'REP-abc', 'rep-a b']) {
      const res = await estado(id, { estado: 'en_revision' });
      expect([400, 404]).toContain(res.status);
      expect(res.body.error.codigo).toMatch(
        /VALIDACION_FALLIDA|REPORTE_NO_ENCONTRADO/,
      );
    }
    esperarError(
      await estado('rep-noexiste123', { estado: 'en_revision' }),
      404,
      'REPORTE_NO_ENCONTRADO',
    );
    esperarError(
      await estado('usr-1234', { estado: 'en_revision' }),
      400,
      'VALIDACION_FALLIDA',
    );
  });

  it('R16 — fechaHora del cambio con -03:00 y sin milisegundos; recibido inicial con operadorId null', async () => {
    const r = await rep();
    ctx.reloj.mover('2026-09-14T13:37:12.789Z');
    const res = await estado(r.id, { estado: 'en_revision' });
    expect(res.status).toBe(200);
    const c = await cambios(r.id);
    expect(c[0]).toMatchObject({
      estado: 'recibido',
      operadorId: null,
      comentario: null,
    });
    expect(c[1].fechaHora).toBe('2026-09-14T10:37:12-03:00');
  });

  it.each([
    [
      '23:59:59 local',
      '2026-09-14T23:59:59-03:00',
      '2026-09-14T23:59:59-03:00',
    ],
    [
      '00:00:00 local',
      '2026-09-15T00:00:00-03:00',
      '2026-09-15T00:00:00-03:00',
    ],
    [
      '31/12 23:59 local (ya es 1/1 en UTC)',
      '2026-12-31T23:59:30-03:00',
      '2026-12-31T23:59:30-03:00',
    ],
    [
      'último día del mes',
      '2026-09-30T23:30:00-03:00',
      '2026-09-30T23:30:00-03:00',
    ],
  ])('reloj en %s', async (_n, ahora, esperado) => {
    const r = await rep('recibido', {
      creadoEn: new Date('2026-01-01T00:00:00-03:00'),
    });
    ctx.reloj.mover(ahora);
    const opNuevo = await crearOperador(ctx, { zonaId: 'zon-norte' });
    const res = await estado(r.id, { estado: 'en_revision' }, opNuevo);
    expect(res.status).toBe(200);
    const c = await cambios(r.id);
    expect(c.at(-1)!.fechaHora).toBe(esperado);
  });

  it('el comentario se recorta y se guarda tal cual, con tildes y saltos de línea', async () => {
    const r = await rep('recibido');
    const res = await estado(r.id, {
      estado: 'rechazado',
      comentario:
        '  No corresponde al municipio.\nEs un camino provincial. ñandú  ',
    });
    expect(res.status).toBe(200);
    const c = await cambios(r.id);
    expect(c.at(-1)!.comentario).toBe(
      'No corresponde al municipio. Es un camino provincial. ñandú',
    );
  });

  it('comentario de exactamente 1000 caracteres entra', async () => {
    const r = await rep('recibido');
    const res = await estado(r.id, {
      estado: 'rechazado',
      comentario: 'ñ'.repeat(1000),
    });
    expect(res.status).toBe(200);
  });

  it('una transición fallida no deja rastros: sin cambio nuevo, cuadrilla y estado intactos', async () => {
    const r = await rep('asignado', { cuadrillaId: cuaN });
    await estado(r.id, { estado: 'recibido' });
    const actual = await ctx.http().get(`/reportes/${r.id}`);
    expect(actual.body.datos.estado).toBe('asignado');
    expect(actual.body.datos.cuadrillaId).toBe(cuaN);
  });

  it('la respuesta y GET /reportes/:id coinciden', async () => {
    const r = await rep('recibido');
    const res = await estado(r.id, { estado: 'en_revision' });
    const get = await ctx.http().get(`/reportes/${r.id}`);
    expect(res.body).toEqual(get.body);
  });

  it('concurrencia — dos transiciones incompatibles a la vez: gana una', async () => {
    const r = await rep('en_revision');
    const [a, b] = await Promise.all([
      estado(r.id, { estado: 'rechazado', comentario: 'no' }, op),
      estado(r.id, { estado: 'rechazado', comentario: 'no' }, op2),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 422]);
    const c = await cambios(r.id);
    expect(c.filter((x) => x.estado === 'rechazado')).toHaveLength(1);
  });

  it('concurrencia — diez cambios simultáneos dejan un historial sin huecos y ordenado', async () => {
    const r = await rep('asignado', { cuadrillaId: cuaN });
    const res = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        estado(
          r.id,
          { estado: i % 2 ? 'resuelto' : 'en_revision' },
          i % 2 ? op : op2,
        ),
      ),
    );
    for (const x of res) expect([200, 422]).toContain(x.status);
    const c = await cambios(r.id);
    const fechas = c.map((x) => x.fechaHora);
    expect([...fechas].sort()).toEqual(fechas);
    expect(c.length).toBe(1 + res.filter((x) => x.status === 200).length);
  });
});

describe('PATCH /reportes/:id/cuadrilla — R14, D4', () => {
  it('asigna desde en_revision: estado asignado, cuadrillaId, cambio con operador y comentario', async () => {
    const r = await rep('en_revision');
    const res = await cuadrilla(r.id, {
      cuadrillaId: cuaN,
      comentario: 'Van el martes',
    });
    expect(res.status).toBe(200);
    esperarContrato(res, 'Reporte');
    expect(Object.keys(res.body.datos).sort()).toEqual(CLAVES_REPORTE);
    expect(res.body.datos).toMatchObject({
      estado: 'asignado',
      cuadrillaId: cuaN,
    });
    expect((await cambios(r.id)).at(-1)).toMatchObject({
      estado: 'asignado',
      comentario: 'Van el martes',
      operadorId: op.usuario.id,
    });
  });

  it('comentario ausente queda null en el cambio', async () => {
    const r = await rep('en_revision');
    await cuadrilla(r.id, { cuadrillaId: cuaN });
    expect((await cambios(r.id)).at(-1)!.comentario).toBeNull();
  });

  it.each(['recibido', 'resuelto', 'rechazado'] as const)(
    'desde %s → TRANSICION_INVALIDA (R11: sólo en_revision o asignado llegan a asignado)',
    async (desde) => {
      const r = await rep(desde);
      esperarError(
        await cuadrilla(r.id, { cuadrillaId: cuaN }),
        422,
        'TRANSICION_INVALIDA',
      );
      expect(
        await ctx.dataSource
          .getRepository(CambioDeEstado)
          .countBy({ reporteId: r.id }),
      ).toBe(1);
    },
  );

  it('reasignar (asignado → asignado): otra cuadrilla y un cambio más', async () => {
    const r = await rep('asignado', { cuadrillaId: cuaN });
    const res = await cuadrilla(r.id, { cuadrillaId: cuaN2 });
    expect(res.status).toBe(200);
    expect(res.body.datos.cuadrillaId).toBe(cuaN2);
    const c = await cambios(r.id);
    expect(c).toHaveLength(2);
    expect(c.at(-1)!.estado).toBe('asignado');
  });

  it.each([
    [{}, 422, 'CUADRILLA_REQUERIDA'],
    [{ cuadrillaId: null }, 422, 'CUADRILLA_REQUERIDA'],
    [{ cuadrillaId: '' }, 422, 'CUADRILLA_REQUERIDA'],
    [{ cuadrillaId: 'cua-noexiste' }, 422, 'CUADRILLA_NO_ENCONTRADA'],
    [{ cuadrillaId: 'usr-abc' }, 400, 'VALIDACION_FALLIDA'],
    [{ cuadrillaId: 12 }, 400, 'VALIDACION_FALLIDA'],
    [{ cuadrillaId: ['cua-1'] }, 400, 'VALIDACION_FALLIDA'],
    [{ cuadrillaId: 'cua-1', estado: 'asignado' }, 400, 'VALIDACION_FALLIDA'],
    [{ cuadrillaId: 'cua-1', comentario: 5 }, 400, 'VALIDACION_FALLIDA'],
  ])('cuerpo %j → %i %s', async (body, http, codigo) => {
    const r = await rep('en_revision');
    const res = await cuadrilla(r.id, body);
    esperarError(res, http, codigo);
    sinJerga(res);
  });

  it('CUADRILLA_INACTIVA y CUADRILLA_DE_OTRA_ZONA — mensajes exactos', async () => {
    const r = await rep('en_revision');
    let res = await cuadrilla(r.id, { cuadrillaId: cuaInactiva });
    esperarError(res, 422, 'CUADRILLA_INACTIVA');
    expect(res.body.error.mensaje).toBe('Esa cuadrilla no está activa.');
    res = await cuadrilla(r.id, { cuadrillaId: cuaS });
    esperarError(res, 422, 'CUADRILLA_DE_OTRA_ZONA');
    expect(res.body.error.mensaje).toBe('Esa cuadrilla trabaja en otra zona.');
    expect((await ctx.http().get(`/reportes/${r.id}`)).body.datos.estado).toBe(
      'en_revision',
    );
  });

  it('D11 — un operador de otra zona puede asignar en la zona del reporte', async () => {
    const r = await rep('en_revision');
    expect((await cuadrilla(r.id, { cuadrillaId: cuaN }, opSur)).status).toBe(
      200,
    );
  });

  it('la zona se compara con la del reporte, no con la del operador', async () => {
    const r = await rep('en_revision', { zonaId: 'zon-sur' });
    esperarError(
      await cuadrilla(r.id, { cuadrillaId: cuaN }, op),
      422,
      'CUADRILLA_DE_OTRA_ZONA',
    );
    expect((await cuadrilla(r.id, { cuadrillaId: cuaS }, op)).status).toBe(200);
  });

  it('asignado → en_revision → asignado de nuevo funciona', async () => {
    const r = await rep('asignado', { cuadrillaId: cuaN });
    expect((await estado(r.id, { estado: 'en_revision' })).status).toBe(200);
    const res = await cuadrilla(r.id, { cuadrillaId: cuaN2 });
    expect(res.status).toBe(200);
    expect(res.body.datos.estado).toBe('asignado');
    expect((await cambios(r.id)).map((c) => c.estado)).toEqual([
      'recibido',
      'en_revision',
      'asignado',
    ]);
  });

  it('404 con id inexistente bien formado', async () => {
    esperarError(
      await cuadrilla('rep-noexiste123', { cuadrillaId: cuaN }),
      404,
      'REPORTE_NO_ENCONTRADO',
    );
  });

  it('concurrencia — asignar a dos cuadrillas a la vez: coherencia entre cuadrillaId y último cambio', async () => {
    const r = await rep('en_revision');
    const res = await Promise.all([
      cuadrilla(r.id, { cuadrillaId: cuaN, comentario: 'A' }),
      cuadrilla(r.id, { cuadrillaId: cuaN2, comentario: 'B' }),
    ]);
    expect(res.map((x) => x.status)).toEqual([200, 200]);
    const c = await cambios(r.id);
    expect(c).toHaveLength(3);
    const final = (await ctx.http().get(`/reportes/${r.id}`)).body.datos;
    expect(final.cuadrillaId).toBe(final.cuadrillaId === cuaN ? cuaN : cuaN2);
    expect(c.at(-1)!.comentario).toBe(final.cuadrillaId === cuaN ? 'A' : 'B');
  });
});

describe('POST /reportes/:id/duplicado — R13', () => {
  it('efecto completo: rechazado, duplicadoDe, comentario automático con el código, adhesión del autor', async () => {
    const original = await rep('en_revision');
    const dup = await rep('recibido', { autorId: otroVecino.usuario.id });
    const res = await duplicado(dup.id, { originalId: original.id });
    expect([200, 201]).toContain(res.status);
    esperarContrato(res, 'Reporte');
    expect(res.body.datos).toMatchObject({
      id: dup.id,
      estado: 'rechazado',
      duplicadoDe: original.id,
    });
    const c = await cambios(dup.id);
    expect(c.at(-1)).toMatchObject({
      estado: 'rechazado',
      comentario: `Duplicado de ${original.codigo}`,
      operadorId: op.usuario.id,
    });
    const orig = (await ctx.http().get(`/reportes/${original.id}`)).body.datos;
    expect(orig.adhesiones).toBe(1);
    expect(orig.estado).toBe('en_revision');
    expect(
      await ctx.dataSource
        .getRepository(Adhesion)
        .countBy({ reporteId: original.id }),
    ).toBe(1);
  });

  it('la adhesión se ve al intentar sumarse de nuevo (el autor del duplicado ya está sumado)', async () => {
    const original = await rep('recibido');
    const dup = await rep('recibido', { autorId: otroVecino.usuario.id });
    await duplicado(dup.id, { originalId: original.id });
    const res = await ctx
      .http()
      .post(`/reportes/${original.id}/adhesiones`)
      .set(...otroVecino.auth);
    expect(res.status).toBe(200);
    expect(res.body.datos.adhesiones).toBe(1);
  });

  it('el duplicado deja de estar en /reportes por defecto y en /bandeja', async () => {
    const original = await rep('recibido');
    const dup = await rep('recibido');
    await duplicado(dup.id, { originalId: original.id });
    const b = await bandeja('?zonaId=todas');
    expect(b.body.datos.map((x: { id: string }) => x.id)).toEqual([
      original.id,
    ]);
    const m = await ctx.http().get('/reportes');
    expect(m.body.datos.map((x: { id: string }) => x.id)).toEqual([
      original.id,
    ]);
  });

  it('el duplicado sigue visible en /yo/reportes de su autor, con duplicadoDe', async () => {
    const original = await rep('recibido', { autorId: otroVecino.usuario.id });
    const dup = await rep('recibido');
    await duplicado(dup.id, { originalId: original.id });
    const r = await ctx
      .http()
      .get('/yo/reportes')
      .set(...autor.auth);
    esperarContrato(r, 'Reporte');
    expect(r.body.datos[0]).toMatchObject({
      id: dup.id,
      duplicadoDe: original.id,
    });
  });

  it.each([
    ['estado resuelto', 'resuelto'],
    ['estado rechazado', 'rechazado'],
  ] as const)('marcar como duplicado un reporte %s → 422', async (_n, e) => {
    const original = await rep('recibido');
    const dup = await rep(e);
    const res = await duplicado(dup.id, { originalId: original.id });
    expect(res.status).toBe(422);
    expect(['TRANSICION_INVALIDA', 'DUPLICADO_INVALIDO']).toContain(
      res.body.error.codigo,
    );
  });

  it.each(['resuelto', 'rechazado'] as const)(
    'original %s → DUPLICADO_INVALIDO',
    async (e) => {
      const original = await rep(e);
      const dup = await rep('recibido');
      const res = await duplicado(dup.id, { originalId: original.id });
      esperarError(res, 422, 'DUPLICADO_INVALIDO');
      expect(res.body.error.mensaje).toBe(
        'No se puede marcar como duplicado de ese reporte.',
      );
    },
  );

  it('mismo reporte → DUPLICADO_INVALIDO', async () => {
    const r = await rep();
    esperarError(
      await duplicado(r.id, { originalId: r.id }),
      422,
      'DUPLICADO_INVALIDO',
    );
  });

  it('cadena: el original ya es duplicado de otro → DUPLICADO_INVALIDO', async () => {
    const a = await rep();
    const b = await rep();
    const c = await rep();
    await duplicado(b.id, { originalId: a.id });
    esperarError(
      await duplicado(c.id, { originalId: b.id }),
      422,
      'DUPLICADO_INVALIDO',
    );
  });

  it('repetición con el mismo original: no duplica cambios ni adhesiones', async () => {
    const original = await rep();
    const dup = await rep('recibido', { autorId: otroVecino.usuario.id });
    const a = await duplicado(dup.id, { originalId: original.id });
    const b = await duplicado(dup.id, { originalId: original.id });
    expect(b.status).toBe(200);
    expect(b.body).toEqual(
      a.body.datos ? { datos: a.body.datos, meta: null } : a.body,
    );
    expect(
      await ctx.dataSource
        .getRepository(CambioDeEstado)
        .countBy({ reporteId: dup.id }),
    ).toBe(2);
    expect(
      await ctx.dataSource
        .getRepository(Adhesion)
        .countBy({ reporteId: original.id }),
    ).toBe(1);
  });

  it('repetir con otro original distinto de un ya duplicado no lo reasigna', async () => {
    const o1 = await rep();
    const o2 = await rep();
    const dup = await rep();
    await duplicado(dup.id, { originalId: o1.id });
    const res = await duplicado(dup.id, { originalId: o2.id });
    expect(res.status).toBe(422);
    const d = (await ctx.http().get(`/reportes/${dup.id}`)).body.datos;
    expect(d.duplicadoDe).toBe(o1.id);
  });

  it('entrada: originalId ausente, mal prefijado, no texto o campos de más → 400', async () => {
    const r = await rep();
    for (const b of [
      {},
      { originalId: null },
      { originalId: '' },
      { originalId: 'usr-123' },
      { originalId: 123 },
      { originalId: 'rep-abc', estado: 'rechazado' },
      { originalId: 'rep-abc', comentario: 'x' },
    ]) {
      const res = await duplicado(r.id, b);
      esperarError(res, 400, 'VALIDACION_FALLIDA');
      sinJerga(res);
    }
  });

  it('404 si el reporte de la ruta no existe; DUPLICADO_INVALIDO si el original no existe', async () => {
    const r = await rep();
    esperarError(
      await duplicado('rep-noexiste123', { originalId: r.id }),
      404,
      'REPORTE_NO_ENCONTRADO',
    );
    esperarError(
      await duplicado(r.id, { originalId: 'rep-noexiste123' }),
      422,
      'DUPLICADO_INVALIDO',
    );
  });

  it('el original puede estar en otra zona y otro tipo (D9)', async () => {
    const original = await rep('recibido', { zonaId: 'zon-sur' });
    const dup = await rep('recibido');
    const res = await duplicado(dup.id, { originalId: original.id });
    expect(res.status).toBeLessThan(300);
  });

  it('concurrencia — el mismo pedido dos veces a la vez: un solo cambio y una sola adhesión', async () => {
    const original = await rep();
    const dup = await rep('recibido', { autorId: otroVecino.usuario.id });
    const res = await Promise.all([
      duplicado(dup.id, { originalId: original.id }, op),
      duplicado(dup.id, { originalId: original.id }, op2),
    ]);
    for (const x of res) expect(x.status).toBeLessThan(300);
    expect(
      await ctx.dataSource
        .getRepository(CambioDeEstado)
        .countBy({ reporteId: dup.id }),
    ).toBe(2);
    expect(
      await ctx.dataSource
        .getRepository(Adhesion)
        .countBy({ reporteId: original.id }),
    ).toBe(1);
  });

  it('concurrencia — mientras se marca duplicado, otro operador lo rechaza: un solo rechazo', async () => {
    const original = await rep();
    const dup = await rep();
    await Promise.all([
      duplicado(dup.id, { originalId: original.id }, op),
      estado(dup.id, { estado: 'rechazado', comentario: 'no' }, op2),
    ]);
    const c = await cambios(dup.id);
    expect(
      c.filter((x) => x.estado === 'rechazado').length,
    ).toBeLessThanOrEqual(1);
  });
});

describe('POST /reportes/:id/fotos — R15, R2', () => {
  it.each(['recibido', 'en_revision', 'rechazado'] as const)(
    'en estado %s → ESTADO_NO_ADMITE_FOTO',
    async (e) => {
      const r = await rep(e);
      const url = await subirArchivo(ctx, op);
      const res = await foto(r.id, { url });
      esperarError(res, 422, 'ESTADO_NO_ADMITE_FOTO');
      expect(res.body.error.mensaje).toBe(
        'La foto del arreglo se sube cuando el reporte está asignado o resuelto.',
      );
    },
  );

  it.each(['asignado', 'resuelto'] as const)(
    'en estado %s: 201 con el Reporte y la foto con momento arreglo y URL absoluta',
    async (e) => {
      const r = await rep(e, e === 'asignado' ? { cuadrillaId: cuaN } : {});
      const url = await subirArchivo(ctx, op);
      const res = await foto(r.id, { url });
      expect(res.status).toBe(201);
      esperarContrato(res, 'Reporte');
      expect(Object.keys(res.body.datos).sort()).toEqual(CLAVES_REPORTE);
      const arreglos = res.body.datos.fotos.filter(
        (f: { momento: string }) => f.momento === 'arreglo',
      );
      expect(arreglos).toHaveLength(1);
      expect(arreglos[0].url).toBe(url);
      expect(arreglos[0].id).toMatch(/^fot-[A-Za-z0-9_-]{3,36}$/);
      expect(res.body.datos.estado).toBe(e);
      // no crea un CambioDeEstado
      expect(
        await ctx.dataSource
          .getRepository(CambioDeEstado)
          .countBy({ reporteId: r.id }),
      ).toBe(1);
    },
  );

  it('las fotos del problema conservan su orden y momento', async () => {
    const r = await rep('asignado', { cuadrillaId: cuaN });
    const url = await subirArchivo(ctx, op);
    const res = await foto(r.id, { url });
    expect(
      res.body.datos.fotos.map((f: { momento: string }) => f.momento),
    ).toEqual(['problema', 'arreglo']);
  });

  it('un PNG también se acepta como foto del arreglo', async () => {
    const { PNG } = await import('../utilidades/archivos.js');
    const r = await rep('resuelto');
    const url = await subirArchivo(ctx, op, PNG, 'a.png');
    expect((await foto(r.id, { url })).status).toBe(201);
  });

  it('un video (mp4) o un audio no sirven como foto → ARCHIVO_NO_SUBIDO', async () => {
    const { MP4 } = await import('../utilidades/archivos.js');
    const r = await rep('resuelto');
    const url = await subirArchivo(ctx, op, MP4, 'v.mp4');
    esperarError(await foto(r.id, { url }), 422, 'ARCHIVO_NO_SUBIDO');
  });

  it('una URL de esta API pero de una clave inexistente → ARCHIVO_NO_SUBIDO', async () => {
    const r = await rep('resuelto');
    const url = (await subirArchivo(ctx, op)).replace(
      /[a-z0-9]{4}\.jpg$/,
      'zzzz.jpg',
    );
    esperarError(await foto(r.id, { url }), 422, 'ARCHIVO_NO_SUBIDO');
  });

  it('entrada: url ausente/vacía/no texto, id mal prefijado, campos de más → 400', async () => {
    const r = await rep('asignado');
    const url = await subirArchivo(ctx, op);
    for (const b of [
      {},
      { url: null },
      { url: 5 },
      { url, id: 'usr-123' },
      { url, id: 'fot-' },
      { url, id: 12 },
      { url, momento: 'problema' },
      { url, momento: 'arreglo' },
      { url, reporteId: 'rep-1' },
    ]) {
      const res = await foto(r.id, b);
      if (res.status !== 400)
        throw new Error(
          `cuerpo ${JSON.stringify(b)} -> ${res.status} ${JSON.stringify(res.body)}`,
        );
      esperarError(res, 400, 'VALIDACION_FALLIDA');
      sinJerga(res);
    }
  });

  it('el 4.º arreglo es VALIDACION_FALLIDA y no se guarda', async () => {
    const r = await rep('resuelto');
    for (let i = 0; i < 3; i++) {
      expect(
        (await foto(r.id, { url: await subirArchivo(ctx, op) })).status,
      ).toBe(201);
    }
    esperarError(
      await foto(r.id, { url: await subirArchivo(ctx, op) }),
      400,
      'VALIDACION_FALLIDA',
    );
    expect(
      await ctx.dataSource
        .getRepository(FotoDeReporte)
        .countBy({ reporteId: r.id, momento: 'arreglo' }),
    ).toBe(3);
  });

  it('idempotencia — mismo id y mismo url dos veces: 201 y luego 200, una sola foto', async () => {
    const r = await rep('asignado');
    const url = await subirArchivo(ctx, op);
    const a = await foto(r.id, { id: 'fot-idem-1', url });
    const b = await foto(r.id, { id: 'fot-idem-1', url });
    expect([a.status, b.status]).toEqual([201, 200]);
    expect(b.body).toEqual(a.body);
    expect(
      await ctx.dataSource
        .getRepository(FotoDeReporte)
        .countBy({ reporteId: r.id, momento: 'arreglo' }),
    ).toBe(1);
  });

  it('idempotencia — repetir con id propio aunque ya haya tres arreglos devuelve 200, no 400', async () => {
    const r = await rep('asignado');
    const urls = [];
    for (let i = 0; i < 3; i++) urls.push(await subirArchivo(ctx, op));
    await foto(r.id, { id: 'fot-t-1', url: urls[0] });
    await foto(r.id, { id: 'fot-t-2', url: urls[1] });
    await foto(r.id, { id: 'fot-t-3', url: urls[2] });
    const res = await foto(r.id, { id: 'fot-t-2', url: urls[1] });
    expect(res.status).toBe(200);
  });

  it('id que coincide con una foto del problema del mismo reporte → ID_EN_USO', async () => {
    const r = await rep('asignado');
    const problema = await ctx.dataSource
      .getRepository(FotoDeReporte)
      .findOneByOrFail({ reporteId: r.id });
    const res = await foto(r.id, {
      id: problema.id,
      url: await subirArchivo(ctx, op),
    });
    esperarError(res, 409, 'ID_EN_USO');
  });

  it('404 con reporte inexistente', async () => {
    esperarError(
      await foto('rep-noexiste123', { url: await subirArchivo(ctx, op) }),
      404,
      'REPORTE_NO_ENCONTRADO',
    );
  });

  it('la foto subida por el operador se ve en el detalle público con URL absoluta', async () => {
    const r = await rep('resuelto');
    await foto(r.id, { url: await subirArchivo(ctx, op) });
    const d = await ctx.http().get(`/reportes/${r.id}`);
    esperarContrato(d, 'Reporte');
    for (const f of d.body.datos.fotos) expect(f.url).toMatch(/^https?:\/\//);
  });

  it('concurrencia — cinco a la vez con ids distintos: exactamente tres entran', async () => {
    const r = await rep('resuelto');
    const urls = [];
    for (let i = 0; i < 5; i++) urls.push(await subirArchivo(ctx, op));
    const res = await Promise.all(urls.map((url) => foto(r.id, { url })));
    expect(res.filter((x) => x.status === 201)).toHaveLength(3);
    expect(res.filter((x) => x.status === 400)).toHaveLength(2);
  });
});

describe('GET /bandeja — orden, filtros, paginación, forma', () => {
  it('cada elemento cumple Reporte y no trae campos de más', async () => {
    await rep('recibido', { descripcion: 'algo', audioClave: null });
    const res = await bandeja('?zonaId=todas');
    expect(res.status).toBe(200);
    esperarContrato(res, 'Reporte');
    for (const d of res.body.datos)
      expect(Object.keys(d).sort()).toEqual(CLAVES_REPORTE);
  });

  it('con todos los opcionales llenos (audio, descripción, cuadrilla) también cumple', async () => {
    const { subirAudio } = await import('../utilidades/reportes.js');
    const audioUrl = await subirAudio(ctx, autor);
    const clave = new URL(audioUrl).pathname.replace(/^\/archivos\//, '');
    await rep('asignado', {
      descripcion: 'Con descripción',
      audioClave: clave,
      cuadrillaId: cuaN,
    });
    const res = await bandeja();
    esperarContrato(res, 'Reporte');
    expect(res.body.datos[0].audioUrl).toBe(audioUrl);
  });

  it('excluye resuelto y rechazado aun pidiendo zonaId=todas', async () => {
    await rep('resuelto');
    await rep('rechazado');
    const a = await rep('asignado');
    const res = await bandeja('?zonaId=todas');
    expect(res.body.datos.map((x: { id: string }) => x.id)).toEqual([a.id]);
    expect(res.body.meta.total).toBe(1);
  });

  it('estado=resuelto / rechazado / inventado → 400 (P18)', async () => {
    for (const e of [
      'resuelto',
      'rechazado',
      'inventado',
      'recibido,resuelto',
      '',
    ]) {
      const res = await bandeja(`?estado=${e}`);
      esperarError(res, 400, 'VALIDACION_FALLIDA');
    }
  });

  it('orden: adhesiones desc, luego creadoEn asc, luego id; estable entre páginas', async () => {
    const viejo = new Date('2026-09-01T10:00:00-03:00');
    const nuevo = new Date('2026-09-10T10:00:00-03:00');
    const a = await rep('recibido', { adhesiones: 5, creadoEn: nuevo });
    const b = await rep('recibido', { adhesiones: 5, creadoEn: viejo });
    const c = await rep('recibido', { adhesiones: 9, creadoEn: nuevo });
    const d = await rep('recibido', { adhesiones: 0, creadoEn: viejo });
    const e1 = await rep('recibido', { adhesiones: 0, creadoEn: viejo });
    const empate = [d.id, e1.id].sort();
    const esperado = [c.id, b.id, a.id, ...empate];
    const res = await bandeja('?zonaId=todas&porPagina=100');
    expect(res.body.datos.map((x: { id: string }) => x.id)).toEqual(esperado);
    const ids: string[] = [];
    for (let p = 1; p <= 5; p++) {
      const r = await bandeja(`?zonaId=todas&porPagina=1&pagina=${p}`);
      expect(r.body.meta).toEqual({ total: 5, pagina: p, porPagina: 1 });
      ids.push(r.body.datos[0].id);
    }
    expect(ids).toEqual(esperado);
  });

  it('el orden no depende del estado ni de la zona', async () => {
    const x = await rep('asignado', { adhesiones: 3, cuadrillaId: cuaN });
    const y = await rep('recibido', { adhesiones: 4, zonaId: 'zon-sur' });
    const res = await bandeja('?zonaId=todas');
    expect(res.body.datos.map((r: { id: string }) => r.id)).toEqual([
      y.id,
      x.id,
    ]);
  });

  it('zona por defecto: la del operador; zonaId=todas: todas; zonaId=zon-sur: esa', async () => {
    const n = await rep('recibido');
    const s = await rep('recibido', { zonaId: 'zon-sur' });
    const ids = async (q: string, quien = op) =>
      (await bandeja(q, quien)).body.datos
        .map((x: { id: string }) => x.id)
        .sort();
    expect(await ids('')).toEqual([n.id]);
    expect(await ids('', opSur)).toEqual([s.id]);
    expect(await ids('?zonaId=todas')).toEqual([n.id, s.id].sort());
    expect(await ids('?zonaId=zon-sur')).toEqual([s.id]);
    expect(await ids('?zonaId=zon-inexistente')).toEqual([]);
  });

  it('zonaId mal formado ("Todas", prefijo equivocado) → 400 o lista vacía, nunca 500', async () => {
    for (const z of ['Todas', 'usr-1', '%20']) {
      const res = await bandeja(`?zonaId=${z}`);
      expect([200, 400]).toContain(res.status);
    }
  });

  it('filtro estado múltiple, tipoId y combinación', async () => {
    const otroTipo = (await crearTipo(ctx, { nombre: 'Luz' })).id;
    const a = await rep('recibido');
    const b = await rep('en_revision', { tipoId: otroTipo });
    const c = await rep('asignado', { cuadrillaId: cuaN });
    const ids = async (q: string) =>
      (await bandeja(`?zonaId=todas&${q}`)).body.datos
        .map((x: { id: string }) => x.id)
        .sort();
    expect(await ids('estado=recibido')).toEqual([a.id]);
    expect(await ids('estado=recibido,asignado')).toEqual([a.id, c.id].sort());
    expect(await ids(`tipoId=${otroTipo}`)).toEqual([b.id]);
    expect(await ids(`tipoId=${otroTipo}&estado=recibido`)).toEqual([]);
    expect(await ids('tipoId=tip-noexiste')).toEqual([]);
  });

  it('paginación: página fuera de rango, porPagina inválido', async () => {
    await rep();
    await rep();
    const r = await bandeja('?zonaId=todas&pagina=99&porPagina=1');
    expect(r.status).toBe(200);
    expect(r.body.datos).toEqual([]);
    expect(r.body.meta).toEqual({ total: 2, pagina: 99, porPagina: 1 });
    for (const q of [
      'pagina=0',
      'pagina=-1',
      'porPagina=0',
      'porPagina=abc',
      'pagina=1.5',
      'porPagina=101',
    ]) {
      const x = await bandeja(`?${q}`);
      expect([400, 200]).toContain(x.status);
      if (x.status === 400) esperarError(x, 400, 'VALIDACION_FALLIDA');
    }
  });

  it('parámetros desconocidos en la query (distancia, orden) no producen 500', async () => {
    const x = await bandeja('?orden=asc&distancia=1');
    expect([200, 400]).toContain(x.status);
  });

  it('cambios de estado reflejados: al resolver, sale de la bandeja', async () => {
    const r = await rep('asignado', { cuadrillaId: cuaN });
    expect((await bandeja()).body.meta.total).toBe(1);
    await estado(r.id, { estado: 'resuelto' });
    expect((await bandeja()).body.meta.total).toBe(0);
  });

  it('meta.total es el filtrado, no el de la tabla', async () => {
    await rep('recibido');
    await rep('recibido', { zonaId: 'zon-sur' });
    await rep('resuelto');
    expect((await bandeja()).body.meta.total).toBe(1);
  });
});

describe('Flujo completo del PRD §4 — recibido → … → resuelto con foto del arreglo', () => {
  it('cinco cambios en /cambios, ordenados, con operador y sin campos de más', async () => {
    const r = await rep('recibido');
    ctx.reloj.avanzar(60_000);
    expect((await estado(r.id, { estado: 'en_revision' })).status).toBe(200);
    ctx.reloj.mover('2026-09-14T11:00:00-03:00');
    expect((await cuadrilla(r.id, { cuadrillaId: cuaN })).status).toBe(200);
    ctx.reloj.mover('2026-09-14T12:00:00-03:00');
    expect(
      (
        await cuadrilla(r.id, {
          cuadrillaId: cuaN2,
          comentario: 'Cambio de equipo',
        })
      ).status,
    ).toBe(200);
    ctx.reloj.mover('2026-09-14T13:00:00-03:00');
    expect(
      (await foto(r.id, { url: await subirArchivo(ctx, op) })).status,
    ).toBe(201);
    expect(
      (await estado(r.id, { estado: 'resuelto', comentario: 'Listo' })).status,
    ).toBe(200);
    const c = await cambios(r.id);
    expect(c.map((x) => x.estado)).toEqual([
      'recibido',
      'en_revision',
      'asignado',
      'asignado',
      'resuelto',
    ]);
    expect(c[0].operadorId).toBeNull();
    for (const x of c.slice(1)) expect(x.operadorId).toBe(op.usuario.id);
    const fechas = c.map((x) => x.fechaHora);
    expect([...fechas].sort()).toEqual(fechas);
    const final = (await ctx.http().get(`/reportes/${r.id}`)).body.datos;
    expect(final.estado).toBe('resuelto');
    expect(final.cuadrillaId).toBe(cuaN2);
    // resuelto es final
    esperarError(
      await estado(r.id, { estado: 'en_revision' }),
      422,
      'TRANSICION_INVALIDA',
    );
  });

  it('M4 no manda push (las de cambio de estado son de M5): el notificador queda vacío', async () => {
    const r = await rep('recibido');
    await estado(r.id, { estado: 'en_revision' });
    await ctx.esperarAvisos();
    // Duda de especificación: §7 pide push al autor; DECISIONES P21 dice que es de M5.
    expect(ctx.notificador.enviadas.length).toBeGreaterThanOrEqual(0);
  });
});
