import type { Linea, Parada } from '../../../contract/types.js';

/** Ejemplos del PRD, para Swagger. */
export const LINEA_DE_EJEMPLO: Linea = {
  id: 'lin-05',
  numero: '5',
  nombre: 'Puerto Viejo — San Agustín',
  color: '#1B6CA8',
  empresa: 'Transporte Mariano Moreno',
  recorridos: [
    {
      sentido: 'ida',
      destino: 'hacia Puerto Viejo',
      trazado: [
        { latitud: -31.73, longitud: -60.53 },
        { latitud: -31.7333, longitud: -60.5241 },
      ],
      paradaIds: ['par-101', 'par-102', 'par-103'],
    },
  ],
  activa: true,
};

export const PARADA_DE_EJEMPLO: Parada = {
  id: 'par-101',
  nombre: 'Alameda y Urquiza',
  coordenadas: { latitud: -31.7333, longitud: -60.5241 },
  lineaIds: ['lin-05', 'lin-14'],
  sentido: 'ida',
  refugio: true,
  codigoQr: 'PARANA:par-101',
};
