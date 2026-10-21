// Detecta la violación de un índice único en los cuatro motores, para traducirla a un código
// de negocio (AGENTS §4.6 y §5.5).
import { QueryFailedError } from 'typeorm';

export function esViolacionDeUnicidad(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const e = error.driverError as
    { code?: unknown; errno?: unknown } | undefined;
  return (
    e?.code === '23505' || // PostgreSQL
    e?.code === 'ER_DUP_ENTRY' || // MySQL y MariaDB
    e?.errno === 1062 ||
    e?.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
    e?.code === 'SQLITE_CONSTRAINT_PRIMARYKEY'
  );
}
