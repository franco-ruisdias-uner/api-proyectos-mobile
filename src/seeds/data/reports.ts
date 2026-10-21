// Reportes de demo (ESPECIFICACION §8): los del PRD con sus ids exactos y los casos feos.
// Las fechas son relativas al reloj de la API, para que siempre sean "de hace poco".
import type { EstadoReporte } from '../../../contract/types.js';

export interface CambioDemo {
  id?: string;
  estado: EstadoReporte;
  comentario: string | null;
  operadorId: string | null;
  /** Minutos después de la creación del reporte. */
  despuesDeMin: number;
}

export interface FotoDemo {
  id?: string;
  momento: 'problema' | 'arreglo';
  color: [number, number, number];
}

export interface ReporteDemo {
  id: string;
  /** Correlativo dentro del año de creación. */
  numero: number;
  tipoId: string;
  descripcion: string | null;
  conAudio?: boolean;
  fotos: FotoDemo[];
  latitud: number;
  longitud: number;
  direccion: string;
  zonaId: string;
  estado: EstadoReporte;
  autorId: string;
  cuadrillaId: string | null;
  duplicadoDe: string | null;
  /** Minutos antes de "ahora". */
  haceMin: number;
  cambios: CambioDemo[];
  /** Vecinos que se sumaron al reporte (ids de usuario). */
  adhesionesDe?: string[];
}

const DIA = 24 * 60;
const NAranja: [number, number, number] = [180, 100, 50];
const NAzul: [number, number, number] = [60, 100, 170];
const NVerde: [number, number, number] = [70, 140, 80];
const NGris: [number, number, number] = [120, 120, 130];

const recibido = (): CambioDemo => ({
  estado: 'recibido',
  comentario: null,
  operadorId: null,
  despuesDeMin: 0,
});

const MOTIVO_LARGO =
  'Revisamos el reclamo con el área de Tránsito y con la Dirección de Obras Públicas. La calle donde ' +
  'se ubica el problema es de jurisdicción provincial (ruta de acceso), por lo que la Municipalidad no ' +
  'puede intervenir ni contratar la reparación sin un convenio previo con Vialidad. Ya enviamos el ' +
  'reclamo por nota oficial a la delegación de Vialidad Provincial, y le sugerimos volver a reportarlo ' +
  'en el canal de la provincia si en treinta días no hay novedades. Lamentamos las molestias y ' +
  'agradecemos que nos avise: cada reporte ayuda a ordenar los pedidos que sí le corresponden a la ciudad.';

/** Cinco baches a menos de 50 m entre sí, en Rocamora y Bolívar (los "catorce baches repetidos"). */
const BASE = { latitud: -33.0089, longitud: -58.5142 };
const punto = (dLat: number, dLon: number) => ({
  latitud: BASE.latitud + dLat,
  longitud: BASE.longitud + dLon,
});

export const REPORTES_DEMO: ReporteDemo[] = [
  {
    // El del PRD.
    id: 'rep-00412',
    numero: 412,
    tipoId: 'tip-bache',
    descripcion: 'Pozo grande frente al 1240, ya rompió dos cubiertas.',
    fotos: [{ id: 'fot-901', momento: 'problema', color: NAranja }],
    ...BASE,
    direccion: 'Rocamora 1240',
    zonaId: 'zon-norte',
    estado: 'asignado',
    autorId: 'usr-084',
    cuadrillaId: 'cua-02',
    duplicadoDe: null,
    haceMin: 4 * DIA,
    adhesionesDe: ['usr-101', 'usr-102', 'usr-103', 'usr-104', 'usr-nuevo'],
    cambios: [
      { ...recibido(), id: 'cam-1176' },
      {
        id: 'cam-1177',
        estado: 'en_revision',
        comentario: 'Lo vemos con Obras Públicas.',
        operadorId: 'usr-003',
        despuesDeMin: 180,
      },
      {
        estado: 'asignado',
        comentario: 'Pasa a la Cuadrilla 2, bacheo de la semana.',
        operadorId: 'usr-003',
        despuesDeMin: 1500,
      },
    ],
  },
  {
    // Cinco cambios de estado, con reasignación y foto del arreglo.
    id: 'rep-00398',
    numero: 398,
    tipoId: 'tip-luminaria',
    descripcion: 'La luz de la esquina está apagada hace una semana.',
    fotos: [
      { momento: 'problema', color: NAzul },
      { momento: 'arreglo', color: NVerde },
    ],
    latitud: -33.041,
    longitud: -58.526,
    direccion: 'Bv. Pedro Jurado y Concordia',
    zonaId: 'zon-sur',
    estado: 'resuelto',
    autorId: 'usr-084',
    cuadrillaId: 'cua-05',
    duplicadoDe: null,
    haceMin: 20 * DIA,
    cambios: [
      recibido(),
      {
        estado: 'en_revision',
        comentario: null,
        operadorId: 'usr-004',
        despuesDeMin: 120,
      },
      {
        estado: 'asignado',
        comentario: 'Cuadrilla 4.',
        operadorId: 'usr-004',
        despuesDeMin: 600,
      },
      {
        estado: 'asignado',
        comentario: 'La 4 no tiene escalera larga: pasa a la Cuadrilla 5.',
        operadorId: 'usr-004',
        despuesDeMin: 2000,
      },
      {
        estado: 'resuelto',
        comentario: 'Se cambió el equipo.',
        operadorId: 'usr-004',
        despuesDeMin: 4300,
      },
    ],
  },
  {
    // Rechazado con un motivo de más de 400 caracteres.
    id: 'rep-00405',
    numero: 405,
    tipoId: 'tip-otro',
    descripcion: 'Hundimiento en el acceso a la ciudad.',
    fotos: [{ momento: 'problema', color: NGris }],
    latitud: -33.005,
    longitud: -58.556,
    direccion: 'Acceso Oeste km 2',
    zonaId: 'zon-oeste',
    estado: 'rechazado',
    autorId: 'usr-084',
    cuadrillaId: null,
    duplicadoDe: null,
    haceMin: 12 * DIA,
    cambios: [
      recibido(),
      {
        estado: 'rechazado',
        comentario: MOTIVO_LARGO,
        operadorId: 'usr-003',
        despuesDeMin: 2900,
      },
    ],
  },
  // Cinco baches a menos de 50 m (Rocamora y Bolívar); el último es duplicado del primero.
  {
    id: 'rep-00420',
    numero: 420,
    tipoId: 'tip-bache',
    descripcion: 'Bache en la esquina de Rocamora y Bolívar.',
    fotos: [{ momento: 'problema', color: NAranja }],
    ...punto(0.0001, 0.00005),
    direccion: 'Rocamora y Bolívar',
    zonaId: 'zon-norte',
    estado: 'en_revision',
    autorId: 'usr-101',
    cuadrillaId: null,
    duplicadoDe: null,
    haceMin: 3 * DIA,
    adhesionesDe: ['usr-084', 'usr-nuevo'],
    cambios: [
      recibido(),
      {
        estado: 'en_revision',
        comentario: null,
        operadorId: 'usr-003',
        despuesDeMin: 400,
      },
    ],
  },
  {
    id: 'rep-00421',
    numero: 421,
    tipoId: 'tip-bache',
    descripcion: 'Otro pozo, a media cuadra del anterior.',
    fotos: [{ momento: 'problema', color: NAranja }],
    ...punto(-0.0001, 0.0001),
    direccion: 'Bolívar 310',
    zonaId: 'zon-norte',
    estado: 'recibido',
    autorId: 'usr-102',
    cuadrillaId: null,
    duplicadoDe: null,
    haceMin: 2 * DIA,
    cambios: [recibido()],
  },
  {
    id: 'rep-00422',
    numero: 422,
    tipoId: 'tip-bache',
    descripcion: null,
    fotos: [{ momento: 'problema', color: NAranja }],
    ...punto(0.00005, -0.0001),
    direccion: 'Rocamora 1236',
    zonaId: 'zon-norte',
    estado: 'recibido',
    autorId: 'usr-103',
    cuadrillaId: null,
    duplicadoDe: null,
    haceMin: 1 * DIA,
    cambios: [recibido()],
  },
  {
    id: 'rep-00423',
    numero: 423,
    tipoId: 'tip-bache',
    descripcion: 'Se hunde el asfalto.',
    fotos: [{ momento: 'problema', color: NAranja }],
    ...punto(-0.00008, -0.00008),
    direccion: 'Rocamora 1250',
    zonaId: 'zon-norte',
    estado: 'recibido',
    autorId: 'usr-104',
    cuadrillaId: null,
    duplicadoDe: null,
    haceMin: 20 * 60,
    cambios: [recibido()],
  },
  {
    id: 'rep-00424',
    numero: 424,
    tipoId: 'tip-bache',
    descripcion: 'El mismo pozo de Rocamora 1240.',
    fotos: [{ momento: 'problema', color: NAranja }],
    ...punto(0.00002, 0.00002),
    direccion: 'Rocamora 1240',
    zonaId: 'zon-norte',
    estado: 'rechazado',
    autorId: 'usr-102',
    cuadrillaId: null,
    duplicadoDe: 'rep-00412',
    haceMin: 3 * DIA,
    cambios: [
      recibido(),
      {
        estado: 'rechazado',
        comentario: 'Duplicado de GCHU-{anio}-00412',
        operadorId: 'usr-003',
        despuesDeMin: 60,
      },
    ],
  },
  // Dos fotos.
  {
    id: 'rep-00430',
    numero: 430,
    tipoId: 'tip-basura',
    descripcion: 'Basura acumulada en la esquina, hace días.',
    fotos: [
      { momento: 'problema', color: NGris },
      { momento: 'problema', color: NVerde },
    ],
    latitud: -33.018,
    longitud: -58.55,
    direccion: 'San Martín 850',
    zonaId: 'zon-oeste',
    estado: 'recibido',
    autorId: 'usr-101',
    cuadrillaId: null,
    duplicadoDe: null,
    haceMin: 6 * 60,
    cambios: [recibido()],
  },
  // Con audio, sin texto.
  {
    id: 'rep-00431',
    numero: 431,
    tipoId: 'tip-agua',
    descripcion: null,
    conAudio: true,
    fotos: [{ momento: 'problema', color: NAzul }],
    latitud: -33.021,
    longitud: -58.49,
    direccion: 'Urquiza 1520',
    zonaId: 'zon-este',
    estado: 'en_revision',
    autorId: 'usr-103',
    cuadrillaId: null,
    duplicadoDe: null,
    haceMin: 2 * DIA,
    cambios: [
      recibido(),
      {
        estado: 'en_revision',
        comentario: 'Avisamos a Obras Sanitarias.',
        operadorId: 'usr-003',
        despuesDeMin: 90,
      },
    ],
  },
  {
    id: 'rep-00432',
    numero: 432,
    tipoId: 'tip-semaforo',
    descripcion: 'El semáforo queda en rojo para todos.',
    fotos: [{ momento: 'problema', color: [170, 60, 60] }],
    latitud: -33.0,
    longitud: -58.485,
    direccion: 'Bv. Irazusta y Rocamora',
    zonaId: 'zon-este',
    estado: 'recibido',
    autorId: 'usr-104',
    cuadrillaId: null,
    duplicadoDe: null,
    haceMin: 90,
    cambios: [recibido()],
  },
  {
    id: 'rep-00433',
    numero: 433,
    tipoId: 'tip-rama',
    descripcion: 'Rama grande sobre la vereda.',
    fotos: [{ momento: 'problema', color: NVerde }],
    latitud: -33.046,
    longitud: -58.51,
    direccion: 'Costanera y Ayacucho',
    zonaId: 'zon-sur',
    estado: 'en_revision',
    autorId: 'usr-084',
    cuadrillaId: null,
    duplicadoDe: null,
    haceMin: 5 * DIA,
    adhesionesDe: ['usr-101'],
    cambios: [
      recibido(),
      {
        estado: 'en_revision',
        comentario: null,
        operadorId: 'usr-004',
        despuesDeMin: 300,
      },
    ],
  },
  {
    id: 'rep-00434',
    numero: 434,
    tipoId: 'tip-vereda',
    descripcion: 'Baldosas sueltas, se tropiezan los chicos.',
    fotos: [{ momento: 'problema', color: [150, 90, 160] }],
    latitud: -33.01,
    longitud: -58.552,
    direccion: 'Rivadavia 1120',
    zonaId: 'zon-oeste',
    estado: 'asignado',
    autorId: 'usr-102',
    cuadrillaId: 'cua-08',
    duplicadoDe: null,
    haceMin: 9 * DIA,
    cambios: [
      recibido(),
      {
        estado: 'en_revision',
        comentario: null,
        operadorId: 'usr-003',
        despuesDeMin: 200,
      },
      {
        estado: 'asignado',
        comentario: 'Entra en el plan de veredas del mes.',
        operadorId: 'usr-003',
        despuesDeMin: 1800,
      },
    ],
  },
];
