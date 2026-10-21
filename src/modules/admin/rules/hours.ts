// R17 y R19: las horas de bloqueos y fijas son en punto, entre 08:00 y 24:00.
const EN_PUNTO = /^(0[89]|1\d|2[0-4]):00$/;

/** Devuelve el mensaje del problema, o null si el tramo `[inicio, fin)` es válido. */
export function validarHoras(inicio: string, fin: string): string | null {
  if (!EN_PUNTO.test(inicio) || inicio === '24:00')
    return 'El horario de inicio tiene que ser una hora en punto entre las 08:00 y las 23:00.';
  if (!EN_PUNTO.test(fin))
    return 'El horario de fin tiene que ser una hora en punto entre las 09:00 y las 24:00.';
  if (inicio >= fin) return 'El inicio tiene que ser antes del fin.';
  return null;
}
