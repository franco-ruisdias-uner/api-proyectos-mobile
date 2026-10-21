import { crearApp, type AppDePrueba } from '../utilities/create-app.js';
import { esperarContrato } from '../utilities/contract.js';
import { crearCuadrilla, crearTipo, crearZona } from '../utilities/catalogs.js';
import {
  crearOperador,
  crearVecino,
  type UsuarioDePrueba,
} from '../utilities/users.js';
import { crearCambio, crearReporte } from '../utilities/reports.js';
import type { EstadoReporte } from '../../contract/types.js';

let ctx: AppDePrueba;
let operador: UsuarioDePrueba;
let autor: UsuarioDePrueba;
let ana: UsuarioDePrueba;
let tipoId: string;
let cuadrilla: string;
let seq = 0;
const token = () => `ExponentPushToken[aviso-${++seq}]`;

function conDispositivo(u: UsuarioDePrueba): Promise<string> {
  return ctx.registrarDispositivo(u.usuario.id, token());
}

async function reporteDe(
  u: UsuarioDePrueba,
  estado: EstadoReporte = 'recibido',
) {
  const r = await crearReporte(ctx, {
    autorId: u.usuario.id,
    tipoId,
    zonaId: 'zon-norte',
    estado,
    codigo: `GCHU-2026-${String(70000 + ++seq)}`,
  });
  await crearCambio(ctx, { reporteId: r.id });
  return r;
}

const estado = (id: string, cuerpo: Record<string, unknown>) =>
  ctx
    .http()
    .patch(`/reportes/${id}/estado`)
    .set(...operador.auth)
    .send(cuerpo);

beforeAll(async () => {
  ctx = await crearApp();
  operador = await crearOperador(ctx, { zonaId: 'zon-norte' });
  autor = await crearVecino(ctx);
  ana = await crearVecino(ctx);
  tipoId = (await crearTipo(ctx, { id: 'tip-bache' })).id;
  await crearZona(ctx, { id: 'zon-norte' });
  cuadrilla = (await crearCuadrilla(ctx, { zonaId: 'zon-norte' })).id;
  await conDispositivo(autor);
});
beforeEach(() => ctx.notificador.limpiar());
afterAll(() => ctx.cerrar());

describe('Especificación §7 — push por cambio de estado', () => {
  it('avisa al autor cuando el operador pasa el reporte a en_revision', async () => {
    const r = await reporteDe(autor);
    const res = await estado(r.id, { estado: 'en_revision' });
    expect(res.status).toBe(200);
    await ctx.esperarAvisos();
    expect(ctx.notificador.enviadas).toHaveLength(1);
    expect(ctx.notificador.enviadas[0]).toMatchObject({
      cuerpo: `Tu reporte ${r.codigo} está en revisión.`,
      datos: { tipo: 'estado', reporteId: r.id, estado: 'en_revision' },
    });
  });

  it('avisa al asignar y al reasignar cuadrilla', async () => {
    const r = await reporteDe(autor, 'en_revision');
    for (let i = 0; i < 2; i++) {
      await ctx
        .http()
        .patch(`/reportes/${r.id}/cuadrilla`)
        .set(...operador.auth)
        .send({ cuadrillaId: cuadrilla });
    }
    await ctx.esperarAvisos();
    expect(ctx.notificador.enviadas.map((m) => m.cuerpo)).toEqual([
      `Tu reporte ${r.codigo} fue asignado a una cuadrilla.`,
      `Tu reporte ${r.codigo} fue asignado a una cuadrilla.`,
    ]);
  });

  it('avisa al resolver y al rechazar', async () => {
    const a = await reporteDe(autor, 'asignado');
    const b = await reporteDe(autor, 'recibido');
    await estado(a.id, { estado: 'resuelto' });
    await estado(b.id, { estado: 'rechazado', comentario: 'No corresponde.' });
    await ctx.esperarAvisos();
    expect(ctx.notificador.enviadas.map((m) => m.cuerpo)).toEqual([
      `Tu reporte ${a.codigo} fue resuelto.`,
      `Tu reporte ${b.codigo} fue rechazado.`,
    ]);
  });

  it('no avisa si el cambio es inválido (422)', async () => {
    const r = await reporteDe(autor, 'resuelto');
    const res = await estado(r.id, { estado: 'en_revision' });
    expect(res.status).toBe(422);
    await ctx.esperarAvisos();
    expect(ctx.notificador.enviadas).toHaveLength(0);
  });

  it('no avisa al autor que tiene los avisos apagados', async () => {
    const mudo = await crearVecino(ctx, { avisosActivos: false });
    await conDispositivo(mudo);
    const r = await reporteDe(mudo);
    await estado(r.id, { estado: 'en_revision' });
    await ctx.esperarAvisos();
    expect(ctx.notificador.enviadas).toHaveLength(0);
  });

  it('avisa a todos los dispositivos del autor y a nadie más', async () => {
    const dueno = await crearVecino(ctx);
    const t1 = await conDispositivo(dueno);
    const t2 = await conDispositivo(dueno);
    await conDispositivo(ana);
    const r = await reporteDe(dueno);
    await estado(r.id, { estado: 'en_revision' });
    await ctx.esperarAvisos();
    expect(ctx.notificador.enviadas.map((m) => m.tokenExpo).sort()).toEqual(
      [t1, t2].sort(),
    );
  });

  it('D13 — los adherentes no reciben los cambios de estado', async () => {
    const tAna = await conDispositivo(ana);
    const r = await reporteDe(autor);
    await ctx
      .http()
      .post(`/reportes/${r.id}/adhesiones`)
      .set(...ana.auth);
    await ctx.esperarAvisos();
    ctx.notificador.limpiar();
    await estado(r.id, { estado: 'en_revision' });
    await ctx.esperarAvisos();
    expect(ctx.notificador.enviadas).toHaveLength(1);
    expect(ctx.notificador.enviadas[0]!.tokenExpo).not.toBe(tAna);
  });

  it('un error del proveedor no rompe el pedido', async () => {
    const r = await reporteDe(autor);
    ctx.notificador.fallarProximoEnvio();
    const res = await estado(r.id, { estado: 'en_revision' });
    expect(res.status).toBe(200);
    await ctx.esperarAvisos();
  });

  it('marcar duplicado avisa al autor del duplicado (rechazado)', async () => {
    const original = await reporteDe(await crearVecino(ctx));
    const dup = await reporteDe(autor);
    const res = await ctx
      .http()
      .post(`/reportes/${dup.id}/duplicado`)
      .set(...operador.auth)
      .send({ originalId: original.id });
    expect(res.status).toBe(200);
    await ctx.esperarAvisos();
    expect(ctx.notificador.enviadas.map((m) => m.cuerpo)).toEqual([
      `Tu reporte ${dup.codigo} fue rechazado.`,
    ]);
    // repetir el pedido no cambia nada, tampoco avisa de nuevo
    ctx.notificador.limpiar();
    await ctx
      .http()
      .post(`/reportes/${dup.id}/duplicado`)
      .set(...operador.auth)
      .send({ originalId: original.id });
    await ctx.esperarAvisos();
    expect(ctx.notificador.enviadas).toHaveLength(0);
  });

  it('marcar duplicado avisa al autor del original que se sumó alguien (PROVISORIA)', async () => {
    const dueno = await crearVecino(ctx);
    await conDispositivo(dueno);
    const original = await reporteDe(dueno);
    const sinDispositivo = await crearVecino(ctx);
    const dup = await reporteDe(sinDispositivo);
    // el autor del duplicado no tiene dispositivos: sólo se entera el del original

    await ctx
      .http()
      .post(`/reportes/${dup.id}/duplicado`)
      .set(...operador.auth)
      .send({ originalId: original.id });
    await ctx.esperarAvisos();
    expect(ctx.notificador.enviadas.map((m) => m.cuerpo)).toEqual([
      `Un vecino más se sumó a tu reporte ${original.codigo}. Ya son 1.`,
    ]);
  });
});

describe('Especificación §7 — push por adhesión', () => {
  it('avisa al autor cuando alguien se suma, con el total', async () => {
    const r = await reporteDe(autor);
    const res = await ctx
      .http()
      .post(`/reportes/${r.id}/adhesiones`)
      .set(...ana.auth);
    expect(res.status).toBe(201);
    esperarContrato(res, 'Reporte');
    await ctx.esperarAvisos();
    expect(ctx.notificador.enviadas).toHaveLength(1);
    expect(ctx.notificador.enviadas[0]).toMatchObject({
      cuerpo: `Un vecino más se sumó a tu reporte ${r.codigo}. Ya son 1.`,
      datos: { tipo: 'adhesion', reporteId: r.id },
    });
  });

  it('sumarse de nuevo (200) no vuelve a avisar', async () => {
    const r = await reporteDe(autor);
    const url = `/reportes/${r.id}/adhesiones`;
    await ctx
      .http()
      .post(url)
      .set(...ana.auth);
    await ctx.esperarAvisos();
    ctx.notificador.limpiar();
    const res = await ctx
      .http()
      .post(url)
      .set(...ana.auth);
    expect(res.status).toBe(200);
    await ctx.esperarAvisos();
    expect(ctx.notificador.enviadas).toHaveLength(0);
  });

  it('no avisa si la adhesión falla (propio, cerrado)', async () => {
    const propio = await reporteDe(autor);
    const cerrado = await reporteDe(autor, 'resuelto');
    await ctx
      .http()
      .post(`/reportes/${propio.id}/adhesiones`)
      .set(...autor.auth);
    await ctx
      .http()
      .post(`/reportes/${cerrado.id}/adhesiones`)
      .set(...ana.auth);
    await ctx.esperarAvisos();
    expect(ctx.notificador.enviadas).toHaveLength(0);
  });

  it('no avisa si el autor tiene los avisos apagados', async () => {
    const mudo = await crearVecino(ctx, { avisosActivos: false });
    await conDispositivo(mudo);
    const r = await reporteDe(mudo);
    await ctx
      .http()
      .post(`/reportes/${r.id}/adhesiones`)
      .set(...ana.auth);
    await ctx.esperarAvisos();
    expect(ctx.notificador.enviadas).toHaveLength(0);
  });

  it('cinco vecinos a la vez: cinco avisos', async () => {
    const r = await reporteDe(autor);
    const vecinos = await Promise.all(
      [1, 2, 3, 4, 5].map(() => crearVecino(ctx)),
    );
    await Promise.all(
      vecinos.map((v) =>
        ctx
          .http()
          .post(`/reportes/${r.id}/adhesiones`)
          .set(...v.auth),
      ),
    );
    await ctx.esperarAvisos();
    expect(ctx.notificador.enviadas).toHaveLength(5);
  });
});

describe('Especificación §7 — interruptor de avisos (PATCH /yo)', () => {
  it('apagarlo corta las push y prenderlo las devuelve', async () => {
    const v = await crearVecino(ctx);
    await conDispositivo(v);
    const r = await reporteDe(v);

    const off = await ctx
      .http()
      .patch('/yo')
      .set(...v.auth)
      .send({ avisosActivos: false });
    expect(off.status).toBe(200);
    esperarContrato(off, 'Usuario');
    expect(off.body.datos.avisosActivos).toBe(false);
    await estado(r.id, { estado: 'en_revision' });
    await ctx.esperarAvisos();
    expect(ctx.notificador.enviadas).toHaveLength(0);

    const on = await ctx
      .http()
      .patch('/yo')
      .set(...v.auth)
      .send({ avisosActivos: true });
    expect(on.body.datos.avisosActivos).toBe(true);
    await ctx
      .http()
      .post(`/reportes/${r.id}/adhesiones`)
      .set(...ana.auth);
    await ctx.esperarAvisos();
    expect(ctx.notificador.enviadas).toHaveLength(1);
  });

  it('avisosActivos que no es booleano → 400', async () => {
    const res = await ctx
      .http()
      .patch('/yo')
      .set(...autor.auth)
      .send({ avisosActivos: 'no' });
    expect(res.status).toBe(400);
    expect(res.body.error.codigo).toBe('VALIDACION_FALLIDA');
  });

  it('PATCH /yo sin token → 401', async () => {
    const res = await ctx.http().patch('/yo').send({ avisosActivos: false });
    expect(res.status).toBe(401);
  });
});
