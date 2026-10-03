import { QueryFailedError } from 'typeorm';

/** ¿La consulta falló por un índice único? Igual en los cuatro motores (AGENTS §5.5). */
export function esViolacionDeUnicidad(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const e = error.driverError as { code?: string; errno?: number } | undefined;
  return (
    e?.code === '23505' || // PostgreSQL
    e?.code === 'ER_DUP_ENTRY' || // MySQL y MariaDB
    e?.errno === 1062 ||
    e?.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
    e?.code === 'SQLITE_CONSTRAINT_PRIMARYKEY'
  );
}
