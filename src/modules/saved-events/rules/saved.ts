import type { Aviso } from '../../../common/notifications/notices.service.js';
import type { EstadoEventoContrato, EstadoGuardado } from '../../events/rules/agenda.js';

/** R17: sólo se guardan los eventos que todavía pueden pasar (programados o suspendidos). */
export function sePuedeGuardar(estadoVisible: EstadoEventoContrato): boolean {
  return estadoVisible === 'programado' || estadoVisible === 'suspendido';
}

/**
 * Especificación §7: la push que corresponde a un cambio de estado hecho por el admin, o `null`
 * si no hay que avisar. Avisa al pasar a `suspendido` o `cancelado` (desde otro estado) y al
 * volver de `suspendido` a `programado`. Un evento que ya terminó no avisa (M5-1).
 */
export function avisoPorCambioDeEstado(
  evento: { id: string; titulo: string },
  antes: EstadoGuardado,
  despues: EstadoGuardado,
  yaTermino: boolean,
): Aviso | null {
  if (antes === despues || yaTermino) return null;
  const datos = { tipo: 'evento-estado', eventoId: evento.id, estado: despues };
  if (despues === 'suspendido') {
    return { titulo: 'Evento suspendido', cuerpo: `Se suspendió «${evento.titulo}».`, datos };
  }
  if (despues === 'cancelado') {
    return { titulo: 'Evento cancelado', cuerpo: `Se canceló «${evento.titulo}».`, datos };
  }
  if (antes === 'suspendido') {
    return { titulo: 'El evento se hace', cuerpo: `«${evento.titulo}» se hace como estaba previsto.`, datos };
  }
  return null;
}
