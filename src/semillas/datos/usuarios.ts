import type { Rol } from '../../../contrato/tipos.js';

export const CONTRASENA_DEMO = 'demo1234';

export interface UsuarioSemilla {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  comercioId: string | null;
  avisosActivos: boolean;
}

/** ESPECIFICACION §8. Todos con la contraseña `demo1234`. */
export const USUARIOS: UsuarioSemilla[] = [
  {
    id: 'usr-512',
    nombre: 'Marta Giménez',
    email: 'marta@mail.com',
    rol: 'vecino',
    comercioId: null,
    avisosActivos: true,
  },
  {
    id: 'usr-nuevo',
    nombre: 'Vecino Nuevo',
    email: 'nuevo@demo.ar',
    rol: 'vecino',
    comercioId: null,
    avisosActivos: true,
  },
  {
    id: 'usr-tornillo',
    nombre: 'Ferretería El Tornillo',
    email: 'tornillo@demo.ar',
    rol: 'comercio',
    comercioId: 'com-118',
    avisosActivos: true,
  },
  {
    id: 'usr-otrocomercio',
    nombre: 'Otro Comercio',
    email: 'otro.comercio@demo.ar',
    rol: 'comercio',
    comercioId: 'com-201',
    avisosActivos: true,
  },
];
