export type Simulacion = { tipo: 'error' } | { tipo: 'demora'; milisegundos: number };

export const DEMORA_MAXIMA_MS = 30_000;

/** Interpreta la cabecera X-Simular (AGENTS §11.4). Lo que no reconoce se ignora. */
export function interpretarSimulacion(valor: string | undefined): Simulacion | null {
  if (!valor) return null;
  if (valor === 'error-500') return { tipo: 'error' };
  const demora = /^demora-(\d{1,7})$/.exec(valor);
  if (demora)
    return { tipo: 'demora', milisegundos: Math.min(Number(demora[1]), DEMORA_MAXIMA_MS) };
  return null;
}
