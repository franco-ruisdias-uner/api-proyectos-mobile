// Usuarios de demo (ESPECIFICACION §8). Todos con la misma contraseña, que va en el README.
import type { Rol } from '../../../contrato/tipos.js';

export const CONTRASENA_DEMO = 'demo1234';

export interface UsuarioDemo {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  rol: Rol;
  zonaId: string | null;
  avisosActivos: boolean;
  creadoEn: string;
}

export const USUARIOS_DEMO: UsuarioDemo[] = [
  {
    id: 'usr-084',
    nombre: 'Norma Pereyra',
    email: 'norma@mail.com',
    telefono: '3446 412233',
    rol: 'vecino',
    zonaId: null,
    avisosActivos: true,
    creadoEn: '2026-03-02T09:15:00-03:00',
  },
  {
    id: 'usr-nuevo',
    nombre: 'Julián Correa',
    email: 'nuevo@demo.ar',
    telefono: null,
    rol: 'vecino',
    zonaId: null,
    avisosActivos: true,
    creadoEn: '2026-09-01T18:40:00-03:00',
  },
  {
    id: 'usr-003',
    nombre: 'Marcela Ibarra',
    email: 'operador.norte@demo.ar',
    telefono: '3446 425000',
    rol: 'operador',
    zonaId: 'zon-norte',
    avisosActivos: true,
    creadoEn: '2025-11-10T08:00:00-03:00',
  },
  {
    id: 'usr-004',
    nombre: 'Diego Montenegro',
    email: 'operador.sur@demo.ar',
    telefono: null,
    rol: 'operador',
    zonaId: 'zon-sur',
    avisosActivos: false,
    creadoEn: '2025-11-10T08:05:00-03:00',
  },
  // Otros vecinos, para que haya reportes de varias personas (baches repetidos, etc.).
  ...[
    ['usr-101', 'Lucía Fernández', 'lucia@demo.ar'],
    ['usr-102', 'Tomás Acosta', 'tomas@demo.ar'],
    ['usr-103', 'Carolina Sosa', 'carolina@demo.ar'],
    ['usr-104', 'Martín Benítez', 'martin@demo.ar'],
  ].map(([id, nombre, email]): UsuarioDemo => ({
    id,
    nombre,
    email,
    telefono: null,
    rol: 'vecino',
    zonaId: null,
    avisosActivos: true,
    creadoEn: '2026-05-20T10:00:00-03:00',
  })),
];
