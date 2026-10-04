// AGENTS §13: la tabla de errores del README sale del catálogo, no se escribe a mano.
// Si este test falla, copiá la tabla que imprime en el README.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tablaDeErrores } from '../utilidades/readme.js';

describe('AGENTS §13 — README con la tabla de errores del catálogo', () => {
  it('la tabla entre los marcadores es la del catálogo', () => {
    const readme = readFileSync(
      join(import.meta.dirname, '../../README.md'),
      'utf8',
    );
    const m = /<!-- errores:inicio -->\n([\s\S]*?)\n<!-- errores:fin -->/.exec(
      readme,
    );
    expect(
      m,
      'Faltan los marcadores <!-- errores:inicio --> y <!-- errores:fin --> en el README',
    ).not.toBeNull();
    expect(
      m![1],
      `La tabla del README no coincide con el catálogo. Tiene que ser:\n\n${tablaDeErrores()}\n`,
    ).toBe(tablaDeErrores());
  });
});
