import { describe, expect, it } from 'vitest';
import type { EstadoReporte } from '../../../../contract/types.js';
import {
  TOPE_FOTOS_DEL_ARREGLO,
  admiteFotoDelArreglo,
  comentarioDeDuplicado,
  transicionPorEstado,
  transicionPorCuadrilla,
} from './transitions.js';

describe('R11 — máquina de estados (D3) por PATCH /estado', () => {
  it.each<[EstadoReporte, EstadoReporte, string]>([
    ['recibido', 'en_revision', 'ok'],
    ['recibido', 'rechazado', 'ok'],
    ['recibido', 'resuelto', 'TRANSICION_INVALIDA'],
    ['recibido', 'recibido', 'TRANSICION_INVALIDA'],
    ['en_revision', 'rechazado', 'ok'],
    ['en_revision', 'resuelto', 'TRANSICION_INVALIDA'],
    ['en_revision', 'recibido', 'TRANSICION_INVALIDA'],
    ['en_revision', 'en_revision', 'TRANSICION_INVALIDA'],
    ['asignado', 'resuelto', 'ok'],
    ['asignado', 'en_revision', 'ok'],
    ['asignado', 'rechazado', 'ok'],
    ['asignado', 'recibido', 'TRANSICION_INVALIDA'],
    ['asignado', 'asignado', 'CUADRILLA_REQUERIDA'],
    ['recibido', 'asignado', 'CUADRILLA_REQUERIDA'],
    ['en_revision', 'asignado', 'CUADRILLA_REQUERIDA'],
    ['resuelto', 'asignado', 'CUADRILLA_REQUERIDA'],
    ['resuelto', 'en_revision', 'TRANSICION_INVALIDA'],
    ['resuelto', 'rechazado', 'TRANSICION_INVALIDA'],
    ['rechazado', 'en_revision', 'TRANSICION_INVALIDA'],
    ['rechazado', 'resuelto', 'TRANSICION_INVALIDA'],
    ['rechazado', 'rechazado', 'TRANSICION_INVALIDA'],
  ])('%s → %s: %s', (desde, hasta, esperado) => {
    expect(transicionPorEstado(desde, hasta)).toBe(esperado);
  });
});

describe('R11/R14 — asignar por PATCH /cuadrilla', () => {
  it.each<[EstadoReporte, string]>([
    ['en_revision', 'ok'],
    ['asignado', 'ok'],
    ['recibido', 'TRANSICION_INVALIDA'],
    ['resuelto', 'TRANSICION_INVALIDA'],
    ['rechazado', 'TRANSICION_INVALIDA'],
  ])('desde %s: %s', (desde, esperado) => {
    expect(transicionPorCuadrilla(desde)).toBe(esperado);
  });
});

describe('R15 — foto del arreglo', () => {
  it.each<[EstadoReporte, boolean]>([
    ['asignado', true],
    ['resuelto', true],
    ['recibido', false],
    ['en_revision', false],
    ['rechazado', false],
  ])('en %s: %s', (estado, esperado) => {
    expect(admiteFotoDelArreglo(estado)).toBe(esperado);
  });

  it('el tope es de tres', () => {
    expect(TOPE_FOTOS_DEL_ARREGLO).toBe(3);
  });
});

describe('R13 — comentario automático del duplicado', () => {
  it('nombra el código del original', () => {
    expect(comentarioDeDuplicado('GCHU-2026-00412')).toBe(
      'Duplicado de GCHU-2026-00412',
    );
  });
});
