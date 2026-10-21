// Una violación de índice único se traduce a un código de negocio (AGENTS §4.6).
// Cada motor la informa distinto.
import { QueryFailedError } from 'typeorm';

export function esViolacionDeUnicidad(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const e = error.driverError as
    { code?: unknown; errno?: unknown } | undefined;
  const codigo = e?.code;
  return (
    codigo === 'SQLITE_CONSTRAINT_UNIQUE' ||
    codigo === 'SQLITE_CONSTRAINT_PRIMARYKEY' ||
    codigo === '23505' || // PostgreSQL
    codigo === 'ER_DUP_ENTRY' || // MySQL y MariaDB
    e?.errno === 1062
  );
}
