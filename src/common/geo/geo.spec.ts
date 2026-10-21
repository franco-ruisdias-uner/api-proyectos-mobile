import { cajaAlrededor, distanciaMetros, puntoEnPoligono } from './geo.js';

const plaza = { latitud: -32.4846, longitud: -58.2321 };

describe('AGENTS §5.5 — Distancias con haversine', () => {
  it('distancia a sí mismo es 0', () => {
    expect(distanciaMetros(plaza, plaza)).toBe(0);
  });

  it('una cuadra (~0,001° de latitud) son ~111 m', () => {
    const otro = { latitud: plaza.latitud + 0.001, longitud: plaza.longitud };
    expect(distanciaMetros(plaza, otro)).toBeCloseTo(111.2, 0);
  });

  it('Concepción del Uruguay → Paraná, unos 240 km en línea recta', () => {
    const parana = { latitud: -31.7319, longitud: -60.5238 };
    const d = distanciaMetros(plaza, parana);
    expect(d).toBeGreaterThan(220_000);
    expect(d).toBeLessThan(250_000);
  });

  it('la caja contiene a todo punto dentro del radio', () => {
    const caja = cajaAlrededor(plaza, 1000);
    for (const angulo of [0, 45, 90, 135, 180, 225, 270, 315]) {
      const rad = (angulo * Math.PI) / 180;
      const p = {
        latitud: plaza.latitud + (Math.cos(rad) * 999) / 111_320,
        longitud:
          plaza.longitud +
          (Math.sin(rad) * 999) / (111_320 * Math.cos((plaza.latitud * Math.PI) / 180)),
      };
      expect(distanciaMetros(plaza, p)).toBeLessThanOrEqual(1000);
      expect(p.latitud).toBeGreaterThanOrEqual(caja.latitudMin);
      expect(p.latitud).toBeLessThanOrEqual(caja.latitudMax);
      expect(p.longitud).toBeGreaterThanOrEqual(caja.longitudMin);
      expect(p.longitud).toBeLessThanOrEqual(caja.longitudMax);
    }
  });
});

describe('AGENTS §5.5 — Punto dentro de un polígono', () => {
  const cuadrado = [
    { latitud: 0, longitud: 0 },
    { latitud: 0, longitud: 10 },
    { latitud: 10, longitud: 10 },
    { latitud: 10, longitud: 0 },
  ];
  it.each([
    [5, 5, true],
    [0.1, 9.9, true],
    [-1, 5, false],
    [5, 11, false],
    [20, 20, false],
  ])('(%d, %d) adentro = %s', (lat, lon, esperado) => {
    expect(puntoEnPoligono({ latitud: lat, longitud: lon }, cuadrado)).toBe(esperado);
  });
});
