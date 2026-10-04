import { idDeTurno, leerIdDeTurno } from './id-turno.js';

describe('ESPECIFICACION D1 — Id de turno determinístico', () => {
  it('arma tur-<espacioId>-<AAAAMMDD>-<HH>', () => {
    expect(idDeTurno('esp-02', '2026-09-19', '19:00')).toBe(
      'tur-esp-02-20260919-19',
    );
    expect(idDeTurno('esp-02', '2026-01-05', '08:00')).toBe(
      'tur-esp-02-20260105-08',
    );
  });

  it('dos espacios no comparten id de turno', () => {
    expect(idDeTurno('esp-01', '2026-09-19', '19:00')).not.toBe(
      idDeTurno('esp-02', '2026-09-19', '19:00'),
    );
  });

  it('lo lee de vuelta, con ids de espacio que llevan guiones', () => {
    expect(leerIdDeTurno('tur-esp-02-20260919-19')).toEqual({
      espacioId: 'esp-02',
      fecha: '2026-09-19',
      inicio: '19:00',
    });
    expect(leerIdDeTurno('tur-esp-t1-abc-20261231-23')).toEqual({
      espacioId: 'esp-t1-abc',
      fecha: '2026-12-31',
      inicio: '23:00',
    });
  });

  it.each([
    ['vacío', ''],
    ['sin prefijo', 'esp-02-20260919-19'],
    ['sin espacio', 'tur-20260919-19'],
    ['el espacio no es de espacio', 'tur-lug-02-20260919-19'],
    ['día que no existe', 'tur-esp-02-20260230-19'],
    ['hora antes de las 8', 'tur-esp-02-20260919-07'],
    ['hora 24 (el último turno empieza a las 23)', 'tur-esp-02-20260919-24'],
    ['hora de un dígito', 'tur-esp-02-20260919-9'],
    ['basura al final', 'tur-esp-02-20260919-19x'],
  ])('rechaza %s', (_caso, id) => {
    expect(leerIdDeTurno(id)).toBeNull();
  });
});
