import type { Sentido, TipoDeDia } from '../../../contrato/tipos.js';
import { distanciaMetros } from '../../comun/geo/geo.js';
import { LINEAS, PARADAS } from './red.js';

// Horarios de demo: se generan por frecuencia y tiempo de viaje entre paradas, de forma
// determinística (la misma red da siempre las mismas filas). Son horas de tabla (R9).
// Sin servicio entre las 00:00 y las 05:20 (D4).

export interface HorarioSemilla {
  id: string;
  lineaId: string;
  paradaId: string;
  sentido: Sentido;
  tipoDeDia: TipoDeDia;
  hora: string;
}

const MIN_PRIMER_SERVICIO = 5 * 60 + 20; // 05:20
const MIN_ULTIMO_PASO = 23 * 60; // los últimos pasos son alrededor de las 23:00
/** Una cuadra recorrida en colectivo urbano, con las paradas y el tránsito, a ~18 km/h. */
const METROS_POR_MINUTO = 300;

/** Frecuencia en minutos entre servicios, por línea (hábil) y su derivación para los otros días. */
const FRECUENCIA_HABIL: Record<string, number> = { 'lin-05': 14, 'lin-14': 15 };
const frecuenciaHabil = (lineaId: string): number =>
  FRECUENCIA_HABIL[lineaId] ?? 20 + (Number(lineaId.slice(4)) % 4) * 5;
const FACTOR_FRECUENCIA: Record<TipoDeDia, number> = {
  habil: 1,
  sabado: 1.5,
  domingo: 2.2,
  feriado: 2.2,
};
const INICIO: Record<TipoDeDia, number> = {
  habil: MIN_PRIMER_SERVICIO,
  sabado: 5 * 60 + 50,
  domingo: 7 * 60,
  feriado: 7 * 60,
};
const TIPOS: TipoDeDia[] = ['habil', 'sabado', 'domingo', 'feriado'];

/** Caso feo del PRD: una línea cuyo último paso es a las 21:00. */
export const LINEA_QUE_TERMINA_A_LAS_21 = 'lin-13';
const MIN_FIN_TEMPRANO = 21 * 60;

/** El horario del ejemplo del PRD: lin-05 pasa por par-101 (ida) a las 10:42 un día hábil. */
const EJEMPLO_PRD = {
  id: 'hor-4410',
  lineaId: 'lin-05',
  paradaId: 'par-101',
  minuto: 10 * 60 + 42,
};

const hhmm = (minutos: number): string =>
  `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;

/** Minutos que tarda el colectivo, desde la cabecera, en llegar a cada parada del recorrido. */
function desfasesDelRecorrido(paradaIds: string[]): number[] {
  const porId = new Map(PARADAS.map((p) => [p.id, p]));
  const desfases = [0];
  for (let i = 1; i < paradaIds.length; i++) {
    const a = porId.get(paradaIds[i - 1])!;
    const b = porId.get(paradaIds[i])!;
    const metros = distanciaMetros(
      { latitud: a.latitud, longitud: a.longitud },
      { latitud: b.latitud, longitud: b.longitud },
    );
    desfases.push(desfases[i - 1] + Math.max(2, Math.round(metros / METROS_POR_MINUTO)));
  }
  return desfases;
}

export function generarHorarios(): HorarioSemilla[] {
  const filas: HorarioSemilla[] = [];
  let siguiente = 10000;
  for (const linea of LINEAS) {
    if (!linea.activa) continue; // la línea inactiva no tiene servicio
    for (const recorrido of linea.recorridos) {
      const desfases = desfasesDelRecorrido(recorrido.paradaIds);
      for (const tipoDeDia of TIPOS) {
        const frecuencia = Math.round(frecuenciaHabil(linea.id) * FACTOR_FRECUENCIA[tipoDeDia]);
        let primera = INICIO[tipoDeDia];
        const indiceEjemplo = recorrido.paradaIds.indexOf(EJEMPLO_PRD.paradaId);
        const esEjemplo =
          linea.id === EJEMPLO_PRD.lineaId && tipoDeDia === 'habil' && indiceEjemplo >= 0;
        if (esEjemplo) {
          // Se alinea la grilla para que el servicio de las 10:42 exista en par-101.
          primera += (EJEMPLO_PRD.minuto - desfases[indiceEjemplo] - primera) % frecuencia;
          if (primera < INICIO.habil) primera += frecuencia;
        }
        const tope = linea.id === LINEA_QUE_TERMINA_A_LAS_21 ? MIN_FIN_TEMPRANO : MIN_ULTIMO_PASO;
        for (let salida = primera; salida <= tope; salida += frecuencia) {
          for (const [i, paradaId] of recorrido.paradaIds.entries()) {
            const minuto = salida + desfases[i];
            if (minuto > tope) continue;
            const id =
              esEjemplo && paradaId === EJEMPLO_PRD.paradaId && minuto === EJEMPLO_PRD.minuto
                ? EJEMPLO_PRD.id
                : `hor-${siguiente++}`;
            filas.push({
              id,
              lineaId: linea.id,
              paradaId,
              sentido: recorrido.sentido,
              tipoDeDia,
              hora: hhmm(minuto),
            });
          }
        }
      }
    }
  }
  return filas;
}
