import { generarRutas } from './rutas.js';
import { generarSuministrosYMedidores } from './suministros.js';

// ESPECIFICACION §8: las rutas de la app de clase, con sus ids y su recorrido.
describe('ESPECIFICACION §8 — Semillas de rutas', () => {
  const { suministros } = generarSuministrosYMedidores();
  const rutas = generarRutas(suministros);
  const ruta = (id: string) => rutas.find((r) => r.id === id)!;

  it('son 20: la 07 de Brasil, la 12 de Quintas Norte y 18 de barrio', () => {
    expect(rutas).toHaveLength(20);
    expect(new Set(rutas.map((r) => r.id)).size).toBe(20);
  });

  it('cada suministro está en una sola ruta y todos están en alguna', () => {
    const todos = rutas.flatMap((r) => r.suministroIds);
    expect(todos).toHaveLength(580);
    expect(new Set(todos).size).toBe(580);
  });

  it('rut-07-2026-05 es del PRD: Barrio Brasil, usr-011, en curso, 200 suministros desde sum-004120', () => {
    const r = ruta('rut-07-2026-05');
    expect(r).toMatchObject({
      numero: '07',
      nombre: 'Barrio Brasil',
      bimestre: '2026-05',
      lectorId: 'usr-011',
      estado: 'en_curso',
      cerradaEn: null,
    });
    expect(r.descargadaEn).toEqual(new Date('2026-09-15T10:40:00Z'));
    expect(r.suministroIds).toHaveLength(200);
    expect(r.suministroIds.slice(0, 4)).toEqual([
      'sum-004120',
      'sum-004136',
      'sum-004150',
      'sum-004162',
    ]);
  });

  it('rut-12-2026-05 es Quintas Norte, cerrada el 14/09', () => {
    const r = ruta('rut-12-2026-05');
    expect(r).toMatchObject({
      nombre: 'Quintas Norte',
      lectorId: 'usr-011',
      estado: 'cerrada',
    });
    expect(r.cerradaEn).toEqual(new Date('2026-09-14T20:02:00Z'));
    expect(r.suministroIds).toHaveLength(20);
  });

  it('las de barrio siguen el mock: estado, lector y 20 suministros', () => {
    expect(ruta('rut-01-2026-05')).toMatchObject({
      nombre: 'Centro',
      estado: 'asignada',
      lectorId: 'usr-012',
      descargadaEn: null,
      cerradaEn: null,
    });
    expect(ruta('rut-03-2026-05')).toMatchObject({
      estado: 'cerrada',
      lectorId: 'usr-014',
      cerradaEn: new Date('2026-09-14T20:02:00Z'),
    });
    expect(ruta('rut-20-2026-05').suministroIds[0]).toBe('sum-200001');
    for (const r of rutas.slice(2)) expect(r.suministroIds).toHaveLength(20);
  });

  it('el suministro inactivo de la 02 sigue en su lugar (R8)', () => {
    const r = ruta('rut-02-2026-05');
    const inactivo = suministros.find((s) => !s.activo)!;
    expect(r.suministroIds).toContain(inactivo.id);
  });
});
