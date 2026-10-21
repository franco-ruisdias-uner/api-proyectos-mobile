import {
  armarGrilla,
  type BloqueoDeGrilla,
  type FijaDeGrilla,
  type ReservaDeGrilla,
} from './grid.js';

const espacio = { id: 'esp-02', precioPorHora: 8000 };
// 2026-09-22 es martes, 2026-09-23 miércoles.
const MARTES = '2026-09-22';

const fija = (p: Partial<FijaDeGrilla> = {}): FijaDeGrilla => ({
  titular: 'Grupo de los martes',
  dia: 2,
  inicio: '21:00',
  fin: '22:00',
  desde: '2026-01-01',
  hasta: null,
  activa: true,
  ...p,
});
const reserva = (p: Partial<ReservaDeGrilla> = {}): ReservaDeGrilla => ({
  id: 'res-1',
  inicio: '21:00',
  estado: 'confirmada',
  ...p,
});
const bloqueo = (p: Partial<BloqueoDeGrilla> = {}): BloqueoDeGrilla => ({
  inicio: null,
  fin: null,
  motivo: 'Cancha anegada',
  ...p,
});
const turno = (
  fecha: string,
  hora: string,
  fijas = [fija()],
  r = [] as ReservaDeGrilla[],
  b = [] as BloqueoDeGrilla[],
) => armarGrilla(espacio, fecha, r, fijas, b).find((t) => t.inicio === hora)!;

describe('PRD §2 / R1 — Un día tiene 16 turnos de una hora', () => {
  const g = armarGrilla(espacio, MARTES, [], [], []);
  it('de 08:00 a 24:00, por inicio', () => {
    expect(g).toHaveLength(16);
    expect(g[0]).toMatchObject({ inicio: '08:00', fin: '09:00' });
    expect(g[15]).toMatchObject({ inicio: '23:00', fin: '24:00' });
    const inicios = g.map((t) => t.inicio);
    expect(inicios).toEqual(inicios.toSorted());
  });
  it('día sin nada: todo libre, con id, espacio, fecha y precio actual (R5)', () => {
    expect(g.every((t) => t.estado === 'libre')).toBe(true);
    expect(g[11]).toEqual({
      id: 'tur-esp-02-20260922-19',
      espacioId: 'esp-02',
      fecha: MARTES,
      inicio: '19:00',
      fin: '20:00',
      estado: 'libre',
      reservaId: null,
      motivoBloqueo: null,
      precio: 8000,
    });
  });
});

describe('PRD §2 / R3 — Reservas fijas', () => {
  it('cubre el turno de su día y horario', () => {
    expect(turno(MARTES, '21:00')).toMatchObject({ estado: 'fijo' });
    expect(turno(MARTES, '20:00').estado).toBe('libre');
    expect(turno(MARTES, '22:00').estado).toBe('libre');
  });
  it('martes vs. miércoles: el día de la semana se toma de la fecha', () => {
    expect(turno('2026-09-23', '21:00').estado).toBe('libre');
  });
  it('una fija de dos horas cubre dos turnos', () => {
    const f = [fija({ inicio: '20:00', fin: '22:00' })];
    expect(turno(MARTES, '20:00', f).estado).toBe('fijo');
    expect(turno(MARTES, '21:00', f).estado).toBe('fijo');
    expect(turno(MARTES, '22:00', f).estado).toBe('libre');
  });
  it('una fija que termina a las 24:00 cubre el último turno', () => {
    const f = [fija({ inicio: '23:00', fin: '24:00' })];
    expect(turno(MARTES, '23:00', f).estado).toBe('fijo');
  });
  it('vigencia: desde y hasta incluidos', () => {
    const f = [fija({ desde: MARTES, hasta: MARTES })];
    expect(turno(MARTES, '21:00', f).estado).toBe('fijo');
    expect(turno('2026-09-29', '21:00', f).estado).toBe('libre');
    expect(turno(MARTES, '21:00', [fija({ desde: '2026-09-23' })]).estado).toBe(
      'libre',
    );
  });
  it('una fija con hasta ayer ya no cubre', () => {
    expect(turno(MARTES, '21:00', [fija({ hasta: '2026-09-21' })]).estado).toBe(
      'libre',
    );
  });
  it('una fija inactiva no cubre', () => {
    expect(turno(MARTES, '21:00', [fija({ activa: false })]).estado).toBe(
      'libre',
    );
  });
  it('domingo es 0', () => {
    expect(
      turno('2026-09-20', '10:00', [
        fija({ dia: 0, inicio: '10:00', fin: '11:00' }),
      ]).estado,
    ).toBe('fijo');
  });
});

describe('PRD §6 / R4 — Bloqueos', () => {
  it('sin horas cubren el día entero, con su motivo', () => {
    const g = armarGrilla(espacio, MARTES, [], [], [bloqueo()]);
    expect(g.every((t) => t.estado === 'mantenimiento')).toBe(true);
    expect(g.every((t) => t.motivoBloqueo === 'Cancha anegada')).toBe(true);
  });
  it('parcial: sólo [inicio, fin)', () => {
    const b = [bloqueo({ inicio: '10:00', fin: '12:00', motivo: 'Riego' })];
    expect(turno(MARTES, '09:00', [], [], b).estado).toBe('libre');
    expect(turno(MARTES, '10:00', [], [], b)).toMatchObject({
      estado: 'mantenimiento',
      motivoBloqueo: 'Riego',
    });
    expect(turno(MARTES, '11:00', [], [], b).estado).toBe('mantenimiento');
    expect(turno(MARTES, '12:00', [], [], b).estado).toBe('libre');
  });
});

describe('R2 — Prioridad: mantenimiento > fijo > reservado > libre', () => {
  it('reservado: confirmada, cumplida y ausente ocupan el turno; la cancelada no', () => {
    for (const estado of ['confirmada', 'cumplida', 'ausente'] as const) {
      expect(
        turno(MARTES, '19:00', [], [reserva({ inicio: '19:00', estado })]),
      ).toMatchObject({ estado: 'reservado', reservaId: 'res-1' });
    }
    expect(
      turno(
        MARTES,
        '19:00',
        [],
        [reserva({ inicio: '19:00', estado: 'cancelada' })],
      ),
    ).toMatchObject({ estado: 'libre', reservaId: null });
  });
  it('fija y reserva en el mismo turno: gana la fija, sin reservaId (R5)', () => {
    expect(turno(MARTES, '21:00', [fija()], [reserva()])).toMatchObject({
      estado: 'fijo',
      reservaId: null,
    });
  });
  it('bloqueo encima de una fija: gana el bloqueo', () => {
    expect(
      turno(
        MARTES,
        '21:00',
        [fija()],
        [reserva()],
        [bloqueo({ inicio: '21:00', fin: '22:00' })],
      ),
    ).toMatchObject({
      estado: 'mantenimiento',
      reservaId: null,
      motivoBloqueo: 'Cancha anegada',
    });
  });
  it('motivoBloqueo sólo en mantenimiento', () => {
    const g = armarGrilla(
      espacio,
      MARTES,
      [reserva()],
      [fija({ inicio: '10:00', fin: '11:00' })],
      [bloqueo({ inicio: '12:00', fin: '13:00' })],
    );
    for (const t of g)
      expect(t.motivoBloqueo !== null).toBe(t.estado === 'mantenimiento');
  });
  it('los turnos pasados se muestran con su estado: no hay lógica de "ahora" en la grilla', () => {
    expect(
      armarGrilla(espacio, '2020-01-01', [], [], []).every(
        (t) => t.estado === 'libre',
      ),
    ).toBe(true);
  });
});
