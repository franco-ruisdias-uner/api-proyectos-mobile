import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DEFINICIONES_DEL_CONTRATO } from '../utilidades/contrato.js';

// AGENTS §10.3: toda entidad que la API devuelve aparece en algún esperarContrato(…, '<Entidad>').

/** Tipos del contrato que no son una respuesta por sí mismos (partes, uniones, sobres). */
const NO_SON_RESPUESTA = [
  'Coordenadas',
  'Categoria',
  'ModeloMedidor',
  'EstadoRuta',
  'MotivoNovedad',
  'Rol',
  'Meta',
  'RespuestaError',
];

/** Entidades que la API todavía no devuelve: se sacan de acá en el módulo que las agrega. */
const TODAVIA_NO_SE_DEVUELVEN = [
  'Suministro',
  'Medidor',
  'Ruta',
  'Lectura',
  'Novedad',
];

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

describe('AGENTS §10.3 — Ningún tipo del contrato queda sin cubrir', () => {
  const textos = archivos(join(import.meta.dirname, '..'))
    .filter((r) => !r.includes(`${join('test', 'utilidades')}`))
    .map((r) => readFileSync(r, 'utf8'))
    .join('\n');

  const devueltas = DEFINICIONES_DEL_CONTRATO.filter(
    (d) =>
      !NO_SON_RESPUESTA.includes(d) && !TODAVIA_NO_SE_DEVUELVEN.includes(d),
  );

  it.each(devueltas)('%s aparece en algún esperarContrato', (nombre) => {
    expect(textos).toMatch(new RegExp(`esperarContrato\\([^;]*'${nombre}'\\)`));
  });
});
