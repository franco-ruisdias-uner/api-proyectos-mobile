// Verificación independiente de M2 — Grilla (ESPECIFICACION §4 M2, R1–R6, D1, D5, D8; DECISIONES M2-1 a M2-4).
// Caja negra: sólo HTTP contra la app completa. Complementa test/e2e/turnos sin repetirlo.
import type { Turno } from '../../contrato/tipos.js';
import { sembrar } from '../../src/semillas/sembrar.js';
import { EspacioEntidad } from '../../src/modulos/espacios/espacio.entidad.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { crearDeporte, crearEspacio } from '../utilidades/espacios.js';
import { crearBloqueo, crearFija, crearReserva } from '../utilidades/turnos.js';
import { crearUsuario } from '../utilidades/usuarios.js';

const CLAVES_TURNO = [
  'espacioId', 'estado', 'fecha', 'fin', 'id', 'inicio', 'motivoBloqueo', 'precio', 'reservaId',
].sort();

describe('M2 — grilla: casos adversariales', () => {
  let a: AppDePrueba;
  let deporteId: string;
  let usuarioId: string;

  beforeAll(async () => {
    a = await crearApp();
    deporteId = (await crearDeporte(a)).id;
    usuarioId = (await crearUsuario(a, 'jugador')).usuario.id;
  });
  afterAll(() => a.cerrar());
  beforeEach(() => a.reloj.fijar('2026-09-19T10:00:00-03:00'));

  const nuevoEspacio = (datos: Partial<EspacioEntidad> = {}) =>
    crearEspacio(a, { deporteId, ...datos });
  const pedir = (id: string, fecha?: string) =>
    a.http().get(`/espacios/${id}/turnos${fecha ? `?fecha=${fecha}` : ''}`);
  const grilla = async (id: string, fecha: string) =>
    esperarContrato<Turno[]>((await pedir(id, fecha).expect(200)).body, 'Turno');
  const estados = (t: Turno[], estado: string) =>
    t.filter((x) => x.estado === estado).map((x) => x.inicio);

  describe('Forma (AGENTS §4.3, §4.5)', () => {
    it('cada turno tiene exactamente las claves del tipo, con y sin opcionales', async () => {
      const e = await nuevoEspacio({ precioPorHora: 12345 });
      await crearReserva(a, { espacioId: e.id, usuarioId, fecha: '2026-09-21', inicio: '09:00' });
      await crearBloqueo(a, { espacioId: e.id, fecha: '2026-09-21', inicio: '10:00', fin: '11:00' });
      const res = await pedir(e.id, '2026-09-21').expect(200);
      for (const t of res.body.datos) expect(Object.keys(t).sort()).toEqual(CLAVES_TURNO);
      expect(Object.keys(res.body).sort()).toEqual(['datos', 'meta']);
      const t = await grilla(e.id, '2026-09-21');
      expect(t[1].reservaId).toMatch(/^res-/);
      expect(t[2].motivoBloqueo).toBe('Cancha anegada');
      expect(t[0].reservaId).toBeNull();
      expect(t[0].motivoBloqueo).toBeNull();
    });

    it('los 16 turnos son consecutivos, de una hora, con ids únicos y el último termina en 24:00 (R1, D8)', async () => {
      const e = await nuevoEspacio();
      const t = await grilla(e.id, '2026-09-21');
      expect(t).toHaveLength(16);
      t.forEach((x, i) => {
        const h = String(8 + i).padStart(2, '0');
        const f = String(9 + i).padStart(2, '0');
        expect(x.inicio).toBe(`${h}:00`);
        expect(x.fin).toBe(`${f}:00`);
        expect(x.id).toBe(`tur-${e.id}-20260921-${h}`);
        expect(x.espacioId).toBe(e.id);
        expect(x.fecha).toBe('2026-09-21');
      });
      expect(new Set(t.map((x) => x.id)).size).toBe(16);
      expect(t[15].fin).toBe('24:00');
    });

    it('el reservaId apunta a la reserva, y el id de turno coincide con el de la reserva creada (D1)', async () => {
      const e = await nuevoEspacio();
      const r = await crearReserva(a, { espacioId: e.id, usuarioId, fecha: '2026-09-22', inicio: '23:00' });
      const t = await grilla(e.id, '2026-09-22');
      expect(t[15]).toMatchObject({ id: r.turnoId, estado: 'reservado', reservaId: r.id });
    });

    it('un id de espacio con guiones no rompe el id del turno', async () => {
      const e = await nuevoEspacio({ id: 'esp-cancha-fut-5' });
      const t = await grilla(e.id, '2026-09-21');
      expect(t[0].id).toBe('tur-esp-cancha-fut-5-20260921-08');
    });
  });

  describe('R2 — prioridad y estados', () => {
    it('cancelada + nueva confirmada en el mismo turno: gana la confirmada y su id', async () => {
      const e = await nuevoEspacio();
      await crearReserva(a, { espacioId: e.id, usuarioId, fecha: '2026-09-21', inicio: '15:00', estado: 'cancelada' });
      const viva = await crearReserva(a, { espacioId: e.id, usuarioId, fecha: '2026-09-21', inicio: '15:00' });
      const t = await grilla(e.id, '2026-09-21');
      expect(t.find((x) => x.inicio === '15:00')).toMatchObject({ estado: 'reservado', reservaId: viva.id });
    });

    it('bloqueo gana a una reserva sin fija; fija gana a reserva; bloqueo gana a fija', async () => {
      const e = await nuevoEspacio();
      // 2026-09-21 es lunes (dia 1)
      await crearReserva(a, { espacioId: e.id, usuarioId, fecha: '2026-09-21', inicio: '09:00' });
      await crearBloqueo(a, { espacioId: e.id, fecha: '2026-09-21', inicio: '09:00', fin: '10:00', motivo: 'Poda' });
      await crearFija(a, { espacioId: e.id, dia: 1, inicio: '12:00', fin: '14:00' });
      await crearReserva(a, { espacioId: e.id, usuarioId, fecha: '2026-09-21', inicio: '13:00' });
      await crearBloqueo(a, { espacioId: e.id, fecha: '2026-09-21', inicio: '13:00', fin: '14:00', motivo: 'Riego' });
      const t = await grilla(e.id, '2026-09-21');
      expect(t[1]).toMatchObject({ estado: 'mantenimiento', reservaId: null, motivoBloqueo: 'Poda' });
      expect(t[4]).toMatchObject({ estado: 'fijo', reservaId: null, motivoBloqueo: null });
      expect(t[5]).toMatchObject({ estado: 'mantenimiento', reservaId: null, motivoBloqueo: 'Riego' });
    });

    it('motivoBloqueo sólo en mantenimiento: ni en fijo ni en reservado ni en libre (R5)', async () => {
      const e = await nuevoEspacio();
      await crearFija(a, { espacioId: e.id, dia: 1, inicio: '10:00', fin: '11:00' });
      await crearReserva(a, { espacioId: e.id, usuarioId, fecha: '2026-09-21', inicio: '12:00' });
      await crearBloqueo(a, { espacioId: e.id, fecha: '2026-09-21', inicio: '14:00', fin: '15:00' });
      const t = await grilla(e.id, '2026-09-21');
      for (const x of t) {
        if (x.estado !== 'mantenimiento') expect(x.motivoBloqueo).toBeNull();
        if (x.estado !== 'reservado') expect(x.reservaId).toBeNull();
      }
    });
  });

  describe('R3 — fijas: bordes', () => {
    it('desde = fecha cubre; desde = mañana no cubre hoy; hasta = fecha cubre; hasta = ayer no', async () => {
      const e = await nuevoEspacio();
      // lunes 21
      await crearFija(a, { espacioId: e.id, dia: 1, inicio: '08:00', fin: '09:00', desde: '2026-09-21' });
      await crearFija(a, { espacioId: e.id, dia: 1, inicio: '09:00', fin: '10:00', desde: '2026-09-22' });
      await crearFija(a, { espacioId: e.id, dia: 1, inicio: '10:00', fin: '11:00', desde: '2026-01-01', hasta: '2026-09-21' });
      await crearFija(a, { espacioId: e.id, dia: 1, inicio: '11:00', fin: '12:00', desde: '2026-01-01', hasta: '2026-09-20' });
      const t = await grilla(e.id, '2026-09-21');
      expect(estados(t, 'fijo')).toEqual(['08:00', '10:00']);
    });

    it('una fija que termina a las 24:00 cubre el último turno; una que empieza a las 08:00 cubre el primero', async () => {
      const e = await nuevoEspacio();
      await crearFija(a, { espacioId: e.id, dia: 1, inicio: '22:00', fin: '24:00' });
      await crearFija(a, { espacioId: e.id, dia: 1, inicio: '08:00', fin: '09:00' });
      const t = await grilla(e.id, '2026-09-21');
      expect(estados(t, 'fijo')).toEqual(['08:00', '22:00', '23:00']);
    });

    it('fija de tres horas cubre tres turnos y no el siguiente', async () => {
      const e = await nuevoEspacio();
      await crearFija(a, { espacioId: e.id, dia: 1, inicio: '18:00', fin: '21:00' });
      expect(estados(await grilla(e.id, '2026-09-21'), 'fijo')).toEqual(['18:00', '19:00', '20:00']);
    });

    it('una fija de otro espacio no afecta', async () => {
      const e = await nuevoEspacio();
      const otro = await nuevoEspacio();
      await crearFija(a, { espacioId: otro.id, dia: 1 });
      expect(estados(await grilla(e.id, '2026-09-21'), 'fijo')).toEqual([]);
    });

    it.each([
      ['2026-09-20', 0], // domingo
      ['2026-09-21', 1],
      ['2026-09-22', 2],
      ['2026-09-23', 3],
      ['2026-09-24', 4],
      ['2026-09-25', 5],
    ])('el día de la semana de %s es %i (0 = domingo)', async (fecha, dia) => {
      const e = await nuevoEspacio();
      await crearFija(a, { espacioId: e.id, dia, inicio: '10:00', fin: '11:00' });
      expect(estados(await grilla(e.id, fecha), 'fijo')).toEqual(['10:00']);
      await crearFija(a, { espacioId: e.id, dia: (dia + 1) % 7, inicio: '12:00', fin: '13:00' });
      expect(estados(await grilla(e.id, fecha), 'fijo')).toEqual(['10:00']);
    });

    it('el sábado 19 (hoy) es día 6', async () => {
      const e = await nuevoEspacio();
      await crearFija(a, { espacioId: e.id, dia: 6, inicio: '10:00', fin: '11:00' });
      expect(estados(await grilla(e.id, '2026-09-19'), 'fijo')).toEqual(['10:00']);
    });
  });

  describe('R4 — bloqueos: bordes', () => {
    it('[inicio, fin): el turno que empieza en fin queda libre; el de inicio queda bloqueado', async () => {
      const e = await nuevoEspacio();
      await crearBloqueo(a, { espacioId: e.id, fecha: '2026-09-21', inicio: '10:00', fin: '12:00' });
      const t = await grilla(e.id, '2026-09-21');
      expect(estados(t, 'mantenimiento')).toEqual(['10:00', '11:00']);
      expect(t.find((x) => x.inicio === '12:00')?.estado).toBe('libre');
      expect(t.find((x) => x.inicio === '09:00')?.estado).toBe('libre');
    });

    it('bloqueo hasta las 24:00 cubre el último turno; bloqueo desde 08:00 cubre el primero', async () => {
      const e = await nuevoEspacio();
      await crearBloqueo(a, { espacioId: e.id, fecha: '2026-09-21', inicio: '22:00', fin: '24:00' });
      await crearBloqueo(a, { espacioId: e.id, fecha: '2026-09-22', inicio: '08:00', fin: '09:00' });
      expect(estados(await grilla(e.id, '2026-09-21'), 'mantenimiento')).toEqual(['22:00', '23:00']);
      expect(estados(await grilla(e.id, '2026-09-22'), 'mantenimiento')).toEqual(['08:00']);
    });

    it('bloqueo de otro espacio no afecta; bloqueo de día entero de hoy sobre turnos ya pasados sí se muestra', async () => {
      const e = await nuevoEspacio();
      const otro = await nuevoEspacio();
      await crearBloqueo(a, { espacioId: otro.id, fecha: '2026-09-21' });
      await crearBloqueo(a, { espacioId: e.id, fecha: '2026-09-19', motivo: 'Lluvia' });
      expect(estados(await grilla(e.id, '2026-09-21'), 'mantenimiento')).toEqual([]);
      expect(estados(await grilla(e.id, '2026-09-19'), 'mantenimiento')).toHaveLength(16);
    });

    it('dos bloqueos solapados: se cubre la unión y el motivo es el del de id menor (M2-4)', async () => {
      const e = await nuevoEspacio();
      await crearBloqueo(a, { espacioId: e.id, fecha: '2026-09-21', inicio: '10:00', fin: '12:00', motivo: 'B', id: 'blo-bbb' });
      await crearBloqueo(a, { espacioId: e.id, fecha: '2026-09-21', inicio: '11:00', fin: '13:00', motivo: 'A', id: 'blo-aaa' });
      const t = await grilla(e.id, '2026-09-21');
      expect(estados(t, 'mantenimiento')).toEqual(['10:00', '11:00', '12:00']);
      expect(t.find((x) => x.inicio === '11:00')?.motivoBloqueo).toBe('A');
      expect(t.find((x) => x.inicio === '10:00')?.motivoBloqueo).toBe('B');
    });

    it('un motivo con tildes, comillas y emoji viaja intacto', async () => {
      const e = await nuevoEspacio();
      const motivo = 'Torneo "Ñandú" — árbol caído ⚽';
      await crearBloqueo(a, { espacioId: e.id, fecha: '2026-09-21', motivo });
      expect((await grilla(e.id, '2026-09-21'))[0].motivoBloqueo).toBe(motivo);
    });
  });

  describe('R5, D5 — precio', () => {
    it('cambiar el precio en la base se ve de inmediato en todos los turnos, incluso reservados', async () => {
      const e = await nuevoEspacio({ precioPorHora: 8000 });
      await crearReserva(a, { espacioId: e.id, usuarioId, fecha: '2026-09-21', inicio: '10:00' });
      expect((await grilla(e.id, '2026-09-21')).every((x) => x.precio === 8000)).toBe(true);
      await a.dataSource.getRepository(EspacioEntidad).update(e.id, { precioPorHora: 9500 });
      const t = await grilla(e.id, '2026-09-21');
      expect(t.every((x) => x.precio === 9500)).toBe(true);
      expect(Number.isInteger(t[0].precio)).toBe(true);
    });
  });

  describe('R6 — reloj, medianoche, fin de mes y de año', () => {
    it('23:59:59 del 19 sigue siendo hoy 19; 00:00:00 del 20 pasa a ser hoy 20 (sin fecha)', async () => {
      const e = await nuevoEspacio();
      a.reloj.fijar('2026-09-19T23:59:59-03:00');
      expect((await grilla(e.id, '2026-09-19'))[0].fecha).toBe('2026-09-19');
      expect((await pedir(e.id).expect(200)).body.datos[0].fecha).toBe('2026-09-19');
      a.reloj.fijar('2026-09-20T00:00:00-03:00');
      expect((await pedir(e.id).expect(200)).body.datos[0].fecha).toBe('2026-09-20');
    });

    it('el rango cambia a las 00:00: el 19 deja de entrar y el 26 empieza a entrar', async () => {
      const e = await nuevoEspacio();
      a.reloj.fijar('2026-09-19T23:59:59-03:00');
      await pedir(e.id, '2026-09-19').expect(200);
      esperarError(await pedir(e.id, '2026-09-26'), 422, 'FECHA_FUERA_DE_RANGO');
      a.reloj.fijar('2026-09-20T00:00:00-03:00');
      esperarError(await pedir(e.id, '2026-09-19'), 422, 'FECHA_FUERA_DE_RANGO');
      await pedir(e.id, '2026-09-26').expect(200);
    });

    it('instante dado en UTC (Z): 02:59:59Z del 20 es todavía el 19 en Villaguay; 03:00:00Z ya es el 20', async () => {
      const e = await nuevoEspacio();
      a.reloj.fijar('2026-09-20T02:59:59Z');
      expect((await pedir(e.id).expect(200)).body.datos[0].fecha).toBe('2026-09-19');
      a.reloj.fijar('2026-09-20T03:00:00Z');
      expect((await pedir(e.id).expect(200)).body.datos[0].fecha).toBe('2026-09-20');
    });

    it('la fija usa el día de la semana argentino cerca de medianoche (sábado 23:30 local = domingo UTC)', async () => {
      const e = await nuevoEspacio();
      await crearFija(a, { espacioId: e.id, dia: 6, inicio: '10:00', fin: '11:00' });
      await crearFija(a, { espacioId: e.id, dia: 0, inicio: '12:00', fin: '13:00' });
      a.reloj.fijar('2026-09-19T23:30:00-03:00');
      const t = await grilla(e.id, '2026-09-19');
      expect(estados(t, 'fijo')).toEqual(['10:00']);
    });

    it('último día del mes: hoy 30/09, la grilla llega hasta el 06/10 y no al 07/10', async () => {
      const e = await nuevoEspacio();
      a.reloj.fijar('2026-09-30T12:00:00-03:00');
      await pedir(e.id, '2026-10-01').expect(200);
      const t = await grilla(e.id, '2026-10-06');
      expect(t[0].fecha).toBe('2026-10-06');
      esperarError(await pedir(e.id, '2026-10-07'), 422, 'FECHA_FUERA_DE_RANGO');
    });

    it('31/12 23:59 -03:00: hoy es 31/12, rango hasta el 06/01/2027; el id usa AAAAMMDD con año nuevo', async () => {
      const e = await nuevoEspacio();
      a.reloj.fijar('2026-12-31T23:59:59-03:00');
      expect((await pedir(e.id).expect(200)).body.datos[0].fecha).toBe('2026-12-31');
      const t = await grilla(e.id, '2027-01-01');
      expect(t[0].id).toBe(`tur-${e.id}-20270101-08`);
      await pedir(e.id, '2027-01-06').expect(200);
      esperarError(await pedir(e.id, '2027-01-07'), 422, 'FECHA_FUERA_DE_RANGO');
      a.reloj.fijar('2027-01-01T00:00:00-03:00');
      expect((await pedir(e.id).expect(200)).body.datos[0].fecha).toBe('2027-01-01');
      esperarError(await pedir(e.id, '2026-12-31'), 422, 'FECHA_FUERA_DE_RANGO');
    });

    it('1/1/2027 es viernes: una fija de dia 5 cubre, y la de dia 4 no', async () => {
      const e = await nuevoEspacio();
      await crearFija(a, { espacioId: e.id, dia: 5, inicio: '10:00', fin: '11:00' });
      await crearFija(a, { espacioId: e.id, dia: 4, inicio: '12:00', fin: '13:00' });
      a.reloj.fijar('2026-12-31T20:00:00-03:00');
      expect(estados(await grilla(e.id, '2027-01-01'), 'fijo')).toEqual(['10:00']);
    });

    it('29/02 de un año bisiesto (2028): válido en formato; fuera de rango se informa con 422, no 400', async () => {
      const e = await nuevoEspacio();
      esperarError(await pedir(e.id, '2028-02-29'), 422, 'FECHA_FUERA_DE_RANGO');
      a.reloj.fijar('2028-02-27T10:00:00-03:00');
      await pedir(e.id, '2028-02-29').expect(200);
      await pedir(e.id, '2028-03-01').expect(200);
      esperarError(await pedir(e.id, '2027-02-29'), 400, 'VALIDACION_FALLIDA');
    });

    it('un turno pasado de hoy sigue mostrando su estado real: reservado, fijo o mantenimiento', async () => {
      const e = await nuevoEspacio();
      a.reloj.fijar('2026-09-19T22:00:00-03:00');
      await crearReserva(a, { espacioId: e.id, usuarioId, fecha: '2026-09-19', inicio: '08:00', estado: 'cumplida' });
      await crearFija(a, { espacioId: e.id, dia: 6, inicio: '09:00', fin: '10:00' });
      await crearBloqueo(a, { espacioId: e.id, fecha: '2026-09-19', inicio: '10:00', fin: '11:00' });
      const t = await grilla(e.id, '2026-09-19');
      expect(t.slice(0, 4).map((x) => x.estado)).toEqual(['reservado', 'fijo', 'mantenimiento', 'libre']);
    });
  });

  describe('Entrada: fecha, paginación y parámetros', () => {
    it.each([
      '2026-13-01', '2026-00-10', '2026-09-00', '2026-09-31', '0000-01-01', ' 2026-09-21',
      '2026-09-21 ', '20260921', '2026/09/21', '٢٠٢٦-٠٩-٢١', 'null', 'undefined', '2026-09-2',
    ])('400 VALIDACION_FALLIDA con fecha «%s», con el sobre de error exacto', async (fecha) => {
      const e = await nuevoEspacio();
      const res = await a.http().get(`/espacios/${e.id}/turnos`).query({ fecha });
      esperarError(res, 400, 'VALIDACION_FALLIDA');
      expect(Object.keys(res.body)).toEqual(['error']);
      expect(Object.keys(res.body.error).sort()).toEqual(['codigo', 'mensaje']);
    });

    it('fecha repetida (?fecha=a&fecha=b) da 400, no se elige una', async () => {
      const e = await nuevoEspacio();
      esperarError(
        await a.http().get(`/espacios/${e.id}/turnos?fecha=2026-09-21&fecha=2026-09-22`),
        400,
        'VALIDACION_FALLIDA',
      );
    });

    it('parámetros desconocidos dan 400 (forbidNonWhitelisted)', async () => {
      const e = await nuevoEspacio();
      esperarError(await a.http().get(`/espacios/${e.id}/turnos?fecha=2026-09-21&estado=libre`), 400, 'VALIDACION_FALLIDA');
      esperarError(await a.http().get(`/espacios/${e.id}/turnos?soloLibres=true`), 400, 'VALIDACION_FALLIDA');
    });

    it.each([
      'pagina=0', 'pagina=-1', 'pagina=abc', 'pagina=1.5', 'porPagina=0', 'porPagina=-5',
      'porPagina=101', 'porPagina=abc', 'porPagina=',
    ])('400 con %s', async (q) => {
      const e = await nuevoEspacio();
      esperarError(await a.http().get(`/espacios/${e.id}/turnos?fecha=2026-09-21&${q}`), 400, 'VALIDACION_FALLIDA');
    });

    it('porPagina=100 y porPagina=16 devuelven los 16; porPagina=7 pagina 3 devuelve 2 turnos (15:00 a 23:00 → los últimos)', async () => {
      const e = await nuevoEspacio();
      const todos = await a.http().get(`/espacios/${e.id}/turnos?fecha=2026-09-21&porPagina=100`).expect(200);
      expect(todos.body.datos).toHaveLength(16);
      expect(todos.body.meta).toEqual({ total: 16, pagina: 1, porPagina: 100 });
      const p3 = await a.http().get(`/espacios/${e.id}/turnos?fecha=2026-09-21&porPagina=7&pagina=3`).expect(200);
      esperarContrato<Turno[]>(p3.body, 'Turno');
      expect(p3.body.datos.map((t: Turno) => t.inicio)).toEqual(['22:00', '23:00']);
      expect(p3.body.meta).toEqual({ total: 16, pagina: 3, porPagina: 7 });
    });

    it('páginas consecutivas no repiten ni saltean turnos', async () => {
      const e = await nuevoEspacio();
      const vistos: string[] = [];
      for (let p = 1; p <= 4; p++) {
        const r = await a.http().get(`/espacios/${e.id}/turnos?fecha=2026-09-21&porPagina=4&pagina=${p}`).expect(200);
        vistos.push(...r.body.datos.map((t: Turno) => t.inicio));
      }
      expect(vistos).toHaveLength(16);
      expect(vistos).toEqual(vistos.toSorted());
      expect(new Set(vistos).size).toBe(16);
    });

    it('pagina enorme da datos vacíos con total correcto', async () => {
      const e = await nuevoEspacio();
      const r = await a.http().get(`/espacios/${e.id}/turnos?fecha=2026-09-21&pagina=999999`).expect(200);
      expect(r.body).toEqual({ datos: [], meta: { total: 16, pagina: 999999, porPagina: 20 } });
    });
  });

  describe('Errores: sobre exacto, mensajes en castellano', () => {
    it('404 ESPACIO_NO_ENCONTRADO, ids raros', async () => {
      for (const id of ['esp-9999', 'ESP-01', 'esp-', 'dep-futbol5', 'x', 'esp-%20', 'esp-' + 'a'.repeat(300)]) {
        const res = await pedir(id, '2026-09-21');
        esperarError(res, 404, 'ESPACIO_NO_ENCONTRADO');
        expect(res.body.error.mensaje).toBe('No existe ese espacio.');
      }
    });

    it('422 FECHA_FUERA_DE_RANGO con el mensaje de la especificación', async () => {
      const e = await nuevoEspacio();
      const res = await pedir(e.id, '2026-10-30');
      esperarError(res, 422, 'FECHA_FUERA_DE_RANGO');
      expect(res.body.error.mensaje).toBe('Sólo se pueden ver y reservar los próximos siete días.');
    });

    it('espacio inexistente + fecha fuera de rango: 404 antes que 422 (M2-3)', async () => {
      esperarError(await pedir('esp-nada', '2030-01-01'), 404, 'ESPACIO_NO_ENCONTRADO');
    });

    it('espacio inactivo no se puede consultar aunque la fecha sea válida (M2-2)', async () => {
      const e = await nuevoEspacio({ activo: false });
      esperarError(await pedir(e.id, '2026-09-21'), 404, 'ESPACIO_NO_ENCONTRADO');
      esperarError(await pedir(e.id), 404, 'ESPACIO_NO_ENCONTRADO');
    });

    it('otros métodos sobre la ruta no existen y devuelven el sobre de error', async () => {
      const e = await nuevoEspacio();
      for (const m of ['post', 'put', 'patch', 'delete'] as const) {
        const res = await a.http()[m](`/espacios/${e.id}/turnos`).send({});
        expect([401, 404, 405]).toContain(res.status);
        expect(Object.keys(res.body)).toEqual(['error']);
        expect(Object.keys(res.body.error).sort()).toEqual(['codigo', 'mensaje']);
      }
    });
  });

  describe('Permisos: público (§1)', () => {
    it('anda sin token y con el token de un jugador, con la misma respuesta', async () => {
      const e = await nuevoEspacio();
      const u = await crearUsuario(a, 'jugador');
      const sin = await pedir(e.id, '2026-09-21').expect(200);
      const con = await pedir(e.id, '2026-09-21').set('Authorization', `Bearer ${u.token}`).expect(200);
      expect(con.body).toEqual(sin.body);
    });

    it('la grilla no filtra datos de otros: no aparece usuario, código QR ni cantidad de personas', async () => {
      const e = await nuevoEspacio();
      await crearReserva(a, { espacioId: e.id, usuarioId, fecha: '2026-09-21', inicio: '10:00' });
      const texto = JSON.stringify((await pedir(e.id, '2026-09-21').expect(200)).body);
      expect(texto).not.toContain(usuarioId);
      expect(texto).not.toContain('VGY-');
      expect(texto).not.toContain('cantidadPersonas');
    });
  });

  describe('Semillas de demo: casos feos del PRD (§8) contra el contrato', () => {
    let s: AppDePrueba;
    beforeAll(async () => {
      s = await crearApp();
      await sembrar(s.dataSource, s.reloj);
    });
    afterAll(() => s.cerrar());

    it('esp-02 los martes tiene la fija fij-07 de 21 a 22', async () => {
      const r = await s.http().get('/espacios/esp-02/turnos?fecha=2026-09-22').expect(200);
      const t = esperarContrato<Turno[]>(r.body, 'Turno');
      expect(t.find((x) => x.inicio === '21:00')).toMatchObject({ estado: 'fijo', reservaId: null });
      expect(t.find((x) => x.inicio === '22:00')?.estado).not.toBe('fijo');
    });

    it('todas las grillas de los 7 días de todos los espacios cumplen el contrato', async () => {
      const es = (await s.http().get('/espacios?porPagina=100').expect(200)).body.datos as { id: string }[];
      for (const e of es) {
        for (let d = 19; d <= 25; d++) {
          const r = await s.http().get(`/espacios/${e.id}/turnos?fecha=2026-09-${d}`).expect(200);
          expect(esperarContrato<Turno[]>(r.body, 'Turno')).toHaveLength(16);
        }
      }
    });

    it('pasado mañana: al menos una cancha tiene el día entero en mantenimiento por «Cancha anegada»', async () => {
      const es = (await s.http().get('/espacios?porPagina=100').expect(200)).body.datos as { id: string }[];
      let bloqueadas = 0;
      for (const e of es) {
        const t = esperarContrato<Turno[]>((await s.http().get(`/espacios/${e.id}/turnos?fecha=2026-09-21`)).body, 'Turno');
        if (t.every((x) => x.estado === 'mantenimiento' && x.motivoBloqueo === 'Cancha anegada')) bloqueadas++;
      }
      expect(bloqueadas).toBeGreaterThan(0);
    });

    it('mañana: existe un espacio sin ningún turno libre, mezclando reservado, fijo y mantenimiento', async () => {
      const es = (await s.http().get('/espacios?porPagina=100').expect(200)).body.datos as { id: string }[];
      const llenos: Turno[][] = [];
      for (const e of es) {
        const t = esperarContrato<Turno[]>((await s.http().get(`/espacios/${e.id}/turnos?fecha=2026-09-20`)).body, 'Turno');
        if (t.every((x) => x.estado !== 'libre')) llenos.push(t);
      }
      expect(llenos.length).toBeGreaterThan(0);
      const tipos = new Set(llenos[0].map((x) => x.estado));
      expect(tipos.has('reservado')).toBe(true);
      expect(tipos.has('fijo')).toBe(true);
      expect(tipos.has('mantenimiento')).toBe(true);
    });

    it('res-1180 aparece como reservado en su turno con ese reservaId', async () => {
      const es = (await s.http().get('/espacios?porPagina=100').expect(200)).body.datos as { id: string }[];
      let visto = false;
      for (const e of es) {
        for (let d = 19; d <= 25 && !visto; d++) {
          const t = (await s.http().get(`/espacios/${e.id}/turnos?fecha=2026-09-${d}`)).body.datos as Turno[];
          if (t.some((x) => x.reservaId === 'res-1180')) visto = true;
        }
      }
      expect(visto).toBe(true);
    });
  });

  describe('Idempotencia y lectura pura', () => {
    it('pedir la grilla no cambia nada: 5 pedidos en paralelo dan lo mismo', async () => {
      const e = await nuevoEspacio();
      await crearFija(a, { espacioId: e.id, dia: 1, inicio: '20:00', fin: '22:00' });
      const rs = await Promise.all(Array.from({ length: 5 }, () => pedir(e.id, '2026-09-21')));
      for (const r of rs) expect(r.body).toEqual(rs[0].body);
    });
  });
});
