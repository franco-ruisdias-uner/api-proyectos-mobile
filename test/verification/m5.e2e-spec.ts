// Verificación independiente de M5 — Eventos guardados y avisos (verificador-contrato). Caja negra.
import { JwtService } from '@nestjs/jwt';
import { crearApp, type AppDePrueba } from '../utilities/create-app.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import {
  conSesion,
  crearAdmin,
  crearEvento,
  crearLugar,
  registrarTelefono,
  registrarTurista,
} from '../utilities/builders.js';

const CLAVES_EVENTO = [
  'coordenadas',
  'descripcion',
  'direccionLibre',
  'estado',
  'fin',
  'id',
  'imagenUrl',
  'inicio',
  'lugarId',
  'precio',
  'titulo',
];
let n = 0;

describe('Convenciones — forma del Evento guardado', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
  });
  afterAll(() => ctx.cerrar());
  const put = (t: string, id: string) => ctx.http().put(`/yo/eventos-guardados/${id}`).set(conSesion(t));

  it('claves exactas con opcionales en null (PUT 201, PUT 200 y GET)', async () => {
    const { token } = await registrarTurista(ctx);
    const id = await crearEvento(ctx);
    const a = await put(token, id).expect(201);
    const b = await put(token, id).expect(200);
    const l = await ctx.http().get('/yo/eventos-guardados').set(conSesion(token)).expect(200);
    esperarContrato(a.body, 'Evento');
    esperarContrato(b.body, 'Evento');
    esperarContrato(l.body, 'Evento');
    for (const e of [a.body.datos, b.body.datos, l.body.datos[0]]) {
      expect(Object.keys(e).sort()).toEqual(CLAVES_EVENTO);
    }
    expect(a.body.datos.fin).toBeNull();
    expect(a.body.datos.precio).toBeNull();
  });

  it('evento con dirección libre, coordenadas, fin y precio llenos', async () => {
    const { token } = await registrarTurista(ctx);
    const id = await crearEvento(ctx, {
      direccionLibre: 'Costanera y Sarmiento',
      coordenadas: { latitud: -32.22, longitud: -58.14 },
      fin: new Date('2026-11-16T02:00:00-03:00'),
      precio: 1500,
    });
    const res = await put(token, id).expect(201);
    esperarContrato(res.body, 'Evento');
    expect(res.body.datos.lugarId).toBeNull();
    expect(res.body.datos.fin).toBe('2026-11-16T02:00:00-03:00');
    expect(res.body.datos.coordenadas).toEqual({ latitud: -32.22, longitud: -58.14 });
  });

  it('PUT con cuerpo de más: 400 con sobre exacto, o se ignora; nunca 500', async () => {
    const { token } = await registrarTurista(ctx);
    const id = await crearEvento(ctx);
    const res = await put(token, id).send({ estado: 'cancelado', usuarioId: 'usr-1' });
    expect([201, 400]).toContain(res.status);
    if (res.status === 400) esperarError(res, 400, 'VALIDACION_FALLIDA');
    else expect(res.body.datos.estado).toBe('programado');
  });

  it('mismo GET repetido da el mismo orden con inicios iguales (desempate estable)', async () => {
    const { token } = await registrarTurista(ctx);
    const inicio = new Date('2026-11-25T21:00:00-03:00');
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) {
      const id = await crearEvento(ctx, { inicio });
      ids.push(id);
      await put(token, id).expect(201);
    }
    const a = await ctx.http().get('/yo/eventos-guardados').set(conSesion(token)).expect(200);
    const b = await ctx.http().get('/yo/eventos-guardados').set(conSesion(token)).expect(200);
    expect(a.body.datos.map((e: { id: string }) => e.id)).toEqual(
      b.body.datos.map((e: { id: string }) => e.id),
    );
    expect(a.body.datos.map((e: { id: string }) => e.id).sort()).toEqual([...ids].sort());
    const pag = [];
    for (let p = 1; p <= 4; p++) {
      const r = await ctx.http().get(`/yo/eventos-guardados?pagina=${p}&porPagina=1`).set(conSesion(token));
      pag.push(r.body.datos[0].id);
    }
    expect(pag).toEqual(a.body.datos.map((e: { id: string }) => e.id));
  });
});

describe('AGENTS §7 — Auth de /yo/eventos-guardados', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
  });
  afterAll(() => ctx.cerrar());

  it('token vencido, mal firmado o basura dan 401 NO_AUTENTICADO en las tres rutas', async () => {
    const { usuario } = await registrarTurista(ctx);
    const jwt = ctx.app.get(JwtService);
    const vencido = await jwt.signAsync({ sub: usuario.id, rol: 'turista' }, { expiresIn: -10 });
    const malFirmado = await new JwtService({ secret: 'otro-secreto-distinto-1234567890abcd' }).signAsync({
      sub: usuario.id,
      rol: 'turista',
    });
    for (const t of [vencido, malFirmado, 'basura']) {
      for (const [m, r] of [
        ['get', '/yo/eventos-guardados'],
        ['put', '/yo/eventos-guardados/evt-abc'],
        ['delete', '/yo/eventos-guardados/evt-abc'],
      ] as const) {
        esperarError(await ctx.http()[m](r).set(conSesion(t)), 401, 'NO_AUTENTICADO');
      }
    }
  });

  it('paginación inválida da 400 VALIDACION_FALLIDA', async () => {
    const { token } = await registrarTurista(ctx);
    for (const q of ['pagina=0', 'pagina=-1', 'porPagina=0', 'porPagina=abc', 'pagina=1.5']) {
      esperarError(
        await ctx.http().get(`/yo/eventos-guardados?${q}`).set(conSesion(token)),
        400,
        'VALIDACION_FALLIDA',
      );
    }
  });

  it('sacar y volver a guardar: 201 otra vez, y queda uno', async () => {
    const { token } = await registrarTurista(ctx);
    const id = await crearEvento(ctx);
    await ctx.http().put(`/yo/eventos-guardados/${id}`).set(conSesion(token)).expect(201);
    await ctx.http().delete(`/yo/eventos-guardados/${id}`).set(conSesion(token)).expect(204);
    await ctx.http().put(`/yo/eventos-guardados/${id}`).set(conSesion(token)).expect(201);
    const l = await ctx.http().get('/yo/eventos-guardados').set(conSesion(token)).expect(200);
    expect(l.body.meta.total).toBe(1);
  });

  it('ids con mayúsculas o espacios no cuelan: PUT 404, DELETE 204', async () => {
    const { token } = await registrarTurista(ctx);
    const id = await crearEvento(ctx);
    for (const raro of [id.toUpperCase(), ` ${id}`, `${id}%20`]) {
      esperarError(
        await ctx.http().put(`/yo/eventos-guardados/${raro}`).set(conSesion(token)),
        404,
        'EVENTO_NO_ENCONTRADO',
      );
      await ctx.http().delete(`/yo/eventos-guardados/${raro}`).set(conSesion(token)).expect(204);
    }
  });
});

describe('R8/R9/R17 — vigencia en los bordes de medianoche', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp({ ahora: '2026-12-31T23:59:00-03:00' });
  });
  afterAll(() => ctx.cerrar());

  it('sin fin: a las 23:59 del día de inicio (31/12) todavía se puede guardar; a las 00:00 del 1/1 no', async () => {
    const { token } = await registrarTurista(ctx);
    const id = await crearEvento(ctx, { inicio: new Date('2026-12-31T20:00:00-03:00') });
    await ctx.http().put(`/yo/eventos-guardados/${id}`).set(conSesion(token)).expect(201);
    const otro = await crearEvento(ctx, { inicio: new Date('2026-12-31T20:00:00-03:00') });
    ctx.reloj.avanzar(60_000); // 00:00 del 1/1/2027
    esperarError(
      await ctx.http().put(`/yo/eventos-guardados/${otro}`).set(conSesion(token)),
      422,
      'EVENTO_NO_VIGENTE',
    );
    const l = await ctx.http().get('/yo/eventos-guardados').set(conSesion(token)).expect(200);
    expect(l.body.datos[0].estado).toBe('finalizado');
    ctx.reloj.avanzar(-60_000);
  });

  it('una peña que cruza la medianoche sigue vigente pasadas las 00:00 hasta su fin', async () => {
    const { token } = await registrarTurista(ctx);
    const id = await crearEvento(ctx, {
      inicio: new Date('2026-12-31T21:00:00-03:00'),
      fin: new Date('2027-01-01T02:00:00-03:00'),
    });
    ctx.reloj.avanzar(3600_000); // 00:59 del 1/1
    await ctx.http().put(`/yo/eventos-guardados/${id}`).set(conSesion(token)).expect(201);
    ctx.reloj.avanzar(2 * 3600_000); // 02:59
    const l = await ctx.http().get('/yo/eventos-guardados').set(conSesion(token)).expect(200);
    expect(l.body.datos[0].estado).toBe('finalizado');
    esperarError(
      await ctx
        .http()
        .put(
          `/yo/eventos-guardados/${await crearEvento(ctx, { inicio: new Date('2026-12-31T21:00:00-03:00'), fin: new Date('2027-01-01T02:00:00-03:00') })}`,
        )
        .set(conSesion(token)),
      422,
      'EVENTO_NO_VIGENTE',
    );
    ctx.reloj.avanzar(-3 * 3600_000);
  });
});

describe('Especificación §7 — Push: casos adversariales', () => {
  let ctx: AppDePrueba;
  let admin: { id: string; token: string };
  beforeAll(async () => {
    ctx = await crearApp();
    admin = await crearAdmin(ctx);
  });
  afterAll(() => ctx.cerrar());
  beforeEach(() => ctx.enviador.limpiar());

  const cambiar = (id: string, estado: string, token = admin.token) =>
    ctx.http().patch(`/eventos/${id}/estado`).set(conSesion(token)).send({ estado });
  const guardar = (t: string, id: string) =>
    ctx.http().put(`/yo/eventos-guardados/${id}`).set(conSesion(t)).expect(201);
  async function turista(telefonos = 1) {
    const { token } = await registrarTurista(ctx);
    const tokens: string[] = [];
    for (let i = 0; i < telefonos; i++) {
      const t = `ExponentPushToken[m5-ver-${++n}]`;
      tokens.push(t);
      await registrarTelefono(ctx, token, t);
    }
    return { token, tokens };
  }

  it('quien tiene dos teléfonos los recibe a los dos', async () => {
    const u = await turista(2);
    const id = await crearEvento(ctx);
    await guardar(u.token, id);
    await cambiar(id, 'cancelado').expect(200);
    await ctx.esperarAvisos();
    expect(ctx.enviador.enviadas.flatMap((m) => m.tokens).sort()).toEqual([...u.tokens].sort());
  });

  it('el mismo teléfono que pasó a otro usuario avisa sólo al usuario actual', async () => {
    const a = await turista();
    const b = await registrarTurista(ctx);
    // b toma el token de a
    await registrarTelefono(ctx, b.token, a.tokens[0]);
    const id = await crearEvento(ctx);
    await guardar(a.token, id);
    await cambiar(id, 'cancelado').expect(200);
    await ctx.esperarAvisos();
    expect(ctx.enviador.enviadas).toEqual([]); // a ya no tiene teléfono; b no guardó
  });

  it('baja del dispositivo (DELETE /dispositivos) => no recibe', async () => {
    const u = await turista();
    const id = await crearEvento(ctx);
    await guardar(u.token, id);
    await ctx.tokens.borrar(u.tokens[0]);
    await cambiar(id, 'suspendido').expect(200);
    await ctx.esperarAvisos();
    expect(ctx.enviador.enviadas).toEqual([]);
  });

  it('suspendido -> cancelado avisa "cancelado"; programado -> suspendido -> programado avisa dos veces', async () => {
    const u = await turista();
    const id = await crearEvento(ctx);
    await guardar(u.token, id);
    await cambiar(id, 'suspendido').expect(200);
    await ctx.esperarAvisos();
    await cambiar(id, 'programado').expect(200);
    await ctx.esperarAvisos();
    expect(ctx.enviador.enviadas.map((m) => (m.datos as { estado: string }).estado)).toEqual([
      'suspendido',
      'programado',
    ]);
    ctx.enviador.limpiar();
    await cambiar(id, 'suspendido').expect(200);
    await cambiar(id, 'cancelado').expect(200);
    await ctx.esperarAvisos();
    const ultimo = ctx.enviador.enviadas.at(-1)!;
    expect(ultimo.titulo).toBe('Evento cancelado');
    expect(ctx.enviador.enviadas).toHaveLength(2);
  });

  it('un PATCH rechazado (finalizado, enum inválido, sin ser admin) no avisa a nadie', async () => {
    const u = await turista();
    const id = await crearEvento(ctx);
    await guardar(u.token, id);
    esperarError(await cambiar(id, 'finalizado'), 400, 'VALIDACION_FALLIDA');
    esperarError(await cambiar(id, 'roto'), 400, 'VALIDACION_FALLIDA');
    esperarError(await cambiar(id, 'cancelado', u.token), 403, 'SIN_PERMISO');
    esperarError(await cambiar('evt-noexiste', 'cancelado'), 404, 'EVENTO_NO_ENCONTRADO');
    await ctx.esperarAvisos();
    expect(ctx.enviador.enviadas).toEqual([]);
    const e = await ctx.http().get(`/eventos/${id}`).expect(200);
    expect(e.body.datos.estado).toBe('programado');
  });

  it('dos PATCH simultáneos a cancelado avisan una sola vez por teléfono', async () => {
    const u = await turista();
    const id = await crearEvento(ctx);
    await guardar(u.token, id);
    const [a, b] = await Promise.all([cambiar(id, 'cancelado'), cambiar(id, 'cancelado')]);
    expect([a.status, b.status]).toEqual([200, 200]);
    await ctx.esperarAvisos();
    const cuenta = ctx.enviador.enviadas.flatMap((m) => m.tokens).filter((t) => t === u.tokens[0]).length;
    expect(cuenta).toBe(1);
  });

  it('el mensaje está en castellano, con el título y sin ids ni jerga', async () => {
    const u = await turista();
    const id = await crearEvento(ctx, { titulo: 'Fiesta de la Playa' });
    await guardar(u.token, id);
    await cambiar(id, 'cancelado').expect(200);
    await ctx.esperarAvisos();
    const m = ctx.enviador.enviadas[0];
    expect(m.cuerpo).toContain('Fiesta de la Playa');
    expect(`${m.titulo} ${m.cuerpo}`).not.toMatch(/evt-|undefined|null|cancelado_|error/i);
  });

  it('el admin que guardó el evento y lo cambia: no se rompe y el resto igual recibe', async () => {
    const u = await turista();
    const id = await crearEvento(ctx);
    await guardar(u.token, id);
    await ctx.http().put(`/yo/eventos-guardados/${id}`).set(conSesion(admin.token)).expect(201);
    await cambiar(id, 'cancelado').expect(200);
    await ctx.esperarAvisos();
    const tokens = ctx.enviador.enviadas.flatMap((m) => m.tokens);
    expect(tokens).toContain(u.tokens[0]);
  });

  it('un evento con lugar distinto y otro guardado por la misma persona no se mezclan', async () => {
    const u = await turista();
    const lugar = await crearLugar(ctx);
    const e1 = await crearEvento(ctx, { lugarId: lugar });
    const e2 = await crearEvento(ctx, { lugarId: lugar });
    await guardar(u.token, e1);
    await cambiar(e2, 'cancelado').expect(200);
    await ctx.esperarAvisos();
    expect(ctx.enviador.enviadas).toEqual([]);
  });

  it('un evento finalizado (calculado) que se cambia a suspendido no avisa, aunque el PATCH responda', async () => {
    const u = await turista();
    const id = await crearEvento(ctx, {
      inicio: new Date('2026-11-14T13:00:00-03:00'),
      fin: new Date('2026-11-14T14:00:00-03:00'),
    });
    // guardar antes de que termine
    await guardar(u.token, id);
    ctx.reloj.avanzar(3 * 3600_000);
    const r = await cambiar(id, 'suspendido');
    expect([200, 422, 409]).toContain(r.status);
    await ctx.esperarAvisos();
    expect(ctx.enviador.enviadas).toEqual([]);
  });
});
