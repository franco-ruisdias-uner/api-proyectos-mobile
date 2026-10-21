import { QueryFailedError } from 'typeorm';

/** ¿La base rechazó la escritura por un índice único? Igual en los cuatro motores. */
export function esViolacionDeUnicidad(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const driver = error.driverError as { code?: string; errno?: number } | undefined;
  return (
    driver?.code === '23505' || // PostgreSQL
    driver?.code === 'ER_DUP_ENTRY' || // MySQL y MariaDB
    driver?.errno === 1062 ||
    driver?.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
    driver?.code === 'SQLITE_CONSTRAINT_PRIMARYKEY'
  );
}
