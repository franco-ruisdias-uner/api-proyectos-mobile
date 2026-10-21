// Verificación independiente de M4 — Ingreso y agenda (ESPECIFICACION §4 M4, R14–R16, D10; DECISIONES M4-1 a M4-6).
// Caja negra: sólo HTTP contra la app completa.
import { createHmac } from 'node:crypto';
import type { Reserva, Turno, Usuario } from '../../contract/types.js';
import {
  JWT_SECRETO_PRUEBA,
  type AppDePrueba,
  crearApp,
} from '../utilities/create-app.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import { crearDeporte, crearEspacio } from '../utilities/venues.js';
import { crearBloqueo, crearFija, crearReserva } from '../utilities/slots.js';
import {
  crearUsuario,
  registrarJugador,
  type UsuarioDePrueba,
} from '../utilities/users.js';

const HOY = '2026-09-19'; // sábado
const CLAVES_RESERVA = [
  'cancelableHasta',
  'cantidadPersonas',
  'codigoQr',
  'creadaEn',
  'espacioId',
  'estado',
  'id',
  'ingresoEn',
  'turnoId',
  'usuarioId',
];
const CLAVES_USUARIO = [
  'ausencias',
  'cancelacionesTardias',
  'email',
  'espaciosFavoritos',
  'id',
  'nombre',
  'rol',
  'telefono',
];
const con = (u: UsuarioDePrueba) => ({ Authorization: `Bearer ${u.token}` });

function jwt(payload: object, secreto: string): string {
  const b = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const cuerpo = `${b({ alg: 'HS256', typ: 'JWT' })}.${b(payload)}`;
  return `${cuerpo}.${createHmac('sha256', secreto).update(cuerpo).digest('base64url')}`;
}

describe('M4 verificación — ingreso y ausentes', () => {
  let a: AppDePrueba;
  let deporteId: string;
  let espacioId: string;
  let encargado: UsuarioDePrueba;
  let admin: UsuarioDePrueba;
  let jugador: UsuarioDePrueba;

  beforeAll(async () => {
    a = await crearApp();
    deporteId = (await crearDeporte(a)).id;
    encargado = await crearUsuario(a, 'encargado');
    admin = await crearUsuario(a, 'administrador');
  });
  afterAll(() => a.cerrar());
  beforeEach(async () => {
    a.reloj.fijar(`${HOY}T10:00:00-03:00`);
    espacioId = (await crearEspacio(a, { deporteId })).id;
    jugador = await registrarJugador(a);
    a.enviador.vaciar();
  });

  const ingresar = (u: UsuarioDePrueba | null, cuerpo: unknown) => {
    const r = a.http().post('/ingresos');
    return (u ? r.set(con(u)) : r).send(cuerpo as object);
  };
  const ausente = (u: UsuarioDePrueba | null, id: string, cuerpo = {}) => {
    const r = a.http().post(`/reservas/${id}/ausente`);
    return (u ? r.set(con(u)) : r).send(cuerpo);
  };
  const reserva = (inicio = '19:00', fecha = HOY, extra = {}) =>
    crearReserva(a, {
      espacioId,
      usuarioId: jugador.usuario.id,
      fecha,
      inicio,
      ...extra,
    });
  const ahora = (iso: string) => a.reloj.fijar(iso);
  const usuario = async (id: string) =>
    (await a.http().get(`/usuarios/${id}`).set(con(encargado)).expect(200)).body
      .datos as Usuario;

  describe('Autenticación (AGENTS §7) en los cinco endpoints', () => {
    const rutas: Array<[string, string]> = [
      ['post', '/ingresos'],
      ['post', '/reservas/res-abc123/ausente'],
      ['get', '/agenda'],
      ['get', '/reservas'],
      ['get', '/usuarios/usr-abc123'],
    ];
    type Agente = Record<string, (r: string) => import('supertest').Test>;
    it.each(rutas)('%s %s: token mal firmado → 401', async (m, ruta) => {
      const t = jwt(
        { sub: encargado.usuario.id, rol: 'encargado', exp: 9999999999 },
        'otro-secreto',
      );
      const res = await (a.http() as never as Agente)
        [m](ruta)
        .set('Authorization', `Bearer ${t}`);
      esperarError(res, 401, 'NO_AUTENTICADO');
    });
    it.each(rutas)('%s %s: token vencido → 401', async (m, ruta) => {
      const t = jwt(
        { sub: encargado.usuario.id, rol: 'encargado', iat: 1000, exp: 2000 },
        JWT_SECRETO_PRUEBA,
      );
      const res = await (a.http() as never as Agente)
        [m](ruta)
        .set('Authorization', `Bearer ${t}`);
      esperarError(res, 401, 'NO_AUTENTICADO');
    });
    it.each(rutas)('%s %s: sin token → 401', async (m, ruta) => {
      esperarError(
        await (a.http() as never as Agente)[m](ruta),
        401,
        'NO_AUTENTICADO',
      );
    });
    it.each(rutas)(
      '%s %s: jugador → 403 SIN_PERMISO (R16)',
      async (m, ruta) => {
        const res = await (a.http() as never as Agente)
          [m](ruta)
          .set(con(jugador));
        esperarError(res, 403, 'SIN_PERMISO');
      },
    );
  });

  describe('POST /ingresos — entrada', () => {
    it.each([
      ['sin cuerpo', {}],
      ['sin espacioId', { codigoQr: 'VGY-0919-19-ABCDEF' }],
      ['sin codigoQr', { espacioId: 'esp-abc' }],
      ['codigoQr vacío', { codigoQr: '', espacioId: 'esp-abc' }],
      ['codigoQr solo espacios', { codigoQr: '   ', espacioId: 'esp-abc' }],
      ['codigoQr número', { codigoQr: 123, espacioId: 'esp-abc' }],
      ['codigoQr null', { codigoQr: null, espacioId: 'esp-abc' }],
      ['codigoQr objeto', { codigoQr: {}, espacioId: 'esp-abc' }],
      ['espacioId número', { codigoQr: 'VGY-0919-19-ABCDEF', espacioId: 5 }],
      [
        'espacioId con prefijo equivocado',
        { codigoQr: 'VGY-0919-19-ABCDEF', espacioId: 'dep-abc' },
      ],
      ['espacioId vacío', { codigoQr: 'VGY-0919-19-ABCDEF', espacioId: '' }],
      [
        'campo de más',
        { codigoQr: 'VGY-0919-19-ABCDEF', espacioId: 'esp-abc', extra: 1 },
      ],
    ])('400 VALIDACION_FALLIDA: %s', async (_n, cuerpo) => {
      esperarError(
        await ingresar(encargado, cuerpo),
        400,
        'VALIDACION_FALLIDA',
      );
    });

    it('un código inexistente con espacio inexistente (bien formado) → 404 CODIGO_INVALIDO', async () => {
      esperarError(
        await ingresar(encargado, {
          codigoQr: 'VGY-0919-19-ZZZZZZ',
          espacioId: 'esp-noexiste',
        }),
        404,
        'CODIGO_INVALIDO',
      );
    });

    it('código válido pero espacioId que no existe → CODIGO_DE_OTRO_ESPACIO', async () => {
      const r = await reserva();
      esperarError(
        await ingresar(encargado, {
          codigoQr: r.codigoQr,
          espacioId: 'esp-noexiste',
        }),
        422,
        'CODIGO_DE_OTRO_ESPACIO',
      );
    });
  });

  describe('POST /ingresos — forma y valores (R14)', () => {
    it('200 con exactamente las claves de Reserva; ingresoEn sin milisegundos y con -03:00', async () => {
      const r = await reserva('19:00');
      ahora(`${HOY}T18:45:30.987-03:00`);
      const res = await ingresar(encargado, {
        codigoQr: r.codigoQr,
        espacioId,
      }).expect(200);
      const d = esperarContrato<Reserva>(res.body, 'Reserva');
      expect(Object.keys(d).sort()).toEqual(CLAVES_RESERVA);
      expect(d.estado).toBe('cumplida');
      expect(d.ingresoEn).toBe(`${HOY}T18:45:30-03:00`);
      expect(d.id).toBe(r.id);
      // y la consulta posterior coincide
      const g = await a
        .http()
        .get(`/reservas/${r.id}`)
        .set(con(encargado))
        .expect(200);
      expect(g.body.datos).toEqual(d);
    });

    it('no se pisa el estado de ausencias del dueño al ingresar', async () => {
      const r = await reserva('19:00');
      ahora(`${HOY}T19:10:00-03:00`);
      await ingresar(encargado, { codigoQr: r.codigoQr, espacioId }).expect(
        200,
      );
      const u = await usuario(jugador.usuario.id);
      expect(u.ausencias).toBe(0);
      expect(u.cancelacionesTardias).toBe(0);
    });

    it('no manda push a nadie', async () => {
      const r = await reserva('19:00');
      ahora(`${HOY}T19:00:00-03:00`);
      await ingresar(encargado, { codigoQr: r.codigoQr, espacioId }).expect(
        200,
      );
      expect(a.enviador.enviados).toHaveLength(0);
    });

    it('código en minúsculas y con espacios alrededor (M4-3) sigue andando; con espacios dentro no', async () => {
      const r = await reserva('19:00');
      ahora(`${HOY}T19:00:00-03:00`);
      esperarError(
        await ingresar(encargado, {
          codigoQr: r.codigoQr.replace('-', ' '),
          espacioId,
        }),
        404,
        'CODIGO_INVALIDO',
      );
      await ingresar(encargado, {
        codigoQr: `\t${r.codigoQr.toLowerCase()} \n`,
        espacioId,
      }).expect(200);
    });
  });

  describe('POST /ingresos — orden de validaciones de R14', () => {
    it('cancelada de otro día y otro espacio → RESERVA_CANCELADA primero', async () => {
      const otro = (await crearEspacio(a, { deporteId })).id;
      const r = await reserva('19:00', '2026-09-20', { estado: 'cancelada' });
      esperarError(
        await ingresar(encargado, { codigoQr: r.codigoQr, espacioId: otro }),
        422,
        'RESERVA_CANCELADA',
      );
    });
    it('otro día y otro espacio → CODIGO_DE_OTRO_DIA antes que CODIGO_DE_OTRO_ESPACIO', async () => {
      const otro = (await crearEspacio(a, { deporteId })).id;
      const r = await reserva('19:00', '2026-09-20');
      esperarError(
        await ingresar(encargado, { codigoQr: r.codigoQr, espacioId: otro }),
        422,
        'CODIGO_DE_OTRO_DIA',
      );
    });
    it('hoy, otro espacio, fuera de horario → CODIGO_DE_OTRO_ESPACIO antes que FUERA_DE_HORARIO', async () => {
      const otro = (await crearEspacio(a, { deporteId })).id;
      const r = await reserva('21:00');
      esperarError(
        await ingresar(encargado, { codigoQr: r.codigoQr, espacioId: otro }),
        422,
        'CODIGO_DE_OTRO_ESPACIO',
      );
    });
    it('ya ingresada y fuera de horario → INGRESO_YA_REGISTRADO antes que FUERA_DE_HORARIO', async () => {
      const r = await reserva('19:00');
      ahora(`${HOY}T19:10:00-03:00`);
      await ingresar(encargado, { codigoQr: r.codigoQr, espacioId }).expect(
        200,
      );
      ahora(`${HOY}T21:00:00-03:00`);
      esperarError(
        await ingresar(encargado, { codigoQr: r.codigoQr, espacioId }),
        409,
        'INGRESO_YA_REGISTRADO',
      );
    });
    it('cumplida de ayer → CODIGO_DE_OTRO_DIA (el día se mira antes que el ingreso previo)', async () => {
      const r = await reserva('19:00', '2026-09-18', {
        estado: 'cumplida',
        ingresoEn: a.reloj.ahora(),
      });
      esperarError(
        await ingresar(encargado, { codigoQr: r.codigoQr, espacioId }),
        422,
        'CODIGO_DE_OTRO_DIA',
      );
    });
  });

  describe('POST /ingresos — horario D10 y bordes del día', () => {
    it.each([
      ['07:29:59', 422],
      ['07:30:00', 200],
      ['08:59:59', 200],
      ['09:00:00', 422],
    ])('turno 08:00: a las %s → %i', async (hhmmss, estado) => {
      const r = await reserva('08:00');
      ahora(`${HOY}T${hhmmss}-03:00`);
      const res = await ingresar(encargado, {
        codigoQr: r.codigoQr,
        espacioId,
      });
      if (estado === 200) expect(res.status).toBe(200);
      else esperarError(res, 422, 'FUERA_DE_HORARIO');
    });
    it('turno 23:00: a las 23:59:59 entra; a las 00:00 del día siguiente es CODIGO_DE_OTRO_DIA', async () => {
      const r = await reserva('23:00');
      const r2 = await reserva('22:00');
      ahora(`${HOY}T23:59:59-03:00`);
      const ok = await ingresar(encargado, {
        codigoQr: r.codigoQr,
        espacioId,
      }).expect(200);
      expect(ok.body.datos.ingresoEn).toBe(`${HOY}T23:59:59-03:00`);
      ahora('2026-09-20T00:00:00-03:00');
      esperarError(
        await ingresar(encargado, { codigoQr: r2.codigoQr, espacioId }),
        422,
        'CODIGO_DE_OTRO_DIA',
      );
    });
    it('a las 00:00 argentinas (03:00Z) un turno de las 08:00 del mismo día todavía no abrió', async () => {
      const r = await reserva('08:00');
      ahora(`${HOY}T00:00:00-03:00`);
      esperarError(
        await ingresar(encargado, { codigoQr: r.codigoQr, espacioId }),
        422,
        'FUERA_DE_HORARIO',
      );
    });
    it('a las 21:30 argentinas (00:30Z del día siguiente) la reserva de hoy sigue siendo de hoy', async () => {
      const r = await reserva('21:00');
      ahora(`${HOY}T21:30:00-03:00`);
      await ingresar(encargado, { codigoQr: r.codigoQr, espacioId }).expect(
        200,
      );
    });
    it('último día del mes y 31/12: un turno de 23:00 se ingresa a las 23:30', async () => {
      for (const f of ['2026-09-30', '2026-12-31']) {
        const r = await reserva('23:00', f);
        ahora(`${f}T12:00:00-03:00`);
        const enc = await crearUsuario(a, 'encargado');
        ahora(`${f}T23:30:00-03:00`);
        const res = await ingresar(enc, {
          codigoQr: r.codigoQr,
          espacioId,
        }).expect(200);
        expect(res.body.datos.ingresoEn).toBe(`${f}T23:30:00-03:00`);
      }
    });
    it('instante dado en Z se interpreta bien (reloj en UTC): 22:45Z = 19:45 -03:00', async () => {
      const r = await reserva('19:00');
      ahora(`${HOY}T22:45:00Z`);
      const res = await ingresar(encargado, {
        codigoQr: r.codigoQr,
        espacioId,
      }).expect(200);
      expect(res.body.datos.ingresoEn).toBe(`${HOY}T19:45:00-03:00`);
    });
  });

  describe('POST /ingresos — simultáneo y cruces con ausente', () => {
    it('ingreso y ausente simultáneos: gana uno solo y las ausencias cuadran', async () => {
      const r = await reserva('19:00');
      ahora(`${HOY}T19:20:00-03:00`);
      const [i, au] = await Promise.all([
        ingresar(encargado, { codigoQr: r.codigoQr, espacioId }),
        ausente(admin, r.id),
      ]);
      const finalRes = await a
        .http()
        .get(`/reservas/${r.id}`)
        .set(con(encargado))
        .expect(200);
      const estado = finalRes.body.datos.estado as string;
      const u = await usuario(jugador.usuario.id);
      if (estado === 'cumplida') {
        expect(i.status).toBe(200);
        expect(u.ausencias).toBe(0);
        expect([409, 200]).toContain(au.status);
        expect(au.status).toBe(409);
      } else {
        expect(estado).toBe('ausente');
        expect(au.status).toBe(200);
        expect(u.ausencias).toBe(1);
        esperarError(i, 422, 'RESERVA_AUSENTE');
      }
    });
    it('cinco ingresos simultáneos: uno 200 y cuatro 409', async () => {
      const r = await reserva('19:00');
      ahora(`${HOY}T19:00:00-03:00`);
      const rs = await Promise.all(
        Array.from({ length: 5 }, () =>
          ingresar(encargado, { codigoQr: r.codigoQr, espacioId }),
        ),
      );
      expect(rs.filter((x) => x.status === 200)).toHaveLength(1);
      rs.filter((x) => x.status !== 200).forEach((x) =>
        esperarError(x, 409, 'INGRESO_YA_REGISTRADO'),
      );
    });
  });

  describe('POST /reservas/:id/ausente — R15', () => {
    it('200 con la Reserva exacta, estado ausente, ingresoEn null; ausencias +1 en /usuarios y en /yo', async () => {
      const r = await reserva('19:00');
      ahora(`${HOY}T19:15:00-03:00`);
      const res = await ausente(encargado, r.id).expect(200);
      const d = esperarContrato<Reserva>(res.body, 'Reserva');
      expect(Object.keys(d).sort()).toEqual(CLAVES_RESERVA);
      expect(d.estado).toBe('ausente');
      expect(d.ingresoEn).toBeNull();
      const u = await usuario(jugador.usuario.id);
      expect(u.ausencias).toBe(1);
      const yo = await a.http().get('/yo').set(con(jugador)).expect(200);
      expect(yo.body.datos.ausencias).toBe(1);
      expect(a.enviador.enviados).toHaveLength(0);
    });
    it.each([
      ['19:14:59', 422],
      ['19:15:00', 200],
    ])('turno 19:00 a las %s → %i', async (hhmmss, estado) => {
      const r = await reserva('19:00');
      ahora(`${HOY}T${hhmmss}-03:00`);
      const res = await ausente(encargado, r.id);
      if (estado === 200) expect(res.status).toBe(200);
      else esperarError(res, 422, 'ANTES_DE_TIEMPO');
    });
    it('un turno de 08:00 con el reloj a las 00:00 → ANTES_DE_TIEMPO', async () => {
      const r = await reserva('08:00');
      ahora(`${HOY}T00:00:00-03:00`);
      esperarError(await ausente(encargado, r.id), 422, 'ANTES_DE_TIEMPO');
    });
    it('una reserva de días atrás todavía se puede marcar (sin tope)', async () => {
      const r = await reserva('19:00', '2026-09-01');
      await ausente(admin, r.id).expect(200);
      expect((await usuario(jugador.usuario.id)).ausencias).toBe(1);
    });
    it('turno 23:00: a las 23:15 del 31/12 se puede', async () => {
      const r = await reserva('23:00', '2026-12-31');
      ahora('2026-12-31T12:00:00-03:00');
      const enc = await crearUsuario(a, 'encargado');
      ahora('2026-12-31T23:15:00-03:00');
      await ausente(enc, r.id).expect(200);
    });
    it('una reserva cumplida → 409 INGRESO_YA_REGISTRADO y no suma ausencia', async () => {
      const r = await reserva('19:00');
      ahora(`${HOY}T19:20:00-03:00`);
      await ingresar(encargado, { codigoQr: r.codigoQr, espacioId }).expect(
        200,
      );
      esperarError(
        await ausente(encargado, r.id),
        409,
        'INGRESO_YA_REGISTRADO',
      );
      expect((await usuario(jugador.usuario.id)).ausencias).toBe(0);
    });
    it('una cancelada → 422 RESERVA_CANCELADA y no suma ausencia', async () => {
      const r = await reserva('19:00', HOY, { estado: 'cancelada' });
      ahora(`${HOY}T19:20:00-03:00`);
      esperarError(await ausente(encargado, r.id), 422, 'RESERVA_CANCELADA');
      expect((await usuario(jugador.usuario.id)).ausencias).toBe(0);
    });
    it('dos ausentes seguidos del mismo jugador en turnos distintos suman 2', async () => {
      const r1 = await reserva('17:00');
      const r2 = await reserva('18:00');
      ahora(`${HOY}T19:00:00-03:00`);
      await ausente(encargado, r1.id).expect(200);
      await ausente(encargado, r2.id).expect(200);
      expect((await usuario(jugador.usuario.id)).ausencias).toBe(2);
    });
    it('la ausente libera el cupo de tres reservas activas al terminar el turno, pero el turno sigue reservado', async () => {
      const r = await reserva('19:00');
      ahora(`${HOY}T19:20:00-03:00`);
      await ausente(encargado, r.id).expect(200);
      const lista = await a
        .http()
        .get(`/espacios/${espacioId}/turnos?fecha=${HOY}`)
        .expect(200);
      const t = (lista.body.datos as Turno[]).find((x) => x.inicio === '19:00');
      expect(t?.estado).toBe('reservado');
      expect(t?.reservaId).toBe(r.id);
    });
    it.each([
      ['id sin prefijo', 'abc123'],
      ['prefijo de otra entidad', 'esp-abc123'],
    ])('id mal formado en la ruta (400 o 404): %s', async (_n, id) => {
      const res = await ausente(encargado, id);
      // AGENTS §7.3 pide validar el prefijo (400); el e2e del módulo acepta 404. Nunca 500.
      expect([400, 404]).toContain(res.status);
    });
    it('404 RESERVA_NO_ENCONTRADA con id bien formado', async () => {
      esperarError(
        await ausente(encargado, 'res-noexiste1'),
        404,
        'RESERVA_NO_ENCONTRADA',
      );
    });
    it('cuerpo con campos de más → 400', async () => {
      const r = await reserva('19:00');
      ahora(`${HOY}T19:20:00-03:00`);
      esperarError(
        await ausente(encargado, r.id, { motivo: 'x' }),
        400,
        'VALIDACION_FALLIDA',
      );
    });
  });

  describe('Cruces con otros módulos', () => {
    it('una reserva ya ausente rechaza ingreso con RESERVA_AUSENTE y mensaje en castellano sin jerga', async () => {
      const r = await reserva('19:00');
      ahora(`${HOY}T19:20:00-03:00`);
      await ausente(encargado, r.id).expect(200);
      const res = await ingresar(encargado, {
        codigoQr: r.codigoQr,
        espacioId,
      });
      esperarError(res, 422, 'RESERVA_AUSENTE');
      expect(res.body.error.mensaje).toMatch(/[a-záéíóú]/i);
      expect(res.body.error.mensaje).not.toMatch(/undefined|null|Error|SQL/i);
    });
    it('una cumplida o ausente no se puede cancelar por el dueño', async () => {
      const r = await reserva('19:00');
      ahora(`${HOY}T19:20:00-03:00`);
      await ausente(encargado, r.id).expect(200);
      const c = await a
        .http()
        .post(`/reservas/${r.id}/cancelacion`)
        .set(con(jugador))
        .send({});
      expect(c.status).toBeGreaterThanOrEqual(400);
      expect(c.status).toBeLessThan(500);
    });
  });
});

describe('M4 verificación — agenda, listado de reservas y usuarios', () => {
  let a: AppDePrueba;
  let deporteId: string;
  let encargado: UsuarioDePrueba;
  let admin: UsuarioDePrueba;
  let jugador: UsuarioDePrueba;
  let e1: string;
  let e2: string;

  beforeAll(async () => {
    a = await crearApp();
    deporteId = (await crearDeporte(a)).id;
    encargado = await crearUsuario(a, 'encargado');
    admin = await crearUsuario(a, 'administrador');
    jugador = await registrarJugador(a, { telefono: '3455-777888' });
    e1 = (await crearEspacio(a, { deporteId, id: 'esp-v1' })).id;
    e2 = (await crearEspacio(a, { deporteId, id: 'esp-v2' })).id;
    await crearEspacio(a, { deporteId, id: 'esp-v3', activo: false });
  });
  afterAll(() => a.cerrar());
  beforeEach(() => a.reloj.fijar(`${HOY}T10:00:00-03:00`));

  const agenda = (qs = '', u = encargado) =>
    a.http().get(`/agenda${qs}`).set(con(u));
  const reservas = (qs = '', u = encargado) =>
    a.http().get(`/reservas${qs}`).set(con(u));

  describe('GET /agenda', () => {
    it('cada elemento es un Turno exacto; reservas de todos los estados salvo cancelada marcan reservado', async () => {
      const f = '2026-09-21';
      const mk = (
        inicio: string,
        estado: 'confirmada' | 'cumplida' | 'ausente' | 'cancelada',
      ) =>
        crearReserva(a, {
          espacioId: e1,
          usuarioId: jugador.usuario.id,
          fecha: f,
          inicio,
          estado,
        });
      const rc = await mk('08:00', 'confirmada');
      const ru = await mk('09:00', 'cumplida');
      const ra = await mk('10:00', 'ausente');
      await mk('11:00', 'cancelada');
      await crearFija(a, {
        espacioId: e1,
        dia: 1,
        inicio: '12:00',
        fin: '14:00',
      });
      await crearBloqueo(a, {
        espacioId: e1,
        fecha: f,
        inicio: '13:00',
        fin: '15:00',
        motivo: 'Riego',
      });
      const res = await agenda(`?fecha=${f}&porPagina=500`).expect(200);
      const ts = esperarContrato<Turno[]>(res.body, 'Turno');
      expect(res.body.meta).toEqual({ total: 32, pagina: 1, porPagina: 500 });
      const de = (e: string, h: string) =>
        ts.find((t) => t.espacioId === e && t.inicio === h)!;
      expect(de(e1, '08:00')).toMatchObject({
        estado: 'reservado',
        reservaId: rc.id,
        motivoBloqueo: null,
      });
      expect(de(e1, '09:00')).toMatchObject({
        estado: 'reservado',
        reservaId: ru.id,
      });
      expect(de(e1, '10:00')).toMatchObject({
        estado: 'reservado',
        reservaId: ra.id,
      });
      expect(de(e1, '11:00')).toMatchObject({
        estado: 'libre',
        reservaId: null,
      });
      expect(de(e1, '12:00')).toMatchObject({
        estado: 'fijo',
        reservaId: null,
        motivoBloqueo: null,
      });
      expect(de(e1, '13:00')).toMatchObject({
        estado: 'mantenimiento',
        motivoBloqueo: 'Riego',
        reservaId: null,
      });
      expect(de(e1, '14:00')).toMatchObject({ estado: 'mantenimiento' });
      expect(de(e1, '15:00')).toMatchObject({ estado: 'libre' });
      expect(de(e1, '23:00').fin).toBe('24:00');
      expect(ts.every((t) => t.espacioId !== 'esp-v3')).toBe(true);
      expect(ts.every((t) => t.fecha === f)).toBe(true);
    });
    it('el id de turno es el determinístico y coincide con la grilla pública', async () => {
      const f = '2026-09-22';
      const ag = (await agenda(`?fecha=${f}&porPagina=500`).expect(200)).body
        .datos as Turno[];
      const pub = (
        await a.http().get(`/espacios/${e2}/turnos?fecha=${f}`).expect(200)
      ).body.datos as Turno[];
      expect(ag.filter((t) => t.espacioId === e2)).toEqual(pub);
      expect(ag[0].id).toBe('tur-esp-v1-20260922-08');
    });
    it('orden total estable entre páginas (sin repetidos ni huecos)', async () => {
      const todos: string[] = [];
      for (let p = 1; p <= 4; p++) {
        const r = await agenda(`?pagina=${p}&porPagina=10`).expect(200);
        todos.push(...(r.body.datos as Turno[]).map((t) => t.id));
      }
      expect(new Set(todos).size).toBe(32);
      expect(todos).toEqual([...todos].sort());
    });
    it('sin fecha usa hoy (hora argentina, con el reloj a las 23:59 y 00:00)', async () => {
      a.reloj.fijar(`${HOY}T23:59:59-03:00`);
      let r = await agenda('?porPagina=1').expect(200);
      expect(r.body.datos[0].fecha).toBe(HOY);
      a.reloj.fijar('2026-09-20T00:00:00-03:00');
      r = await agenda('?porPagina=1').expect(200);
      expect(r.body.datos[0].fecha).toBe('2026-09-20');
      a.reloj.fijar(`${HOY}T21:30:00-03:00`); // ya es el día siguiente en UTC
      r = await agenda('?porPagina=1').expect(200);
      expect(r.body.datos[0].fecha).toBe(HOY);
    });
    it('administrador también accede', async () => {
      await agenda('', admin).expect(200);
    });
    it.each([
      ['fecha=2026-02-30'],
      ['fecha=2026-13-01'],
      ['fecha=19-09-2026'],
      ['fecha=2026-9-1'],
      ['fecha='],
      ['fecha=2026-09-19T10:00:00-03:00'],
      ['porPagina=501'],
      ['porPagina=0'],
      ['pagina=0'],
      ['pagina=-1'],
      ['pagina=abc'],
      ['distancia=1'],
    ])('400 con ?%s', async (qs) => {
      esperarError(await agenda(`?${qs}`), 400, 'VALIDACION_FALLIDA');
    });
    it('página fuera de rango: datos [] con total correcto', async () => {
      const r = await agenda('?pagina=99&porPagina=20').expect(200);
      expect(r.body.datos).toEqual([]);
      expect(r.body.meta).toEqual({ total: 32, pagina: 99, porPagina: 20 });
    });
    it('el 29/02 de un año bisiesto y el 31/12 son fechas válidas', async () => {
      await agenda('?fecha=2028-02-29').expect(200);
      await agenda('?fecha=2026-12-31').expect(200);
      esperarError(
        await agenda('?fecha=2027-02-29'),
        400,
        'VALIDACION_FALLIDA',
      );
    });
  });

  describe('GET /reservas', () => {
    let r1: string;
    let r2: string;
    let r3: string;
    beforeAll(async () => {
      const otro = await registrarJugador(a);
      r1 = (
        await crearReserva(a, {
          espacioId: e1,
          usuarioId: jugador.usuario.id,
          fecha: '2026-10-01',
          inicio: '20:00',
        })
      ).id;
      r2 = (
        await crearReserva(a, {
          espacioId: e2,
          usuarioId: otro.usuario.id,
          fecha: '2026-10-01',
          inicio: '09:00',
          estado: 'ausente',
        })
      ).id;
      r3 = (
        await crearReserva(a, {
          espacioId: e2,
          usuarioId: otro.usuario.id,
          fecha: '2026-10-02',
          inicio: '09:00',
          estado: 'cancelada',
        })
      ).id;
    });
    it('forma exacta de Reserva, orden por fecha e inicio', async () => {
      const res = await reservas('?fecha=2026-10-01').expect(200);
      const d = esperarContrato<Reserva[]>(res.body, 'Reserva');
      d.forEach((x) => expect(Object.keys(x).sort()).toEqual(CLAVES_RESERVA));
      expect(d.map((x) => x.id)).toEqual([r2, r1]);
    });
    it('cada filtro solo y combinado; cancelada incluida cuando se pide', async () => {
      const por = async (qs: string) =>
        ((await reservas(qs).expect(200)).body.datos as Reserva[]).map(
          (x) => x.id,
        );
      expect(await por('?estado=cancelada&fecha=2026-10-02')).toEqual([r3]);
      expect(
        await por('?estado=ausente&espacioId=esp-v2&fecha=2026-10-01'),
      ).toEqual([r2]);
      expect(
        await por('?estado=ausente&espacioId=esp-v1&fecha=2026-10-01'),
      ).toEqual([]);
      expect(await por('?fecha=2026-10-02&espacioId=esp-v2')).toEqual([r3]);
      expect(await por('?fecha=2026-10-03')).toEqual([]);
      expect((await por('?fecha=2026-10-01')).length).toBe(2);
    });
    it('meta.total es el filtrado; paginación y página fuera de rango', async () => {
      const res = await reservas(
        '?fecha=2026-10-01&porPagina=1&pagina=2',
      ).expect(200);
      expect(res.body.meta).toEqual({ total: 2, pagina: 2, porPagina: 1 });
      expect(res.body.datos).toHaveLength(1);
      const fuera = await reservas('?fecha=2026-10-01&pagina=50').expect(200);
      expect(fuera.body.datos).toEqual([]);
      expect(fuera.body.meta.total).toBe(2);
    });
    it.each([
      ['estado=confirmadas'],
      ['estado='],
      ['estado=CONFIRMADA'],
      ['fecha=2026-02-30'],
      ['espacioId=dep-1'],
      ['espacioId='],
      ['usuarioId=usr-1'],
      ['porPagina=101'],
    ])('400 con ?%s', async (qs) => {
      esperarError(await reservas(`?${qs}`), 400, 'VALIDACION_FALLIDA');
    });
    it('un espacioId inexistente pero bien formado da lista vacía', async () => {
      const res = await reservas('?espacioId=esp-fantasma').expect(200);
      expect(res.body).toEqual({
        datos: [],
        meta: { total: 0, pagina: 1, porPagina: 20 },
      });
    });
    it('un espacio inactivo igual muestra sus reservas', async () => {
      const x = await crearReserva(a, {
        espacioId: 'esp-v3',
        usuarioId: jugador.usuario.id,
        fecha: '2026-10-05',
        inicio: '10:00',
      });
      const res = await reservas('?espacioId=esp-v3').expect(200);
      expect(res.body.datos.map((d: Reserva) => d.id)).toEqual([x.id]);
    });
  });

  describe('GET /usuarios/:id', () => {
    it.each([
      ['jugador', () => jugador],
      ['encargado', () => encargado],
      ['administrador', () => admin],
    ])(
      'devuelve el Usuario (%s) con exactamente las claves del tipo y sin datos internos',
      async (_n, quien) => {
        const u = quien();
        const res = await a
          .http()
          .get(`/usuarios/${u.usuario.id}`)
          .set(con(encargado))
          .expect(200);
        const d = esperarContrato<Usuario>(res.body, 'Usuario');
        expect(Object.keys(d).sort()).toEqual(CLAVES_USUARIO);
        expect(d.telefono).not.toBe('');
        expect(JSON.stringify(res.body)).not.toMatch(
          /hash|contrasena|password|scrypt/i,
        );
        expect(d).toEqual(u.usuario);
      },
    );
    it('el administrador también puede consultar', async () => {
      await a
        .http()
        .get(`/usuarios/${jugador.usuario.id}`)
        .set(con(admin))
        .expect(200);
    });
    it('un jugador no puede ni mirarse a sí mismo por esta ruta (403)', async () => {
      esperarError(
        await a.http().get(`/usuarios/${jugador.usuario.id}`).set(con(jugador)),
        403,
        'SIN_PERMISO',
      );
    });
    it('404 USUARIO_NO_ENCONTRADO para inexistente y para id mal formado', async () => {
      for (const id of ['usr-noexiste', 'esp-v1', '123']) {
        esperarError(
          await a.http().get(`/usuarios/${id}`).set(con(encargado)),
          404,
          'USUARIO_NO_ENCONTRADO',
        );
      }
    });
    it('refleja ausencias y favoritos vacíos', async () => {
      const r = await crearReserva(a, {
        espacioId: e1,
        usuarioId: jugador.usuario.id,
        fecha: HOY,
        inicio: '08:00',
      });
      await a
        .http()
        .post(`/reservas/${r.id}/ausente`)
        .set(con(encargado))
        .send({})
        .expect(200);
      const res = await a
        .http()
        .get(`/usuarios/${jugador.usuario.id}`)
        .set(con(encargado))
        .expect(200);
      expect(res.body.datos.ausencias).toBe(1);
      expect(res.body.datos.espaciosFavoritos).toEqual([]);
    });
  });
});
