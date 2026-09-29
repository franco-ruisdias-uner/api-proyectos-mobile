import { describe, expect, it } from 'vitest';
import type { EstadoReporte } from '../../../../contrato/tipos.js';
import { avisoDeAdhesion, avisoDeEstado } from './avisos.js';

describe('Especificación §7 — texto de las push', () => {
  it.each<[EstadoReporte, string]>([
    ['en_revision', 'Tu reporte GCHU-2026-00412 está en revisión.'],
    ['asignado', 'Tu reporte GCHU-2026-00412 fue asignado a una cuadrilla.'],
    ['resuelto', 'Tu reporte GCHU-2026-00412 fue resuelto.'],
    ['rechazado', 'Tu reporte GCHU-2026-00412 fue rechazado.'],
    ['recibido', 'Tu reporte GCHU-2026-00412 fue recibido.'],
  ])('cambio a %s', (estado, cuerpo) => {
    const aviso = avisoDeEstado(
      { id: 'rep-1', codigo: 'GCHU-2026-00412' },
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
      { id: 'rep-1', codigo: 'GCHU-2026-00412' },
      3,
    );
    expect(aviso.cuerpo).toBe(
      'Un vecino más se sumó a tu reporte GCHU-2026-00412. Ya son 3.',
    );
    expect(aviso.datos).toEqual({
      tipo: 'adhesion',
      reporteId: 'rep-1',
      codigo: 'GCHU-2026-00412',
    });
  });
});
