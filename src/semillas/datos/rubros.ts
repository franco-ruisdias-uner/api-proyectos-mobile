import type { Rubro } from '../../../contrato/tipos.js';

/** Los 9 rubros del PRD §1. */
export const RUBROS: Rubro[] = [
  { id: 'rub-gastronomia', nombre: 'Gastronomía', icono: 'restaurant', color: '#D9534F', orden: 1 },
  { id: 'rub-indumentaria', nombre: 'Indumentaria', icono: 'shirt', color: '#8E5BB5', orden: 2 },
  { id: 'rub-hogar', nombre: 'Hogar', icono: 'home', color: '#3FA796', orden: 3 },
  {
    id: 'rub-ferreteria',
    nombre: 'Ferretería y construcción',
    icono: 'hammer',
    color: '#E8A33D',
    orden: 4,
  },
  { id: 'rub-salud', nombre: 'Salud y farmacia', icono: 'medkit', color: '#2F9E5B', orden: 5 },
  { id: 'rub-servicios', nombre: 'Servicios', icono: 'briefcase', color: '#4A7FC1', orden: 6 },
  { id: 'rub-tecnologia', nombre: 'Tecnología', icono: 'laptop', color: '#5B6FD6', orden: 7 },
  { id: 'rub-libreria', nombre: 'Librería', icono: 'book', color: '#B5793C', orden: 8 },
  { id: 'rub-otros', nombre: 'Otros', icono: 'ellipsis-horizontal', color: '#7A8691', orden: 9 },
];
