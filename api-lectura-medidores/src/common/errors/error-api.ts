import { CATALOGO, type CodigoError } from './catalog.js';

/**
 * Error de negocio con un código del catálogo. El filtro global lo convierte en
 * `{ error: { codigo, mensaje } }` con el estado HTTP del catálogo.
 */
export class ErrorApi extends Error {
  readonly estado: number;

  constructor(
    readonly codigo: CodigoError,
    mensaje?: string,
  ) {
    super(mensaje ?? CATALOGO[codigo].mensaje);
    this.estado = CATALOGO[codigo].estado;
  }
}

/** ¿El error de la base es por un índice único (o clave primaria) repetido? En los cuatro motores. */
export function esViolacionDeUnicidad(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const e = error as { code?: unknown; errno?: unknown; driverError?: unknown };
  const conductor = (e.driverError ?? e) as { code?: unknown; errno?: unknown };
  const codigo = conductor.code;
  return (
    codigo === '23505' || // PostgreSQL
    codigo === 'ER_DUP_ENTRY' || // MySQL y MariaDB
    conductor.errno === 1062 ||
    codigo === 'SQLITE_CONSTRAINT_UNIQUE' ||
    codigo === 'SQLITE_CONSTRAINT_PRIMARYKEY'
  );
}

/** ¿La base abortó la transacción por un bloqueo cruzado? Se puede reintentar. En los cuatro motores. */
export function esDeadlock(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const e = error as { code?: unknown; errno?: unknown; driverError?: unknown };
  const conductor = (e.driverError ?? e) as { code?: unknown; errno?: unknown };
  return (
    conductor.code === '40P01' || // PostgreSQL
    conductor.code === '40001' ||
    conductor.code === 'ER_LOCK_DEADLOCK' || // MySQL y MariaDB
    conductor.errno === 1213 ||
    conductor.code === 'SQLITE_BUSY'
  );
}
