import { describe, expect, it } from 'vitest';
import { cajaAlrededorDe, distanciaEnMetros } from './distancia.js';

const ROCAMORA = { latitud: -33.0089, longitud: -58.5142 };

describe('AGENTS §5.5 — distancia con haversine', () => {
  it('un punto está a cero metros de sí mismo', () => {
    expect(distanciaEnMetros(ROCAMORA, ROCAMORA)).toBe(0);
  });

  it.each([
    // un grado de latitud son ~111,2 km
    [{ latitud: -32.0089, longitud: -58.5142 }, 111_195, 50],
    // ~11 m hacia el norte
    [{ latitud: -33.0088, longitud: -58.5142 }, 11.1, 0.2],
    // Buenos Aires – Gualeguaychú, en línea recta ~ 200 km
    [{ latitud: -34.6037, longitud: -58.3816 }, 178_000, 6_000],
  ])('distancia a %j', (otro, esperada, tolerancia) => {
    expect(
      Math.abs(distanciaEnMetros(ROCAMORA, otro) - esperada),
    ).toBeLessThanOrEqual(tolerancia);
  });

  it('es simétrica', () => {
    const otro = { latitud: -33.02, longitud: -58.49 };
    expect(distanciaEnMetros(ROCAMORA, otro)).toBeCloseTo(
      distanciaEnMetros(otro, ROCAMORA),
      6,
    );
  });
});

describe('AGENTS §5.5 — prefiltro por caja', () => {
  it('la caja contiene todos los puntos dentro del radio', () => {
    const caja = cajaAlrededorDe(ROCAMORA, 50);
    for (const grados of [0, 45, 90, 135, 180, 225, 270, 315]) {
      const rad = (grados * Math.PI) / 180;
      // punto a 49 m en esa dirección (aprox. plana, alcanza para 49 m)
      const p = {
        latitud: ROCAMORA.latitud + (49 * Math.cos(rad)) / 111_195,
        longitud:
          ROCAMORA.longitud +
          (49 * Math.sin(rad)) /
            (111_195 * Math.cos((ROCAMORA.latitud * Math.PI) / 180)),
      };
      expect(distanciaEnMetros(ROCAMORA, p)).toBeLessThan(50);
      expect(p.latitud).toBeGreaterThanOrEqual(caja.sur);
      expect(p.latitud).toBeLessThanOrEqual(caja.norte);
      expect(p.longitud).toBeGreaterThanOrEqual(caja.oeste);
      expect(p.longitud).toBeLessThanOrEqual(caja.este);
    }
  });

  it('no es exagerada: ronda el doble del radio de lado', () => {
    const caja = cajaAlrededorDe(ROCAMORA, 1000);
    const alto = distanciaEnMetros(
      { latitud: caja.sur, longitud: ROCAMORA.longitud },
      { latitud: caja.norte, longitud: ROCAMORA.longitud },
    );
    expect(alto).toBeGreaterThanOrEqual(2000);
    expect(alto).toBeLessThan(2100);
  });
});
