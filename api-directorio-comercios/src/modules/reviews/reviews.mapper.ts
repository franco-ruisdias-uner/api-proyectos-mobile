import type { Resena as ResenaContrato } from '../../../contract/types.js';
import { aIsoConZona } from '../../common/dates/dates.js';
import type { Resena } from './review.entity.js';

export function resenaAContrato(r: Resena): ResenaContrato {
  return {
    id: r.id,
    comercioId: r.comercioId,
    usuarioId: r.usuarioId,
    estrellas: r.estrellas as ResenaContrato['estrellas'],
    comentario: r.comentario,
    respuesta: r.respuesta,
    reportada: r.reportada,
    creadaEn: aIsoConZona(r.creadaEn),
    // Si está en el servidor, está sincronizada (AGENTS §4.4).
    sincronizada: true,
  };
}
