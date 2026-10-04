// M3 — Reservas (ESPECIFICACION §4 y reglas R7 a R13).
// El reloj de prueba arranca el sábado 19/09/2026 a las 10:00 en Villaguay.
import type { Reserva, Turno, Usuario } from '../../contrato/tipos.js';
import { ReservaEntidad } from '../../src/modulos/turnos/reserva.entidad.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { crearDeporte, crearEspacio } from '../utilidades/espacios.js';
import { crearBloqueo, crearFija, crearReserva } from '../utilidades/turnos.js';
import {
  crearUsuario,
  registrarJugador,
  type UsuarioDePrueba,
} from '../utilidades/usuarios.js';

const HOY = '2026-09-19';
const MANANA = '2026-09-20';
const turno = (espacioId: string, fecha: string, hh: string): string =>
  `tur-${espacioId}-${fecha.replaceAll('-', '')}-${hh}`;

describe('M3 — Reservas', () => {
  let a: AppDePrueba;
  let espacioId: string;
  let otroEspacioId: string;
  let encargado: UsuarioDePrueba;

  let deporteId: string;

  beforeAll(async () => {
    a = await crearApp();
    deporteId = (await crearDeporte(a)).id;
    encargado = await crearUsuario(a, 'encargado');
  });
  // Cada test tiene sus propios espacios: no se pisan turnos entre tests.
  beforeEach(async () => {
    espacioId = (await crearEspacio(a, { deporteId, capacidad: 10 })).id;
    otroEspacioId = (await crearEspacio(a, { deporteId, capacidad: 10 })).id;
  });
  afterAll(() => a.cerrar());
  afterEach(() => a.reloj.fijar(`${HOY}T10:00:00-03:00`));

  const reservar = (
    u: UsuarioDePrueba | null,
    cuerpo: unknown,
  ): ReturnType<ReturnType<AppDePrueba['http']>['post']> => {
    const req = a.http().post('/reservas');
    return (u ? req.set('Authorization', `Bearer ${u.token}`) : req).send(
      cuerpo as object,
    );
  };
  const jugador = (): Promise<UsuarioDePrueba> => registrarJugador(a);
  const conToken = (u: UsuarioDePrueba) => ({ Authorization: `Bearer ${u.token}` });

  describe('POST /reservas — PRD §2 y §3', () => {
    it('201 con la Reserva del contrato y el turno pasa a reservado', async () => {
      const u = await jugador();
      const res = await reservar(u, {
        turnoId: turno(espacioId, MANANA, '19'),
        cantidadPersonas: 8,
      }).expect(201);
      const r = esperarContrato<Reserva>(res.body, 'Reserva');
      expect(r).toMatchObject({
        turnoId: turno(espacioId, MANANA, '19'),
        espacioId,
        usuarioId: u.usuario.id,
        cantidadPersonas: 8,
        estado: 'confirmada',
        ingresoEn: null,
        creadaEn: '2026-09-19T10:00:00-03:00',
        cancelableHasta: '2026-09-20T15:00:00-03:00',
      });
      expect(r.id).toMatch(/^res-[a-z0-9]{12}$/);
      expect(r.codigoQr).toMatch(/^VGY-0920-19-[A-Z0-9]{6}$/);

      const grilla = await a
        .http()
        .get(`/espacios/${espacioId}/turnos?fecha=${MANANA}`)
        .expect(200);
      expect(
        (grilla.body.datos as Turno[]).find((t) => t.inicio === '19:00'),
      ).toMatchObject({ estado: 'reservado', reservaId: r.id });
    });

    it('el último turno del día (23 a 24) también se reserva', async () => {
      const u = await jugador();
      const res = await reservar(u, {
        turnoId: turno(espacioId, '2026-09-21', '23'),
        cantidadPersonas: 2,
      }).expect(201);
      expect(esperarContrato<Reserva>(res.body, 'Reserva').cancelableHasta).toBe(
        '2026-09-21T19:00:00-03:00',
      );
    });

    it('el turno de hoy que todavía no empezó se puede reservar', async () => {
      const u = await jugador();
      await reservar(u, {
        turnoId: turno(espacioId, HOY, '11'),
        cantidadPersonas: 2,
      }).expect(201);
    });

    it('sin token: 401', async () => {
      esperarError(
        await reservar(null, { turnoId: turno(espacioId, MANANA, '10'), cantidadPersonas: 2 }),
        401,
        'NO_AUTENTICADO',
      );
    });

    it('un encargado no reserva: 403 (R16, D6)', async () => {
      esperarError(
        await reservar(encargado, { turnoId: turno(espacioId, MANANA, '10'), cantidadPersonas: 2 }),
        403,
        'SIN_PERMISO',
      );
    });

    it.each([
      ['sin turnoId', { cantidadPersonas: 2 }],
      ['turnoId que no es texto', { turnoId: 12, cantidadPersonas: 2 }],
      ['sin cantidadPersonas', { turnoId: 'tur-esp-01-20260920-10' }],
      ['cantidad cero', { turnoId: 'tur-esp-01-20260920-10', cantidadPersonas: 0 }],
      ['cantidad negativa', { turnoId: 'tur-esp-01-20260920-10', cantidadPersonas: -3 }],
      ['cantidad decimal', { turnoId: 'tur-esp-01-20260920-10', cantidadPersonas: 2.5 }],
      ['cantidad como texto', { turnoId: 'tur-esp-01-20260920-10', cantidadPersonas: '4' }],
      ['campo de más', { turnoId: 'tur-esp-01-20260920-10', cantidadPersonas: 2, estado: 'cumplida' }],
    ])('400 VALIDACION_FALLIDA: %s', async (_d, cuerpo) => {
      const u = await jugador();
      esperarError(await reservar(u, cuerpo), 400, 'VALIDACION_FALLIDA');
    });

    it.each([
      ['no tiene la forma de un turno', 'cualquier-cosa'],
      ['es de un espacio que no existe', 'tur-esp-nope-20260920-10'],
      ['es de una hora fuera de la grilla (07)', 'tur-X-20260920-07'],
      ['es de una hora fuera de la grilla (24)', 'tur-X-20260920-24'],
      ['es de un día que no existe', 'tur-X-20260230-10'],
    ])('404 TURNO_NO_ENCONTRADO: el id %s', async (_d, id) => {
      const u = await jugador();
      esperarError(
        await reservar(u, { turnoId: id.replace('X', espacioId), cantidadPersonas: 2 }),
        404,
        'TURNO_NO_ENCONTRADO',
      );
    });

    it('404 TURNO_NO_ENCONTRADO si el espacio está dado de baja', async () => {
      const d = await crearDeporte(a);
      const inactivo = await crearEspacio(a, { deporteId: d.id, activo: false });
      const u = await jugador();
      esperarError(
        await reservar(u, { turnoId: turno(inactivo.id, MANANA, '10'), cantidadPersonas: 2 }),
        404,
        'TURNO_NO_ENCONTRADO',
      );
    });

    it.each([
      ['ayer', '2026-09-18'],
      ['dentro de siete días', '2026-09-26'],
    ])('422 FECHA_FUERA_DE_RANGO: %s (R6, R7)', async (_d, fecha) => {
      const u = await jugador();
      esperarError(
        await reservar(u, { turnoId: turno(espacioId, fecha, '10'), cantidadPersonas: 2 }),
        422,
        'FECHA_FUERA_DE_RANGO',
      );
    });

    it('hoy + 6 es el último día que se puede reservar', async () => {
      const u = await jugador();
      await reservar(u, { turnoId: turno(espacioId, '2026-09-25', '10'), cantidadPersonas: 2 }).expect(201);
    });

    it.each([
      ['08:00', '08'],
      ['10:00, que empieza justo ahora (reloj a las 10:00:00)', '10'],
    ])('422 TURNO_PASADO: el de las %s de hoy (R7)', async (_d, hh) => {
      const u = await jugador();
      esperarError(
        await reservar(u, { turnoId: turno(espacioId, HOY, hh), cantidadPersonas: 2 }),
        422,
        'TURNO_PASADO',
      );
    });

    it('un turno que empieza un minuto después del reloj sí se reserva', async () => {
      const u = await jugador();
      a.reloj.fijar(`${HOY}T10:59:00-03:00`);
      await reservar(u, { turnoId: turno(espacioId, HOY, '11'), cantidadPersonas: 2 }).expect(201);
    });

    it('409 TURNO_NO_DISPONIBLE si hay un bloqueo (R2, R7)', async () => {
      const u = await jugador();
      await crearBloqueo(a, { espacioId, fecha: '2026-09-22', inicio: '10:00', fin: '12:00' });
      esperarError(
        await reservar(u, { turnoId: turno(espacioId, '2026-09-22', '11'), cantidadPersonas: 2 }),
        409,
        'TURNO_NO_DISPONIBLE',
      );
      await reservar(u, { turnoId: turno(espacioId, '2026-09-22', '12'), cantidadPersonas: 2 }).expect(201);
    });

    it('409 TURNO_NO_DISPONIBLE si hay una reserva fija (R3, R7)', async () => {
      const u = await jugador();
      // 2026-09-22 es martes
      await crearFija(a, { espacioId: otroEspacioId, dia: 2, inicio: '21:00', fin: '23:00' });
      for (const hh of ['21', '22'])
        esperarError(
          await reservar(u, { turnoId: turno(otroEspacioId, '2026-09-22', hh), cantidadPersonas: 2 }),
          409,
          'TURNO_NO_DISPONIBLE',
        );
    });

    it('un bloqueo gana sobre una reserva hecha: sigue siendo NO_DISPONIBLE y no OCUPADO (R2)', async () => {
      const dueno = await jugador();
      const otro = await jugador();
      await crearReserva(a, { espacioId, usuarioId: dueno.usuario.id, fecha: '2026-09-23', inicio: '09:00' });
      await crearBloqueo(a, { espacioId, fecha: '2026-09-23' });
      esperarError(
        await reservar(otro, { turnoId: turno(espacioId, '2026-09-23', '09'), cantidadPersonas: 2 }),
        409,
        'TURNO_NO_DISPONIBLE',
      );
    });

    it('409 TURNO_OCUPADO si otro lo tiene confirmado, cumplido o ausente (R7)', async () => {
      const dueno = await jugador();
      const otro = await jugador();
      for (const [i, estado] of (['confirmada', 'cumplida', 'ausente'] as const).entries()) {
        const hh = String(9 + i).padStart(2, '0');
        await crearReserva(a, { espacioId: otroEspacioId, usuarioId: dueno.usuario.id, fecha: '2026-09-24', inicio: `${hh}:00`, estado });
        esperarError(
          await reservar(otro, { turnoId: turno(otroEspacioId, '2026-09-24', hh), cantidadPersonas: 2 }),
          409,
          'TURNO_OCUPADO',
        );
      }
    });

    it('un turno con reserva cancelada vuelve a estar libre y se puede reservar (R8)', async () => {
      const dueno = await jugador();
      const otro = await jugador();
      await crearReserva(a, { espacioId, usuarioId: dueno.usuario.id, fecha: '2026-09-24', inicio: '14:00', estado: 'cancelada' });
      await reservar(otro, { turnoId: turno(espacioId, '2026-09-24', '14'), cantidadPersonas: 2 }).expect(201);
    });

    it('422 CAPACIDAD_EXCEDIDA: más personas que la capacidad; justo la capacidad entra (R7)', async () => {
      const u = await jugador();
      esperarError(
        await reservar(u, { turnoId: turno(espacioId, '2026-09-25', '15'), cantidadPersonas: 11 }),
        422,
        'CAPACIDAD_EXCEDIDA',
      );
      await reservar(u, { turnoId: turno(espacioId, '2026-09-25', '15'), cantidadPersonas: 10 }).expect(201);
    });

    it('el turno ocupado se informa antes que la capacidad (orden de R7)', async () => {
      const dueno = await jugador();
      const otro = await jugador();
      await crearReserva(a, { espacioId, usuarioId: dueno.usuario.id, fecha: '2026-09-25', inicio: '16:00' });
      esperarError(
        await reservar(otro, { turnoId: turno(espacioId, '2026-09-25', '16'), cantidadPersonas: 99 }),
        409,
        'TURNO_OCUPADO',
      );
    });

    describe('PRD §3 — un máximo de tres reservas activas por persona (R9)', () => {
      const cuerpo = (fecha: string, hh: string) => ({
        turnoId: turno(espacioId, fecha, hh),
        cantidadPersonas: 2,
      });

      it('la cuarta falla con LIMITE_DE_RESERVAS', async () => {
        const u = await jugador();
        for (const hh of ['08', '09', '10'])
          await reservar(u, cuerpo('2026-09-25', hh)).expect(201);
        esperarError(await reservar(u, cuerpo('2026-09-25', '11')), 422, 'LIMITE_DE_RESERVAS');
      });

      it('las canceladas, las cumplidas, las ausentes y las que ya terminaron no cuentan', async () => {
        const u = await jugador();
        await crearReserva(a, { espacioId, usuarioId: u.usuario.id, fecha: '2026-09-25', inicio: '12:00', estado: 'cancelada' });
        await crearReserva(a, { espacioId, usuarioId: u.usuario.id, fecha: '2026-09-25', inicio: '13:00', estado: 'cumplida' });
        await crearReserva(a, { espacioId, usuarioId: u.usuario.id, fecha: '2026-09-25', inicio: '14:00', estado: 'ausente' });
        await crearReserva(a, { espacioId, usuarioId: u.usuario.id, fecha: HOY, inicio: '08:00' }); // ya terminó
        for (const hh of ['15', '16', '17'])
          await reservar(u, cuerpo('2026-09-25', hh)).expect(201);
      });

      it('una reserva en curso todavía cuenta; al terminar el turno deja de contar', async () => {
        const u = await jugador();
        await crearReserva(a, { espacioId, usuarioId: u.usuario.id, fecha: HOY, inicio: '10:00' });
        await reservar(u, cuerpo('2026-09-24', '08')).expect(201);
        await reservar(u, cuerpo('2026-09-24', '09')).expect(201);
        a.reloj.fijar(`${HOY}T10:30:00-03:00`);
        esperarError(await reservar(u, cuerpo('2026-09-24', '10')), 422, 'LIMITE_DE_RESERVAS');
        a.reloj.fijar(`${HOY}T11:00:00-03:00`);
        await reservar(u, cuerpo('2026-09-24', '10')).expect(201);
      });

      it('cancelar una libera el cupo', async () => {
        const u = await jugador();
        const ids: string[] = [];
        for (const hh of ['08', '09', '10']) {
          const r = await reservar(u, cuerpo('2026-09-23', hh)).expect(201);
          ids.push(r.body.datos.id as string);
        }
        await a.http().post(`/reservas/${ids[0]}/cancelacion`).set(conToken(u)).expect(200);
        await reservar(u, cuerpo('2026-09-23', '11')).expect(201);
      });

      it('el límite es por persona', async () => {
        const u = await jugador();
        const otro = await jugador();
        for (const hh of ['18', '19', '20'])
          await reservar(u, cuerpo('2026-09-25', hh)).expect(201);
        await reservar(otro, cuerpo('2026-09-25', '21')).expect(201);
      });
    });

    describe('R11 — reintentos por mala señal', () => {
      it('el mismo jugador pidiendo el mismo turno: 200 con la misma reserva, un solo registro', async () => {
        const u = await jugador();
        const cuerpo = { turnoId: turno(espacioId, '2026-09-25', '20'), cantidadPersonas: 4 };
        const primera = await reservar(u, cuerpo).expect(201);
        const segunda = await reservar(u, cuerpo).expect(200);
        expect(segunda.body).toEqual(primera.body);
        esperarContrato<Reserva>(segunda.body, 'Reserva');
        const filas = await a.dataSource.getRepository(ReservaEntidad).countBy({
          espacioId,
          fecha: '2026-09-25',
          inicio: '20:00',
        });
        expect(filas).toBe(1);
      });

      it('no repite la validación de capacidad ni de límite: devuelve la existente', async () => {
        const u = await jugador();
        const turnoId = turno(espacioId, '2026-09-25', '21');
        const primera = await reservar(u, { turnoId, cantidadPersonas: 4 }).expect(201);
        for (const hh of ['22', '23'])
          await reservar(u, { turnoId: turno(espacioId, '2026-09-25', hh), cantidadPersonas: 2 }).expect(201);
        const otra = await reservar(u, { turnoId, cantidadPersonas: 9 }).expect(200);
        expect(otra.body.datos.id).toBe(primera.body.datos.id);
        expect(otra.body.datos.cantidadPersonas).toBe(4);
      });
    });

    describe('R8 — nunca dos reservas en el mismo turno, ni con pedidos simultáneos', () => {
      it('dos jugadores al mismo turno a la vez: uno 201 y el otro 409 TURNO_OCUPADO', async () => {
        const u1 = await jugador();
        const u2 = await jugador();
        const cuerpo = { turnoId: turno(espacioId, '2026-09-25', '22'), cantidadPersonas: 2 };
        const [r1, r2] = await Promise.all([reservar(u1, cuerpo), reservar(u2, cuerpo)]);
        expect([r1.status, r2.status].toSorted()).toEqual([201, 409]);
        const perdedora = r1.status === 409 ? r1 : r2;
        esperarError(perdedora, 409, 'TURNO_OCUPADO');
        expect(
          await a.dataSource.getRepository(ReservaEntidad).countBy({
            espacioId,
            fecha: '2026-09-25',
            inicio: '22:00',
          }),
        ).toBe(1);
      });

      it('varios jugadores a la vez: gana uno solo', async () => {
        const us = await Promise.all([jugador(), jugador(), jugador(), jugador()]);
        const cuerpo = { turnoId: turno(espacioId, '2026-09-25', '23'), cantidadPersonas: 2 };
        const rs = await Promise.all(us.map((u) => reservar(u, cuerpo)));
        expect(rs.filter((r) => r.status === 201)).toHaveLength(1);
        expect(rs.filter((r) => r.status === 409)).toHaveLength(3);
      });

      it('el mismo jugador mandando dos veces a la vez: un registro y las dos respuestas son la misma reserva', async () => {
        const u = await jugador();
        const cuerpo = { turnoId: turno(espacioId, '2026-09-24', '22'), cantidadPersonas: 2 };
        const [r1, r2] = await Promise.all([reservar(u, cuerpo), reservar(u, cuerpo)]);
        expect([r1.status, r2.status].toSorted()).toEqual([200, 201]);
        expect(r1.body.datos.id).toBe(r2.body.datos.id);
      });
    });
  });

  describe('GET /yo/reservas — PRD §3 (R13)', () => {
    const pedir = (u: UsuarioDePrueba | null, q = '') => {
      const req = a.http().get(`/yo/reservas${q}`);
      return u ? req.set(conToken(u)) : req;
    };

    it('sin token: 401', async () => {
      esperarError(await pedir(null), 401, 'NO_AUTENTICADO');
    });

    it('sin reservas: lista vacía en ambos momentos', async () => {
      const u = await jugador();
      for (const q of ['', '?cuando=pasadas']) {
        const res = await pedir(u, q).expect(200);
        expect(res.body).toEqual({ datos: [], meta: { total: 0, pagina: 1, porPagina: 20 } });
      }
    });

    it('próximas (default): confirmadas cuyo turno no terminó, por inicio ascendente; pasadas: las demás, descendente', async () => {
      const u = await jugador();
      const otro = await jugador();
      const mk = (fecha: string, inicio: string, estado: ReservaEntidad['estado'] = 'confirmada', usuarioId = u.usuario.id) =>
        crearReserva(a, { espacioId, usuarioId, fecha, inicio, estado });
      const futura2 = await mk('2026-09-22', '10:00');
      const futura1 = await mk('2026-09-20', '20:00');
      const futura1b = await mk('2026-09-20', '09:00');
      const enCurso = await mk(HOY, '10:00');
      const terminada = await mk(HOY, '08:00');
      const cancelada = await mk('2026-09-21', '10:00', 'cancelada');
      const cumplida = await mk('2026-09-18', '10:00', 'cumplida');
      const ausente = await mk('2026-09-17', '10:00', 'ausente');
      await mk('2026-09-20', '12:00', 'confirmada', otro.usuario.id);

      const prox = await pedir(u).expect(200);
      const proximas = esperarContrato<Reserva[]>(prox.body, 'Reserva');
      expect(proximas.map((r) => r.id)).toEqual([enCurso.id, futura1b.id, futura1.id, futura2.id]);
      expect(prox.body.meta).toEqual({ total: 4, pagina: 1, porPagina: 20 });
      expect(proximas.every((r) => r.usuarioId === u.usuario.id)).toBe(true);

      const pas = await pedir(u, '?cuando=pasadas').expect(200);
      expect(esperarContrato<Reserva[]>(pas.body, 'Reserva').map((r) => r.id)).toEqual([
        cancelada.id,
        terminada.id,
        cumplida.id,
        ausente.id,
      ]);
      expect(pas.body.meta.total).toBe(4);
    });

    it('el corte pasa a la medianoche en hora argentina, no en UTC', async () => {
      const u = await jugador();
      const r = await crearReserva(a, { espacioId, usuarioId: u.usuario.id, fecha: HOY, inicio: '23:00' });
      a.reloj.fijar(`${HOY}T23:59:00-03:00`); // 02:59 UTC del día siguiente
      expect((await pedir(u).expect(200)).body.datos.map((x: Reserva) => x.id)).toEqual([r.id]);
      a.reloj.fijar('2026-09-20T00:00:00-03:00');
      expect((await pedir(u).expect(200)).body.datos).toEqual([]);
      expect((await pedir(u, '?cuando=pasadas').expect(200)).body.datos.map((x: Reserva) => x.id)).toEqual([r.id]);
    });

    it('pagina con meta correcto y una página fuera de rango devuelve [] con el total', async () => {
      const u = await jugador();
      for (const hh of ['08', '09', '10'])
        await crearReserva(a, { espacioId, usuarioId: u.usuario.id, fecha: '2026-09-24', inicio: `${hh}:00` });
      const p1 = await pedir(u, '?porPagina=2').expect(200);
      expect(p1.body.datos).toHaveLength(2);
      expect(p1.body.meta).toEqual({ total: 3, pagina: 1, porPagina: 2 });
      const p2 = await pedir(u, '?porPagina=2&pagina=2').expect(200);
      expect(p2.body.datos).toHaveLength(1);
      const p9 = await pedir(u, '?porPagina=2&pagina=9').expect(200);
      expect(p9.body).toEqual({ datos: [], meta: { total: 3, pagina: 9, porPagina: 2 } });
    });

    it.each(['?cuando=futuras', '?cuando=', '?pagina=0', '?porPagina=101'])(
      '400 VALIDACION_FALLIDA con %s',
      async (q) => {
        const u = await jugador();
        esperarError(await pedir(u, q), 400, 'VALIDACION_FALLIDA');
      },
    );
  });

  describe('GET /reservas/:id', () => {
    const ver = (u: UsuarioDePrueba | null, id: string) => {
      const req = a.http().get(`/reservas/${id}`);
      return u ? req.set(conToken(u)) : req;
    };

    it('el dueño la ve (200, contrato)', async () => {
      const u = await jugador();
      const r = await crearReserva(a, { espacioId, usuarioId: u.usuario.id, fecha: '2026-09-22', inicio: '08:00' });
      const res = await ver(u, r.id).expect(200);
      expect(esperarContrato<Reserva>(res.body, 'Reserva').id).toBe(r.id);
    });

    it('un encargado la ve aunque no sea suya', async () => {
      const u = await jugador();
      const r = await crearReserva(a, { espacioId, usuarioId: u.usuario.id, fecha: '2026-09-22', inicio: '09:00' });
      await ver(encargado, r.id).expect(200);
    });

    it('otro jugador: 403 SIN_PERMISO', async () => {
      const u = await jugador();
      const otro = await jugador();
      const r = await crearReserva(a, { espacioId, usuarioId: u.usuario.id, fecha: '2026-09-22', inicio: '10:00' });
      esperarError(await ver(otro, r.id), 403, 'SIN_PERMISO');
    });

    it('sin token: 401', async () => {
      esperarError(await ver(null, 'res-1'), 401, 'NO_AUTENTICADO');
    });

    it.each(['res-noexiste', 'cualquier-cosa', 'usr-123'])('404 RESERVA_NO_ENCONTRADA con %s', async (id) => {
      const u = await jugador();
      esperarError(await ver(u, id), 404, 'RESERVA_NO_ENCONTRADA');
    });
  });

  describe('POST /reservas/:id/cancelacion — PRD §3 (R12)', () => {
    const cancelar = (u: UsuarioDePrueba | null, id: string) => {
      const req = a.http().post(`/reservas/${id}/cancelacion`);
      return u ? req.set(conToken(u)) : req;
    };
    const tardias = async (u: UsuarioDePrueba): Promise<number> => {
      const res = await a.http().get('/yo').set(conToken(u)).expect(200);
      return (res.body.datos as Usuario).cancelacionesTardias;
    };
    const nueva = async (u: UsuarioDePrueba, fecha = MANANA, hh = '19') =>
      crearReserva(a, { espacioId, usuarioId: u.usuario.id, fecha, inicio: `${hh}:00` });

    it('el dueño cancela con tiempo: 200 cancelada, el turno queda libre y no es tardía', async () => {
      const u = await jugador();
      const r = await nueva(u, '2026-09-23', '19');
      const res = await cancelar(u, r.id).expect(200);
      expect(esperarContrato<Reserva>(res.body, 'Reserva')).toMatchObject({ id: r.id, estado: 'cancelada' });
      expect(await tardias(u)).toBe(0);
      const grilla = await a.http().get(`/espacios/${espacioId}/turnos?fecha=2026-09-23`);
      expect((grilla.body.datos as Turno[]).find((t) => t.inicio === '19:00')).toMatchObject({
        estado: 'libre',
        reservaId: null,
      });
    });

    it('después de cancelar, otro jugador puede reservar ese turno', async () => {
      const u = await jugador();
      const otro = await jugador();
      const r = await nueva(u, '2026-09-23', '20');
      await cancelar(u, r.id).expect(200);
      await reservar(otro, { turnoId: turno(espacioId, '2026-09-23', '20'), cantidadPersonas: 2 }).expect(201);
    });

    it('justo en cancelableHasta todavía se puede; un segundo después, no', async () => {
      const u = await jugador();
      const r = await nueva(u, MANANA, '19'); // cancelableHasta 15:00 del 20
      a.reloj.fijar('2026-09-20T15:00:00-03:00');
      const ok = await cancelar(u, r.id).expect(200);
      expect(ok.body.datos.estado).toBe('cancelada');

      const r2 = await nueva(u, MANANA, '20'); // cancelableHasta 16:00
      a.reloj.fijar('2026-09-20T16:00:01-03:00');
      esperarError(await cancelar(u, r2.id), 422, 'CANCELACION_FUERA_DE_PLAZO');
      expect(await tardias(u)).toBe(0);
    });

    it('422 CANCELACION_FUERA_DE_PLAZO también con el turno ya empezado; la reserva sigue confirmada', async () => {
      const u = await jugador();
      const r = await nueva(u, HOY, '10');
      a.reloj.fijar(`${HOY}T10:20:00-03:00`);
      esperarError(await cancelar(u, r.id), 422, 'CANCELACION_FUERA_DE_PLAZO');
      const ver = await a.http().get(`/reservas/${r.id}`).set(conToken(u)).expect(200);
      expect(ver.body.datos.estado).toBe('confirmada');
    });

    it('un encargado cancela fuera de plazo: 200 y suma una cancelación tardía al dueño (D3)', async () => {
      const u = await jugador();
      const r = await nueva(u, HOY, '14'); // cancelableHasta 10:00 de hoy
      a.reloj.fijar(`${HOY}T12:00:00-03:00`);
      const res = await cancelar(encargado, r.id).expect(200);
      expect(res.body.datos.estado).toBe('cancelada');
      expect(await tardias(u)).toBe(1);
    });

    it('un encargado cancela con tiempo: no suma tardía', async () => {
      const u = await jugador();
      const r = await nueva(u, '2026-09-24', '19');
      await cancelar(encargado, r.id).expect(200);
      expect(await tardias(u)).toBe(0);
    });

    it('cancelar una ya cancelada: 200 sin cambios y sin sumar tardías, aunque sea fuera de plazo', async () => {
      const u = await jugador();
      const r = await nueva(u, HOY, '15');
      a.reloj.fijar(`${HOY}T12:00:00-03:00`);
      await cancelar(encargado, r.id).expect(200);
      expect(await tardias(u)).toBe(1);
      const de_nuevo = await cancelar(encargado, r.id).expect(200);
      expect(de_nuevo.body.datos.estado).toBe('cancelada');
      const dueno = await cancelar(u, r.id).expect(200);
      expect(dueno.body.datos.estado).toBe('cancelada');
      expect(await tardias(u)).toBe(1);
    });

    it('un encargado no cancela una reserva cuyo turno ya empezó: 409 RESERVA_NO_CANCELABLE', async () => {
      const u = await jugador();
      const r = await nueva(u, HOY, '16');
      a.reloj.fijar(`${HOY}T16:30:00-03:00`);
      esperarError(await cancelar(encargado, r.id), 409, 'RESERVA_NO_CANCELABLE');
      expect(await tardias(u)).toBe(0);
    });

    it.each(['cumplida', 'ausente'] as const)('una %s no se cancela: 409 RESERVA_NO_CANCELABLE', async (estado) => {
      const u = await jugador();
      const r = await crearReserva(a, { espacioId, usuarioId: u.usuario.id, fecha: '2026-09-25', inicio: '09:00', estado });
      esperarError(await cancelar(u, r.id), 409, 'RESERVA_NO_CANCELABLE');
      esperarError(await cancelar(encargado, r.id), 409, 'RESERVA_NO_CANCELABLE');
    });

    it('otro jugador: 403 SIN_PERMISO y la reserva sigue confirmada', async () => {
      const u = await jugador();
      const otro = await jugador();
      const r = await nueva(u, '2026-09-25', '10');
      esperarError(await cancelar(otro, r.id), 403, 'SIN_PERMISO');
      expect((await a.http().get(`/reservas/${r.id}`).set(conToken(u))).body.datos.estado).toBe('confirmada');
    });

    it('sin token: 401', async () => {
      esperarError(await cancelar(null, 'res-1'), 401, 'NO_AUTENTICADO');
    });

    it.each(['res-noexiste', 'cualquier-cosa'])('404 RESERVA_NO_ENCONTRADA con %s', async (id) => {
      const u = await jugador();
      esperarError(await cancelar(u, id), 404, 'RESERVA_NO_ENCONTRADA');
    });

    it('dos cancelaciones tardías simultáneas del encargado suman una sola vez', async () => {
      const u = await jugador();
      const r = await nueva(u, HOY, '17'); // cancelableHasta 13:00
      a.reloj.fijar(`${HOY}T14:00:00-03:00`);
      const [x, y] = await Promise.all([cancelar(encargado, r.id), cancelar(encargado, r.id)]);
      expect([x.status, y.status]).toEqual([200, 200]);
      expect(await tardias(u)).toBe(1);
    });
  });
});
