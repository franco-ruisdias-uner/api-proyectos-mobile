import type { Coordenadas } from '../../../contract/types.js';
import type { EstadoGuardado } from '../../modules/events/rules/agenda.js';

/**
 * Agenda de demo (especificación §8). Todo es relativo al día en que se siembra, en hora de
 * Buenos Aires: `dia` es la cantidad de días desde hoy y `hora` el "HH:MM" de ese día.
 */
export interface Momento {
  dia: number;
  hora: string;
}

export interface EventoSemilla {
  id: string;
  titulo: string;
  descripcion: string;
  lugarId: string | null;
  direccionLibre: string | null;
  coordenadas: Coordenadas | null;
  inicio: Momento;
  fin: Momento | null;
  /** Archivo de `medios/`. */
  imagen: string | null;
  precio: number | null;
  estado: EstadoGuardado;
}

export const EVENTOS_SEMILLA: EventoSemilla[] = [
  {
    // El ejemplo del PRD: una peña en el anfiteatro. Hoy a la noche.
    id: 'evt-017',
    titulo: 'Peña en el anfiteatro',
    descripcion: 'Noche de folclore con artistas de la región.',
    lugarId: 'lug-009',
    direccionLibre: null,
    coordenadas: null,
    inicio: { dia: 0, hora: '21:00' },
    fin: { dia: 1, hora: '02:00' },
    imagen: 'museums-1.png',
    precio: 0,
    estado: 'programado',
  },
  {
    id: 'evt-018',
    titulo: 'Noche de luces en la costanera',
    descripcion:
      'Música en vivo y fuegos artificiales sobre el río. Empieza a la noche y sigue hasta la madrugada: cruza la medianoche.',
    lugarId: 'lug-014',
    direccionLibre: null,
    coordenadas: null,
    inicio: { dia: 0, hora: '23:00' },
    fin: { dia: 1, hora: '03:00' },
    imagen: 'beaches-1.png',
    precio: 5000,
    estado: 'programado',
  },
  {
    // Gratis y sin hora de fin: cuenta hasta las 23:59 de su día.
    id: 'evt-019',
    titulo: 'Feria de artesanos en la plaza',
    descripcion:
      'Artesanías, dulces caseros y comidas regionales en la Plaza San Martín. La entrada es libre.',
    lugarId: 'lug-027',
    direccionLibre: null,
    coordenadas: null,
    inicio: { dia: 1, hora: '17:00' },
    fin: null,
    imagen: 'crafts-1.png',
    precio: 0,
    estado: 'programado',
  },
  {
    // Sin lugar del catálogo: dirección libre y coordenadas. Sin precio conocido.
    id: 'evt-020',
    titulo: 'Peña folklórica en el Club de Pescadores',
    descripcion: 'Empanadas, guitarreada y baile. Consultá el precio en el club.',
    lugarId: null,
    direccionLibre: 'Club de Pescadores, Costanera Norte, Colón',
    coordenadas: { latitud: -32.2101, longitud: -58.1402 },
    inicio: { dia: 2, hora: '20:30' },
    fin: { dia: 2, hora: '23:59' },
    imagen: null,
    precio: null,
    estado: 'programado',
  },
  {
    id: 'evt-021',
    titulo: 'Regata del río Uruguay',
    descripcion: 'Regata de veleros frente a la costanera. Suspendida por el pronóstico de viento.',
    lugarId: 'lug-007',
    direccionLibre: null,
    coordenadas: null,
    inicio: { dia: 3, hora: '15:00' },
    fin: { dia: 3, hora: '19:00' },
    imagen: 'nature-1.png',
    precio: 0,
    estado: 'suspendido',
  },
  {
    id: 'evt-022',
    titulo: 'Cine bajo las estrellas',
    descripcion: 'Función al aire libre en el parque. Cancelada.',
    lugarId: 'lug-015',
    direccionLibre: null,
    coordenadas: null,
    inicio: { dia: 5, hora: '21:30' },
    fin: null,
    imagen: null,
    precio: 1200,
    estado: 'cancelado',
  },
  {
    id: 'evt-023',
    titulo: 'Fiesta de la Playa',
    descripcion: 'Música, deportes de playa y un día entero en la Playa Norte.',
    lugarId: 'lug-002',
    direccionLibre: null,
    coordenadas: null,
    inicio: { dia: 10, hora: '11:00' },
    fin: { dia: 10, hora: '20:00' },
    imagen: 'beaches-2.png',
    precio: 0,
    estado: 'programado',
  },
  {
    // Ya terminó: sale como `finalizado` (se calcula).
    id: 'evt-024',
    titulo: 'Muestra de fotografía de Colón',
    descripcion: 'Fotos históricas de la ciudad en el Museo Casa de la Cultura.',
    lugarId: 'lug-005',
    direccionLibre: null,
    coordenadas: null,
    inicio: { dia: -3, hora: '18:00' },
    fin: { dia: -3, hora: '21:00' },
    imagen: 'museums-2.png',
    precio: 0,
    estado: 'programado',
  },
];
