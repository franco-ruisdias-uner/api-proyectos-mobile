import type { Rol } from '../../comun/auth/roles.js';

export interface UsuarioSemilla {
  id: string;
  nombre: string;
  email: string;
  contrasena: string;
  rol: Rol;
}

/** Contraseña de todas las cuentas de demo (va en el README). */
export const CONTRASENA_DE_DEMO = 'demo1234';

export const USUARIOS: UsuarioSemilla[] = [
  // Del PRD, con su id exacto. Sus favoritos son lin-05 y par-101 (FAVORITAS_DE_DEMO).
  { id: 'usr-320', nombre: 'Julián Ferrari', email: 'julian@mail.com', contrasena: CONTRASENA_DE_DEMO, rol: 'pasajero' },
  // Cuenta sin nada: sirve para ver las listas vacías.
  { id: 'usr-nuevo', nombre: 'Usuario Nuevo', email: 'nuevo@demo.ar', contrasena: CONTRASENA_DE_DEMO, rol: 'pasajero' },
  // La Dirección de Transporte: publica avisos y ve el resumen de reportes.
  { id: 'usr-direccion', nombre: 'Dirección de Transporte', email: 'transporte@parana.demo.ar', contrasena: CONTRASENA_DE_DEMO, rol: 'direccion' },
];

/** Favoritos de demo, en orden de alta. El resto de las cuentas no tiene ninguno. */
export const FAVORITAS_DE_DEMO: Record<string, { lineas: string[]; paradas: string[] }> = {
  'usr-320': { lineas: ['lin-05'], paradas: ['par-101'] },
};
