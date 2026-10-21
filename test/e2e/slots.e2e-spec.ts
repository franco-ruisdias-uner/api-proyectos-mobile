// M2 — Grilla: GET /espacios/:id/turnos (ESPECIFICACION §4, reglas R1 a R6).
// El reloj de prueba arranca el sábado 19/09/2026 a las 10:00 en Villaguay.
import type { Turno } from '../../contract/types.js';
import { type AppDePrueba, crearApp } from '../utilities/create-app.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import { crearDeporte, crearEspacio } from '../utilities/venues.js';
import { crearBloqueo, crearFija, crearReserva } from '../utilities/slots.js';
import { crearUsuario } from '../utilities/users.js';

describe('GET /espacios/:id/turnos — PRD §2, público', () => {
  let a: AppDePrueba;
  let espacioId: string;
  let usuarioId: string;

  beforeAll(async () => {
    a = await crearApp();
    const d = await crearDeporte(a);
    espacioId = (
      await crearEspacio(a, { deporteId: d.id, precioPorHora: 8000 })
    ).id;
    usuarioId = (await crearUsuario(a, 'jugador')).usuario.id;
  });
  afterAll(() => a.cerrar());

  const pedir = (fecha?: string, id = espacioId) =>
    a.http().get(`/espacios/${id}/turnos${fecha ? `?fecha=${fecha}` : ''}`);

  it('sin sesión: 200 con los 16 turnos, cada uno cumple el contrato (R1)', async () => {
    const res = await pedir('2026-09-21').expect(200);
    const turnos = esperarContrato<Turno[]>(res.body, 'Turno');
    expect(turnos).toHaveLength(16);
    expect(turnos[0]).toMatchObject({ inicio: '08:00', fin: '09:00' });
    expect(turnos[15]).toMatchObject({ inicio: '23:00', fin: '24:00' });
    const inicios = turnos.map((t) => t.inicio);
    expect(inicios).toEqual(inicios.toSorted());
    expect(res.body.meta).toEqual({ total: 16, pagina: 1, porPagina: 20 });
  });

  it('el turno trae id determinístico, espacio, fecha y precio actual (D1, R5)', async () => {
    const res = await pedir('2026-09-21').expect(200);
    expect((res.body.datos as Turno[])[11]).toEqual({
      id: `tur-${espacioId}-20260921-19`,
      espacioId,
      fecha: '2026-09-21',
      inicio: '19:00',
      fin: '20:00',
      estado: 'libre',
      reservaId: null,
      motivoBloqueo: null,
      precio: 8000,
    });
  });

  it('sin fecha: usa hoy en hora argentina (R6)', async () => {
    const res = await pedir().expect(200);
    expect(res.body.datos[0].fecha).toBe('2026-09-19');
  });

  it('hoy cerca de la medianoche en Villaguay sigue siendo hoy aunque en UTC ya sea mañana', async () => {
    a.reloj.fijar('2026-09-19T23:30:00-03:00'); // 02:30 UTC del 20
    try {
      const res = await pedir().expect(200);
      expect(res.body.datos[0].fecha).toBe('2026-09-19');
    } finally {
      a.reloj.fijar('2026-09-19T10:00:00-03:00');
    }
  });

  it('los turnos que ya pasaron se muestran con su estado (R6)', async () => {
    const res = await pedir('2026-09-19').expect(200);
    expect((res.body.datos as Turno[])[0]).toMatchObject({
      inicio: '08:00',
      estado: 'libre',
    });
  });

  it('una reserva confirmada, cumplida o ausente deja el turno reservado con su reservaId (R2, R5)', async () => {
    const fecha = '2026-09-22';
    const r1 = await crearReserva(a, {
      espacioId,
      usuarioId,
      fecha,
      inicio: '10:00',
      estado: 'confirmada',
    });
    const r2 = await crearReserva(a, {
      espacioId,
      usuarioId,
      fecha,
      inicio: '11:00',
      estado: 'cumplida',
    });
    const r3 = await crearReserva(a, {
      espacioId,
      usuarioId,
      fecha,
      inicio: '12:00',
      estado: 'ausente',
    });
    await crearReserva(a, {
      espacioId,
      usuarioId,
      fecha,
      inicio: '13:00',
      estado: 'cancelada',
    });
    const t = esperarContrato<Turno[]>((await pedir(fecha)).body, 'Turno');
    const por = (h: string) => t.find((x) => x.inicio === h)!;
    expect(por('10:00')).toMatchObject({
      estado: 'reservado',
      reservaId: r1.id,
    });
    expect(por('11:00')).toMatchObject({
      estado: 'reservado',
      reservaId: r2.id,
    });
    expect(por('12:00')).toMatchObject({
      estado: 'reservado',
      reservaId: r3.id,
    });
    expect(por('13:00')).toMatchObject({ estado: 'libre', reservaId: null });
  });

  it('una reserva de otro día o de otro espacio no afecta (R2)', async () => {
    const d = await crearDeporte(a);
    const otro = await crearEspacio(a, { deporteId: d.id });
    await crearReserva(a, {
      espacioId: otro.id,
      usuarioId,
      fecha: '2026-09-23',
      inicio: '10:00',
    });
    await crearReserva(a, {
      espacioId,
      usuarioId,
      fecha: '2026-09-24',
      inicio: '10:00',
    });
    const t = esperarContrato<Turno[]>(
      (await pedir('2026-09-23')).body,
      'Turno',
    );
    expect(t.every((x) => x.estado === 'libre')).toBe(true);
  });

  it('la fija cubre sus turnos sólo el día de la semana que corresponde (R3)', async () => {
    const e = await crearEspacio(a, { deporteId: (await crearDeporte(a)).id });
    await crearFija(a, {
      espacioId: e.id,
      dia: 3,
      inicio: '20:00',
      fin: '22:00',
    });
    const miercoles = esperarContrato<Turno[]>(
      (await pedir('2026-09-23', e.id)).body,
      'Turno',
    );
    expect(
      miercoles.filter((t) => t.estado === 'fijo').map((t) => t.inicio),
    ).toEqual(['20:00', '21:00']);
    const jueves = esperarContrato<Turno[]>(
      (await pedir('2026-09-24', e.id)).body,
      'Turno',
    );
    expect(jueves.some((t) => t.estado === 'fijo')).toBe(false);
  });

  it('una fija inactiva o vencida no cubre (R3)', async () => {
    const e = await crearEspacio(a, { deporteId: (await crearDeporte(a)).id });
    await crearFija(a, { espacioId: e.id, dia: 1, activa: false });
    await crearFija(a, {
      espacioId: e.id,
      dia: 1,
      inicio: '10:00',
      fin: '11:00',
      hasta: '2026-09-20',
    });
    const t = esperarContrato<Turno[]>(
      (await pedir('2026-09-21', e.id)).body,
      'Turno',
    );
    expect(t.every((x) => x.estado === 'libre')).toBe(true);
  });

  it('fija y reserva en el mismo turno: gana la fija (R2)', async () => {
    const e = await crearEspacio(a, { deporteId: (await crearDeporte(a)).id });
    await crearFija(a, { espacioId: e.id, dia: 1 });
    await crearReserva(a, {
      espacioId: e.id,
      usuarioId,
      fecha: '2026-09-21',
      inicio: '21:00',
    });
    const t = esperarContrato<Turno[]>(
      (await pedir('2026-09-21', e.id)).body,
      'Turno',
    );
    expect(t.find((x) => x.inicio === '21:00')).toMatchObject({
      estado: 'fijo',
      reservaId: null,
    });
  });

  it('un bloqueo de día entero deja todo en mantenimiento con el motivo (R4)', async () => {
    const e = await crearEspacio(a, { deporteId: (await crearDeporte(a)).id });
    await crearBloqueo(a, {
      espacioId: e.id,
      fecha: '2026-09-21',
      motivo: 'Cancha anegada',
    });
    const t = esperarContrato<Turno[]>(
      (await pedir('2026-09-21', e.id)).body,
      'Turno',
    );
    expect(
      t.every(
        (x) =>
          x.estado === 'mantenimiento' && x.motivoBloqueo === 'Cancha anegada',
      ),
    ).toBe(true);
    const otroDia = esperarContrato<Turno[]>(
      (await pedir('2026-09-22', e.id)).body,
      'Turno',
    );
    expect(otroDia.every((x) => x.estado === 'libre')).toBe(true);
  });

  it('un bloqueo parcial encima de una fija y una reserva gana (R2, R4)', async () => {
    const e = await crearEspacio(a, { deporteId: (await crearDeporte(a)).id });
    await crearFija(a, { espacioId: e.id, dia: 1 });
    await crearReserva(a, {
      espacioId: e.id,
      usuarioId,
      fecha: '2026-09-21',
      inicio: '20:00',
    });
    await crearBloqueo(a, {
      espacioId: e.id,
      fecha: '2026-09-21',
      inicio: '20:00',
      fin: '22:00',
      motivo: 'Riego',
    });
    const t = esperarContrato<Turno[]>(
      (await pedir('2026-09-21', e.id)).body,
      'Turno',
    );
    expect(
      t.filter((x) => x.estado === 'mantenimiento').map((x) => x.inicio),
    ).toEqual(['20:00', '21:00']);
    expect(t.find((x) => x.inicio === '20:00')).toMatchObject({
      reservaId: null,
      motivoBloqueo: 'Riego',
    });
    expect(t.find((x) => x.inicio === '19:00')?.estado).toBe('libre');
  });

  it('el precio es el precioPorHora actual del espacio (D5)', async () => {
    const e = await crearEspacio(a, {
      deporteId: (await crearDeporte(a)).id,
      precioPorHora: 0,
    });
    const t = esperarContrato<Turno[]>(
      (await pedir('2026-09-21', e.id)).body,
      'Turno',
    );
    expect(t.every((x) => x.precio === 0)).toBe(true);
  });

  it('el rango: de hoy a hoy + 6 entra; ayer y hoy + 7 dan FECHA_FUERA_DE_RANGO (R6)', async () => {
    await pedir('2026-09-19').expect(200);
    await pedir('2026-09-25').expect(200);
    esperarError(await pedir('2026-09-18'), 422, 'FECHA_FUERA_DE_RANGO');
    esperarError(await pedir('2026-09-26'), 422, 'FECHA_FUERA_DE_RANGO');
  });

  it('el rango se mueve con el reloj', async () => {
    a.reloj.fijar('2026-12-30T10:00:00-03:00');
    try {
      await pedir('2027-01-05').expect(200);
      esperarError(await pedir('2027-01-06'), 422, 'FECHA_FUERA_DE_RANGO');
    } finally {
      a.reloj.fijar('2026-09-19T10:00:00-03:00');
    }
  });

  it.each([
    'hoy',
    '2026-9-21',
    '2026-02-30',
    '21/09/2026',
    '2026-09-21T10:00:00-03:00',
    '',
  ])('400 con una fecha mal formada: «%s»', async (fecha) => {
    esperarError(
      await a.http().get(`/espacios/${espacioId}/turnos`).query({ fecha }),
      400,
      'VALIDACION_FALLIDA',
    );
  });

  it('404 ESPACIO_NO_ENCONTRADO si no existe, si el id es de otra cosa o si está inactivo', async () => {
    esperarError(
      await pedir('2026-09-21', 'esp-noexiste'),
      404,
      'ESPACIO_NO_ENCONTRADO',
    );
    esperarError(
      await pedir('2026-09-21', 'lug-001'),
      404,
      'ESPACIO_NO_ENCONTRADO',
    );
    const e = await crearEspacio(a, {
      deporteId: (await crearDeporte(a)).id,
      activo: false,
    });
    esperarError(await pedir('2026-09-21', e.id), 404, 'ESPACIO_NO_ENCONTRADO');
  });

  it('paginación: porPagina=5 da los 5 primeros y la página 5 da vacío con el total correcto', async () => {
    const p1 = await a
      .http()
      .get(`/espacios/${espacioId}/turnos?fecha=2026-09-21&porPagina=5`)
      .expect(200);
    expect(p1.body.datos.map((t: Turno) => t.inicio)).toEqual([
      '08:00',
      '09:00',
      '10:00',
      '11:00',
      '12:00',
    ]);
    expect(p1.body.meta).toEqual({ total: 16, pagina: 1, porPagina: 5 });
    const p4 = await a
      .http()
      .get(
        `/espacios/${espacioId}/turnos?fecha=2026-09-21&porPagina=5&pagina=5`,
      )
      .expect(200);
    expect(p4.body.datos).toEqual([]);
    expect(p4.body.meta.total).toBe(16);
  });

  it('el mismo pedido dos veces da lo mismo', async () => {
    const x = await pedir('2026-09-21');
    const y = await pedir('2026-09-21');
    expect(x.body).toEqual(y.body);
  });
});
