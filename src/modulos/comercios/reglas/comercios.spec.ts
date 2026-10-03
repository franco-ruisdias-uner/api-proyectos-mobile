import type { Horario } from '../../../../contrato/tipos.js';
import {
  codigoQrDe,
  comercioIdDeQr,
  horariosVisibles,
  ordenarComercios,
  type ComercioOrdenable,
} from './comercios.js';

const c = (id: string, extra: Partial<ComercioOrdenable> = {}): ComercioOrdenable => ({
  id,
  nombreBusqueda: id,
  puntaje: 0,
  latitud: -32.48,
  longitud: -58.23,
  ...extra,
});

describe('PRD §1 — Código QR del comercio (D13)', () => {
  it('el código es CCU:<comercioId>', () => {
    expect(codigoQrDe('com-118')).toBe('CCU:com-118');
  });

  it.each([
    ['CCU:com-118', 'com-118'],
    ['CCU:com-abc_DEF-9', 'com-abc_DEF-9'],
  ])('%s se resuelve', (codigo, id) => {
    expect(comercioIdDeQr(codigo)).toBe(id);
  });

  it.each([
    [''],
    ['com-118'],
    ['CCU:'],
    ['CCU:rub-118'],
    ['ccu:com-118'],
    ['CCU:com-118 '],
    ['CCU:com-1/../x'],
    ['https://ejemplo.ar/com-118'],
    ['CCU:com-' + 'a'.repeat(37)],
  ])('«%s» no se reconoce', (codigo) => {
    expect(comercioIdDeQr(codigo)).toBeNull();
  });
});

describe('PRD §1 — Orden de los comercios', () => {
  it('por nombre, desempata por id', () => {
    const lista = [
      c('com-3', { nombreBusqueda: 'b' }),
      c('com-2', { nombreBusqueda: 'a' }),
      c('com-1', { nombreBusqueda: 'b' }),
    ];
    expect(ordenarComercios(lista, 'nombre', null).map((x) => x.id)).toEqual([
      'com-2',
      'com-1',
      'com-3',
    ]);
  });

  it('por puntaje de mayor a menor, desempata por nombre y después por id', () => {
    const lista = [
      c('com-1', { puntaje: 4, nombreBusqueda: 'z' }),
      c('com-2', { puntaje: 5, nombreBusqueda: 'y' }),
      c('com-3', { puntaje: 4, nombreBusqueda: 'a' }),
      c('com-4', { puntaje: 4, nombreBusqueda: 'a' }),
    ];
    expect(ordenarComercios(lista, 'puntaje', null).map((x) => x.id)).toEqual([
      'com-2',
      'com-3',
      'com-4',
      'com-1',
    ]);
  });

  it('por distancia, de más cerca a más lejos', () => {
    const centro = { latitud: -32.48, longitud: -58.23 };
    const lista = [
      c('com-1', { latitud: -32.5 }),
      c('com-2', { latitud: -32.481 }),
      c('com-3', { latitud: -32.49 }),
    ];
    expect(ordenarComercios(lista, 'distancia', centro).map((x) => x.id)).toEqual([
      'com-2',
      'com-3',
      'com-1',
    ]);
  });

  it('con distancias iguales, desempata por nombre y por id', () => {
    const centro = { latitud: -32.48, longitud: -58.23 };
    const lista = [c('com-2', { nombreBusqueda: 'a' }), c('com-1', { nombreBusqueda: 'a' })];
    expect(ordenarComercios(lista, 'distancia', centro).map((x) => x.id)).toEqual([
      'com-1',
      'com-2',
    ]);
  });

  it('no modifica la lista original', () => {
    const lista = [c('com-2'), c('com-1')];
    ordenarComercios(lista, 'nombre', null);
    expect(lista.map((x) => x.id)).toEqual(['com-2', 'com-1']);
  });
});

describe('D2 — Comercio cerrado por vacaciones: horarios vacíos mientras dura', () => {
  const horarios: Horario[] = [{ dia: 1, abre: '08:00', cierra: '12:00' }];

  it.each([
    ['sin fecha de vuelta', null, '2026-10-03', true],
    ['el último día de cierre todavía está cerrado', '2026-10-03', '2026-10-03', false],
    ['un día antes de la vuelta', '2026-10-04', '2026-10-03', false],
    ['al día siguiente ya vuelve', '2026-10-02', '2026-10-03', true],
    ['cruzando el fin de año', '2027-01-05', '2026-12-31', false],
    ['cruzando el fin de año, ya pasó', '2026-12-31', '2027-01-01', true],
  ])('%s', (_caso, cerradoHasta, hoy, vuelven) => {
    expect(horariosVisibles(horarios, cerradoHasta, hoy)).toEqual(vuelven ? horarios : []);
  });
});
