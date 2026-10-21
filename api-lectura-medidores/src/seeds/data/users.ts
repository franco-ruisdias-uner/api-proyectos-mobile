import type { Rol } from '../../../contract/types.js';

// Los usuarios de la app de clase (docs/reference/class-app/mocks/roster.ts),
// con los mismos ids, legajos y nombres. Contraseña de demo para todos: "lectura".

export const CONTRASENA_DEMO = 'lectura';

export interface SemillaUsuario {
  id: string;
  legajo: string;
  nombre: string;
  rol: Rol;
  biometriaActiva: boolean;
}

export const USUARIOS: SemillaUsuario[] = [
  {
    id: 'usr-011',
    legajo: 'L-011',
    nombre: 'Ramón Duarte',
    rol: 'lector',
    biometriaActiva: true,
  },
  {
    id: 'usr-012',
    legajo: 'L-012',
    nombre: 'Silvia Fernández',
    rol: 'lector',
    biometriaActiva: true,
  },
  {
    id: 'usr-013',
    legajo: 'L-013',
    nombre: 'Jorge Pereyra',
    rol: 'lector',
    biometriaActiva: false,
  },
  {
    id: 'usr-014',
    legajo: 'L-014',
    nombre: 'Marta Quiroga',
    rol: 'lector',
    biometriaActiva: true,
  },
  {
    id: 'usr-015',
    legajo: 'L-015',
    nombre: 'Carlos Ibáñez',
    rol: 'lector',
    biometriaActiva: false,
  },
  {
    id: 'usr-016',
    legajo: 'L-016',
    nombre: 'Ana Belén Sosa',
    rol: 'lector',
    biometriaActiva: true,
  },
  {
    id: 'usr-017',
    legajo: 'L-017',
    nombre: 'Pedro Álvarez',
    rol: 'lector',
    biometriaActiva: true,
  },
  {
    id: 'usr-018',
    legajo: 'L-018',
    nombre: 'Lucía Romero',
    rol: 'lector',
    biometriaActiva: false,
  },
  {
    id: 'usr-019',
    legajo: 'L-019',
    nombre: 'Héctor Gómez',
    rol: 'lector',
    biometriaActiva: true,
  },
  {
    id: 'usr-020',
    legajo: 'L-020',
    nombre: 'Norma Cabrera',
    rol: 'lector',
    biometriaActiva: false,
  },
  {
    id: 'usr-021',
    legajo: 'L-021',
    nombre: 'Diego Palacios',
    rol: 'lector',
    biometriaActiva: true,
  },
  {
    id: 'usr-022',
    legajo: 'L-022',
    nombre: 'Claudia Medina',
    rol: 'lector',
    biometriaActiva: true,
  },
  {
    id: 'usr-023',
    legajo: 'L-023',
    nombre: 'Raúl Benítez',
    rol: 'lector',
    biometriaActiva: false,
  },
  {
    id: 'usr-024',
    legajo: 'L-024',
    nombre: 'Verónica Acosta',
    rol: 'lector',
    biometriaActiva: true,
  },
  {
    id: 'usr-025',
    legajo: 'L-025',
    nombre: 'Miguel Torres',
    rol: 'lector',
    biometriaActiva: false,
  },
  {
    id: 'usr-026',
    legajo: 'L-026',
    nombre: 'Graciela Núñez',
    rol: 'lector',
    biometriaActiva: true,
  },
  {
    id: 'usr-027',
    legajo: 'L-027',
    nombre: 'Sergio Molina',
    rol: 'lector',
    biometriaActiva: true,
  },
  {
    id: 'usr-028',
    legajo: 'L-028',
    nombre: 'Patricia Leiva',
    rol: 'lector',
    biometriaActiva: false,
  },
  {
    id: 'usr-029',
    legajo: 'L-029',
    nombre: 'Oscar Paredes',
    rol: 'lector',
    biometriaActiva: true,
  },
  {
    id: 'usr-030',
    legajo: 'L-030',
    nombre: 'Laura Vidal',
    rol: 'administracion',
    biometriaActiva: false,
  },
];
