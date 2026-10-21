import { puntoEnPoligono } from './polygon.js';

const cuadrado = [
  { latitud: 0, longitud: 0 },
  { latitud: 0, longitud: 10 },
  { latitud: 10, longitud: 10 },
  { latitud: 10, longitud: 0 },
];

const formaL = [
  { latitud: 0, longitud: 0 },
  { latitud: 0, longitud: 10 },
  { latitud: 5, longitud: 10 },
  { latitud: 5, longitud: 5 },
  { latitud: 10, longitud: 5 },
  { latitud: 10, longitud: 0 },
];

describe('Punto dentro de un polígono (zonas)', () => {
  it.each([
    ['centro del cuadrado', cuadrado, 5, 5, true],
    ['cerca de una esquina, adentro', cuadrado, 0.1, 0.1, true],
    ['afuera al norte', cuadrado, 10.1, 5, false],
    ['afuera al este', cuadrado, 5, 10.1, false],
    ['afuera al sur-oeste', cuadrado, -1, -1, false],
    ['dentro del brazo de la L', formaL, 2, 8, true],
    ['dentro del otro brazo de la L', formaL, 8, 2, true],
    ['en el hueco de la L (cóncavo)', formaL, 8, 8, false],
    ['sobre un borde cuenta como adentro', cuadrado, 5, 0, true],
    ['sobre un vértice cuenta como adentro', cuadrado, 10, 10, true],
  ])('%s', (_nombre, poligono, latitud, longitud, esperado) => {
    expect(puntoEnPoligono({ latitud, longitud }, poligono)).toBe(esperado);
  });

  it('un polígono con menos de tres puntos no contiene nada', () => {
    expect(
      puntoEnPoligono({ latitud: 0, longitud: 0 }, cuadrado.slice(0, 2)),
    ).toBe(false);
    expect(puntoEnPoligono({ latitud: 0, longitud: 0 }, [])).toBe(false);
  });
});
