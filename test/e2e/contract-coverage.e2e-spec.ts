import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFINICIONES } from '../utilities/contract.js';

/**
 * AGENTS §10.3 — Ninguna entidad que la API devuelve queda sin un `esperarContrato`.
 * Cada módulo pasa sus entidades de PENDIENTES a DEVUELTAS cuando las implementa.
 */
const DEVUELTAS = [
  'Usuario',
  'Sesion',
  'ArchivoSubido',
  'Salud',
  'Dispositivo',
  'PruebaNotificacion',
  'Lugar',
  'Categoria',
  'Evento',
  'Favorito',
  'Visita',
];
/** Partes de otras entidades: se validan dentro de ellas. */
const ANIDADAS = [
  'Coordenadas',
  'Horario',
  'Audioguia',
  'Preferencias',
  'EstadoEvento',
  'OrigenVisita',
  'Meta',
  'RespuestaError',
];
/** Entidades de módulos que todavía no están. */
const PENDIENTES: Record<string, string> = {};

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
  it('toda definición del esquema está clasificada', () => {
    const clasificadas = new Set([...DEVUELTAS, ...ANIDADAS, ...Object.keys(PENDIENTES)]);
    expect(DEFINICIONES.filter((d) => !clasificadas.has(d))).toEqual([]);
  });

  it('cada entidad que la API devuelve aparece en algún esperarContrato(…, "<Entidad>")', () => {
    const texto = archivosDeTest('test')
      .filter((a) => !a.endsWith('contract-coverage.e2e-spec.ts'))
      .map((a) => readFileSync(a, 'utf8'))
      .join('\n');
    const sinCubrir = DEVUELTAS.filter((d) => !new RegExp(`esperarContrato\\([^)]*['"]${d}['"]`).test(texto));
    expect(sinCubrir).toEqual([]);
  });
});
