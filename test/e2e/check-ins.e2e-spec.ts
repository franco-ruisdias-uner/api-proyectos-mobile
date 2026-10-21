// M4 — Ingreso y agenda (ESPECIFICACION §4 y reglas R14 a R16).
// El reloj de prueba arranca el sábado 19/09/2026 a las 10:00 en Villaguay.
import type { Reserva, Turno, Usuario } from '../../contract/types.js';
import { ReservaEntidad } from '../../src/modules/slots/reserva.entity.js';
import { UsuarioEntidad } from '../../src/modules/users/user.entity.js';
import { type AppDePrueba, crearApp } from '../utilities/create-app.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import { crearDeporte, crearEspacio } from '../utilities/venues.js';
import { crearBloqueo, crearFija, crearReserva } from '../utilities/slots.js';
import {
  crearUsuario,
  registrarJugador,
  type UsuarioDePrueba,
} from '../utilities/users.js';

const HOY = '2026-09-19';
const con = (u: UsuarioDePrueba): { Authorization: string } => ({
  Authorization: `Bearer ${u.token}`,
});

describe('M4 — Ingreso y ausentes', () => {
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
  beforeEach(async () => {
    espacioId = (await crearEspacio(a, { deporteId })).id;
    jugador = await registrarJugador(a);
  });
  afterAll(() => a.cerrar());
  afterEach(() => a.reloj.fijar(`${HOY}T10:00:00-03:00`));

  const ingresar = (u: UsuarioDePrueba | null, cuerpo: unknown) => {
    const req = a.http().post('/ingresos');
    return (u ? req.set(con(u)) : req).send(cuerpo as object);
  };
  const ausente = (u: UsuarioDePrueba | null, id: string, cuerpo = {}) => {
    const req = a.http().post(`/reservas/${id}/ausente`);
    return (u ? req.set(con(u)) : req).send(cuerpo);
  };
  const reservaDe = (inicio = '19:00', datos: Partial<ReservaEntidad> = {}) =>
    crearReserva(a, {
      espacioId,
      usuarioId: jugador.usuario.id,
      fecha: HOY,
      inicio,
      ...datos,
    });
  const ahoraSon = (hhmm: string): void =>
    a.reloj.fijar(`${HOY}T${hhmm}:00-03:00`);

  describe('POST /ingresos — PRD §4, R14', () => {
    it('200 con la Reserva cumplida e ingresoEn = ahora', async () => {
      const r = await reservaDe('19:00');
      ahoraSon('18:45');
      const res = await ingresar(encargado, {
        codigoQr: r.codigoQr,
        espacioId,
      }).expect(200);
      const dato = esperarContrato<Reserva>(res.body, 'Reserva');
      expect(dato).toMatchObject({
        id: r.id,
        estado: 'cumplida',
        ingresoEn: '2026-09-19T18:45:00-03:00',
      });
    });

    it('el administrador también puede', async () => {
      const r = await reservaDe('19:00');
      ahoraSon('19:00');
      await ingresar(admin, { codigoQr: r.codigoQr, espacioId }).expect(200);
    });

    it('acepta el código con espacios y en minúsculas', async () => {
      const r = await reservaDe('19:00');
      ahoraSon('19:10');
      const res = await ingresar(encargado, {
        codigoQr: ` ${r.codigoQr.toLowerCase()} `,
        espacioId,
      }).expect(200);
      esperarContrato<Reserva>(res.body, 'Reserva');
    });

    it('el turno sigue reservado en la grilla después de ingresar', async () => {
      const r = await reservaDe('19:00');
      ahoraSon('19:00');
      await ingresar(encargado, { codigoQr: r.codigoQr, espacioId }).expect(
        200,
      );
      const grilla = await a
        .http()
        .get(`/espacios/${espacioId}/turnos?fecha=${HOY}`)
        .expect(200);
      const t = esperarContrato<Turno[]>(grilla.body, 'Turno').find(
        (x) => x.inicio === '19:00',
      );
      expect(t).toMatchObject({ estado: 'reservado', reservaId: r.id });
    });

    it.each([
      [{}],
      [{ codigoQr: 'VGY-0919-19-AAAAAA' }],
      [{ espacioId: 'esp-01' }],
      [{ codigoQr: '', espacioId: 'esp-01' }],
      [{ codigoQr: 5, espacioId: 'esp-01' }],
      [{ codigoQr: 'VGY-0919-19-AAAAAA', espacioId: 'esp-01', extra: 1 }],
    ])('400 por cuerpo mal formado %j', async (cuerpo) => {
      esperarError(
        await ingresar(encargado, cuerpo),
        400,
        'VALIDACION_FALLIDA',
      );
    });

    it('401 sin token', async () => {
      esperarError(
        await ingresar(null, { codigoQr: 'VGY-0919-19-AAAAAA', espacioId }),
        401,
        'NO_AUTENTICADO',
      );
    });

    it('403 para un jugador (R16)', async () => {
      const r = await reservaDe('19:00');
      ahoraSon('19:00');
      esperarError(
        await ingresar(jugador, { codigoQr: r.codigoQr, espacioId }),
        403,
        'SIN_PERMISO',
      );
      const sigue = await a.dataSource
        .getRepository(ReservaEntidad)
        .findOneByOrFail({ id: r.id });
      expect(sigue.estado).toBe('confirmada');
    });

    it('404 CODIGO_INVALIDO si el código no existe', async () => {
      esperarError(
        await ingresar(encargado, {
          codigoQr: 'VGY-0101-08-ZZZZZZ',
          espacioId,
        }),
        404,
        'CODIGO_INVALIDO',
      );
    });

    it('422 RESERVA_CANCELADA', async () => {
      const r = await reservaDe('19:00', { estado: 'cancelada' });
      ahoraSon('19:00');
      esperarError(
        await ingresar(encargado, { codigoQr: r.codigoQr, espacioId }),
        422,
        'RESERVA_CANCELADA',
      );
    });

    it('422 CODIGO_DE_OTRO_DIA (mañana y ayer)', async () => {
      const manana = await reservaDe('19:00', { fecha: '2026-09-20' });
      const ayer = await reservaDe('19:00', { fecha: '2026-09-18' });
      ahoraSon('19:00');
      for (const r of [manana, ayer])
        esperarError(
          await ingresar(encargado, { codigoQr: r.codigoQr, espacioId }),
          422,
          'CODIGO_DE_OTRO_DIA',
        );
    });

    it('"hoy" es el día argentino, no el de UTC', async () => {
      const r = await reservaDe('23:00');
      a.reloj.fijar('2026-09-20T02:30:00Z'); // 23:30 del 19 en Villaguay
      await ingresar(encargado, { codigoQr: r.codigoQr, espacioId }).expect(
        200,
      );
    });

    it('422 CODIGO_DE_OTRO_ESPACIO', async () => {
      const r = await reservaDe('19:00');
      const otro = (await crearEspacio(a, { deporteId })).id;
      ahoraSon('19:00');
      esperarError(
        await ingresar(encargado, { codigoQr: r.codigoQr, espacioId: otro }),
        422,
        'CODIGO_DE_OTRO_ESPACIO',
      );
    });

    it('409 INGRESO_YA_REGISTRADO la segunda vez, sin pisar ingresoEn', async () => {
      const r = await reservaDe('19:00');
      ahoraSon('19:00');
      await ingresar(encargado, { codigoQr: r.codigoQr, espacioId }).expect(
        200,
      );
      ahoraSon('19:20');
      esperarError(
        await ingresar(encargado, { codigoQr: r.codigoQr, espacioId }),
        409,
        'INGRESO_YA_REGISTRADO',
      );
      const fila = await a.dataSource
        .getRepository(ReservaEntidad)
        .findOneByOrFail({ id: r.id });
      expect(fila.ingresoEn?.toISOString()).toBe('2026-09-19T22:00:00.000Z');
    });

    it('dos lecturas simultáneas del mismo QR: una entra y la otra es INGRESO_YA_REGISTRADO', async () => {
      const r = await reservaDe('19:00');
      ahoraSon('19:00');
      const cuerpo = { codigoQr: r.codigoQr, espacioId };
      const [x, y] = await Promise.all([
        ingresar(encargado, cuerpo),
        ingresar(admin, cuerpo),
      ]);
      expect([x.status, y.status].toSorted()).toEqual([200, 409]);
      esperarError(x.status === 409 ? x : y, 409, 'INGRESO_YA_REGISTRADO');
    });

    it('422 RESERVA_AUSENTE si ya la marcaron ausente (M4-1)', async () => {
      const r = await reservaDe('19:00', { estado: 'ausente' });
      ahoraSon('19:30');
      esperarError(
        await ingresar(encargado, { codigoQr: r.codigoQr, espacioId }),
        422,
        'RESERVA_AUSENTE',
      );
    });

    describe('FUERA_DE_HORARIO (D10): de 30 minutos antes al fin del turno', () => {
      it.each([
        ['18:29', 422],
        ['18:30', 200],
        ['19:59', 200],
        ['20:00', 422],
        ['10:00', 422],
      ])('a las %s: %i', async (hora, estado) => {
        const r = await reservaDe('19:00');
        ahoraSon(hora);
        const res = await ingresar(encargado, {
          codigoQr: r.codigoQr,
          espacioId,
        });
        if (estado === 200) esperarContrato<Reserva>(res.body, 'Reserva');
        else esperarError(res, 422, 'FUERA_DE_HORARIO');
      });
    });
  });

  describe('POST /reservas/:id/ausente — PRD §4, R15', () => {
    it('200: queda ausente y suma 1 a ausencias del dueño', async () => {
      const r = await reservaDe('19:00');
      ahoraSon('19:15');
      const res = await ausente(encargado, r.id).expect(200);
      const dato = esperarContrato<Reserva>(res.body, 'Reserva');
      expect(dato).toMatchObject({
        id: r.id,
        estado: 'ausente',
        ingresoEn: null,
      });
      const dueno = await a.dataSource
        .getRepository(UsuarioEntidad)
        .findOneByOrFail({ id: jugador.usuario.id });
      expect(dueno.ausencias).toBe(1);
    });

    it('el turno sigue reservado y el límite de tres libera lugar al terminar', async () => {
      const r = await reservaDe('19:00');
      ahoraSon('19:15');
      await ausente(admin, r.id).expect(200);
      const grilla = await a
        .http()
        .get(`/espacios/${espacioId}/turnos?fecha=${HOY}`)
        .expect(200);
      const t = esperarContrato<Turno[]>(grilla.body, 'Turno').find(
        (x) => x.inicio === '19:00',
      );
      expect(t?.estado).toBe('reservado');
    });

    it('422 ANTES_DE_TIEMPO a las 19:14 y 200 a las 19:15', async () => {
      const r = await reservaDe('19:00');
      ahoraSon('19:14');
      esperarError(await ausente(encargado, r.id), 422, 'ANTES_DE_TIEMPO');
      ahoraSon('19:15');
      await ausente(encargado, r.id).expect(200);
    });

    it('marcarla dos veces: 200 sin sumar otra ausencia', async () => {
      const r = await reservaDe('19:00');
      ahoraSon('20:00');
      await ausente(encargado, r.id).expect(200);
      const res = await ausente(encargado, r.id).expect(200);
      expect(esperarContrato<Reserva>(res.body, 'Reserva').estado).toBe(
        'ausente',
      );
      const dueno = await a.dataSource
        .getRepository(UsuarioEntidad)
        .findOneByOrFail({ id: jugador.usuario.id });
      expect(dueno.ausencias).toBe(1);
    });

    it('dos pedidos simultáneos suman una sola ausencia', async () => {
      const r = await reservaDe('19:00');
      ahoraSon('20:00');
      const rs = await Promise.all([
        ausente(encargado, r.id),
        ausente(admin, r.id),
      ]);
      expect(rs.map((x) => x.status)).toEqual([200, 200]);
      const dueno = await a.dataSource
        .getRepository(UsuarioEntidad)
        .findOneByOrFail({ id: jugador.usuario.id });
      expect(dueno.ausencias).toBe(1);
    });

    it('422 RESERVA_CANCELADA y 409 INGRESO_YA_REGISTRADO', async () => {
      const c = await reservaDe('18:00', { estado: 'cancelada' });
      const ok = await reservaDe('19:00', { estado: 'cumplida' });
      ahoraSon('20:30');
      esperarError(await ausente(encargado, c.id), 422, 'RESERVA_CANCELADA');
      esperarError(
        await ausente(encargado, ok.id),
        409,
        'INGRESO_YA_REGISTRADO',
      );
    });

    it('401, 403 (jugador, aunque sea el dueño), 404 y 400', async () => {
      const r = await reservaDe('19:00');
      ahoraSon('20:00');
      esperarError(await ausente(null, r.id), 401, 'NO_AUTENTICADO');
      esperarError(await ausente(jugador, r.id), 403, 'SIN_PERMISO');
      esperarError(
        await ausente(encargado, 'res-noexiste'),
        404,
        'RESERVA_NO_ENCONTRADA',
      );
      esperarError(
        await ausente(encargado, 'xx-1'),
        404,
        'RESERVA_NO_ENCONTRADA',
      );
      esperarError(
        await ausente(encargado, r.id, { motivo: 'x' }),
        400,
        'VALIDACION_FALLIDA',
      );
    });
  });
});

describe('M4 — Agenda, listado de reservas y usuarios', () => {
  let a: AppDePrueba;
  let deporteId: string;
  let encargado: UsuarioDePrueba;
  let jugador: UsuarioDePrueba;
  let e1: string;
  let e2: string;
  let inactivo: string;

  beforeAll(async () => {
    a = await crearApp();
    deporteId = (await crearDeporte(a)).id;
    encargado = await crearUsuario(a, 'encargado');
    jugador = await registrarJugador(a, { telefono: '3455-123456' });
    e1 = (await crearEspacio(a, { deporteId, id: 'esp-a1' })).id;
    e2 = (await crearEspacio(a, { deporteId, id: 'esp-a2' })).id;
    inactivo = (
      await crearEspacio(a, { deporteId, id: 'esp-a3', activo: false })
    ).id;
    await crearReserva(a, {
      espacioId: e1,
      usuarioId: jugador.usuario.id,
      fecha: HOY,
      inicio: '19:00',
    });
    await crearFija(a, {
      espacioId: e2,
      dia: 6,
      inicio: '10:00',
      fin: '12:00',
    });
    await crearBloqueo(a, {
      espacioId: e1,
      fecha: HOY,
      inicio: '21:00',
      fin: '23:00',
    });
    await crearReserva(a, {
      espacioId: e2,
      usuarioId: jugador.usuario.id,
      fecha: '2026-09-20',
      inicio: '20:00',
      estado: 'cancelada',
    });
    await crearReserva(a, {
      espacioId: e2,
      usuarioId: jugador.usuario.id,
      fecha: '2026-09-10',
      inicio: '09:00',
      estado: 'cumplida',
    });
  });
  afterAll(() => a.cerrar());

  const agenda = (u: UsuarioDePrueba | null, qs = '') => {
    const req = a.http().get(`/agenda${qs}`);
    return u ? req.set(con(u)) : req;
  };

  describe('GET /agenda', () => {
    it('turnos de todos los espacios activos, por espacio e inicio', async () => {
      const res = await agenda(encargado, '?porPagina=500').expect(200);
      const turnos = esperarContrato<Turno[]>(res.body, 'Turno');
      expect(turnos).toHaveLength(32);
      expect((res.body as { meta: unknown }).meta).toEqual({
        total: 32,
        pagina: 1,
        porPagina: 500,
      });
      expect(turnos.every((t) => t.fecha === HOY)).toBe(true);
      expect(turnos.some((t) => t.espacioId === inactivo)).toBe(false);
      const orden = turnos.map((t) => `${t.espacioId}|${t.inicio}`);
      expect(orden).toEqual(orden.toSorted());
      const de = (e: string, i: string) =>
        turnos.find((t) => t.espacioId === e && t.inicio === i);
      expect(de(e1, '19:00')?.estado).toBe('reservado');
      expect(de(e1, '21:00')).toMatchObject({
        estado: 'mantenimiento',
        motivoBloqueo: 'Cancha anegada',
      });
      expect(de(e2, '11:00')?.estado).toBe('fijo');
      expect(de(e2, '08:00')?.estado).toBe('libre');
    });

    it('fecha: otro día, y también días pasados o lejanos (sin límite de rango)', async () => {
      const m = await agenda(
        encargado,
        '?fecha=2026-09-20&porPagina=500',
      ).expect(200);
      expect(
        esperarContrato<Turno[]>(m.body, 'Turno').filter(
          (t) => t.estado === 'reservado',
        ),
      ).toHaveLength(0);
      const pasado = await agenda(
        encargado,
        '?fecha=2026-09-10&porPagina=500',
      ).expect(200);
      expect(
        esperarContrato<Turno[]>(pasado.body, 'Turno').filter(
          (t) => t.estado === 'reservado',
        ),
      ).toHaveLength(1);
      await agenda(encargado, '?fecha=2027-01-01').expect(200);
    });

    it('paginación: página 2 de 10 y página fuera de rango', async () => {
      const res = await agenda(encargado, '?porPagina=10&pagina=2').expect(200);
      expect(esperarContrato<Turno[]>(res.body, 'Turno')).toHaveLength(10);
      const fuera = await agenda(encargado, '?pagina=99').expect(200);
      expect(
        (fuera.body as { datos: unknown[]; meta: { total: number } }).datos,
      ).toEqual([]);
      expect((fuera.body as { meta: { total: number } }).meta.total).toBe(32);
    });

    it.each([
      '?fecha=ayer',
      '?fecha=2026-02-30',
      '?fecha=',
      '?porPagina=501',
      '?porPagina=0',
      '?pagina=0',
    ])('400 con %s', async (qs) => {
      esperarError(await agenda(encargado, qs), 400, 'VALIDACION_FALLIDA');
    });

    it('401 sin token y 403 para un jugador', async () => {
      esperarError(await agenda(null), 401, 'NO_AUTENTICADO');
      esperarError(await agenda(jugador), 403, 'SIN_PERMISO');
    });

    it('sin espacios activos devuelve una lista vacía', async () => {
      const vacia = await crearApp();
      try {
        const enc = await crearUsuario(vacia, 'encargado');
        const res = await vacia.http().get('/agenda').set(con(enc)).expect(200);
        expect(esperarContrato<Turno[]>(res.body, 'Turno')).toEqual([]);
        expect((res.body as { meta: { total: number } }).meta.total).toBe(0);
      } finally {
        await vacia.cerrar();
      }
    });
  });

  describe('GET /reservas', () => {
    const listar = (u: UsuarioDePrueba | null, qs = '') => {
      const req = a.http().get(`/reservas${qs}`);
      return u ? req.set(con(u)) : req;
    };

    it('todas, por fecha e inicio ascendente', async () => {
      const res = await listar(encargado).expect(200);
      const rs = esperarContrato<Reserva[]>(res.body, 'Reserva');
      expect(rs).toHaveLength(3);
      expect(rs.map((r) => r.turnoId.slice(-11))).toEqual([
        '20260910-09',
        '20260919-19',
        '20260920-20',
      ]);
    });

    it('filtros fecha, espacioId y estado, y combinados', async () => {
      const por = async (qs: string): Promise<Reserva[]> =>
        esperarContrato<Reserva[]>(
          (await listar(encargado, qs).expect(200)).body,
          'Reserva',
        );
      expect(await por(`?fecha=${HOY}`)).toHaveLength(1);
      expect(await por(`?espacioId=${e2}`)).toHaveLength(2);
      expect(await por('?estado=cancelada')).toHaveLength(1);
      expect(await por(`?espacioId=${e2}&estado=cumplida`)).toHaveLength(1);
      expect(await por(`?espacioId=${e1}&estado=cumplida`)).toEqual([]);
      expect(await por('?espacioId=esp-zzz')).toEqual([]);
    });

    it('paginación con meta correcto', async () => {
      const res = await listar(encargado, '?porPagina=2&pagina=2').expect(200);
      expect(esperarContrato<Reserva[]>(res.body, 'Reserva')).toHaveLength(1);
      expect((res.body as { meta: unknown }).meta).toEqual({
        total: 3,
        pagina: 2,
        porPagina: 2,
      });
    });

    it.each([
      '?fecha=hoy',
      '?fecha=2026-13-01',
      '?estado=rota',
      '?espacioId=abc',
      '?porPagina=101',
    ])('400 con %s', async (qs) => {
      esperarError(await listar(encargado, qs), 400, 'VALIDACION_FALLIDA');
    });

    it('401 sin token y 403 para un jugador', async () => {
      esperarError(await listar(null), 401, 'NO_AUTENTICADO');
      esperarError(await listar(jugador), 403, 'SIN_PERMISO');
    });
  });

  describe('GET /usuarios/:id', () => {
    const ver = (u: UsuarioDePrueba | null, id: string) => {
      const req = a.http().get(`/usuarios/${id}`);
      return u ? req.set(con(u)) : req;
    };

    it('el Usuario con su teléfono, sin datos internos', async () => {
      const res = await ver(encargado, jugador.usuario.id).expect(200);
      const u = esperarContrato<Usuario>(res.body, 'Usuario');
      expect(u).toMatchObject({
        id: jugador.usuario.id,
        telefono: '3455-123456',
        rol: 'jugador',
        espaciosFavoritos: [],
        cancelacionesTardias: 0,
        ausencias: 0,
      });
      expect(JSON.stringify(res.body)).not.toMatch(/hash/i);
    });

    it('404, 401 y 403', async () => {
      esperarError(
        await ver(encargado, 'usr-noexiste'),
        404,
        'USUARIO_NO_ENCONTRADO',
      );
      esperarError(await ver(encargado, 'abc'), 404, 'USUARIO_NO_ENCONTRADO');
      esperarError(await ver(null, jugador.usuario.id), 401, 'NO_AUTENTICADO');
      esperarError(await ver(jugador, jugador.usuario.id), 403, 'SIN_PERMISO');
    });
  });
});
