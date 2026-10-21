/** Roles internos (D1): el Usuario del PRD no tiene rol; la columna no sale en respuestas. */
export const ROLES = ['pasajero', 'direccion'] as const;
export type Rol = (typeof ROLES)[number];

/** El rol que crea el registro público (AGENTS §7.1). */
export const ROL_COMUN: Rol = 'pasajero';
