import { generarLecturas } from './lecturas.js';
import { generarSuministrosYMedidores } from './suministros.js';

describe('ESPECIFICACION §8 — Semillas de lecturas', () => {
  const { suministros, medidores } = generarSuministrosYMedidores();
  const lecturas = generarLecturas(
    suministros,
    new Map(medidores.map((m) => [m.id, m.multiplicador])),
  );
  const lec = (id: string) => lecturas.find((l) => l.id === id)!;

  it('son las 20 de la app de clase, con ids distintos y todas de la ruta 07', () => {
    expect(lecturas).toHaveLength(20);
    expect(new Set(lecturas.map((l) => l.id)).size).toBe(20);
    expect(new Set(lecturas.map((l) => l.suministroId)).size).toBe(20);
    expect(new Set(lecturas.map((l) => l.rutaId))).toEqual(
      new Set(['rut-07-2026-05']),
    );
  });

  it('D19: lec-88201 es de sum-004120: 1302 contra 1284, consumo 18', () => {
    expect(lec('lec-88201')).toMatchObject({
      suministroId: 'sum-004120',
      valor: 1302,
      consumo: 18,
      fueraDeRango: false,
    });
  });

  it('lec-88240 tiene el consumo negativo del mock, fuera de rango y confirmada', () => {
    expect(lec('lec-88240')).toMatchObject({
      valor: 86,
      consumo: -4014,
      fueraDeRango: true,
      confirmadaPorLector: true,
    });
  });

  it('A29: el medidor ×10 (lec-88225) también sale de rango con D4; las demás son normales', () => {
    const fuera = lecturas.filter((l) => l.fueraDeRango).map((l) => l.id);
    expect(fuera.sort()).toEqual(['lec-88225', 'lec-88240']);
    for (const l of lecturas)
      expect(l.confirmadaPorLector).toBe(l.fueraDeRango);
  });
});
