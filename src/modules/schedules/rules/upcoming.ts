import type { Horario } from '../../../../contract/types.js';
import { diaEnZona, horaEnZona, sumarDias } from '../../../common/dates/dates.js';
import { tipoDeDia } from './day-type.js';

export interface PedidoDeProximos {
  ahora: Date;
  /** Las filas de la tabla de una parada, de todas las líneas y de todos los tipos de día. */
  horarios: readonly Horario[];
  /** Fechas "AAAA-MM-DD" de feriado que cubren, al menos, hoy y mañana. */
  feriados: ReadonlySet<string>;
  cantidad: number;
}

const comparar = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const porHoraEId = (a: Horario, b: Horario) => comparar(a.hora, b.hora) || comparar(a.id, b.id);

/**
 * R8: para cada línea, los `cantidad` pasos siguientes a `ahora` según la tabla del tipo de
 * día de hoy; si no alcanzan, se completa con los de mañana, con el tipo de día de mañana.
 * Un servicio del minuto actual todavía cuenta (A18). Orden cronológico: primero lo de hoy y
 * después lo de mañana. Sólo devuelve filas de la tabla (R9).
 */
export function proximosPasos(pedido: PedidoDeProximos): Horario[] {
  const hoy = diaEnZona(pedido.ahora);
  const horaActual = horaEnZona(pedido.ahora);
  const tipoHoy = tipoDeDia(hoy, pedido.feriados);
  const tipoManiana = tipoDeDia(sumarDias(hoy, 1), pedido.feriados);

  const lineas = new Map<string, Horario[]>();
  for (const horario of pedido.horarios) {
    const deLaLinea = lineas.get(horario.lineaId) ?? [];
    deLaLinea.push(horario);
    lineas.set(horario.lineaId, deLaLinea);
  }

  const elegidos: { dia: 0 | 1; horario: Horario }[] = [];
  for (const deLaLinea of lineas.values()) {
    const deHoy = deLaLinea
      .filter((x) => x.tipoDeDia === tipoHoy && x.hora >= horaActual)
      .sort(porHoraEId)
      .slice(0, pedido.cantidad);
    const faltan = pedido.cantidad - deHoy.length;
    const deManiana =
      faltan > 0
        ? deLaLinea
            .filter((x) => x.tipoDeDia === tipoManiana)
            .sort(porHoraEId)
            .slice(0, faltan)
        : [];
    for (const horario of deHoy) elegidos.push({ dia: 0, horario });
    for (const horario of deManiana) elegidos.push({ dia: 1, horario });
  }

  return elegidos
    .sort(
      (a, b) =>
        a.dia - b.dia ||
        comparar(a.horario.hora, b.horario.hora) ||
        comparar(a.horario.lineaId, b.horario.lineaId) ||
        comparar(a.horario.id, b.horario.id),
    )
    .map((x) => x.horario);
}
