import {
  calcularConsumo,
  evaluarRango,
} from '../../modulos/lecturas/reglas/lecturas.js';
import { CANTIDAD_BRASIL, type SemillaSuministro } from './suministros.js';

// Las lecturas de la app de clase (docs/referencia/app-de-clase/mocks/readings.ts), todas de la
// ruta 07 de Brasil y del lector usr-011. Una diferencia, por D19: el PRD manda que `lec-88201`
// sea de `sum-004120` (el primero de Brasil), así que el suministro que el mock tenía leído en
// ese lugar (el segundo) queda sin lectura.

export const LECTOR_DE_BRASIL = 'usr-011';
export const RUTA_DE_BRASIL = 'rut-07-2026-05';
/** Lecturas de Brasil por posición en la ruta; la 0 es la del PRD (D19). */
export const INDICES_CON_LECTURA = [
  0, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 25, 40,
];
const INDICE_DEL_PRD = 0;
const INDICE_CON_MEDIDOR_CAMBIADO = 40;

export interface SemillaLectura {
  id: string;
  rutaId: string;
  suministroId: string;
  lectorId: string;
  valor: number;
  consumo: number;
  latitud: number;
  longitud: number;
  fueraDeRango: boolean;
  confirmadaPorLector: boolean;
  fechaHora: Date;
}

function reloj(minutosTotales: number): Date {
  const hora = 8 + Math.floor(minutosTotales / 60);
  const minuto = minutosTotales % 60;
  const hh = String(hora).padStart(2, '0');
  const mm = String(minuto).padStart(2, '0');
  return new Date(`2026-09-15T${hh}:${mm}:00-03:00`);
}

export function generarLecturas(
  suministros: SemillaSuministro[],
  multiplicadores: Map<string, number>,
): SemillaLectura[] {
  return INDICES_CON_LECTURA.slice(0, CANTIDAD_BRASIL).map((indice) => {
    const s = suministros[indice];
    const multiplicador = multiplicadores.get(s.medidorId) ?? 1;
    const base = {
      rutaId: RUTA_DE_BRASIL,
      suministroId: s.id,
      lectorId: LECTOR_DE_BRASIL,
      latitud: s.latitud,
      longitud: s.longitud,
    };
    let id = `lec-${88200 + indice}`;
    let valor: number;
    let fechaHora = reloj(indice);
    if (indice === INDICE_DEL_PRD) {
      id = 'lec-88201';
      valor = 1302;
      fechaHora = reloj(12);
    } else if (indice === INDICE_CON_MEDIDOR_CAMBIADO) {
      // P-04: cambiaron el medidor, el consumo da negativo y el lector confirmó el aviso.
      id = 'lec-88240';
      valor = 86;
      fechaHora = reloj(65);
    } else {
      valor = (s.lecturaAnterior ?? 0) + 8 + (indice % 11);
    }
    const consumo = calcularConsumo(valor, s.lecturaAnterior, multiplicador);
    const fueraDeRango = evaluarRango(consumo, s.consumoPromedio);
    return {
      ...base,
      id,
      valor,
      consumo,
      fueraDeRango,
      // La app pide confirmar lo que sale de rango: el lector de la demo siempre confirmó.
      confirmadaPorLector: fueraDeRango,
      fechaHora,
    };
  });
}
