import type { Resena as ResenaContrato } from '../../../contrato/tipos.js';
import { aIsoConZona } from '../../comun/fechas/fechas.js';
import type { Resena } from './resena.entidad.js';

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
