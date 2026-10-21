export type Simulacion = { tipo: 'error' } | { tipo: 'demora'; milisegundos: number };

const DEMORA_MAXIMA = 30_000;

/** Interpreta la cabecera `X-Simular` (AGENTS §11.4). */
export function leerSimulacion(cabecera: string | undefined): Simulacion | null {
  if (!cabecera) return null;
  const valor = cabecera.trim().toLowerCase();
  if (valor === 'error-500') return { tipo: 'error' };
  const demora = /^demora-(\d{1,9})$/.exec(valor);
  if (demora) return { tipo: 'demora', milisegundos: Math.min(Number(demora[1]), DEMORA_MAXIMA) };
  return null;
}
