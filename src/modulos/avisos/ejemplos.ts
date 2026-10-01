import type { Aviso } from '../../../contrato/tipos.js';

/** Ejemplo del PRD (avi-088), para Swagger. */
export const AVISO_DE_EJEMPLO: Aviso = {
  id: 'avi-088',
  titulo: 'Desvío por obra en calle Corrientes',
  detalle: 'Por una obra, las líneas 2, 7 y 9 no pasan por Corrientes entre Urquiza y Racedo.',
  lineaIds: ['lin-02', 'lin-07', 'lin-09'],
  desde: '2026-09-19T08:00:00-03:00',
  hasta: '2026-09-26T18:00:00-03:00',
  gravedad: 'desvio',
  trazadoAlternativo: [
    { latitud: -31.7333, longitud: -60.5241 },
    { latitud: -31.7345, longitud: -60.5198 },
  ],
  videoUrl: 'http://192.168.0.10:3000/archivos/videos/2026/09/k3j9x0a2b7c1d4e5f6g8h9i0.mp4',
};
