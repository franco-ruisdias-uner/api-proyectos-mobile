export type Simulacion = { tipo: 'error' } | { tipo: 'demora'; milisegundos: number };

const DEMORA_MAXIMA = 30_000;

/** `X-Simular: error-500` o `X-Simular: demora-3000` (AGENTS §11.4). */
export function interpretarSimulacion(cabecera: string | undefined): Simulacion | null {
  const valor = cabecera?.trim().toLowerCase();
  if (!valor) return null;
  if (valor === 'error-500') return { tipo: 'error' };
  const m = /^demora-(\d+)$/.exec(valor);
  if (m) return { tipo: 'demora', milisegundos: Math.min(Number(m[1]), DEMORA_MAXIMA) };
  return null;
}
