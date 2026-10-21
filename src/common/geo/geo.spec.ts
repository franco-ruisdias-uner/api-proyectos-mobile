import { cajaAlrededor, distanciaMetros, puntoEnPoligono } from './geo.js';

const alamedaYUrquiza = { latitud: -31.7333, longitud: -60.5241 };

describe('AGENTS §5.5 — distancias y zonas en TypeScript', () => {
  it('la distancia a sí mismo es cero', () => {
    expect(distanciaMetros(alamedaYUrquiza, alamedaYUrquiza)).toBe(0);
  });

  it('una cuadra de Paraná (~0.001° de latitud) son unos 111 m', () => {
    const d = distanciaMetros(alamedaYUrquiza, { latitud: -31.7343, longitud: -60.5241 });
    expect(d).toBeGreaterThan(110);
    expect(d).toBeLessThan(112);
  });

  it('Paraná–Santa Fe son unos 25 km', () => {
    const d = distanciaMetros(alamedaYUrquiza, { latitud: -31.6333, longitud: -60.7 });
    expect(d).toBeGreaterThan(19_000);
    expect(d).toBeLessThan(21_000);
  });

  it('es simétrica', () => {
    const b = { latitud: -31.74, longitud: -60.51 };
    expect(distanciaMetros(alamedaYUrquiza, b)).toBeCloseTo(distanciaMetros(b, alamedaYUrquiza));
  });

  it('la caja contiene todo punto a menos del radio', () => {
    const caja = cajaAlrededor(alamedaYUrquiza, 500);
    const cerca = { latitud: -31.7333 + 0.0044, longitud: -60.5241 };
    expect(distanciaMetros(alamedaYUrquiza, cerca)).toBeLessThan(500);
    expect(cerca.latitud).toBeLessThanOrEqual(caja.latitudMaxima);
    const alEste = { latitud: -31.7333, longitud: -60.5241 + 0.0052 };
    expect(distanciaMetros(alamedaYUrquiza, alEste)).toBeLessThan(500);
    expect(alEste.longitud).toBeLessThanOrEqual(caja.longitudMaxima);
    expect(caja.latitudMinima).toBeLessThan(caja.latitudMaxima);
    expect(caja.longitudMinima).toBeLessThan(caja.longitudMaxima);
  });

  const cuadrado = [
    { latitud: -31.73, longitud: -60.53 },
    { latitud: -31.73, longitud: -60.52 },
    { latitud: -31.74, longitud: -60.52 },
    { latitud: -31.74, longitud: -60.53 },
  ];

  it.each([
    [{ latitud: -31.735, longitud: -60.525 }, true],
    [{ latitud: -31.745, longitud: -60.525 }, false],
    [{ latitud: -31.735, longitud: -60.515 }, false],
  ])('punto en polígono %j → %s', (punto, esperado) => {
    expect(puntoEnPoligono(punto, cuadrado)).toBe(esperado);
  });

  it('un polígono con menos de tres puntos no contiene nada', () => {
    expect(puntoEnPoligono(alamedaYUrquiza, cuadrado.slice(0, 2))).toBe(false);
  });
});
