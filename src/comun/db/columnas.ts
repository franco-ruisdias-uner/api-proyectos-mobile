import { Column, PrimaryColumn, type ValueTransformer } from 'typeorm';
import { sinMilisegundos } from '../fechas/fechas.js';

// Los únicos tipos de columna permitidos (AGENTS §5.3). Todos portables a SQLite,
// PostgreSQL, MySQL y MariaDB, y estables con `synchronize`.

interface Opciones {
  nullable?: boolean;
  unique?: boolean;
}

const base = (o?: Opciones) => ({ nullable: o?.nullable ?? false, unique: o?.unique ?? false });

/** Id de texto con prefijo ("lin-05"). */
export const ColumnaId = () => PrimaryColumn({ type: 'varchar', length: 40 });

/** Referencia al id de otra entidad. */
export const ColumnaReferencia = (o?: Opciones) =>
  Column({ type: 'varchar', length: 40, ...base(o) });

/** Texto corto, con largo explícito (MySQL lo exige). */
export const ColumnaTexto = (largo: number, o?: Opciones) =>
  Column({ type: 'varchar', length: largo, ...base(o) });

export const ColumnaTextoLargo = (o?: Opciones) => Column({ type: 'text', ...base(o) });

export const ColumnaEntero = (o?: Opciones) => Column({ type: 'int', ...base(o) });

/** Coordenadas y puntajes: vuelve como number en los cuatro motores (decimal no). */
export const ColumnaDoble = (o?: Opciones) => Column({ type: 'double precision', ...base(o) });

export const ColumnaBooleano = (o?: Opciones) => Column({ type: 'boolean', ...base(o) });

/** Enum del PRD: varchar(20) + validación en el DTO + tipo unión de TS. */
export const ColumnaEnum = (o?: Opciones) => Column({ type: 'varchar', length: 20, ...base(o) });

/** Día "AAAA-MM-DD", sin conversiones de zona. */
export const ColumnaDia = (o?: Opciones) => Column({ type: 'varchar', length: 10, ...base(o) });

/** Hora de tabla "HH:MM". */
export const ColumnaHora = (o?: Opciones) => Column({ type: 'varchar', length: 5, ...base(o) });

/** Objeto o lista que no se filtra. */
export const ColumnaJson = (o?: Opciones) => Column({ type: 'simple-json', ...base(o) });

const instanteSinMilisegundos: ValueTransformer = {
  to: (valor: Date | null | undefined) => (valor instanceof Date ? sinMilisegundos(valor) : valor),
  from: (valor: Date | string | null) =>
    valor === null ? null : valor instanceof Date ? valor : new Date(valor),
};

/**
 * Instante, guardado en UTC: `timestamptz` en PostgreSQL, `datetime` en el resto (ninguno
 * de los dos existe en todos). El motor se lee del entorno al cargar las entidades, que es
 * cuando TypeORM evalúa los decoradores; la configuración ya se validó antes.
 */
export const ColumnaInstante = (o?: Opciones) =>
  Column({
    type: process.env.DB_MOTOR === 'postgres' ? 'timestamptz' : 'datetime',
    transformer: instanteSinMilisegundos,
    ...base(o),
  });
