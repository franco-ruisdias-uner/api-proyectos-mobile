import { describe, expect, it } from 'vitest';
import type { EstadoReporte } from '../../../../contract/types.js';
import {
  avisoDeAdhesion,
  avisoDeEstado,
  avisoDeReporteNuevo,
} from './notices.js';

describe('Especificación §7 — texto de las push', () => {
  it.each<[EstadoReporte, string]>([
    ['en_revision', 'Tu reporte Bache en Av. Colon 1550 está en revisión.'],
    [
      'asignado',
      'Tu reporte Bache en Av. Colon 1550 fue asignado a una cuadrilla.',
    ],
    ['resuelto', 'Tu reporte Bache en Av. Colon 1550 fue resuelto.'],
    ['rechazado', 'Tu reporte Bache en Av. Colon 1550 fue rechazado.'],
    ['recibido', 'Tu reporte Bache en Av. Colon 1550 fue recibido.'],
  ])('cambio a %s', (estado, cuerpo) => {
    const aviso = avisoDeEstado(
      {
        id: 'rep-1',
        codigo: 'GCHU-2026-00412',
        tipo: 'Bache',
        direccion: 'Av. Colon 1550',
      },
      estado,
    );
    expect(aviso.cuerpo).toBe(cuerpo);
    expect(aviso.titulo).toBe('Tu reporte cambió de estado');
    expect(aviso.datos).toEqual({
      tipo: 'estado',
      reporteId: 'rep-1',
      codigo: 'GCHU-2026-00412',
      estado,
    });
  });

  it('adhesión', () => {
    const aviso = avisoDeAdhesion(
      {
        id: 'rep-1',
        codigo: 'GCHU-2026-00412',
        tipo: 'Bache',
        direccion: 'Av. Colon 1550',
      },
      3,
    );
    expect(aviso.cuerpo).toBe(
      'Un vecino más se sumó a tu reporte Bache en Av. Colon 1550. Ya son 3.',
    );
    expect(aviso.datos).toEqual({
      tipo: 'adhesion',
      reporteId: 'rep-1',
      codigo: 'GCHU-2026-00412',
    });
  });

  it('reporte nuevo (operadores)', () => {
    const aviso = avisoDeReporteNuevo({
      id: 'rep-1',
      codigo: 'GCHU-2026-00412',
      tipo: 'Bache',
      direccion: 'Av. Colon 1550',
    });
    expect(aviso.cuerpo).toBe('Nuevo reporte: Bache en Av. Colon 1550');
    expect(aviso.datos.tipo).toBe('nuevo');
    expect(aviso.canal).toBe('nuevo-reporte');
  });
});
