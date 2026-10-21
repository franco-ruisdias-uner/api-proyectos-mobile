export interface Rango {
  inicio: number;
  fin: number; // inclusive
}

/**
 * Interpreta la cabecera Range (RFC 9110 §14.2). Sin cabecera, con una que no se entiende
 * (otra unidad, mal escrita) o con varios rangos → null: se ignora y va el archivo entero.
 * Un rango bien escrito que cae fuera del archivo → 'invalido' (416).
 */
export function interpretarRango(
  cabecera: string | undefined,
  total: number,
): Rango | null | 'invalido' {
  if (cabecera === undefined) return null;
  const partes = /^bytes=(\d*)-(\d*)$/.exec(cabecera.trim());
  if (!partes) return null;
  const [, textoInicio, textoFin] = partes;
  if (textoInicio === '' && textoFin === '') return null;

  if (textoInicio === '') {
    // "bytes=-N": los últimos N bytes
    const sufijo = Number(textoFin);
    if (sufijo === 0 || total === 0) return 'invalido';
    return { inicio: Math.max(0, total - sufijo), fin: total - 1 };
  }
  const inicio = Number(textoInicio);
  if (textoFin !== '' && Number(textoFin) < inicio) return null;
  if (inicio >= total) return 'invalido';
  const fin = textoFin === '' ? total - 1 : Math.min(Number(textoFin), total - 1);
  return { inicio, fin };
}
