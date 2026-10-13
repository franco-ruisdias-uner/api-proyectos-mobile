import type { AvanceRuta } from '../../../../contrato/api.js';
import { diaYMesEnArgentina } from '../../../comun/fechas/fechas.js';

/** "AAAA-NN" con NN de 01 a 06: el número de bimestre del año (D9). */
export const PATRON_BIMESTRE = /^\d{4}-0[1-6]$/;

export function esBimestreValido(bimestre: string): boolean {
  return PATRON_BIMESTRE.test(bimestre);
}

/** El id de una ruta es determinístico: `rut-07-2026-05`. */
export function idDeRuta(numero: string, bimestre: string): string {
  return `rut-${numero}-${bimestre}`;
}

/** R22: el mensaje exacto del PRD, con el día en hora argentina. */
export function mensajeRutaCerrada(cerradaEn: Date): string {
  return `Esa ruta fue cerrada el ${diaYMesEnArgentina(cerradaEn)}.`;
}

/** El primer elemento que aparece dos veces, o `undefined`. */
export function primerRepetido(valores: string[]): string | undefined {
  const vistos = new Set<string>();
  for (const v of valores) {
    if (vistos.has(v)) return v;
    vistos.add(v);
  }
  return undefined;
}

/** R10: lo que el servidor ya recibió de la ruta. */
export function calcularAvance(
  rutaId: string,
  cuentas: {
    suministros: number;
    leidos: number;
    conNovedad: number;
    fueraDeRango: number;
  },
): AvanceRuta {
  return {
    rutaId,
    ...cuentas,
    pendientes: Math.max(
      0,
      cuentas.suministros - cuentas.leidos - cuentas.conNovedad,
    ),
  };
}

/** R20: los ids que el teléfono dice haber cargado y el servidor no tiene, sin repetidos. */
export function faltantesDelCierre(
  declarados: string[],
  recibidos: ReadonlySet<string>,
): string[] {
  return [...new Set(declarados)].filter((id) => !recibidos.has(id));
}

/** R20: "Faltan subir 3 lecturas y 1 novedad. …"; sólo nombra lo que falta. */
export function mensajeFaltantes(lecturas: number, novedades: number): string {
  const partes: string[] = [];
  if (lecturas > 0)
    partes.push(`${lecturas} ${lecturas === 1 ? 'lectura' : 'lecturas'}`);
  if (novedades > 0)
    partes.push(`${novedades} ${novedades === 1 ? 'novedad' : 'novedades'}`);
  const total = lecturas + novedades;
  return `${total === 1 ? 'Falta' : 'Faltan'} subir ${partes.join(' y ')}. Esperá a tener señal y probá de nuevo.`;
}
