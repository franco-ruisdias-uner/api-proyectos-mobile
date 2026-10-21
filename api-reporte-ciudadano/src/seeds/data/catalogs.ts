// Catálogos de demo (ESPECIFICACION §8): tipos de reporte, zonas y cuadrillas.
import type { Coordenadas } from '../../../contract/types.js';

export interface TipoDemo {
  id: string;
  nombre: string;
  icono: string;
  color: string;
  areaResponsable: string;
}

/** Los ocho tipos del PRD §1. Los íconos son nombres de Ionicons que existen. */
export const TIPOS_DEMO: TipoDemo[] = [
  {
    id: 'tip-bache',
    nombre: 'Bache',
    icono: 'construct',
    color: '#E67E22',
    areaResponsable: 'Obras Públicas',
  },
  {
    id: 'tip-luminaria',
    nombre: 'Luminaria apagada',
    icono: 'bulb',
    color: '#F1C40F',
    areaResponsable: 'Alumbrado Público',
  },
  {
    id: 'tip-basura',
    nombre: 'Basura acumulada',
    icono: 'trash',
    color: '#7F8C8D',
    areaResponsable: 'Higiene Urbana',
  },
  {
    id: 'tip-rama',
    nombre: 'Rama o árbol caído',
    icono: 'leaf',
    color: '#27AE60',
    areaResponsable: 'Espacios Verdes',
  },
  {
    id: 'tip-agua',
    nombre: 'Pérdida de agua o cloaca',
    icono: 'water',
    color: '#2980B9',
    areaResponsable: 'Obras Sanitarias',
  },
  {
    id: 'tip-semaforo',
    nombre: 'Semáforo con falla',
    icono: 'stop-circle',
    color: '#C0392B',
    areaResponsable: 'Tránsito',
  },
  {
    id: 'tip-vereda',
    nombre: 'Vereda rota',
    icono: 'walk',
    color: '#8E44AD',
    areaResponsable: 'Obras Públicas',
  },
  {
    id: 'tip-otro',
    nombre: 'Otro problema',
    icono: 'ellipsis-horizontal-circle',
    color: '#34495E',
    areaResponsable: 'Centro de Atención al Vecino',
  },
];

export interface ZonaDemo {
  id: string;
  nombre: string;
  limite: Coordenadas[];
  referente: string;
}

/**
 * Cuatro zonas que se reparten un rectángulo sobre la planta urbana de Gualeguaychú: cada
 * una es el triángulo que forman un lado del rectángulo y el centro. Comparten aristas, así
 * que no se superponen ni dejan huecos.
 */
const NO = { latitud: -32.975, longitud: -58.565 };
const NE = { latitud: -32.975, longitud: -58.475 };
const SE = { latitud: -33.055, longitud: -58.475 };
const SO = { latitud: -33.055, longitud: -58.565 };
const CENTRO = { latitud: -33.02, longitud: -58.52 };

/** Rectángulo que cubren las zonas (lo usa el test de cobertura). */
export const CAJA_DE_LAS_ZONAS = {
  norte: NO.latitud,
  sur: SO.latitud,
  este: NE.longitud,
  oeste: NO.longitud,
};

export const ZONAS_DEMO: ZonaDemo[] = [
  {
    id: 'zon-norte',
    nombre: 'Zona Norte',
    limite: [NO, NE, CENTRO],
    referente: 'Marcela Ibarra',
  },
  {
    id: 'zon-este',
    nombre: 'Zona Este',
    limite: [NE, SE, CENTRO],
    referente: 'Rubén Godoy',
  },
  {
    id: 'zon-sur',
    nombre: 'Zona Sur',
    limite: [SE, SO, CENTRO],
    referente: 'Diego Montenegro',
  },
  {
    id: 'zon-oeste',
    nombre: 'Zona Oeste',
    limite: [SO, NO, CENTRO],
    referente: 'Analía Fernández',
  },
];

export interface CuadrillaDemo {
  id: string;
  nombre: string;
  zonaId: string;
  especialidad: string;
  activa: boolean;
}

export const CUADRILLAS_DEMO: CuadrillaDemo[] = [
  {
    id: 'cua-01',
    nombre: 'Cuadrilla 1 — Alumbrado',
    zonaId: 'zon-norte',
    especialidad: 'Alumbrado público',
    activa: true,
  },
  {
    id: 'cua-02',
    nombre: 'Cuadrilla 2 — Bacheo',
    zonaId: 'zon-norte',
    especialidad: 'Bacheo y calzadas',
    activa: true,
  },
  {
    id: 'cua-03',
    nombre: 'Cuadrilla 3 — Limpieza',
    zonaId: 'zon-norte',
    especialidad: 'Higiene urbana',
    activa: false,
  },
  {
    id: 'cua-04',
    nombre: 'Cuadrilla 4 — Bacheo',
    zonaId: 'zon-sur',
    especialidad: 'Bacheo y calzadas',
    activa: true,
  },
  {
    id: 'cua-05',
    nombre: 'Cuadrilla 5 — Alumbrado',
    zonaId: 'zon-sur',
    especialidad: 'Alumbrado público',
    activa: true,
  },
  {
    id: 'cua-06',
    nombre: 'Cuadrilla 6 — Espacios verdes',
    zonaId: 'zon-este',
    especialidad: 'Poda y árboles',
    activa: true,
  },
  {
    id: 'cua-07',
    nombre: 'Cuadrilla 7 — Agua y cloacas',
    zonaId: 'zon-este',
    especialidad: 'Obras sanitarias',
    activa: true,
  },
  {
    id: 'cua-08',
    nombre: 'Cuadrilla 8 — Veredas',
    zonaId: 'zon-oeste',
    especialidad: 'Veredas y cordones',
    activa: true,
  },
  {
    id: 'cua-09',
    nombre: 'Cuadrilla 9 — Limpieza',
    zonaId: 'zon-oeste',
    especialidad: 'Higiene urbana',
    activa: true,
  },
];
