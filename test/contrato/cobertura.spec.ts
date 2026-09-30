import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// AGENTS §10.3 — ninguna entidad que la API devuelve queda sin un esperarContrato.

const esquema = JSON.parse(readFileSync('contrato/esquema.json', 'utf8')) as {
  definitions: Record<string, unknown>;
};

/** Lo que la API ya devuelve, módulo por módulo. Cada módulo agrega los suyos. */
const DEVUELTAS = ['Salud', 'Sesion', 'Usuario', 'ArchivoSubido', 'Dispositivo', 'PruebaDePush'];

/** Piezas que no se devuelven solas: van dentro de otras o son el sobre. */
const AUXILIARES = [
  'Coordenadas',
  'Sentido',
  'Recorrido',
  'TipoDeDia',
  'Gravedad',
  'MotivoDemora',
  'Tema',
  'Meta',
  'RespuestaError',
];

/** Entidades del PRD que llegan en módulos siguientes (espec. §3). */
const PENDIENTES: Record<string, string> = {
  Linea: 'M1',
  Parada: 'M1',
  Horario: 'M2',
  Aviso: 'M4',
  ReporteDeDemora: 'M5',
};

function archivosDe(carpeta: string): string[] {
  return readdirSync(carpeta).flatMap((nombre) => {
    const ruta = join(carpeta, nombre);
    return statSync(ruta).isDirectory() ? archivosDe(ruta) : ruta.endsWith('.ts') ? [ruta] : [];
  });
}

describe('AGENTS §10.3 — cobertura del contrato', () => {
  const textoDeTests = archivosDe('test')
    .map((archivo) => readFileSync(archivo, 'utf8'))
    .join('\n');

  it('cada definición del esquema está clasificada', () => {
    const clasificadas = new Set([...DEVUELTAS, ...AUXILIARES, ...Object.keys(PENDIENTES)]);
    const sinClasificar = Object.keys(esquema.definitions).filter((d) => !clasificadas.has(d));
    expect(sinClasificar).toEqual([]);
  });

  it.each(DEVUELTAS)('%s aparece en algún esperarContrato(…, "%s")', (definicion) => {
    expect(textoDeTests).toMatch(new RegExp(`esperarContrato\\([^;]*'${definicion}'\\)`));
  });
});
