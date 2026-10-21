import { QueryFailedError } from 'typeorm';

/**
 * ¿La consulta falló por un índice único? Sirve para traducir la violación al código de
 * negocio que corresponde (AGENTS §4.6) en los cuatro motores.
 */
export function esViolacionDeUnicidad(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const causa = error.driverError as { code?: unknown; errno?: unknown } | undefined;
  const codigo = causa?.code;
  return (
    codigo === '23505' || // PostgreSQL
    codigo === 'ER_DUP_ENTRY' || // MySQL / MariaDB
    causa?.errno === 1062 ||
    codigo === 'SQLITE_CONSTRAINT_UNIQUE' ||
    codigo === 'SQLITE_CONSTRAINT_PRIMARYKEY'
  );
}
