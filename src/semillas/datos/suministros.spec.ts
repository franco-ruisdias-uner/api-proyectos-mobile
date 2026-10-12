import { generarSuministrosYMedidores } from './suministros.js';

// ESPECIFICACION §8: las semillas reproducen la lógica de los mocks de la app de clase.
describe('ESPECIFICACION §8 — Semillas de suministros y medidores', () => {
  const { suministros, medidores } = generarSuministrosYMedidores();
  const sum = (id: string) => suministros.find((s) => s.id === id)!;
  const med = (id: string) => medidores.find((m) => m.id === id)!;

  it('son 200 de Brasil + 20 de Quintas Norte + 18 barrios de 20: 580, uno por suministro', () => {
    expect(suministros).toHaveLength(580);
    expect(medidores).toHaveLength(580);
    expect(new Set(suministros.map((s) => s.id)).size).toBe(580);
    expect(new Set(suministros.map((s) => s.numero)).size).toBe(580);
    expect(new Set(medidores.map((m) => m.id)).size).toBe(580);
    expect(new Set(medidores.map((m) => m.codigoQr)).size).toBe(580);
    for (const s of suministros) expect(med(s.medidorId)).toBeDefined();
  });

  it('el primero es el del PRD: sum-004120, med-A88413 (A-88413, agujas), instalado el 11/03/2019', () => {
    expect(sum('sum-004120')).toMatchObject({
      numero: '004120',
      titular: 'Coronel, Ramona',
      direccion: 'Brasil 1420',
      categoria: 'residencial',
      medidorId: 'med-A88413',
      lecturaAnterior: 1284,
      consumoPromedio: 18,
      activo: true,
    });
    expect(sum('sum-004120').fechaLecturaAnterior).toEqual(
      new Date('2026-07-14T12:30:00Z'),
    );
    expect(med('med-A88413')).toMatchObject({
      serie: 'A-88413',
      modelo: 'agujas',
      multiplicador: 1,
      digitos: 5,
      codigoQr: 'COOP-CHJ:med-A88413',
    });
    expect(med('med-A88413').instaladoEn).toEqual(
      new Date('2019-03-11T03:00:00Z'),
    );
  });

  it('los cuatro primeros de Brasil tienen los números y los titulares fijados del mock', () => {
    expect(
      suministros.slice(0, 4).map((s) => [s.numero, s.titular, s.direccion]),
    ).toEqual([
      ['004120', 'Coronel, Ramona', 'Brasil 1420'],
      ['004136', 'Benítez, Olga', 'Brasil 1436'],
      ['004150', 'Peralta, Dora', 'Brasil 1450'],
      ['004162', 'Miguez, Hector', 'Brasil 1462'],
    ]);
    expect(suministros[4]).toMatchObject({
      numero: '004204',
      direccion: 'Brasil 1476',
    });
  });

  it('la ruta de Brasil queda en el orden del recorrido, no ordenada por número', () => {
    expect(
      suministros
        .slice(0, 200)
        .map((s) => s.numero)
        .slice(0, 6),
    ).toEqual(['004120', '004136', '004150', '004162', '004204', '004205']);
  });

  it('índice 10 de Brasil: conexión nueva, sin lectura anterior ni promedio', () => {
    expect(suministros[10]).toMatchObject({
      lecturaAnterior: null,
      fechaLecturaAnterior: null,
      consumoPromedio: null,
    });
  });

  it('índice 25 de Brasil: medidor con multiplicador ×10 y sin video', () => {
    const m = med(suministros[25].medidorId);
    expect(m).toMatchObject({
      modelo: 'multiplicador',
      multiplicador: 10,
      videoModelo: null,
    });
  });

  it('índice 40 de Brasil: lectura anterior de 4100 (para el consumo negativo de lec-88240)', () => {
    expect(suministros[40].lecturaAnterior).toBe(4100);
  });

  it('el resto de los medidores de Brasil, Quintas y barrios tiene video de su modelo', () => {
    const conVideo = medidores.filter(
      (m) => m.id !== suministros[25].medidorId,
    );
    for (const m of conVideo) expect(m.videoModelo).toBe(m.modelo);
    expect(new Set(conVideo.map((m) => m.modelo))).toEqual(
      new Set(['agujas', 'digital', 'agujas_viejo']),
    );
  });

  it('Quintas Norte: 20 rurales desde sum-008001, con medidores med-Q…', () => {
    const q = suministros.slice(200, 220);
    expect(q[0]).toMatchObject({
      id: 'sum-008001',
      categoria: 'rural',
      direccion: 'Los Sauces 120',
      medidorId: 'med-Q008001',
    });
    expect(q.every((s) => s.categoria === 'rural')).toBe(true);
  });

  it('barrios: 20 por ruta, un comercial cada 10 y uno inactivo (R8)', () => {
    const barrios = suministros.slice(220);
    expect(barrios[0]).toMatchObject({
      id: 'sum-010001',
      direccion: 'San Martín 100',
    });
    expect(barrios.filter((s) => s.categoria === 'comercial')).toHaveLength(
      18 * 2,
    );
    expect(suministros.filter((s) => !s.activo).map((s) => s.numero)).toEqual([
      '020006',
    ]);
  });

  it('sum-004120 usa las coordenadas del PRD; el resto, la fórmula del mock a 6 decimales', () => {
    expect(suministros[0]).toMatchObject({
      latitud: -30.7521,
      longitud: -57.9814,
    });
    expect(suministros[1].latitud).toBe(-30.75198);
    expect(suministros[1].longitud).toBe(-57.98148);
    expect(suministros[2].longitud).toBe(-57.98132);
  });
});
