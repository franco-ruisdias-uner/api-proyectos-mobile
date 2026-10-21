import { cajaAlrededor, cruzaElAntimeridianoOUnPolo, distanciaMetros, puntoEnPoligono } from './geo.js';

describe('AGENTS §5.5 — Distancia con haversine', () => {
  it('mismo punto = 0', () => {
    const p = { latitud: -32.2233, longitud: -58.1428 };
    expect(distanciaMetros(p, p)).toBe(0);
  });

  it('Colón → Molino Forclaz ≈ 5 km', () => {
    const colon = { latitud: -32.2233, longitud: -58.1428 };
    const molino = { latitud: -32.1904, longitud: -58.1932 };
    const d = distanciaMetros(colon, molino);
    expect(d).toBeGreaterThan(5500);
    expect(d).toBeLessThan(6500);
  });

  it('un grado de latitud ≈ 111 km', () => {
    const d = distanciaMetros({ latitud: 0, longitud: 0 }, { latitud: 1, longitud: 0 });
    expect(Math.round(d / 1000)).toBe(111);
  });
});

describe('AGENTS §5.5 — Caja para prefiltrar en la base', () => {
  it('contiene los puntos dentro del radio', () => {
    const centro = { latitud: -32.2233, longitud: -58.1428 };
    const caja = cajaAlrededor(centro, 1000);
    expect(caja.latitudMin).toBeLessThan(centro.latitud);
    expect(caja.latitudMax).toBeGreaterThan(centro.latitud);
    expect(caja.longitudMin).toBeLessThan(centro.longitud);
    expect(caja.longitudMax).toBeGreaterThan(centro.longitud);
    const alBorde = { latitud: centro.latitud + 0.0089, longitud: centro.longitud };
    expect(distanciaMetros(centro, alBorde)).toBeLessThan(1000);
    expect(alBorde.latitud).toBeLessThanOrEqual(caja.latitudMax);
  });
});

describe('AGENTS §5.5 — Punto dentro de polígono', () => {
  const cuadrado = [
    { latitud: 0, longitud: 0 },
    { latitud: 0, longitud: 1 },
    { latitud: 1, longitud: 1 },
    { latitud: 1, longitud: 0 },
  ];
  it.each([
    [0.5, 0.5, true],
    [1.5, 0.5, false],
    [-0.1, 0.5, false],
    [0.99, 0.01, true],
  ])('(%d, %d) → %s', (lat, lng, dentro) => {
    expect(puntoEnPoligono({ latitud: lat, longitud: lng }, cuadrado)).toBe(dentro);
  });
});

describe('AGENTS §5.5 — Prefiltro por caja cerca del antimeridiano y de los polos', () => {
  it.each([
    [{ latitud: -32.2236, longitud: -58.1427 }, 5000, false],
    [{ latitud: 0, longitud: 179.99 }, 5000, true],
    [{ latitud: 0, longitud: -179.99 }, 5000, true],
    [{ latitud: 89.9, longitud: 0 }, 30000, true],
  ])('%j con %i m → cruza: %s', (centro, radio, cruza) => {
    expect(cruzaElAntimeridianoOUnPolo(cajaAlrededor(centro, radio))).toBe(cruza);
  });
});
