// Las rutas de barrio de la app de clase (mocks/roster.ts, `extraRouteSeeds`), en su orden.
// Cada una tiene 20 suministros sobre su calle, un lector y un estado.
import type { EstadoRuta } from '../../../contrato/tipos.js';

export interface Barrio {
  numero: string;
  nombre: string;
  calle: string;
  estado: EstadoRuta;
  lectorId: string;
}

export const BARRIOS: Barrio[] = [
  {
    numero: '01',
    nombre: 'Centro',
    calle: 'San Martín',
    estado: 'asignada',
    lectorId: 'usr-012',
  },
  {
    numero: '02',
    nombre: 'Barrio Sur',
    calle: 'Belgrano',
    estado: 'en_curso',
    lectorId: 'usr-013',
  },
  {
    numero: '03',
    nombre: 'Villa Libertad',
    calle: 'Urquiza',
    estado: 'cerrada',
    lectorId: 'usr-014',
  },
  {
    numero: '04',
    nombre: 'Barrio Norte',
    calle: 'Moreno',
    estado: 'asignada',
    lectorId: 'usr-015',
  },
  {
    numero: '05',
    nombre: 'San Isidro',
    calle: 'Mitre',
    estado: 'en_curso',
    lectorId: 'usr-016',
  },
  {
    numero: '06',
    nombre: 'Los Pinos',
    calle: 'Sarmiento',
    estado: 'cerrada',
    lectorId: 'usr-017',
  },
  {
    numero: '08',
    nombre: 'La Estación',
    calle: 'Rivadavia',
    estado: 'asignada',
    lectorId: 'usr-018',
  },
  {
    numero: '09',
    nombre: 'Parque del Sol',
    calle: 'Alberdi',
    estado: 'en_curso',
    lectorId: 'usr-019',
  },
  {
    numero: '10',
    nombre: 'Barrio Oeste',
    calle: 'Pellegrini',
    estado: 'cerrada',
    lectorId: 'usr-020',
  },
  {
    numero: '11',
    nombre: 'Costa del Uruguay',
    calle: 'Costanera',
    estado: 'asignada',
    lectorId: 'usr-021',
  },
  {
    numero: '13',
    nombre: 'Santa Rosa',
    calle: '25 de Mayo',
    estado: 'en_curso',
    lectorId: 'usr-022',
  },
  {
    numero: '14',
    nombre: 'Las Heras',
    calle: 'Las Heras',
    estado: 'cerrada',
    lectorId: 'usr-023',
  },
  {
    numero: '15',
    nombre: 'San Martín',
    calle: 'Independencia',
    estado: 'asignada',
    lectorId: 'usr-024',
  },
  {
    numero: '16',
    nombre: 'Barrio Este',
    calle: 'España',
    estado: 'en_curso',
    lectorId: 'usr-025',
  },
  {
    numero: '17',
    nombre: 'El Molino',
    calle: 'Italia',
    estado: 'cerrada',
    lectorId: 'usr-026',
  },
  {
    numero: '18',
    nombre: 'La Floresta',
    calle: 'Francia',
    estado: 'asignada',
    lectorId: 'usr-027',
  },
  {
    numero: '19',
    nombre: 'Pueblo Nuevo',
    calle: 'Chile',
    estado: 'en_curso',
    lectorId: 'usr-028',
  },
  {
    numero: '20',
    nombre: 'Almirante Brown',
    calle: 'Brown',
    estado: 'cerrada',
    lectorId: 'usr-029',
  },
];
