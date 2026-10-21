import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFINICIONES } from '../utilities/contract.js';

/**
 * Tipos del contrato que la API todavía no devuelve, con el módulo que los trae. Cuando un
 * módulo empieza a devolver uno, se saca de esta lista y este test exige que haya algún
 * `esperarContrato(…, '<Tipo>')` en test/.
 */
const TODAVIA_NO_DEVUELTOS: Record<string, string> = {};

/** Partes de otros tipos o del sobre: no se devuelven solos. */
const AUXILIARES = new Set(['Coordenadas', 'Horario', 'Rol', 'Meta', 'RespuestaError']);

function archivosDeTest(carpeta: string): string[] {
  return readdirSync(carpeta, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? archivosDeTest(join(carpeta, e.name))
      : e.name.endsWith('.ts')
        ? [join(carpeta, e.name)]
        : [],
  );
}

describe('AGENTS §10.3 — Toda entidad que devuelve la API pasa por esperarContrato en algún test', () => {
  const texto = archivosDeTest(join(import.meta.dirname, '..'))
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n');

  const devueltos = DEFINICIONES.filter((d) => !AUXILIARES.has(d) && !(d in TODAVIA_NO_DEVUELTOS));

  it.each(devueltos.map((d) => [d]))('%s', (definicion) => {
    expect(texto).toMatch(new RegExp(`esperarContrato\\([^;]*'${definicion}'\\)`));
  });

  it('la lista de pendientes sólo nombra definiciones que existen', () => {
    for (const d of Object.keys(TODAVIA_NO_DEVUELTOS)) expect(DEFINICIONES).toContain(d);
  });
});
