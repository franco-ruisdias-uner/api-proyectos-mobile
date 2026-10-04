// Usuarios de demo (ESPECIFICACION §8). Todos con la misma contraseña, que va en el README.
import type { Rol } from '../../../contrato/tipos.js';

export const CONTRASENA_DEMO = 'villaguay2026';

export interface UsuarioSemilla {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  rol: Rol;
  cancelacionesTardias: number;
  ausencias: number;
}

export const USUARIOS: UsuarioSemilla[] = [
  // El del PRD, con sus datos exactos.
  {
    id: 'usr-207',
    nombre: 'Emiliano Ruiz',
    email: 'emiliano@mail.com',
    telefono: '3455-401122',
    rol: 'jugador',
    cancelacionesTardias: 1,
    ausencias: 0,
  },
  {
    id: 'usr-208',
    nombre: 'Lucía Benítez',
    email: 'lleno@demo.ar',
    telefono: '3455-402233',
    rol: 'jugador',
    cancelacionesTardias: 0,
    ausencias: 0,
  },
  {
    id: 'usr-209',
    nombre: 'Tomás Acosta',
    email: 'nuevo@demo.ar',
    telefono: '3455-403344',
    rol: 'jugador',
    cancelacionesTardias: 0,
    ausencias: 0,
  },
  {
    id: 'usr-301',
    nombre: 'Marcelo Godoy',
    email: 'marcelo@villaguay.demo.ar',
    telefono: '3455-420001',
    rol: 'encargado',
    cancelacionesTardias: 0,
    ausencias: 0,
  },
  {
    id: 'usr-302',
    nombre: 'Nahuel Ojeda',
    email: 'nahuel@villaguay.demo.ar',
    telefono: '3455-420002',
    rol: 'administrador',
    cancelacionesTardias: 0,
    ausencias: 0,
  },
];
