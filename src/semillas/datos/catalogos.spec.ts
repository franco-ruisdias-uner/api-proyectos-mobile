import { puntoEnPoligono } from '../../comun/geo/poligono.js';
import {
  CAJA_DE_LAS_ZONAS as caja,
  CUADRILLAS_DEMO,
  TIPOS_DEMO,
  ZONAS_DEMO,
} from './catalogos.js';

/** Íconos de Ionicons que usan las semillas (verificados a mano contra ionic.io/ionicons). */
const IONICONS = new Set([
  'construct',
  'bulb',
  'trash',
  'leaf',
  'water',
  'stop-circle',
  'walk',
  'ellipsis-horizontal-circle',
]);

describe('ESPECIFICACION §8 — Semillas de los catálogos', () => {
  it('son los ocho tipos del PRD, con ícono de Ionicons y color hexadecimal', () => {
    expect(TIPOS_DEMO).toHaveLength(8);
    expect(TIPOS_DEMO.map((t) => t.id)).toContain('tip-bache');
    for (const t of TIPOS_DEMO) {
      expect(IONICONS.has(t.icono), t.icono).toBe(true);
      expect(t.color).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it('R5 — las cuatro zonas cubren el rectángulo de la ciudad sin superponerse ni dejar huecos', () => {
    expect(ZONAS_DEMO).toHaveLength(4);
    const pasos = 60;
    for (let i = 1; i < pasos; i++) {
      for (let j = 1; j < pasos; j++) {
        // Un punto "torcido" para no caer justo sobre una diagonal compartida.
        const latitud =
          caja.sur + ((caja.norte - caja.sur) * (i + 0.137)) / pasos;
        const longitud =
          caja.oeste + ((caja.este - caja.oeste) * (j + 0.291)) / pasos;
        const en = ZONAS_DEMO.filter((z) =>
          puntoEnPoligono({ latitud, longitud }, z.limite),
        );
        expect(en.length, `${latitud}, ${longitud}`).toBe(1);
      }
    }
  });

  it('el ejemplo del PRD (Rocamora 1240) cae en la zona norte', () => {
    const p = { latitud: -33.0089, longitud: -58.5142 };
    const en = ZONAS_DEMO.filter((z) => puntoEnPoligono(p, z.limite));
    expect(en.map((z) => z.id)).toEqual(['zon-norte']);
  });

  it('cuadrillas: cua-02 es "Cuadrilla 2 — Bacheo", cada zona tiene 2 o 3 y una está inactiva', () => {
    expect(CUADRILLAS_DEMO.find((c) => c.id === 'cua-02')?.nombre).toBe(
      'Cuadrilla 2 — Bacheo',
    );
    for (const z of ZONAS_DEMO) {
      const n = CUADRILLAS_DEMO.filter((c) => c.zonaId === z.id).length;
      expect(n, z.id).toBeGreaterThanOrEqual(2);
      expect(n, z.id).toBeLessThanOrEqual(3);
    }
    expect(CUADRILLAS_DEMO.filter((c) => !c.activa)).toHaveLength(1);
  });
});
