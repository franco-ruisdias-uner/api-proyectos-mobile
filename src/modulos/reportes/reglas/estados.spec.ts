import { describe, expect, it } from 'vitest';
import {
  ESTADOS_ABIERTOS,
  ESTADOS_DEL_MAPA_POR_DEFECTO,
  esEstadoAbierto,
  interpretarEstados,
} from './estados.js';

describe('PRD §3 — estados abiertos y cerrados', () => {
  it.each([
    ['recibido', true],
    ['en_revision', true],
    ['asignado', true],
    ['resuelto', false],
    ['rechazado', false],
  ] as const)('%s abierto: %s', (estado, abierto) => {
    expect(esEstadoAbierto(estado)).toBe(abierto);
  });

  it('los abiertos son recibido, en_revision y asignado (R9)', () => {
    expect([...ESTADOS_ABIERTOS]).toEqual([
      'recibido',
      'en_revision',
      'asignado',
    ]);
  });

  it('D10 — el mapa sin filtro no incluye los rechazados', () => {
    expect(ESTADOS_DEL_MAPA_POR_DEFECTO).toContain('resuelto');
    expect(ESTADOS_DEL_MAPA_POR_DEFECTO).not.toContain('rechazado');
  });
});

describe('Filtro estado del mapa: uno o varios separados por coma', () => {
  it.each([
    ['recibido', ['recibido']],
    ['recibido,asignado', ['recibido', 'asignado']],
    [' recibido , asignado ', ['recibido', 'asignado']],
    ['recibido,recibido', ['recibido']],
    ['rechazado', ['rechazado']],
  ])('%j → %j', (texto, esperado) => {
    expect(interpretarEstados(texto)).toEqual(esperado);
  });

  it.each(['', ',', 'recibido,', 'cerrado', 'recibido,cualquiera', 'RECIBIDO'])(
    '%j no es válido',
    (texto) => {
      expect(interpretarEstados(texto)).toBeNull();
    },
  );
});
