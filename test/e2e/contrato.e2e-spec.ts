// AGENTS §10.3 — Ningún tipo del contrato que la API devuelve queda sin un test que lo valide.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { definicionesDelContrato } from '../utilidades/contrato.js';

/** Tipos que no son una respuesta por sí mismos: se validan dentro de otros. */
const AUXILIARES = new Set([
  'Meta',
  'RespuestaError',
  'Coordenadas',
  'Foto',
  'EstadoReporte',
  'Rol',
  'Plataforma',
]);

/**
 * Tipos que la API todavía no devuelve, con el módulo que los trae.
 * Cuando un módulo empieza a devolver uno, se saca de acá (el test avisa).
 */
const TODAVIA_NO: Record<string, string> = {
  Reporte: 'M2',
  CambioDeEstado: 'M2',
};

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    return statSync(ruta).isDirectory()
      ? archivos(ruta)
      : ruta.endsWith('.ts')
        ? [ruta]
        : [];
  });
}

const raiz = join(import.meta.dirname, '..');
const texto = archivos(raiz)
  .filter((r) => !r.includes(join('test', 'utilidades')))
  .map((r) => readFileSync(r, 'utf8'))
  .join('\n');

const cubiertos = new Set(
  [...texto.matchAll(/esperar(?:Contrato|Forma)\([^;]*?,\s*'(\w+)'\s*\)/g)].map(
    (m) => m[1],
  ),
);

describe('AGENTS §10.3 — Cobertura del contrato', () => {
  const devueltos = definicionesDelContrato().filter((d) => !AUXILIARES.has(d));

  it.each(devueltos)(
    '%s aparece en algún esperarContrato (o está anotado para otro módulo)',
    (tipo) => {
      if (tipo in TODAVIA_NO) {
        expect(
          cubiertos.has(tipo),
          `${tipo} ya está cubierto: sacalo de TODAVIA_NO`,
        ).toBe(false);
      } else {
        expect(
          cubiertos.has(tipo),
          `Ningún test valida ${tipo} con esperarContrato`,
        ).toBe(true);
      }
    },
  );
});
