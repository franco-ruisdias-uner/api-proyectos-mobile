// Verificación independiente de M5 — Avisos (ESPECIFICACION §4 M5, §5, §7, D13; AGENTS §9). Caja negra.
import { JwtService } from '@nestjs/jwt';
import { crearApp, type AppDePrueba } from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import {
  crearCuadrilla,
  crearTipo,
  crearZona,
  cuadradoAlrededorDe,
} from '../utilidades/catalogos.js';
import {
  crearOperador,
  crearVecino,
  type UsuarioDePrueba,
} from '../utilidades/usuarios.js';
import {
  crearCambio,
  crearReporte,
  cuerpoReporte,
  ROCAMORA,
  subirArchivo,
} from '../utilidades/reportes.js';
import type { EstadoReporte } from '../../contrato/tipos.js';

const JERGA =
  /\b(must|should|property|undefined|null|cannot|exception|invalid|string|boolean|number|array|entity|constraint|sql|jwt|payload|body|whitelist|estado:|rep-|usr-|cua-)\b/i;
const SECRETO = 'secreto-solo-para-los-tests-de-la-api';

let ctx: AppDePrueba;
let op: UsuarioDePrueba;
let op2: UsuarioDePrueba;
let autor: UsuarioDePrueba;
let ana: UsuarioDePrueba;
let tipoId: string;
let cua: string;
let cuaSur: string;
let n = 0;
const nuevoToken = () =>
  `ExponentPushToken[ver5-${++n}-${Math.random().toString(36).slice(2, 8)}]`;

/** Registra un dispositivo por la API pública (como lo hace la app). */
async function dispositivo(u: UsuarioDePrueba): Promise<string> {
  const t = nuevoToken();
  const r = await ctx
    .http()
    .post('/dispositivos')
    .set(...u.auth)
    .send({ tokenExpo: t, plataforma: 'android' });
  expect([200, 201]).toContain(r.status);
  return t;
}

async function rep(
  duenio: UsuarioDePrueba,
  estado: EstadoReporte = 'recibido',
  zonaId = 'zon-norte',
) {
  const r = await crearReporte(ctx, {
    autorId: duenio.usuario.id,
    tipoId,
    zonaId,
    estado,
    // fuera del rango que asigna el servidor a los reportes creados por la API
    codigo: `GCHU-2026-${String(50000 + ++n)}`,
  });
  await crearCambio(ctx, { reporteId: r.id });
  return r;
}

const estado = (id: string, body: object, q: UsuarioDePrueba = op) =>
  ctx
    .http()
    .patch(`/reportes/${id}/estado`)
    .set(...q.auth)
    .send(body);
const asignar = (id: string, body: object, q: UsuarioDePrueba = op) =>
  ctx
    .http()
    .patch(`/reportes/${id}/cuadrilla`)
    .set(...q.auth)
    .send(body);
const duplicado = (id: string, originalId: string, q: UsuarioDePrueba = op) =>
  ctx
    .http()
    .post(`/reportes/${id}/duplicado`)
    .set(...q.auth)
    .send({ originalId });
const sumar = (id: string, q: UsuarioDePrueba) =>
  ctx
    .http()
    .post(`/reportes/${id}/adhesiones`)
    .set(...q.auth);

async function avisos() {
  await ctx.esperarAvisos();
  return [...ctx.notificador.enviadas];
}

beforeAll(async () => {
  ctx = await crearApp();
  op = await crearOperador(ctx, { zonaId: 'zon-norte' });
  op2 = await crearOperador(ctx, { zonaId: 'zon-norte' });
  autor = await crearVecino(ctx);
  ana = await crearVecino(ctx);
  tipoId = (await crearTipo(ctx, { id: 'tip-bache' })).id;
  await crearZona(ctx, {
    id: 'zon-norte',
    limite: cuadradoAlrededorDe(ROCAMORA.latitud, ROCAMORA.longitud),
  });
  await crearZona(ctx, { id: 'zon-sur' });
  cua = (await crearCuadrilla(ctx, { zonaId: 'zon-norte' })).id;
  cuaSur = (await crearCuadrilla(ctx, { zonaId: 'zon-sur' })).id;
});
beforeEach(async () => {
  await ctx.esperarAvisos();
  ctx.notificador.limpiar();
  // Personas nuevas por test: los dispositivos no se acumulan entre casos.
  autor = await crearVecino(ctx);
  ana = await crearVecino(ctx);
});
afterAll(() => ctx.cerrar());

describe('Especificación §7 — forma y texto de la push de estado', () => {
  it.each([
    ['recibido', 'en_revision', /revisi[oó]n/i],
    ['asignado', 'resuelto', /resuelt/i],
    ['recibido', 'rechazado', /rechazad/i],
  ] as const)(
    '%s → %s: un mensaje con el código, en castellano, sin jerga',
    async (desde, hasta, re) => {
      const t = await dispositivo(autor);
      const r = await rep(autor, desde);
      const res = await estado(r.id, {
        estado: hasta,
        ...(hasta === 'rechazado' ? { comentario: 'No corresponde.' } : {}),
      });
      expect(res.status).toBe(200);
      esperarContrato(res, 'Reporte');
      const e = await avisos();
      expect(e).toHaveLength(1);
      expect(e[0]!.tokenExpo).toBe(t);
      expect(e[0]!.cuerpo).toContain(r.codigo);
      expect(e[0]!.cuerpo).toMatch(re);
      expect(e[0]!.titulo.trim()).not.toBe('');
      expect(`${e[0]!.titulo} ${e[0]!.cuerpo}`).not.toMatch(JERGA);
      for (const v of Object.values(e[0]!.datos ?? {}))
        expect(typeof v).toBe('string');
      expect(e[0]!.datos).toMatchObject({ reporteId: r.id });
    },
  );

  it('asignar cuadrilla dice "cuadrilla" y el código', async () => {
    await dispositivo(autor);
    const r = await rep(autor, 'en_revision');
    const res = await asignar(r.id, { cuadrillaId: cua });
    expect(res.status).toBe(200);
    const e = await avisos();
    expect(e).toHaveLength(1);
    expect(e[0]!.cuerpo).toContain(r.codigo);
    expect(e[0]!.cuerpo).toMatch(/cuadrilla/i);
    expect(e[0]!.cuerpo).not.toContain(cua);
  });

  it('volver de asignado a en_revision también avisa', async () => {
    await dispositivo(autor);
    const r = await rep(autor, 'asignado');
    await estado(r.id, { estado: 'en_revision' });
    expect(await avisos()).toHaveLength(1);
  });

  it('el comentario del rechazo no filtra ids ni datos internos en la push', async () => {
    await dispositivo(autor);
    const r = await rep(autor);
    await estado(r.id, {
      estado: 'rechazado',
      comentario: 'Motivo cualquiera.',
    });
    const e = await avisos();
    expect(JSON.stringify(e)).not.toMatch(/contrasena|hash|email|@/i);
  });
});

describe('Especificación §7 — quién NO recibe push de estado', () => {
  it('autor sin dispositivos: no se manda nada y el pedido anda', async () => {
    const solo = await crearVecino(ctx);
    const r = await rep(solo);
    const res = await estado(r.id, { estado: 'en_revision' });
    expect(res.status).toBe(200);
    expect(await avisos()).toHaveLength(0);
  });

  it('autor con avisos apagados: nada, para estado, cuadrilla y duplicado', async () => {
    const mudo = await crearVecino(ctx, { avisosActivos: false });
    await dispositivo(mudo);
    const a = await rep(mudo);
    const b = await rep(mudo, 'en_revision');
    const c = await rep(mudo);
    const original = await rep(await crearVecino(ctx));
    await estado(a.id, { estado: 'en_revision' });
    await asignar(b.id, { cuadrillaId: cua });
    await duplicado(c.id, original.id);
    expect(await avisos()).toHaveLength(0);
  });

  it('D13 — un adherente no recibe el cambio de estado; sólo el autor', async () => {
    const tAutor = await dispositivo(autor);
    const tAna = await dispositivo(ana);
    const r = await rep(autor);
    expect((await sumar(r.id, ana)).status).toBe(201);
    await ctx.esperarAvisos();
    ctx.notificador.limpiar();
    await estado(r.id, { estado: 'en_revision' });
    await asignar(r.id, { cuadrillaId: cua });
    await estado(r.id, { estado: 'resuelto' });
    const e = await avisos();
    expect(e).toHaveLength(3);
    expect(e.every((m) => m.tokenExpo === tAutor)).toBe(true);
    expect(e.some((m) => m.tokenExpo === tAna)).toBe(false);
  });

  it('el operador que cambia el estado no recibe la push (aunque tenga dispositivo)', async () => {
    const tOp = await dispositivo(op);
    await dispositivo(autor);
    const r = await rep(autor);
    await estado(r.id, { estado: 'en_revision' });
    expect((await avisos()).some((m) => m.tokenExpo === tOp)).toBe(false);
  });

  it('un dispositivo que pasó a otro usuario avisa al nuevo dueño, no al anterior', async () => {
    const t = await dispositivo(autor);
    const r1 = await rep(autor);
    // el mismo teléfono ahora es de Ana
    await ctx
      .http()
      .post('/dispositivos')
      .set(...ana.auth)
      .send({ tokenExpo: t, plataforma: 'android' });
    await estado(r1.id, { estado: 'en_revision' });
    expect(await avisos()).toHaveLength(0);
    const r2 = await rep(ana);
    await estado(r2.id, { estado: 'en_revision' });
    const e = await avisos();
    expect(e).toHaveLength(1);
    expect(e[0]!.tokenExpo).toBe(t);
  });

  it('un dispositivo dado de baja no recibe', async () => {
    const t = await dispositivo(autor);
    const del = await ctx
      .http()
      .delete(`/dispositivos/${encodeURIComponent(t)}`)
      .set(...autor.auth);
    expect(del.status).toBe(204);
    const r = await rep(autor);
    await estado(r.id, { estado: 'en_revision' });
    expect(await avisos()).toHaveLength(0);
  });
});

describe('Especificación §7 — no avisa cuando el pedido falla', () => {
  it.each([
    [
      'estado inválido (TRANSICION_INVALIDA)',
      async (r: { id: string }) => estado(r.id, { estado: 'resuelto' }),
      'recibido',
    ],
    [
      'rechazo sin motivo',
      async (r: { id: string }) => estado(r.id, { estado: 'rechazado' }),
      'recibido',
    ],
    [
      'asignado por /estado',
      async (r: { id: string }) => estado(r.id, { estado: 'asignado' }),
      'en_revision',
    ],
    [
      'cuadrilla de otra zona',
      async (r: { id: string }) => asignar(r.id, { cuadrillaId: cuaSur }),
      'en_revision',
    ],
    [
      'sin ser operador',
      async (r: { id: string }) => estado(r.id, { estado: 'en_revision' }, ana),
      'recibido',
    ],
    [
      'cuerpo con campo de más',
      async (r: { id: string }) =>
        estado(r.id, { estado: 'en_revision', x: 1 }),
      'recibido',
    ],
  ] as const)('%s', async (_n, accion, desde) => {
    await dispositivo(autor);
    const r = await rep(autor, desde);
    const res = await accion(r);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(await avisos()).toHaveLength(0);
  });

  it('el mismo estado repetido (en_revision → en_revision) no avisa dos veces', async () => {
    await dispositivo(autor);
    const r = await rep(autor);
    const a = await estado(r.id, { estado: 'en_revision' });
    const b = await estado(r.id, { estado: 'en_revision' });
    expect(a.status).toBe(200);
    expect(b.status).toBe(422);
    expect(await avisos()).toHaveLength(1);
  });

  it('dos operadores a la vez con el mismo cambio: un solo aviso', async () => {
    await dispositivo(autor);
    const r = await rep(autor);
    const [a, b] = await Promise.all([
      estado(r.id, { estado: 'en_revision' }, op),
      estado(r.id, { estado: 'en_revision' }, op2),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 422]);
    expect(await avisos()).toHaveLength(1);
  });

  it('una falla del proveedor de push no rompe el pedido y se puede seguir', async () => {
    await dispositivo(autor);
    const r = await rep(autor);
    ctx.notificador.fallarProximoEnvio();
    const a = await estado(r.id, { estado: 'en_revision' });
    expect(a.status).toBe(200);
    esperarContrato(a, 'Reporte');
    await ctx.esperarAvisos();
    const b = await estado(r.id, { estado: 'rechazado', comentario: 'Ya no.' });
    expect(b.status).toBe(200);
    expect(await avisos()).toHaveLength(1);
  });

  it('una falla en la push de adhesión no rompe la adhesión', async () => {
    await dispositivo(autor);
    const r = await rep(autor);
    ctx.notificador.fallarProximoEnvio();
    const res = await sumar(r.id, ana);
    expect(res.status).toBe(201);
    esperarContrato(res, 'Reporte');
    await ctx.esperarAvisos();
    expect(res.body.datos.adhesiones).toBe(1);
  });

  it('el token que Expo marca como inválido se da de baja: no vuelve a recibir', async () => {
    const t = await dispositivo(autor);
    ctx.notificador.marcarInvalido(t);
    const r = await rep(autor);
    await estado(r.id, { estado: 'en_revision' });
    expect(await avisos()).toHaveLength(1);
    ctx.notificador.limpiar();
    ctx.notificador.marcarInvalido(t);
    await estado(r.id, { estado: 'rechazado', comentario: 'Ya no.' });
    expect(await avisos()).toHaveLength(0);
  });
});

describe('Especificación §7 — push por adhesión', () => {
  it('al autor, con el total actualizado y datos de la pantalla', async () => {
    const t = await dispositivo(autor);
    const r = await rep(autor);
    const vecinos = [ana, await crearVecino(ctx)];
    for (const v of vecinos) expect((await sumar(r.id, v)).status).toBe(201);
    const e = await avisos();
    expect(e).toHaveLength(2);
    expect(e.every((m) => m.tokenExpo === t)).toBe(true);
    expect(e[0]!.cuerpo).toContain(r.codigo);
    expect(e[0]!.cuerpo).toContain('1');
    expect(e[1]!.cuerpo).toContain('2');
    expect(`${e[0]!.titulo} ${e[0]!.cuerpo}`).not.toMatch(JERGA);
  });

  it('el que se suma no recibe nada, aunque tenga dispositivo', async () => {
    const tAna = await dispositivo(ana);
    await dispositivo(autor);
    const r = await rep(autor);
    await sumar(r.id, ana);
    const e = await avisos();
    expect(e.some((m) => m.tokenExpo === tAna)).toBe(false);
  });

  it('adherentes previos no reciben el aviso de nuevos adherentes', async () => {
    await dispositivo(autor);
    const tAna = await dispositivo(ana);
    const r = await rep(autor);
    await sumar(r.id, ana);
    await sumar(r.id, await crearVecino(ctx));
    expect((await avisos()).some((m) => m.tokenExpo === tAna)).toBe(false);
  });

  it('repetir la adhesión (200), reporte propio, cerrado o inexistente: sin aviso', async () => {
    await dispositivo(autor);
    const r = await rep(autor);
    await sumar(r.id, ana);
    await ctx.esperarAvisos();
    ctx.notificador.limpiar();
    expect((await sumar(r.id, ana)).status).toBe(200);
    esperarError(await sumar(r.id, autor), 422, 'ADHESION_A_REPORTE_PROPIO');
    const cerrado = await rep(autor, 'resuelto');
    esperarError(await sumar(cerrado.id, ana), 422, 'REPORTE_CERRADO');
    esperarError(
      await sumar('rep-inexistente', ana),
      404,
      'REPORTE_NO_ENCONTRADO',
    );
    expect(await avisos()).toHaveLength(0);
  });

  it('sin token (401): sin aviso', async () => {
    await dispositivo(autor);
    const r = await rep(autor);
    const res = await ctx.http().post(`/reportes/${r.id}/adhesiones`);
    expect(res.status).toBe(401);
    expect(await avisos()).toHaveLength(0);
  });

  it('el mismo vecino sumándose 3 veces a la vez: un solo aviso', async () => {
    await dispositivo(autor);
    const r = await rep(autor);
    const rs = await Promise.all([
      sumar(r.id, ana),
      sumar(r.id, ana),
      sumar(r.id, ana),
    ]);
    expect(rs.filter((x) => x.status === 201)).toHaveLength(1);
    expect(rs.every((x) => [200, 201].includes(x.status))).toBe(true);
    expect(await avisos()).toHaveLength(1);
  });

  it('adhesión con avisos apagados sigue sumando', async () => {
    const mudo = await crearVecino(ctx, { avisosActivos: false });
    await dispositivo(mudo);
    const r = await rep(mudo);
    const res = await sumar(r.id, ana);
    expect(res.status).toBe(201);
    expect(res.body.datos.adhesiones).toBe(1);
    expect(await avisos()).toHaveLength(0);
  });
});

describe('Especificación R13 / D5 (PROVISORIA) — push al marcar duplicado', () => {
  it('autor del duplicado: push "rechazado"; autor del original: push de adhesión', async () => {
    const dueno = await crearVecino(ctx);
    const tDup = await dispositivo(autor);
    const tOri = await dispositivo(dueno);
    const original = await rep(dueno);
    const dup = await rep(autor);
    const res = await duplicado(dup.id, original.id);
    expect(res.status).toBe(200);
    const e = await avisos();
    expect(e).toHaveLength(2);
    const alDup = e.find((m) => m.tokenExpo === tDup)!;
    const alOri = e.find((m) => m.tokenExpo === tOri)!;
    expect(alDup.cuerpo).toContain(dup.codigo);
    expect(alDup.cuerpo).toMatch(/rechazad/i);
    expect(alOri.cuerpo).toContain(original.codigo);
    expect(alOri.cuerpo).toContain('1');
  });

  it('mismo autor en los dos: recibe la de rechazo y no se avisa a sí mismo de una adhesión', async () => {
    await dispositivo(autor);
    const original = await rep(autor);
    const dup = await rep(autor);
    const res = await duplicado(dup.id, original.id);
    expect(res.status).toBe(200);
    const e = await avisos();
    expect(e).toHaveLength(1);
    expect(e[0]!.cuerpo).toMatch(/rechazad/i);
    const o = await ctx.http().get(`/reportes/${original.id}`);
    expect(o.body.datos.adhesiones).toBe(0);
  });

  it('el autor del duplicado ya sumado al original: sin push de adhesión repetida', async () => {
    const dueno = await crearVecino(ctx);
    await dispositivo(dueno);
    const original = await rep(dueno);
    const dup = await rep(autor);
    await sumar(original.id, autor);
    await ctx.esperarAvisos();
    ctx.notificador.limpiar();
    await duplicado(dup.id, original.id);
    const e = await avisos();
    expect(e.some((m) => /se sumó/i.test(m.cuerpo))).toBe(false);
  });

  it('duplicado inválido (mismo reporte, original cerrado): sin push', async () => {
    await dispositivo(autor);
    const dueno = await crearVecino(ctx);
    await dispositivo(dueno);
    const dup = await rep(autor);
    const cerrado = await rep(dueno, 'resuelto');
    esperarError(await duplicado(dup.id, dup.id), 422, 'DUPLICADO_INVALIDO');
    esperarError(
      await duplicado(dup.id, cerrado.id),
      422,
      'DUPLICADO_INVALIDO',
    );
    expect(await avisos()).toHaveLength(0);
  });

  it('un vecino no puede marcar duplicado (403) y no hay push', async () => {
    await dispositivo(autor);
    const o = await rep(await crearVecino(ctx));
    const d = await rep(autor);
    esperarError(await duplicado(d.id, o.id, ana), 403, 'SIN_PERMISO');
    expect(await avisos()).toHaveLength(0);
  });

  it('avisos apagados en el autor del original: sólo recibe el del duplicado', async () => {
    const mudo = await crearVecino(ctx, { avisosActivos: false });
    await dispositivo(mudo);
    const tDup = await dispositivo(autor);
    const original = await rep(mudo);
    const dup = await rep(autor);
    await duplicado(dup.id, original.id);
    const e = await avisos();
    expect(e).toHaveLength(1);
    expect(e[0]!.tokenExpo).toBe(tDup);
  });

  it('el duplicado en el historial: comentario automático y un solo rechazado', async () => {
    await dispositivo(autor);
    const o = await rep(await crearVecino(ctx));
    const d = await rep(autor);
    await duplicado(d.id, o.id);
    await duplicado(d.id, o.id);
    const c = await ctx.http().get(`/reportes/${d.id}/cambios`);
    expect(
      c.body.datos.filter((x: { estado: string }) => x.estado === 'rechazado'),
    ).toHaveLength(1);
    expect(await avisos()).toHaveLength(1);
  });
});

describe('Especificación §7 — creación de reportes no manda push', () => {
  it('el recibido inicial no avisa a nadie', async () => {
    await dispositivo(autor);
    const foto = await subirArchivo(ctx, autor);
    const res = await ctx
      .http()
      .post('/reportes')
      .set(...autor.auth)
      .send(
        cuerpoReporte(foto, tipoId, { creadoEn: '2026-09-14T09:59:00-03:00' }),
      );
    expect(res.status).toBe(201);
    expect(await avisos()).toHaveLength(0);
  });

  it('reenviar el POST con el mismo id (200) tampoco avisa', async () => {
    await dispositivo(autor);
    const foto = await subirArchivo(ctx, autor);
    const cuerpo = cuerpoReporte(foto, tipoId, {
      id: 'rep-ver5-idem',
      creadoEn: '2026-09-14T09:59:00-03:00',
    });
    await ctx
      .http()
      .post('/reportes')
      .set(...autor.auth)
      .send(cuerpo);
    const b = await ctx
      .http()
      .post('/reportes')
      .set(...autor.auth)
      .send(cuerpo);
    expect(b.status).toBe(200);
    expect(await avisos()).toHaveLength(0);
  });
});

describe('Especificación §4 M5 — PATCH /yo', () => {
  const yo = (u: UsuarioDePrueba, body: unknown) =>
    ctx
      .http()
      .patch('/yo')
      .set(...u.auth)
      .send(body as object);

  it('avisosActivos false/true: forma de Usuario y persiste en GET /yo', async () => {
    const v = await crearVecino(ctx);
    const off = await yo(v, { avisosActivos: false });
    expect(off.status).toBe(200);
    esperarContrato(off, 'Usuario');
    expect(off.body.datos.avisosActivos).toBe(false);
    const g = await ctx
      .http()
      .get('/yo')
      .set(...v.auth);
    esperarContrato(g, 'Usuario');
    expect(g.body.datos.avisosActivos).toBe(false);
    const on = await yo(v, { avisosActivos: true });
    expect(on.body.datos.avisosActivos).toBe(true);
  });

  it('no afecta a otros usuarios', async () => {
    const a = await crearVecino(ctx);
    const b = await crearVecino(ctx);
    await yo(a, { avisosActivos: false });
    const g = await ctx
      .http()
      .get('/yo')
      .set(...b.auth);
    expect(g.body.datos.avisosActivos).toBe(true);
  });

  it('cuerpo vacío: 200 y no cambia nada', async () => {
    const v = await crearVecino(ctx, { telefono: '3446123456' });
    const res = await yo(v, {});
    expect(res.status).toBe(200);
    esperarContrato(res, 'Usuario');
    expect(res.body.datos.telefono).toBe('3446123456');
    expect(res.body.datos.avisosActivos).toBe(true);
  });

  it('nombre y teléfono se actualizan; teléfono "" o null → null', async () => {
    const v = await crearVecino(ctx, { telefono: '3446123456' });
    const a = await yo(v, {
      nombre: '  Nuevo Nombre ',
      telefono: '3446999999',
    });
    expect(a.status).toBe(200);
    esperarContrato(a, 'Usuario');
    expect(a.body.datos.telefono).toBe('3446999999');
    expect(a.body.datos.nombre.trim()).toBe('Nuevo Nombre');
    for (const vacio of ['', null]) {
      const b = await yo(v, { telefono: vacio });
      expect(b.status).toBe(200);
      expect(b.body.datos.telefono).toBeNull();
      await yo(v, { telefono: '3446999999' });
    }
  });

  it.each([
    [{ rol: 'operador' }],
    [{ zonaId: 'zon-norte' }],
    [{ email: 'otro@mail.com' }],
    [{ id: 'usr-999' }],
    [{ contrasena: 'nueva-clave-123' }],
    [{ password: 'x' }],
    [{ avisosActivos: false, extra: 1 }],
  ])('campos de más %j → 400 VALIDACION_FALLIDA, sin jerga', async (body) => {
    const v = await crearVecino(ctx);
    const res = await yo(v, body);
    esperarError(res, 400, 'VALIDACION_FALLIDA');
    expect(res.body.error.mensaje).not.toMatch(JERGA);
    const g = await ctx
      .http()
      .get('/yo')
      .set(...v.auth);
    expect(g.body.datos.rol).toBe('vecino');
    expect(g.body.datos.zonaId).toBeNull();
  });

  it.each([
    [{ avisosActivos: 'no' }],
    [{ avisosActivos: 'false' }],
    [{ avisosActivos: 0 }],
    [{ avisosActivos: null }],
    [{ nombre: '' }],
    [{ nombre: '   ' }],
    [{ nombre: null }],
    [{ nombre: 123 }],
    [{ telefono: 123 }],
    [{ telefono: ['1'] }],
    [{ nombre: 'x'.repeat(500) }],
  ])('tipos equivocados %j → 400', async (body) => {
    const v = await crearVecino(ctx);
    const res = await yo(v, body);
    esperarError(res, 400, 'VALIDACION_FALLIDA');
    expect(res.body.error.mensaje).not.toMatch(JERGA);
  });

  it('un operador también puede apagar sus avisos y conserva rol y zona', async () => {
    const o = await crearOperador(ctx, { zonaId: 'zon-norte' });
    const res = await yo(o, { avisosActivos: false });
    expect(res.status).toBe(200);
    esperarContrato(res, 'Usuario');
    expect(res.body.datos).toMatchObject({
      rol: 'operador',
      zonaId: 'zon-norte',
      avisosActivos: false,
    });
    expect(res.body.datos).not.toHaveProperty('contrasenaHash');
  });

  it('sin token, vencido o mal firmado → 401 NO_AUTENTICADO', async () => {
    esperarError(
      await ctx.http().patch('/yo').send({ avisosActivos: false }),
      401,
      'NO_AUTENTICADO',
    );
    const jwt = new JwtService();
    const vencido = await jwt.signAsync(
      { sub: autor.usuario.id, rol: 'vecino', exp: 1600000000 },
      { secret: SECRETO },
    );
    const ajeno = await jwt.signAsync(
      { sub: autor.usuario.id, rol: 'vecino' },
      { secret: 'otro-secreto-distinto-de-32-caracteres-xx' },
    );
    for (const t of [vencido, ajeno, 'basura']) {
      const res = await ctx
        .http()
        .patch('/yo')
        .set('Authorization', `Bearer ${t}`)
        .send({ avisosActivos: false });
      esperarError(res, 401, 'NO_AUTENTICADO');
    }
  });

  it('el interruptor se aplica en el acto: apagado corta estado y adhesión; prendido las devuelve', async () => {
    const v = await crearVecino(ctx);
    await dispositivo(v);
    const r = await rep(v);
    await yo(v, { avisosActivos: false });
    await estado(r.id, { estado: 'en_revision' });
    await sumar(r.id, ana);
    expect(await avisos()).toHaveLength(0);
    await yo(v, { avisosActivos: true });
    await sumar(r.id, await crearVecino(ctx));
    await estado(r.id, { estado: 'rechazado', comentario: 'Ya no.' });
    expect(await avisos()).toHaveLength(2);
  });

  it('cambiar el nombre no toca los avisos', async () => {
    const v = await crearVecino(ctx, { avisosActivos: false });
    const res = await yo(v, { nombre: 'Otro Nombre' });
    expect(res.body.datos.avisosActivos).toBe(false);
  });
});

describe('AGENTS §9 — POST /dispositivos/prueba respeta los dispositivos del usuario', () => {
  it('manda sólo a los del usuario que lo pide', async () => {
    const t = await dispositivo(autor);
    await dispositivo(ana);
    const res = await ctx
      .http()
      .post('/dispositivos/prueba')
      .set(...autor.auth);
    expect([200, 201, 202, 204]).toContain(res.status);
    const e = await avisos();
    expect(e.length).toBeGreaterThanOrEqual(1);
    expect(e.every((m) => m.tokenExpo === t)).toBe(true);
  });
});
