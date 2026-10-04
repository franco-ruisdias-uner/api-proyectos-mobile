// AGENTS §10.3: toda entidad del contrato que la API devuelve aparece en algún
// esperarContrato(…, '<Entidad>') de test/. Así ningún tipo queda sin cubrir.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFINICIONES } from '../utilidades/contrato.js';

/** Definiciones que no son una respuesta por sí mismas (sobre, uniones, partes de otra). */
const AUXILIARES = new Set([
  'Meta',
  'RespuestaError',
  'Coordenadas',
  'EstadoTurno',
  'EstadoReserva',
  'Rol',
]);

/** Entidades que la API empieza a devolver en un módulo posterior del plan (ESPECIFICACION §3). */
const DE_MODULOS_SIGUIENTES: Record<string, string> = {
  Turno: 'M2',
  ReservaFija: 'M5',
};

function archivosDeTest(carpeta: string): string[] {
  return readdirSync(carpeta, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? archivosDeTest(join(carpeta, e.name))
      : e.name.endsWith('.ts')
        ? [join(carpeta, e.name)]
        : [],
  );
}

describe('AGENTS §10.3 — Cobertura del contrato', () => {
  const texto = archivosDeTest(join(import.meta.dirname, '..'))
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n');
  const cubiertas = new Set(
    [...texto.matchAll(/esperarContrato(?:<[^>]*>)?\([^)]*?'(\w+)'\)/g)].map(
      (m) => m[1],
    ),
  );
  const genericas = (d: string) => d.includes('<');

  it.each(
    DEFINICIONES.filter(
      (d) => !AUXILIARES.has(d) && !genericas(d) && !DE_MODULOS_SIGUIENTES[d],
    ),
  )('%s está cubierta por algún test', (definicion) => {
    expect(
      cubiertas.has(definicion),
      `Ningún test valida «${definicion}» con esperarContrato`,
    ).toBe(true);
  });
});
