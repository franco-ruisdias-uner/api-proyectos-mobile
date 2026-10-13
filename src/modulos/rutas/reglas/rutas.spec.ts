import {
  calcularAvance,
  esBimestreValido,
  faltantesDelCierre,
  idDeRuta,
  mensajeFaltantes,
  mensajeRutaCerrada,
  primerRepetido,
} from './rutas.js';

describe('ESPECIFICACION §2 — Ids y bimestre de las rutas (D9)', () => {
  it('el id de la ruta es rut-<numero>-<bimestre>', () => {
    expect(idDeRuta('07', '2026-05')).toBe('rut-07-2026-05');
  });

  it.each([
    ['2026-01', true],
    ['2026-05', true],
    ['2026-06', true],
    ['2026-00', false],
    ['2026-07', false],
    ['2026-12', false],
    ['2026-5', false],
    ['26-05', false],
    ['2026-05 ', false],
    ['mayo', false],
    ['', false],
  ])('bimestre %j → %s', (bimestre, valido) => {
    expect(esBimestreValido(bimestre)).toBe(valido);
  });
});

describe('ESPECIFICACION R22 — Mensaje de ruta cerrada', () => {
  it('dice DD/MM en hora argentina', () => {
    expect(mensajeRutaCerrada(new Date('2026-09-14T20:02:00Z'))).toBe(
      'Esa ruta fue cerrada el 14/09.',
    );
  });

  it('cerca de la medianoche cuenta el día argentino, no el UTC', () => {
    // 01:30 UTC del 15 es las 22:30 del 14 en Chajarí.
    expect(mensajeRutaCerrada(new Date('2026-09-15T01:30:00Z'))).toBe(
      'Esa ruta fue cerrada el 14/09.',
    );
    // 02:59 UTC del 1/1 es 23:59 del 31/12.
    expect(mensajeRutaCerrada(new Date('2027-01-01T02:59:00Z'))).toBe(
      'Esa ruta fue cerrada el 31/12.',
    );
  });
});

describe('ESPECIFICACION R5 — Suministros repetidos', () => {
  it('devuelve el primero que aparece dos veces', () => {
    expect(primerRepetido(['a', 'b', 'c', 'b', 'a'])).toBe('b');
  });
  it('sin repetidos, undefined', () => {
    expect(primerRepetido(['a', 'b'])).toBeUndefined();
    expect(primerRepetido([])).toBeUndefined();
  });
});

describe('ESPECIFICACION R10 — Avance de la ruta', () => {
  it('pendientes = suministros - leidos - conNovedad', () => {
    expect(
      calcularAvance('rut-07-2026-05', {
        suministros: 200,
        leidos: 120,
        conNovedad: 5,
        fueraDeRango: 3,
      }),
    ).toEqual({
      rutaId: 'rut-07-2026-05',
      suministros: 200,
      leidos: 120,
      conNovedad: 5,
      pendientes: 75,
      fueraDeRango: 3,
    });
  });

  it('nunca da pendientes negativos', () => {
    expect(
      calcularAvance('rut-1-2026-05', {
        suministros: 2,
        leidos: 2,
        conNovedad: 1,
        fueraDeRango: 0,
      }).pendientes,
    ).toBe(0);
  });
});

describe('R20 — Lo que le falta al servidor para cerrar', () => {
  it('lo que el teléfono dice y el servidor no tiene, sin repetidos', () => {
    expect(
      faltantesDelCierre(
        ['lec-a', 'lec-b', 'lec-b', 'lec-c'],
        new Set(['lec-a']),
      ),
    ).toEqual(['lec-b', 'lec-c']);
  });

  it('si el servidor tiene todo, no falta nada', () => {
    expect(faltantesDelCierre(['lec-a'], new Set(['lec-a', 'lec-z']))).toEqual(
      [],
    );
    expect(faltantesDelCierre([], new Set())).toEqual([]);
  });

  it.each([
    [
      3,
      1,
      'Faltan subir 3 lecturas y 1 novedad. Esperá a tener señal y probá de nuevo.',
    ],
    [1, 0, 'Falta subir 1 lectura. Esperá a tener señal y probá de nuevo.'],
    [0, 2, 'Faltan subir 2 novedades. Esperá a tener señal y probá de nuevo.'],
    [
      1,
      1,
      'Faltan subir 1 lectura y 1 novedad. Esperá a tener señal y probá de nuevo.',
    ],
  ])('mensaje con %i lecturas y %i novedades', (l, n, esperado) => {
    expect(mensajeFaltantes(l, n)).toBe(esperado);
  });
});
