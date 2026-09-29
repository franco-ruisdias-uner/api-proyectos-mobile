// La tabla de errores del README (AGENTS §13.7) tiene que coincidir con el catálogo.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATALOGO } from './catalogo.js';

const README = readFileSync(
  join(import.meta.dirname, '../../../README.md'),
  'utf8',
);

function filasDeErrores(): Map<string, { estado: number; mensaje: string }> {
  const inicio = README.indexOf('<!-- errores:inicio -->');
  const fin = README.indexOf('<!-- errores:fin -->');
  expect(inicio).toBeGreaterThan(-1);
  expect(fin).toBeGreaterThan(inicio);
  const filas = new Map<string, { estado: number; mensaje: string }>();
  for (const linea of README.slice(inicio, fin).split('\n')) {
    const partes = /^\| `([A-Z_]+)` \| (\d{3}) \| (.+) \|$/.exec(linea.trim());
    if (partes) {
      filas.set(partes[1], { estado: Number(partes[2]), mensaje: partes[3] });
    }
  }
  return filas;
}

describe('AGENTS §13 — la tabla de errores del README sale del catálogo', () => {
  const filas = filasDeErrores();

  it('tiene exactamente los códigos del catálogo', () => {
    expect([...filas.keys()].sort()).toEqual(Object.keys(CATALOGO).sort());
  });

  it.each(Object.entries(CATALOGO))(
    '%s tiene el estado y el mensaje del catálogo',
    (codigo, { estado, mensaje }) => {
      const fila = filas.get(codigo);
      expect(fila?.estado).toBe(estado);
      expect(fila?.mensaje.startsWith(mensaje)).toBe(true);
    },
  );
});
