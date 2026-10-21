import {
  coincideBusqueda,
  type FilaLugar,
  ordenarLugares,
  patronLike,
  problemaDeFiltros,
  terminoDeBusqueda,
} from './listing.js';

const PLAZA = { latitud: -32.2236, longitud: -58.1427 };
const fila = (id: string, nombre: string, latitud: number, longitud: number): FilaLugar => ({
  id,
  nombreBusqueda: nombre,
  latitud,
  longitud,
});

describe('R5 — Filtros de cercanía que no van solos', () => {
  it.each([
    [{}, null],
    [{ ...PLAZA }, null],
    [{ ...PLAZA, orden: 'distancia' as const, radioMetros: 100 }, null],
    [{ orden: 'nombre' as const }, null],
    [{ latitud: -32 }, 'Mandá la latitud y la longitud juntas.'],
    [{ longitud: -58 }, 'Mandá la latitud y la longitud juntas.'],
    [
      { orden: 'distancia' as const },
      'Para ordenar por distancia hace falta tu ubicación (latitud y longitud).',
    ],
    [{ radioMetros: 500 }, 'Para buscar cerca hace falta tu ubicación (latitud y longitud).'],
    [{ latitud: 0, longitud: 0, orden: 'distancia' as const }, null],
  ])('%j → %s', (filtros, problema) => {
    expect(problemaDeFiltros(filtros)).toBe(problema);
  });
});

describe('AGENTS §5.5 — Búsqueda por nombre portable', () => {
  it.each([
    ['Colón', 'colon'],
    ['  TERMAS   de ', 'termas de'],
    ['', ''],
    ['   ', ''],
    ['molino\u0000', 'molino'],
    ['a\u0000b\tc', 'a b c'],
  ])('término «%j» → «%s»', (q, termino) => {
    expect(terminoDeBusqueda(q)).toBe(termino);
  });

  it.each([
    ['colon', '%colon%'],
    ['50%', '%50%%'],
    ['a_b', '%a%b%'],
    ['a\\b', '%a%b%'],
  ])('patrón LIKE de «%s»: los comodines no filtran de menos', (termino, patron) => {
    expect(patronLike(termino)).toBe(patron);
  });

  it.each([
    ['termas de colon', 'colon', true],
    ['termas de colon', '', true],
    ['a%b', 'a%b', true],
    ['axxb', 'a%b', false],
    ['axb', 'a_b', false],
  ])('«%s» contiene «%s»: %s', (nombre, termino, esperado) => {
    expect(coincideBusqueda(nombre, termino)).toBe(esperado);
  });
});

describe('PRD §2 y AGENTS §4.2 — Orden y radio', () => {
  const filas = [
    fila('lug-palmar', 'parque nacional el palmar', -31.8667, -58.2833),
    fila('lug-termas', 'termas de colon', -32.2135, -58.1455),
    fila('lug-molino', 'molino forclaz', -32.1904, -58.1932),
    fila('lug-casa', 'casa de la cultura', -32.2236, -58.1427),
  ];

  it('por nombre, desempate por id', () => {
    const empate = [...filas, fila('lug-a', 'molino forclaz', 0, 0)];
    expect(ordenarLugares(empate, { orden: 'nombre' }).map((f) => f.id)).toEqual([
      'lug-casa',
      'lug-a',
      'lug-molino',
      'lug-palmar',
      'lug-termas',
    ]);
  });

  it('por distancia al punto', () => {
    expect(ordenarLugares(filas, { orden: 'distancia', punto: PLAZA }).map((f) => f.id)).toEqual([
      'lug-casa',
      'lug-termas',
      'lug-molino',
      'lug-palmar',
    ]);
  });

  it('por distancia, empate por nombre y después por id', () => {
    const p = { latitud: -32, longitud: -58 };
    const empate = [
      fila('lug-c', 'zeta', -32, -58),
      fila('lug-b', 'alfa', -32, -58),
      fila('lug-a', 'alfa', -32, -58),
    ];
    expect(ordenarLugares(empate, { orden: 'distancia', punto: p }).map((f) => f.id)).toEqual([
      'lug-a',
      'lug-b',
      'lug-c',
    ]);
  });

  it('radio: sólo los que están a esa distancia o menos', () => {
    expect(
      ordenarLugares(filas, { orden: 'nombre', punto: PLAZA, radioMetros: 2000 }).map((f) => f.id),
    ).toEqual(['lug-casa', 'lug-termas']);
  });

  it('radio en el borde: un lugar a ~1000,8 m entra con 1001 m y no con 1000 m', () => {
    const lejos = fila('lug-x', 'x', -32.2236 + 0.009, -58.1427);
    expect(ordenarLugares([lejos], { orden: 'nombre', punto: PLAZA, radioMetros: 1001 })).toHaveLength(1);
    expect(ordenarLugares([lejos], { orden: 'nombre', punto: PLAZA, radioMetros: 1000 })).toHaveLength(0);
  });
});
