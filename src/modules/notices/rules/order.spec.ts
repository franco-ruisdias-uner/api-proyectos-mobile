import type { Gravedad } from '../../../../contract/types.js';
import { ordenarAvisos } from './order.js';

const aviso = (id: string, gravedad: Gravedad, desde: string) => ({
  id,
  gravedad,
  desde: new Date(desde),
});

describe('Espec. §4 — orden de los avisos: gravedad y después desde descendente', () => {
  it('suspensión, desvío, informativo', () => {
    const lista = [
      aviso('a', 'informativo', '2026-09-19T00:00:00Z'),
      aviso('b', 'suspension', '2026-09-01T00:00:00Z'),
      aviso('c', 'desvio', '2026-09-10T00:00:00Z'),
    ];
    expect(ordenarAvisos(lista).map((a) => a.id)).toEqual(['b', 'c', 'a']);
  });

  it('dentro de la misma gravedad, el que empezó después primero', () => {
    const lista = [
      aviso('a', 'desvio', '2026-09-01T00:00:00Z'),
      aviso('b', 'desvio', '2026-09-15T00:00:00Z'),
    ];
    expect(ordenarAvisos(lista).map((a) => a.id)).toEqual(['b', 'a']);
  });

  it('si empatan todo, desempata por id y no modifica la lista original', () => {
    const lista = [
      aviso('avi-2', 'desvio', '2026-09-01T00:00:00Z'),
      aviso('avi-1', 'desvio', '2026-09-01T00:00:00Z'),
    ];
    expect(ordenarAvisos(lista).map((a) => a.id)).toEqual(['avi-1', 'avi-2']);
    expect(lista[0].id).toBe('avi-2');
  });
});
