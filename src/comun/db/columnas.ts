// Tipos de columna portables a los cuatro motores (AGENTS §5.3). Las entidades usan
// sólo estos helpers.
import { Column, type ColumnOptions, PrimaryColumn } from 'typeorm';

const motor = (): string => process.env.DB_MOTOR ?? 'better-sqlite3';

/** Id de texto con prefijo ("usr-207"). */
export const ColumnaId = (): PropertyDecorator =>
  PrimaryColumn({ type: 'varchar', length: 40 });

/** Referencia a otro id. */
export const ColumnaRef = (opciones: ColumnOptions = {}): PropertyDecorator =>
  Column({ type: 'varchar', length: 40, ...opciones });

/** Texto corto, siempre con largo explícito (MySQL lo exige). */
export const ColumnaTexto = (
  length: number,
  opciones: ColumnOptions = {},
): PropertyDecorator => Column({ type: 'varchar', length, ...opciones });

export const ColumnaTextoLargo = (
  opciones: ColumnOptions = {},
): PropertyDecorator => Column({ type: 'text', ...opciones });

export const ColumnaEntero = (
  opciones: ColumnOptions = {},
): PropertyDecorator => Column({ type: 'int', ...opciones });

/** Coordenadas y puntajes: `double precision` vuelve como number en los cuatro motores. */
export const ColumnaDecimal = (
  opciones: ColumnOptions = {},
): PropertyDecorator => Column({ type: 'double precision', ...opciones });

export const ColumnaBooleana = (
  opciones: ColumnOptions = {},
): PropertyDecorator => Column({ type: 'boolean', ...opciones });

/** Enum del PRD: varchar(20) + validación en el DTO + unión de TS. */
export const ColumnaEnum = (opciones: ColumnOptions = {}): PropertyDecorator =>
  Column({ type: 'varchar', length: 20, ...opciones });

/** Día "AAAA-MM-DD", como texto. */
export const ColumnaDia = (opciones: ColumnOptions = {}): PropertyDecorator =>
  Column({ type: 'varchar', length: 10, ...opciones });

/** Hora "HH:MM", como texto. */
export const ColumnaHora = (opciones: ColumnOptions = {}): PropertyDecorator =>
  Column({ type: 'varchar', length: 5, ...opciones });

/** Objeto o lista que no se filtra. */
export const ColumnaJson = (opciones: ColumnOptions = {}): PropertyDecorator =>
  Column({ type: 'simple-json', ...opciones });

/**
 * Instante, guardado en UTC: `timestamptz` en PostgreSQL, `datetime` en el resto
 * (ninguno de los dos existe en todos). El motor se lee del entorno porque los
 * decoradores se evalúan al importar, antes de que Nest arme la configuración.
 */
export const ColumnaInstante = (
  opciones: ColumnOptions = {},
): PropertyDecorator =>
  Column({
    type: motor() === 'postgres' ? 'timestamptz' : 'datetime',
    ...opciones,
  });
