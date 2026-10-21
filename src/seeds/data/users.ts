import type { Preferencias } from '../../../contract/types.js';
import type { Rol } from '../../common/auth/decorators.js';

export interface UsuarioSemilla {
  id: string;
  nombre: string;
  email: string;
  contrasena: string;
  rol: Rol;
  /** Días antes del momento de sembrar. */
  creadoHaceDias: number;
  preferencias: Preferencias;
}

/** Usuarios de demo (especificación §8). Las contraseñas están en el README. */
export const USUARIOS_SEMILLA: UsuarioSemilla[] = [
  {
    // El usuario del ejemplo del PRD. Sus categorías favoritas se crean con el catálogo (M1).
    id: 'usr-201',
    nombre: 'Lucía Méndez',
    email: 'lucia@mail.com',
    contrasena: 'lucia1234',
    rol: 'turista',
    creadoHaceDias: 26,
    preferencias: {
      categoriasFavoritas: ['cat-museos', 'cat-playas'],
      avisarProximidad: true,
      radioAvisoMetros: 250,
      tema: 'sistema',
    },
  },
  {
    // Sin nada: para ver las listas vacías.
    id: 'usr-nuevo',
    nombre: 'Turista Nuevo',
    email: 'nuevo@demo.ar',
    contrasena: 'nuevo1234',
    rol: 'turista',
    creadoHaceDias: 0,
    preferencias: { categoriasFavoritas: [], avisarProximidad: true, radioAvisoMetros: 250, tema: 'sistema' },
  },
  {
    id: 'usr-turismo',
    nombre: 'Dirección de Turismo',
    email: 'turismo@colon.demo.ar',
    contrasena: 'turismo1234',
    rol: 'admin',
    creadoHaceDias: 60,
    preferencias: { categoriasFavoritas: [], avisarProximidad: false, radioAvisoMetros: 250, tema: 'claro' },
  },
];
