import type { EstadoEventoContrato, EstadoGuardado } from '../../events/rules/agenda.js';
import { avisoPorCambioDeEstado, sePuedeGuardar } from './saved.js';

describe('R17 — Sólo se pueden guardar eventos programados o suspendidos', () => {
  it.each<[EstadoEventoContrato, boolean]>([
    ['programado', true],
    ['suspendido', true],
    ['cancelado', false],
    ['finalizado', false],
  ])('%s → %s', (estado, esperado) => {
    expect(sePuedeGuardar(estado)).toBe(esperado);
  });
});

describe('Especificación §7 — Cuándo se avisa un cambio de estado', () => {
  const evento = { titulo: 'Peña en el anfiteatro', id: 'evt-017' };

  it.each<[EstadoGuardado, EstadoGuardado, boolean]>([
    ['programado', 'suspendido', true],
    ['programado', 'cancelado', true],
    ['suspendido', 'cancelado', true],
    ['cancelado', 'suspendido', true],
    ['suspendido', 'programado', true],
    ['cancelado', 'programado', false],
    ['programado', 'programado', false],
    ['suspendido', 'suspendido', false],
    ['cancelado', 'cancelado', false],
  ])('%s → %s: avisa = %s', (antes, despues, avisa) => {
    const aviso = avisoPorCambioDeEstado(evento, antes, despues, false);
    expect(aviso !== null).toBe(avisa);
  });

  it('un evento que ya terminó no avisa nada', () => {
    expect(avisoPorCambioDeEstado(evento, 'programado', 'cancelado', true)).toBeNull();
  });

  it('el mensaje nombra el evento, está en castellano y lleva el id para abrirlo', () => {
    const aviso = avisoPorCambioDeEstado(evento, 'programado', 'suspendido', false);
    expect(aviso?.titulo).toBe('Evento suspendido');
    expect(aviso?.cuerpo).toContain('Peña en el anfiteatro');
    expect(aviso?.datos).toEqual({ tipo: 'evento-estado', eventoId: 'evt-017', estado: 'suspendido' });
    expect(avisoPorCambioDeEstado(evento, 'programado', 'cancelado', false)?.titulo).toBe('Evento cancelado');
    expect(avisoPorCambioDeEstado(evento, 'suspendido', 'programado', false)?.titulo).toBe(
      'El evento se hace',
    );
  });
});
