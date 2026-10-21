import { crearApp, type AppDePrueba } from '../utilities/create-app.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import {
  conSesion,
  crearAdmin,
  crearEvento,
  registrarTelefono,
  registrarTurista,
} from '../utilities/builders.js';

const TOKEN_EXPO = (n: number) => `ExponentPushToken[eventos-guardados-${n}]`;

describe('PRD §3 — Eventos guardados: GET/PUT/DELETE /yo/eventos-guardados', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
  });
  afterAll(() => ctx.cerrar());

  const guardar = (token: string, id: string) =>
    ctx.http().put(`/yo/eventos-guardados/${id}`).set(conSesion(token));

  it('sin token, las tres rutas dan 401', async () => {
    for (const [metodo, ruta] of [
      ['get', '/yo/eventos-guardados'],
      ['put', '/yo/eventos-guardados/evt-001'],
      ['delete', '/yo/eventos-guardados/evt-001'],
    ] as const) {
      esperarError(await ctx.http()[metodo](ruta), 401, 'NO_AUTENTICADO');
    }
  });

  it('lista vacía para quien no guardó nada', async () => {
    const { token } = await registrarTurista(ctx);
    const res = await ctx.http().get('/yo/eventos-guardados').set(conSesion(token)).expect(200);
    expect(res.body).toEqual({ datos: [], meta: { total: 0, pagina: 1, porPagina: 20 } });
  });

  it('D4 — PUT guarda (201) y devuelve el Evento del PRD', async () => {
    const { token } = await registrarTurista(ctx);
    const id = await crearEvento(ctx, { titulo: 'Peña de prueba', precio: 0 });
    const res = await guardar(token, id).expect(201);
    esperarContrato(res.body, 'Evento');
    expect(res.body.meta).toBeNull();
    expect(res.body.datos).toMatchObject({ id, titulo: 'Peña de prueba', precio: 0, estado: 'programado' });
    expect(res.body.datos.inicio).toBe('2026-11-15T21:00:00-03:00');
  });

  it('R17 — un evento suspendido se puede guardar', async () => {
    const { token } = await registrarTurista(ctx);
    const id = await crearEvento(ctx, { estado: 'suspendido' });
    const res = await guardar(token, id).expect(201);
    expect(res.body.datos.estado).toBe('suspendido');
  });

  it('R17 — un evento cancelado da 422 EVENTO_NO_VIGENTE', async () => {
    const { token } = await registrarTurista(ctx);
    const id = await crearEvento(ctx, { estado: 'cancelado' });
    esperarError(await guardar(token, id), 422, 'EVENTO_NO_VIGENTE');
  });

  it('R9/R17 — un evento que ya terminó (finalizado) da 422 EVENTO_NO_VIGENTE', async () => {
    const { token } = await registrarTurista(ctx);
    const id = await crearEvento(ctx, {
      inicio: new Date('2026-11-13T21:00:00-03:00'),
      fin: new Date('2026-11-13T23:00:00-03:00'),
    });
    esperarError(await guardar(token, id), 422, 'EVENTO_NO_VIGENTE');
  });

  it('un evento sin fin de hoy sigue vigente hasta las 23:59 (R8)', async () => {
    const { token } = await registrarTurista(ctx);
    const id = await crearEvento(ctx, { inicio: new Date('2026-11-14T09:00:00-03:00') });
    await guardar(token, id).expect(201);
  });

  it('un evento que no existe, o con un id mal formado, da 404 EVENTO_NO_ENCONTRADO', async () => {
    const { token } = await registrarTurista(ctx);
    for (const id of ['evt-noexiste', 'xyz', 'lug-004', 'evt-%00']) {
      esperarError(await guardar(token, id), 404, 'EVENTO_NO_ENCONTRADO');
    }
  });

  it('PUT dos veces deja uno: la segunda da 200 con el mismo Evento', async () => {
    const { token } = await registrarTurista(ctx);
    const id = await crearEvento(ctx);
    const a = await guardar(token, id).expect(201);
    const b = await guardar(token, id).expect(200);
    esperarContrato(b.body, 'Evento');
    expect(b.body).toEqual(a.body);
    const lista = await ctx.http().get('/yo/eventos-guardados').set(conSesion(token)).expect(200);
    expect(lista.body.meta.total).toBe(1);
  });

  it('dos PUT simultáneos: uno crea (201), el otro devuelve el existente (200), queda uno', async () => {
    const { token } = await registrarTurista(ctx);
    const id = await crearEvento(ctx);
    const [a, b] = await Promise.all([guardar(token, id), guardar(token, id)]);
    expect([a.status, b.status].sort()).toEqual([200, 201]);
    const lista = await ctx.http().get('/yo/eventos-guardados').set(conSesion(token)).expect(200);
    expect(lista.body.meta.total).toBe(1);
  });

  it('GET: por inicio ascendente, sin importar en qué orden se guardaron; cada persona ve los suyos', async () => {
    const uno = await registrarTurista(ctx);
    const otro = await registrarTurista(ctx);
    const tarde = await crearEvento(ctx, { inicio: new Date('2026-11-20T21:00:00-03:00') });
    const temprano = await crearEvento(ctx, { inicio: new Date('2026-11-15T10:00:00-03:00') });
    const medio = await crearEvento(ctx, { inicio: new Date('2026-11-17T21:00:00-03:00') });
    for (const id of [tarde, temprano, medio]) await guardar(uno.token, id).expect(201);
    await guardar(otro.token, medio).expect(201);
    const res = await ctx.http().get('/yo/eventos-guardados').set(conSesion(uno.token)).expect(200);
    esperarContrato(res.body, 'Evento');
    expect(res.body.datos.map((e: { id: string }) => e.id)).toEqual([temprano, medio, tarde]);
    const ajena = await ctx.http().get('/yo/eventos-guardados').set(conSesion(otro.token)).expect(200);
    expect(ajena.body.datos.map((e: { id: string }) => e.id)).toEqual([medio]);
  });

  it('GET: lo guardado sigue en la lista aunque después se cancele o termine (con el estado de hoy)', async () => {
    const { token } = await registrarTurista(ctx);
    const admin = await crearAdmin(ctx);
    const cancelado = await crearEvento(ctx);
    const termina = await crearEvento(ctx, {
      inicio: new Date('2026-11-14T13:00:00-03:00'),
      fin: new Date('2026-11-14T14:00:00-03:00'),
    });
    await guardar(token, cancelado).expect(201);
    await guardar(token, termina).expect(201);
    await ctx
      .http()
      .patch(`/eventos/${cancelado}/estado`)
      .set(conSesion(admin.token))
      .send({ estado: 'cancelado' })
      .expect(200);
    ctx.reloj.avanzar(3 * 3600_000);
    const res = await ctx.http().get('/yo/eventos-guardados').set(conSesion(token)).expect(200);
    const estados = Object.fromEntries(
      res.body.datos.map((e: { id: string; estado: string }) => [e.id, e.estado]),
    );
    expect(estados).toEqual({ [cancelado]: 'cancelado', [termina]: 'finalizado' });
    ctx.reloj.avanzar(-3 * 3600_000);
  });

  it('GET: paginación, con el total correcto también fuera de rango', async () => {
    const { token } = await registrarTurista(ctx);
    for (let i = 0; i < 3; i++) {
      const id = await crearEvento(ctx, { inicio: new Date(`2026-11-2${i}T21:00:00-03:00`) });
      await guardar(token, id).expect(201);
    }
    const p2 = await ctx
      .http()
      .get('/yo/eventos-guardados?pagina=2&porPagina=2')
      .set(conSesion(token))
      .expect(200);
    expect(p2.body.datos).toHaveLength(1);
    expect(p2.body.meta).toEqual({ total: 3, pagina: 2, porPagina: 2 });
    const p9 = await ctx
      .http()
      .get('/yo/eventos-guardados?pagina=9&porPagina=2')
      .set(conSesion(token))
      .expect(200);
    expect(p9.body).toEqual({ datos: [], meta: { total: 3, pagina: 9, porPagina: 2 } });
    esperarError(
      await ctx.http().get('/yo/eventos-guardados?porPagina=101').set(conSesion(token)),
      400,
      'VALIDACION_FALLIDA',
    );
  });

  it('DELETE: 204 sin cuerpo; también si no estaba, si no existe o si el id está mal formado', async () => {
    const { token } = await registrarTurista(ctx);
    const id = await crearEvento(ctx);
    await guardar(token, id).expect(201);
    const res = await ctx.http().delete(`/yo/eventos-guardados/${id}`).set(conSesion(token)).expect(204);
    expect(res.text).toBe('');
    for (const otro of [id, 'evt-noexiste', 'xyz', 'evt-%00']) {
      await ctx.http().delete(`/yo/eventos-guardados/${otro}`).set(conSesion(token)).expect(204);
    }
    const lista = await ctx.http().get('/yo/eventos-guardados').set(conSesion(token)).expect(200);
    expect(lista.body.datos).toEqual([]);
  });

  it('DELETE sólo saca el de quien lo pide', async () => {
    const uno = await registrarTurista(ctx);
    const otro = await registrarTurista(ctx);
    const id = await crearEvento(ctx);
    await guardar(uno.token, id).expect(201);
    await guardar(otro.token, id).expect(201);
    await ctx.http().delete(`/yo/eventos-guardados/${id}`).set(conSesion(uno.token)).expect(204);
    const lista = await ctx.http().get('/yo/eventos-guardados').set(conSesion(otro.token)).expect(200);
    expect(lista.body.datos).toHaveLength(1);
  });

  it('cancelado y ya guardado: repetir el PUT sigue dando 200 (reintento de la cola)', async () => {
    const { token } = await registrarTurista(ctx);
    const admin = await crearAdmin(ctx);
    const id = await crearEvento(ctx);
    await guardar(token, id).expect(201);
    await ctx.http().patch(`/eventos/${id}/estado`).set(conSesion(admin.token)).send({ estado: 'cancelado' });
    const res = await guardar(token, id).expect(200);
    expect(res.body.datos.estado).toBe('cancelado');
  });
});

describe('Especificación §7 — Push a quienes guardaron un evento', () => {
  let ctx: AppDePrueba;
  let admin: { id: string; token: string };
  let n = 0;
  beforeAll(async () => {
    ctx = await crearApp();
    admin = await crearAdmin(ctx);
  });
  afterAll(() => ctx.cerrar());
  beforeEach(() => ctx.enviador.limpiar());

  const cambiar = (id: string, estado: string) =>
    ctx.http().patch(`/eventos/${id}/estado`).set(conSesion(admin.token)).send({ estado });

  async function turistaConTelefono(): Promise<{ token: string; tokenExpo: string }> {
    const { token } = await registrarTurista(ctx);
    const tokenExpo = TOKEN_EXPO(++n);
    await registrarTelefono(ctx, token, tokenExpo, 'android');
    return { token, tokenExpo };
  }

  const guardar = (token: string, id: string) =>
    ctx.http().put(`/yo/eventos-guardados/${id}`).set(conSesion(token)).expect(201);

  it('al suspender: recibe la push quien lo guardó, y nadie más', async () => {
    const quien = await turistaConTelefono();
    const otro = await turistaConTelefono();
    const id = await crearEvento(ctx, { titulo: 'Peña en el anfiteatro' });
    await guardar(quien.token, id);
    await cambiar(id, 'suspendido').expect(200);
    await ctx.esperarAvisos();
    expect(ctx.enviador.enviadas).toHaveLength(1);
    expect(ctx.enviador.enviadas[0]).toMatchObject({
      tokens: [quien.tokenExpo],
      titulo: 'Evento suspendido',
      datos: { tipo: 'evento-estado', eventoId: id, estado: 'suspendido' },
    });
    expect(ctx.enviador.enviadas[0].cuerpo).toContain('Peña en el anfiteatro');
    expect(ctx.enviador.enviadas[0].tokens).not.toContain(otro.tokenExpo);
  });

  it('al cancelar: push a todos los que lo guardaron, en un mismo envío', async () => {
    const a = await turistaConTelefono();
    const b = await turistaConTelefono();
    const id = await crearEvento(ctx);
    await guardar(a.token, id);
    await guardar(b.token, id);
    await cambiar(id, 'cancelado').expect(200);
    await ctx.esperarAvisos();
    const tokens = ctx.enviador.enviadas.flatMap((m) => m.tokens).sort();
    expect(tokens).toEqual([a.tokenExpo, b.tokenExpo].sort());
    expect(ctx.enviador.enviadas.every((m) => m.titulo === 'Evento cancelado')).toBe(true);
  });

  it('un suspendido que vuelve a programado avisa que se hace', async () => {
    const quien = await turistaConTelefono();
    const id = await crearEvento(ctx, { estado: 'suspendido' });
    await guardar(quien.token, id);
    await cambiar(id, 'programado').expect(200);
    await ctx.esperarAvisos();
    expect(ctx.enviador.enviadas).toHaveLength(1);
    expect(ctx.enviador.enviadas[0]).toMatchObject({
      tokens: [quien.tokenExpo],
      datos: { estado: 'programado' },
    });
  });

  it('cancelado → programado no avisa (la especificación sólo lo pide desde suspendido)', async () => {
    const quien = await turistaConTelefono();
    const id = await crearEvento(ctx);
    await guardar(quien.token, id);
    await cambiar(id, 'cancelado').expect(200);
    await ctx.esperarAvisos();
    ctx.enviador.limpiar();
    await cambiar(id, 'programado').expect(200);
    await ctx.esperarAvisos();
    expect(ctx.enviador.enviadas).toEqual([]);
  });

  it('R10 — el mismo estado no avisa', async () => {
    const quien = await turistaConTelefono();
    const id = await crearEvento(ctx, { estado: 'suspendido' });
    await guardar(quien.token, id);
    await cambiar(id, 'suspendido').expect(200);
    await ctx.esperarAvisos();
    expect(ctx.enviador.enviadas).toEqual([]);
  });

  it('quien dejó de guardarlo (D9) no recibe nada', async () => {
    const quien = await turistaConTelefono();
    const id = await crearEvento(ctx);
    await guardar(quien.token, id);
    await ctx.http().delete(`/yo/eventos-guardados/${id}`).set(conSesion(quien.token)).expect(204);
    await cambiar(id, 'cancelado').expect(200);
    await ctx.esperarAvisos();
    expect(ctx.enviador.enviadas).toEqual([]);
  });

  it('quien no guardó el evento no recibe nada, aunque tenga teléfono registrado', async () => {
    await turistaConTelefono();
    const id = await crearEvento(ctx);
    await cambiar(id, 'cancelado').expect(200);
    await ctx.esperarAvisos();
    expect(ctx.enviador.enviadas).toEqual([]);
  });

  it('quien guardó sin teléfono registrado: el cambio anda y no hay push', async () => {
    const { token } = await registrarTurista(ctx);
    const id = await crearEvento(ctx);
    await guardar(token, id);
    await cambiar(id, 'cancelado').expect(200);
    await ctx.esperarAvisos();
    expect(ctx.enviador.enviadas).toEqual([]);
  });

  it('un evento que ya terminó no avisa', async () => {
    const quien = await turistaConTelefono();
    const id = await crearEvento(ctx, { inicio: new Date('2026-11-14T13:00:00-03:00') });
    await guardar(quien.token, id);
    ctx.reloj.avanzar(24 * 3600_000);
    await cambiar(id, 'cancelado').expect(200);
    await ctx.esperarAvisos();
    ctx.reloj.avanzar(-24 * 3600_000);
    expect(ctx.enviador.enviadas).toEqual([]);
  });

  it('AGENTS §9 — si Expo falla, el cambio de estado igual responde 200', async () => {
    const quien = await turistaConTelefono();
    const id = await crearEvento(ctx);
    await guardar(quien.token, id);
    const original = ctx.enviador.enviar.bind(ctx.enviador);
    ctx.enviador.enviar = () => Promise.reject(new Error('Expo caído'));
    try {
      const res = await cambiar(id, 'cancelado').expect(200);
      expect(res.body.datos.estado).toBe('cancelado');
      await ctx.esperarAvisos();
    } finally {
      ctx.enviador.enviar = original;
    }
  });

  it('AGENTS §9 — un token que Expo informa como inválido se borra', async () => {
    const quien = await turistaConTelefono();
    const id = await crearEvento(ctx);
    await guardar(quien.token, id);
    ctx.enviador.invalidos.add(quien.tokenExpo);
    await cambiar(id, 'cancelado').expect(200);
    await ctx.esperarAvisos();
    ctx.enviador.limpiar();
    const otroEvento = await crearEvento(ctx);
    await guardar(quien.token, otroEvento);
    await cambiar(otroEvento, 'cancelado').expect(200);
    await ctx.esperarAvisos();
    expect(ctx.enviador.enviadas).toEqual([]);
    ctx.enviador.invalidos.clear();
  });
});
