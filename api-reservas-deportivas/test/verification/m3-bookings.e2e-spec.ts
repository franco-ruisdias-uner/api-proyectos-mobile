// Verificación independiente de M3 — Reservas (ESPECIFICACION §4 M3, R7–R13, D1–D3; DECISIONES M3-1 a M3-6).
// Caja negra: sólo HTTP contra la app completa. Complementa test/e2e/reservas sin repetirlo.
import { createHmac } from 'node:crypto';
import type { Reserva, Usuario } from '../../contract/types.js';
import {
  JWT_SECRETO_PRUEBA,
  type AppDePrueba,
  crearApp,
} from '../utilities/create-app.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import { crearDeporte, crearEspacio } from '../utilities/venues.js';
import { crearBloqueo, crearReserva } from '../utilities/slots.js';
import {
  crearUsuario,
  registrarJugador,
  type UsuarioDePrueba,
} from '../utilities/users.js';

const CLAVES = [
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
const tur = (e: string, f: string, hh: string) =>
  `tur-${e}-${f.replaceAll('-', '')}-${hh}`;

function jwt(payload: object, secreto: string): string {
  const b = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const cuerpo = `${b({ alg: 'HS256', typ: 'JWT' })}.${b(payload)}`;
  return `${cuerpo}.${createHmac('sha256', secreto).update(cuerpo).digest('base64url')}`;
}

describe('M3 — reservas: casos adversariales', () => {
  let a: AppDePrueba;
  let deporteId: string;
  let espacioId: string;
  let encargado: UsuarioDePrueba;
  let admin: UsuarioDePrueba;

  beforeAll(async () => {
    a = await crearApp();
    deporteId = (await crearDeporte(a)).id;
    encargado = await crearUsuario(a, 'encargado');
    admin = await crearUsuario(a, 'administrador');
  });
  afterAll(() => a.cerrar());
  beforeEach(async () => {
    a.reloj.fijar('2026-09-19T10:00:00-03:00');
    espacioId = (await crearEspacio(a, { deporteId, capacidad: 10 })).id;
  });

  const auth = (u: UsuarioDePrueba) => ({ Authorization: `Bearer ${u.token}` });
  const reservar = (u: UsuarioDePrueba, cuerpo: unknown) =>
    a
      .http()
      .post('/reservas')
      .set(auth(u))
      .send(cuerpo as object);
  const cancelar = (u: UsuarioDePrueba, id: string, cuerpo?: object) =>
    a
      .http()
      .post(`/reservas/${id}/cancelacion`)
      .set(auth(u))
      .send(cuerpo ?? {});

  describe('Autenticación (AGENTS §7)', () => {
    const rutas: Array<[string, string]> = [
      ['post', '/reservas'],
      ['get', '/yo/reservas'],
      ['get', '/reservas/res-abc123'],
      ['post', '/reservas/res-abc123/cancelacion'],
    ];
    it.each(rutas)('%s %s: token mal firmado → 401', async (m, ruta) => {
      const t = jwt(
        { sub: 'usr-x', rol: 'jugador', exp: 9999999999 },
        'otro-secreto',
      );
      const res = await (
        a.http() as never as Record<
          string,
          (r: string) => import('supertest').Test
        >
      )
        [m](ruta)
        .set('Authorization', `Bearer ${t}`);
      esperarError(res, 401, 'NO_AUTENTICADO');
    });
    it.each(rutas)('%s %s: token vencido → 401', async (m, ruta) => {
      const j = await registrarJugador(a);
      const t = jwt(
        { sub: j.usuario.id, rol: 'jugador', iat: 1000, exp: 2000 },
        JWT_SECRETO_PRUEBA,
      );
      const res = await (
        a.http() as never as Record<
          string,
          (r: string) => import('supertest').Test
        >
      )
        [m](ruta)
        .set('Authorization', `Bearer ${t}`);
      esperarError(res, 401, 'NO_AUTENTICADO');
    });
    it('esquema Authorization distinto de Bearer → 401', async () => {
      const j = await registrarJugador(a);
      esperarError(
        await a.http().get('/yo/reservas').set('Authorization', j.token),
        401,
        'NO_AUTENTICADO',
      );
    });
  });

  describe('Forma (AGENTS §4.3)', () => {
    it('la reserva creada, la repetida, la consultada y la cancelada tienen exactamente las claves del tipo', async () => {
      const u = await registrarJugador(a);
      const cuerpo = {
        turnoId: tur(espacioId, '2026-09-22', '12'),
        cantidadPersonas: 3,
      };
      const r1 = await reservar(u, cuerpo).expect(201);
      const r2 = await reservar(u, cuerpo).expect(200);
      const id = r1.body.datos.id as string;
      const r3 = await a.http().get(`/reservas/${id}`).set(auth(u)).expect(200);
      const r4 = await cancelar(u, id).expect(200);
      const lista = await a
        .http()
        .get('/yo/reservas?cuando=pasadas')
        .set(auth(u))
        .expect(200);
      for (const res of [r1, r2, r3, r4]) {
        esperarContrato<Reserva>(res.body, 'Reserva');
        expect(Object.keys(res.body.datos).sort()).toEqual(CLAVES);
      }
      expect(r2.body).toEqual(r1.body);
      expect(r3.body.datos).toEqual(r1.body.datos);
      expect(r4.body.datos).toEqual({ ...r1.body.datos, estado: 'cancelada' });
      esperarContrato<Reserva[]>(lista.body, 'Reserva');
      expect(lista.body.datos[0]).toEqual(r4.body.datos);
    });

    it('creadaEn y cancelableHasta salen sin milisegundos aunque el reloj los tenga', async () => {
      const u = await registrarJugador(a);
      a.reloj.fijar('2026-09-19T10:00:00.789-03:00');
      const res = await reservar(u, {
        turnoId: tur(espacioId, '2026-09-21', '09'),
        cantidadPersonas: 1,
      }).expect(201);
      const r = esperarContrato<Reserva>(res.body, 'Reserva');
      expect(r.creadaEn).toBe('2026-09-19T10:00:00-03:00');
      expect(r.cancelableHasta).toBe('2026-09-21T05:00:00-03:00');
    });

    it('los códigos QR son distintos entre reservas y siguen el formato (D2)', async () => {
      const u = await registrarJugador(a);
      const qrs = new Set<string>();
      for (const hh of ['08', '09', '10']) {
        const res = await reservar(u, {
          turnoId: tur(espacioId, '2026-09-21', hh),
          cantidadPersonas: 1,
        }).expect(201);
        expect(res.body.datos.codigoQr).toMatch(
          new RegExp(`^VGY-0921-${hh}-[A-Z0-9]{6}$`),
        );
        qrs.add(res.body.datos.codigoQr);
      }
      expect(qrs.size).toBe(3);
    });
  });

  describe('Fechas: bordes de calendario y de hora (AGENTS §6)', () => {
    it('31/12: cancelableHasta de un turno de 01:00 de enero no aplica; el de 23:00 del 31/12 cae a las 19:00 del mismo día', async () => {
      a.reloj.fijar('2026-12-28T10:00:00-03:00');
      const u = await registrarJugador(a);
      const res = await reservar(u, {
        turnoId: tur(espacioId, '2026-12-31', '23'),
        cantidadPersonas: 2,
      }).expect(201);
      expect(res.body.datos.cancelableHasta).toBe('2026-12-31T19:00:00-03:00');
      expect(res.body.datos.codigoQr).toMatch(/^VGY-1231-23-/);
    });

    it('cancelableHasta cruza el cambio de día, de mes y de año (turno de 08:00 el 1/1)', async () => {
      a.reloj.fijar('2026-12-30T10:00:00-03:00');
      const u = await registrarJugador(a);
      const res = await reservar(u, {
        turnoId: tur(espacioId, '2027-01-01', '08'),
        cantidadPersonas: 2,
      }).expect(201);
      expect(res.body.datos.cancelableHasta).toBe('2027-01-01T04:00:00-03:00');
      expect(res.body.datos.codigoQr).toMatch(/^VGY-0101-08-/);
    });

    it('último día del mes: hoy 28/02/2028 (bisiesto) con hoy+6 = 05/03', async () => {
      a.reloj.fijar('2028-02-28T12:00:00-03:00');
      const u = await registrarJugador(a);
      await reservar(u, {
        turnoId: tur(espacioId, '2028-02-29', '10'),
        cantidadPersonas: 1,
      }).expect(201);
      await reservar(u, {
        turnoId: tur(espacioId, '2028-03-05', '10'),
        cantidadPersonas: 1,
      }).expect(201);
      esperarError(
        await reservar(u, {
          turnoId: tur(espacioId, '2028-03-06', '10'),
          cantidadPersonas: 1,
        }),
        422,
        'FECHA_FUERA_DE_RANGO',
      );
    });

    it('29/02 en año no bisiesto → 404 TURNO_NO_ENCONTRADO', async () => {
      const u = await registrarJugador(a);
      esperarError(
        await reservar(u, {
          turnoId: tur(espacioId, '2026-02-29', '10'),
          cantidadPersonas: 1,
        }),
        404,
        'TURNO_NO_ENCONTRADO',
      );
    });

    it('a las 23:59 de hoy hoy+6 sigue siendo el último día; a las 00:00 del día siguiente el rango se corre', async () => {
      const u = await registrarJugador(a);
      a.reloj.fijar('2026-09-19T23:59:59-03:00'); // 02:59:59Z del 20
      await reservar(u, {
        turnoId: tur(espacioId, '2026-09-25', '10'),
        cantidadPersonas: 1,
      }).expect(201);
      esperarError(
        await reservar(u, {
          turnoId: tur(espacioId, '2026-09-26', '10'),
          cantidadPersonas: 1,
        }),
        422,
        'FECHA_FUERA_DE_RANGO',
      );
      a.reloj.fijar('2026-09-20T00:00:00-03:00');
      await reservar(u, {
        turnoId: tur(espacioId, '2026-09-26', '10'),
        cantidadPersonas: 1,
      }).expect(201);
      esperarError(
        await reservar(u, {
          turnoId: tur(espacioId, '2026-09-19', '23'),
          cantidadPersonas: 1,
        }),
        422,
        'FECHA_FUERA_DE_RANGO',
      );
    });

    it('reloj a las 23:30: el turno de 23:00 de hoy ya pasó, el de mañana a las 08:00 se reserva', async () => {
      const u = await registrarJugador(a);
      a.reloj.fijar('2026-09-19T23:30:00-03:00');
      esperarError(
        await reservar(u, {
          turnoId: tur(espacioId, '2026-09-19', '23'),
          cantidadPersonas: 1,
        }),
        422,
        'TURNO_PASADO',
      );
      const r = await reservar(u, {
        turnoId: tur(espacioId, '2026-09-20', '08'),
        cantidadPersonas: 1,
      }).expect(201);
      expect(r.body.datos.cancelableHasta).toBe('2026-09-20T04:00:00-03:00');
    });

    it('reloj a las 00:00 exactas: cualquier turno de hoy es futuro salvo los que ya empezaron; el de 08:00 se reserva', async () => {
      const u = await registrarJugador(a);
      a.reloj.fijar('2026-09-19T00:00:00-03:00');
      await reservar(u, {
        turnoId: tur(espacioId, '2026-09-19', '08'),
        cantidadPersonas: 1,
      }).expect(201);
    });

    it('cancelación: exactamente a las 4 h menos un segundo se puede; 4 h y un segundo no (dueño)', async () => {
      const u = await registrarJugador(a);
      const r = await crearReserva(a, {
        espacioId,
        usuarioId: u.usuario.id,
        fecha: '2026-09-19',
        inicio: '23:00',
      });
      a.reloj.fijar('2026-09-19T19:00:00-03:00');
      esperarContrato(
        await cancelar(u, r.id)
          .expect(200)
          .then((x) => x.body),
        'Reserva',
      );
      const r2 = await crearReserva(a, {
        espacioId,
        usuarioId: u.usuario.id,
        fecha: '2026-09-19',
        inicio: '22:00',
      });
      a.reloj.fijar('2026-09-19T18:00:01-03:00');
      esperarError(await cancelar(u, r2.id), 422, 'CANCELACION_FUERA_DE_PLAZO');
    });

    it('cancelar al cruzar la medianoche UTC (21:00-03:00 = 00:00Z) respeta el plazo local', async () => {
      const u = await registrarJugador(a);
      const r = await crearReserva(a, {
        espacioId,
        usuarioId: u.usuario.id,
        fecha: '2026-09-20',
        inicio: '08:00',
      });
      a.reloj.fijar('2026-09-20T03:59:59-03:00');
      await cancelar(u, r.id).expect(200);
    });
  });

  describe('Entrada (AGENTS §7.3)', () => {
    it.each([
      [
        'cantidadPersonas enorme',
        { cantidadPersonas: 1e12 },
        422,
        'CAPACIDAD_EXCEDIDA',
      ],
      [
        'cantidadPersonas null',
        { cantidadPersonas: null },
        400,
        'VALIDACION_FALLIDA',
      ],
      [
        'cantidadPersonas booleano',
        { cantidadPersonas: true },
        400,
        'VALIDACION_FALLIDA',
      ],
      [
        'cantidadPersonas arreglo',
        { cantidadPersonas: [2] },
        400,
        'VALIDACION_FALLIDA',
      ],
      ['turnoId vacío', { turnoId: '' }, 400, 'VALIDACION_FALLIDA'],
      ['turnoId null', { turnoId: null }, 400, 'VALIDACION_FALLIDA'],
      ['turnoId objeto', { turnoId: { a: 1 } }, 400, 'VALIDACION_FALLIDA'],
      ['usuarioId de más', { usuarioId: 'usr-1' }, 400, 'VALIDACION_FALLIDA'],
      ['password de más', { password: 'x' }, 400, 'VALIDACION_FALLIDA'],
      ['espacioId de más', { espacioId: 'esp-1' }, 400, 'VALIDACION_FALLIDA'],
    ])('%s', async (_d, extra, estado, codigo) => {
      const u = await registrarJugador(a);
      const res = await reservar(u, {
        turnoId: tur(espacioId, '2026-09-21', '10'),
        cantidadPersonas: 2,
        ...extra,
      });
      esperarError(res, estado, codigo);
    });

    it('cuerpo vacío, no-JSON y arreglo → 400 con sobre de error', async () => {
      const u = await registrarJugador(a);
      esperarError(
        await a.http().post('/reservas').set(auth(u)),
        400,
        'VALIDACION_FALLIDA',
      );
      esperarError(
        await a
          .http()
          .post('/reservas')
          .set(auth(u))
          .set('Content-Type', 'application/json')
          .send('{no es json'),
        400,
        'VALIDACION_FALLIDA',
      );
      const res = await a
        .http()
        .post('/reservas')
        .set(auth(u))
        .send([{ turnoId: 'x' }]);
      expect(res.status).toBe(400);
    });

    it.each([
      ['mayúsculas', (e: string) => `TUR-${e.toUpperCase()}-20260921-10`],
      ['hora de un dígito', (e: string) => `tur-${e}-20260921-9`],
      ['hora con minutos', (e: string) => `tur-${e}-20260921-10:00`],
      ['fecha con guiones', (e: string) => `tur-${e}-2026-09-21-10`],
      ['espacios alrededor', (e: string) => ` tur-${e}-20260921-10 `],
      ['sufijo de más', (e: string) => `tur-${e}-20260921-10-x`],
      ['prefijo de reserva', (e: string) => `res-${e}-20260921-10`],
    ])('turnoId con %s → 404 o 400, nunca 500 ni 201', async (_d, f) => {
      const u = await registrarJugador(a);
      const res = await reservar(u, {
        turnoId: f(espacioId),
        cantidadPersonas: 2,
      });
      expect([400, 404]).toContain(res.status);
      expect(Object.keys(res.body)).toEqual(['error']);
      expect(Object.keys(res.body.error).sort()).toEqual(['codigo', 'mensaje']);
    });

    it('inyección tipo SQL en turnoId → error de contrato, no 500', async () => {
      const u = await registrarJugador(a);
      const res = await reservar(u, {
        turnoId: "tur-'; DROP TABLE reservas;--",
        cantidadPersonas: 2,
      });
      expect([400, 404]).toContain(res.status);
    });
  });

  describe('Reglas de R7 en combinaciones raras', () => {
    it('hoy+6 a las 08:00 con el reloj a las 23:59 de hoy: fecha en rango pero turno pasado no aplica (futuro)', async () => {
      const u = await registrarJugador(a);
      a.reloj.fijar('2026-09-19T23:59:00-03:00');
      await reservar(u, {
        turnoId: tur(espacioId, '2026-09-25', '08'),
        cantidadPersonas: 1,
      }).expect(201);
    });

    it('mensajes de error en castellano, sin jerga ni ids', async () => {
      const u = await registrarJugador(a);
      const res = await reservar(u, {
        turnoId: tur(espacioId, '2026-09-19', '08'),
        cantidadPersonas: 2,
      });
      esperarError(res, 422, 'TURNO_PASADO');
      expect(res.body.error.mensaje).toBe('Ese turno ya pasó.');
      const res2 = await reservar(u, { turnoId: 'nada', cantidadPersonas: 2 });
      expect(res2.body.error.mensaje).toBe('No existe ese turno.');
    });

    it('fija y bloqueo parcial: sólo tapan sus horas; el turno de al lado se reserva', async () => {
      const u = await registrarJugador(a);
      await crearBloqueo(a, {
        espacioId,
        fecha: '2026-09-21',
        inicio: '10:00',
        fin: '12:00',
      });
      for (const hh of ['10', '11'])
        esperarError(
          await reservar(u, {
            turnoId: tur(espacioId, '2026-09-21', hh),
            cantidadPersonas: 1,
          }),
          409,
          'TURNO_NO_DISPONIBLE',
        );
      await reservar(u, {
        turnoId: tur(espacioId, '2026-09-21', '12'),
        cantidadPersonas: 1,
      }).expect(201);
      await reservar(u, {
        turnoId: tur(espacioId, '2026-09-21', '09'),
        cantidadPersonas: 1,
      }).expect(201);
    });

    it('un bloqueo de día entero en otro espacio no afecta a éste', async () => {
      const otro = (await crearEspacio(a, { deporteId })).id;
      await crearBloqueo(a, { espacioId: otro, fecha: '2026-09-21' });
      const u = await registrarJugador(a);
      await reservar(u, {
        turnoId: tur(espacioId, '2026-09-21', '10'),
        cantidadPersonas: 1,
      }).expect(201);
    });

    it('dos espacios distintos, mismo día y hora: ambos se reservan (D1)', async () => {
      const otro = (await crearEspacio(a, { deporteId })).id;
      const u1 = await registrarJugador(a);
      const u2 = await registrarJugador(a);
      await reservar(u1, {
        turnoId: tur(espacioId, '2026-09-21', '10'),
        cantidadPersonas: 1,
      }).expect(201);
      await reservar(u2, {
        turnoId: tur(otro, '2026-09-21', '10'),
        cantidadPersonas: 1,
      }).expect(201);
    });

    it('capacidad 1 y cantidadPersonas 1 entra; 2 no', async () => {
      const e = await crearEspacio(a, { deporteId, capacidad: 1 });
      const u = await registrarJugador(a);
      esperarError(
        await reservar(u, {
          turnoId: tur(e.id, '2026-09-21', '10'),
          cantidadPersonas: 2,
        }),
        422,
        'CAPACIDAD_EXCEDIDA',
      );
      await reservar(u, {
        turnoId: tur(e.id, '2026-09-21', '10'),
        cantidadPersonas: 1,
      }).expect(201);
    });

    it('turno ocupado por una reserva cumplida de otro y turno pasado: el pasado se informa primero (R7)', async () => {
      const otro = await registrarJugador(a);
      await crearReserva(a, {
        espacioId,
        usuarioId: otro.usuario.id,
        fecha: '2026-09-19',
        inicio: '08:00',
        estado: 'cumplida',
      });
      const u = await registrarJugador(a);
      esperarError(
        await reservar(u, {
          turnoId: tur(espacioId, '2026-09-19', '08'),
          cantidadPersonas: 1,
        }),
        422,
        'TURNO_PASADO',
      );
    });

    it('cancelar y volver a reservar el mismo turno el mismo jugador: 201 nueva reserva, no la cancelada (R11)', async () => {
      const u = await registrarJugador(a);
      const cuerpo = {
        turnoId: tur(espacioId, '2026-09-23', '18'),
        cantidadPersonas: 2,
      };
      const r1 = await reservar(u, cuerpo).expect(201);
      await cancelar(u, r1.body.datos.id).expect(200);
      const r2 = await reservar(u, cuerpo).expect(201);
      expect(r2.body.datos.id).not.toBe(r1.body.datos.id);
      expect(r2.body.datos.estado).toBe('confirmada');
      expect(r2.body.datos.codigoQr).not.toBe(r1.body.datos.codigoQr);
    });

    it('cancelar, reservar de nuevo y cancelar dos veces no deja el turno trabado ni duplica (R8)', async () => {
      const u = await registrarJugador(a);
      const cuerpo = {
        turnoId: tur(espacioId, '2026-09-23', '18'),
        cantidadPersonas: 2,
      };
      for (let i = 0; i < 3; i++) {
        const r = await reservar(u, cuerpo).expect(201);
        await cancelar(u, r.body.datos.id).expect(200);
      }
      const otro = await registrarJugador(a);
      await reservar(otro, cuerpo).expect(201);
    });

    it('reintento del mismo turno con otra cantidadPersonas devuelve la original sin cambiarla', async () => {
      const u = await registrarJugador(a);
      const t = tur(espacioId, '2026-09-23', '18');
      await reservar(u, { turnoId: t, cantidadPersonas: 2 }).expect(201);
      const r = await reservar(u, { turnoId: t, cantidadPersonas: 7 }).expect(
        200,
      );
      expect(r.body.datos.cantidadPersonas).toBe(2);
    });
  });

  describe('R9 — límite de tres', () => {
    it('cancelar una confirmada de un turno de hoy que empezó, por un encargado, no es posible; no libera cupo', async () => {
      const u = await registrarJugador(a);
      const en = await crearReserva(a, {
        espacioId,
        usuarioId: u.usuario.id,
        fecha: '2026-09-19',
        inicio: '10:00',
      });
      await crearReserva(a, {
        espacioId,
        usuarioId: u.usuario.id,
        fecha: '2026-09-21',
        inicio: '10:00',
      });
      await crearReserva(a, {
        espacioId,
        usuarioId: u.usuario.id,
        fecha: '2026-09-22',
        inicio: '10:00',
      });
      esperarError(
        await reservar(u, {
          turnoId: tur(espacioId, '2026-09-23', '10'),
          cantidadPersonas: 1,
        }),
        422,
        'LIMITE_DE_RESERVAS',
      );
      a.reloj.fijar('2026-09-19T11:00:00-03:00'); // la en curso terminó
      await reservar(u, {
        turnoId: tur(espacioId, '2026-09-23', '10'),
        cantidadPersonas: 1,
      }).expect(201);
      expect(en.id).toBeTruthy();
    });

    it('el límite se evalúa con las reservas confirmadas de cualquier espacio', async () => {
      const otro = (await crearEspacio(a, { deporteId })).id;
      const u = await registrarJugador(a);
      await reservar(u, {
        turnoId: tur(espacioId, '2026-09-21', '10'),
        cantidadPersonas: 1,
      }).expect(201);
      await reservar(u, {
        turnoId: tur(otro, '2026-09-21', '10'),
        cantidadPersonas: 1,
      }).expect(201);
      await reservar(u, {
        turnoId: tur(espacioId, '2026-09-22', '10'),
        cantidadPersonas: 1,
      }).expect(201);
      esperarError(
        await reservar(u, {
          turnoId: tur(otro, '2026-09-22', '10'),
          cantidadPersonas: 1,
        }),
        422,
        'LIMITE_DE_RESERVAS',
      );
    });

    it('cuatro pedidos simultáneos a turnos distintos del mismo jugador: a lo sumo tres quedan activas (M3-5 admite el riesgo)', async () => {
      const u = await registrarJugador(a);
      const res = await Promise.all(
        ['08', '09', '10', '11'].map((hh) =>
          reservar(u, {
            turnoId: tur(espacioId, '2026-09-22', hh),
            cantidadPersonas: 1,
          }),
        ),
      );
      const ok = res.filter((r) => r.status === 201).length;
      const lista = await a.http().get('/yo/reservas').set(auth(u)).expect(200);
      expect(lista.body.meta.total).toBe(ok);
      expect(ok).toBeLessThanOrEqual(3);
      for (const r of res.filter((x) => x.status !== 201))
        expect([422, 409]).toContain(r.status);
    });
  });

  describe('R8 — concurrencia', () => {
    it('diez jugadores al mismo turno: exactamente un 201 y nueve 409 TURNO_OCUPADO, sin 500', async () => {
      const us = await Promise.all(
        Array.from({ length: 10 }, () => registrarJugador(a)),
      );
      const t = tur(espacioId, '2026-09-24', '20');
      const res = await Promise.all(
        us.map((u) => reservar(u, { turnoId: t, cantidadPersonas: 2 })),
      );
      expect(res.filter((r) => r.status === 201)).toHaveLength(1);
      const otros = res.filter((r) => r.status !== 201);
      expect(otros).toHaveLength(9);
      for (const r of otros) esperarError(r, 409, 'TURNO_OCUPADO');
      const g = await a
        .http()
        .get(`/espacios/${espacioId}/turnos?fecha=2026-09-24`)
        .expect(200);
      expect(
        g.body.datos.filter(
          (x: { estado: string }) => x.estado === 'reservado',
        ),
      ).toHaveLength(1);
    });

    it('reservar y cancelar a la vez, repetido: nunca quedan dos confirmadas en el mismo turno', async () => {
      const t = tur(espacioId, '2026-09-24', '21');
      const base = await registrarJugador(a);
      const r0 = await reservar(base, {
        turnoId: t,
        cantidadPersonas: 2,
      }).expect(201);
      const us = await Promise.all(
        Array.from({ length: 4 }, () => registrarJugador(a)),
      );
      const res = await Promise.all([
        cancelar(base, r0.body.datos.id),
        ...us.map((u) => reservar(u, { turnoId: t, cantidadPersonas: 2 })),
      ]);
      for (const r of res) expect(r.status).toBeLessThan(500);
      const g = await a
        .http()
        .get(`/espacios/${espacioId}/turnos?fecha=2026-09-24`)
        .expect(200);
      expect(
        g.body.datos.filter(
          (x: { id: string; estado: string }) =>
            x.id === t && x.estado === 'reservado',
        ).length,
      ).toBeLessThanOrEqual(1);
      expect(
        res.slice(1).filter((r) => r.status === 201).length,
      ).toBeLessThanOrEqual(1);
    });
  });

  describe('GET /yo/reservas (R13)', () => {
    it('no mezcla reservas de otro jugador ni con el encargado: el encargado sólo ve las suyas (ninguna)', async () => {
      const u = await registrarJugador(a);
      await crearReserva(a, {
        espacioId,
        usuarioId: u.usuario.id,
        fecha: '2026-09-21',
        inicio: '10:00',
      });
      const res = await a
        .http()
        .get('/yo/reservas')
        .set(auth(encargado))
        .expect(200);
      expect(res.body.datos).toEqual([]);
    });

    it('el orden es estable con paginación: sin repetidos ni faltantes al recorrer todas las páginas', async () => {
      const u = await registrarJugador(a);
      const otro = await crearEspacio(a, { deporteId });
      // mismo inicio en dos espacios: empate que se desempata por id
      for (const e of [espacioId, otro.id])
        for (const f of ['2026-09-21', '2026-09-22'])
          await crearReserva(a, {
            espacioId: e,
            usuarioId: u.usuario.id,
            fecha: f,
            inicio: '10:00',
            estado: 'cumplida',
          });
      const vistos: string[] = [];
      for (let p = 1; p <= 4; p++) {
        const res = await a
          .http()
          .get(`/yo/reservas?cuando=pasadas&porPagina=1&pagina=${p}`)
          .set(auth(u))
          .expect(200);
        vistos.push(...res.body.datos.map((r: Reserva) => r.id));
      }
      expect(new Set(vistos).size).toBe(4);
      const todas = await a
        .http()
        .get('/yo/reservas?cuando=pasadas')
        .set(auth(u))
        .expect(200);
      expect(todas.body.datos.map((r: Reserva) => r.id)).toEqual(vistos);
    });

    it('el filtro cuando repetido o con mayúsculas es 400, no un default silencioso', async () => {
      const u = await registrarJugador(a);
      esperarError(
        await a.http().get('/yo/reservas?cuando=Proximas').set(auth(u)),
        400,
        'VALIDACION_FALLIDA',
      );
    });

    it('porPagina=100 es válido; pagina=1.5 y porPagina=abc son 400', async () => {
      const u = await registrarJugador(a);
      await a.http().get('/yo/reservas?porPagina=100').set(auth(u)).expect(200);
      esperarError(
        await a.http().get('/yo/reservas?pagina=1.5').set(auth(u)),
        400,
        'VALIDACION_FALLIDA',
      );
      esperarError(
        await a.http().get('/yo/reservas?porPagina=abc').set(auth(u)),
        400,
        'VALIDACION_FALLIDA',
      );
    });

    it('una reserva de turno que termina exactamente ahora (11:00 con el reloj a las 11:00:00) ya es pasada', async () => {
      const u = await registrarJugador(a);
      const r = await crearReserva(a, {
        espacioId,
        usuarioId: u.usuario.id,
        fecha: '2026-09-19',
        inicio: '10:00',
      });
      a.reloj.fijar('2026-09-19T10:59:59-03:00');
      expect(
        (await a.http().get('/yo/reservas').set(auth(u))).body.datos.map(
          (x: Reserva) => x.id,
        ),
      ).toEqual([r.id]);
      a.reloj.fijar('2026-09-19T11:00:00-03:00');
      expect(
        (await a.http().get('/yo/reservas').set(auth(u))).body.datos,
      ).toEqual([]);
    });
  });

  describe('GET /reservas/:id', () => {
    it('el administrador también la ve', async () => {
      const u = await registrarJugador(a);
      const r = await crearReserva(a, {
        espacioId,
        usuarioId: u.usuario.id,
        fecha: '2026-09-21',
        inicio: '10:00',
      });
      const res = await a
        .http()
        .get(`/reservas/${r.id}`)
        .set(auth(admin))
        .expect(200);
      esperarContrato<Reserva>(res.body, 'Reserva');
    });

    it.each(['res-', 'RES-ABC', 'usr-123', 'x', '%20', 'res-inexistente0'])(
      'id raro «%s» → 404 RESERVA_NO_ENCONTRADA o 400',
      async (id) => {
        const u = await registrarJugador(a);
        const res = await a.http().get(`/reservas/${id}`).set(auth(u));
        expect([400, 404]).toContain(res.status);
        expect(Object.keys(res.body)).toEqual(['error']);
      },
    );

    it('otro jugador recibe 403 y el cuerpo del error no filtra datos de la reserva', async () => {
      const u = await registrarJugador(a);
      const otro = await registrarJugador(a);
      const r = await crearReserva(a, {
        espacioId,
        usuarioId: u.usuario.id,
        fecha: '2026-09-21',
        inicio: '10:00',
      });
      const res = await a.http().get(`/reservas/${r.id}`).set(auth(otro));
      esperarError(res, 403, 'SIN_PERMISO');
      expect(JSON.stringify(res.body)).not.toContain(r.codigoQr);
    });

    it('un jugador que consulta una reserva inexistente recibe 404 (no 403)', async () => {
      const u = await registrarJugador(a);
      esperarError(
        await a.http().get('/reservas/res-noexiste99').set(auth(u)),
        404,
        'RESERVA_NO_ENCONTRADA',
      );
    });
  });

  describe('POST /reservas/:id/cancelacion (R12, D3, M3-1)', () => {
    it('reserva inexistente → 404 RESERVA_NO_ENCONTRADA para jugador y encargado', async () => {
      const u = await registrarJugador(a);
      esperarError(
        await cancelar(u, 'res-noexiste99'),
        404,
        'RESERVA_NO_ENCONTRADA',
      );
      esperarError(
        await cancelar(encargado, 'res-noexiste99'),
        404,
        'RESERVA_NO_ENCONTRADA',
      );
    });

    it('cuerpo con campos de más → 400', async () => {
      const u = await registrarJugador(a);
      const r = await crearReserva(a, {
        espacioId,
        usuarioId: u.usuario.id,
        fecha: '2026-09-23',
        inicio: '10:00',
      });
      esperarError(
        await cancelar(u, r.id, { estado: 'confirmada' }),
        400,
        'VALIDACION_FALLIDA',
      );
      expect(
        (await a.http().get(`/reservas/${r.id}`).set(auth(u))).body.datos
          .estado,
      ).toBe('confirmada');
    });

    it('otro jugador que cancela una reserva ajena ya cancelada → 403, no 200', async () => {
      const u = await registrarJugador(a);
      const otro = await registrarJugador(a);
      const r = await crearReserva(a, {
        espacioId,
        usuarioId: u.usuario.id,
        fecha: '2026-09-23',
        inicio: '10:00',
        estado: 'cancelada',
      });
      esperarError(await cancelar(otro, r.id), 403, 'SIN_PERMISO');
    });

    it.each(['cumplida', 'ausente'] as const)(
      'el dueño cancela una %s → 409 RESERVA_NO_CANCELABLE (M3-1)',
      async (estado) => {
        const u = await registrarJugador(a);
        const r = await crearReserva(a, {
          espacioId,
          usuarioId: u.usuario.id,
          fecha: '2026-09-23',
          inicio: '10:00',
          estado,
        });
        esperarError(await cancelar(u, r.id), 409, 'RESERVA_NO_CANCELABLE');
      },
    );

    it.each(['cumplida', 'ausente'] as const)(
      'el encargado cancela una %s → 409 y no suma tardías',
      async (estado) => {
        const u = await registrarJugador(a);
        const r = await crearReserva(a, {
          espacioId,
          usuarioId: u.usuario.id,
          fecha: '2026-09-23',
          inicio: '10:00',
          estado,
        });
        esperarError(
          await cancelar(encargado, r.id),
          409,
          'RESERVA_NO_CANCELABLE',
        );
        const yo = await a.http().get('/yo').set(auth(u)).expect(200);
        expect((yo.body.datos as Usuario).cancelacionesTardias).toBe(0);
      },
    );

    it('el administrador cancela fuera de plazo y suma tardía; el turno vuelve a estar libre y reservable', async () => {
      const u = await registrarJugador(a);
      const r = await crearReserva(a, {
        espacioId,
        usuarioId: u.usuario.id,
        fecha: '2026-09-19',
        inicio: '12:00',
      });
      const res = await cancelar(admin, r.id).expect(200);
      expect(esperarContrato<Reserva>(res.body, 'Reserva').estado).toBe(
        'cancelada',
      );
      const yo = await a.http().get('/yo').set(auth(u)).expect(200);
      expect((yo.body.datos as Usuario).cancelacionesTardias).toBe(1);
      const otro = await registrarJugador(a);
      await reservar(otro, { turnoId: r.turnoId, cantidadPersonas: 2 }).expect(
        201,
      );
    });

    it('el encargado cancela justo en el límite (ahora = cancelableHasta): no es tardía; un segundo después sí', async () => {
      const u = await registrarJugador(a);
      const r1 = await crearReserva(a, {
        espacioId,
        usuarioId: u.usuario.id,
        fecha: '2026-09-19',
        inicio: '14:00',
      });
      a.reloj.fijar('2026-09-19T10:00:00-03:00');
      await cancelar(encargado, r1.id).expect(200);
      let yo = await a.http().get('/yo').set(auth(u)).expect(200);
      expect((yo.body.datos as Usuario).cancelacionesTardias).toBe(0);
      const r2 = await crearReserva(a, {
        espacioId,
        usuarioId: u.usuario.id,
        fecha: '2026-09-19',
        inicio: '15:00',
      });
      a.reloj.fijar('2026-09-19T11:00:01-03:00');
      await cancelar(encargado, r2.id).expect(200);
      yo = await a.http().get('/yo').set(auth(u)).expect(200);
      expect((yo.body.datos as Usuario).cancelacionesTardias).toBe(1);
    });

    it('el dueño cancelando dos veces seguidas: ambas 200 e idénticas', async () => {
      const u = await registrarJugador(a);
      const r = await crearReserva(a, {
        espacioId,
        usuarioId: u.usuario.id,
        fecha: '2026-09-23',
        inicio: '10:00',
      });
      const c1 = await cancelar(u, r.id).expect(200);
      const c2 = await cancelar(u, r.id).expect(200);
      expect(c2.body).toEqual(c1.body);
    });

    it('cancelar sin que cambie el reloj no toca el orden: la cancelada pasa a pasadas y libera el cupo de tres', async () => {
      const u = await registrarJugador(a);
      const ids: string[] = [];
      for (const hh of ['08', '09', '10']) {
        const r = await reservar(u, {
          turnoId: tur(espacioId, '2026-09-23', hh),
          cantidadPersonas: 1,
        }).expect(201);
        ids.push(r.body.datos.id);
      }
      await cancelar(u, ids[1]).expect(200);
      const prox = await a.http().get('/yo/reservas').set(auth(u)).expect(200);
      expect(prox.body.datos.map((r: Reserva) => r.id)).toEqual([
        ids[0],
        ids[2],
      ]);
      const pas = await a
        .http()
        .get('/yo/reservas?cuando=pasadas')
        .set(auth(u))
        .expect(200);
      expect(pas.body.datos.map((r: Reserva) => r.id)).toEqual([ids[1]]);
    });

    it('el método incorrecto (GET/DELETE a /cancelacion) no cancela y da error con sobre', async () => {
      const u = await registrarJugador(a);
      const r = await crearReserva(a, {
        espacioId,
        usuarioId: u.usuario.id,
        fecha: '2026-09-23',
        inicio: '10:00',
      });
      const res = await a.http().delete(`/reservas/${r.id}`).set(auth(u));
      expect([404, 405]).toContain(res.status);
      expect(Object.keys(res.body)).toEqual(['error']);
      expect(
        (await a.http().get(`/reservas/${r.id}`).set(auth(u))).body.datos
          .estado,
      ).toBe('confirmada');
    });
  });

  describe('M3-6 — sin avisos en M3', () => {
    it('reservar y cancelar no mandan push a nadie', async () => {
      const u = await registrarJugador(a);
      const fan = await registrarJugador(a);
      await a.http().put(`/yo/espacios-favoritos/${espacioId}`).set(auth(fan));
      a.enviador.vaciar();
      const r = await reservar(u, {
        turnoId: tur(espacioId, '2026-09-23', '10'),
        cantidadPersonas: 1,
      }).expect(201);
      await cancelar(u, r.body.datos.id).expect(200);
      await new Promise((ok) => setTimeout(ok, 50));
      expect(a.enviador.enviados).toHaveLength(0);
    });
  });
});
