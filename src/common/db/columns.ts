import { Column, type ColumnOptions, PrimaryColumn } from 'typeorm';

/**
 * Helpers de columnas portables (AGENTS §5.3). Las entidades usan sólo estos: así el mismo
 * código crea el mismo esquema en SQLite, PostgreSQL, MySQL y MariaDB.
 *
 * El motor se lee de process.env al cargar las entidades (los decoradores corren al importar
 * el archivo). main.ts carga el .env antes de importar nada, y los tests fijan DB_MOTOR antes
 * de levantar la app.
 */
export const motorActual = (): string => process.env.DB_MOTOR || 'better-sqlite3';

type Opciones = Pick<ColumnOptions, 'nullable' | 'default' | 'unique' | 'name'>;

/** Id de texto con prefijo: `usr-512`. */
export const ColumnaId = () => PrimaryColumn({ type: 'varchar', length: 40 });

/** Referencia a otro id (sin clave foránea obligatoria). */
export const ColumnaRef = (o: Opciones = {}) => Column({ type: 'varchar', length: 40, ...o });

/** Texto corto: siempre con largo (MySQL lo exige para varchar e índices). */
export const ColumnaTexto = (largo: number, o: Opciones = {}) =>
  Column({ type: 'varchar', length: largo, ...o });

export const ColumnaTextoLargo = (o: Opciones = {}) => Column({ type: 'text', ...o });

/** Entero: cantidades y precios en pesos. */
export const ColumnaEntero = (o: Opciones = {}) => Column({ type: 'int', ...o });

/** Coordenadas y puntajes: `double precision` vuelve como number en los cuatro motores. */
export const ColumnaDecimal = (o: Opciones = {}) => Column({ type: 'double precision', ...o });

export const ColumnaBooleano = (o: Opciones = {}) => Column({ type: 'boolean', ...o });

/** Enum del PRD: varchar(20) + validación en el DTO + tipo unión de TS (nada de `enum`). */
export const ColumnaEnum = (o: Opciones = {}) => Column({ type: 'varchar', length: 20, ...o });

/** Día "AAAA-MM-DD", como texto. */
export const ColumnaDia = (o: Opciones = {}) => Column({ type: 'varchar', length: 10, ...o });

/** Hora "HH:MM", como texto. */
export const ColumnaHora = (o: Opciones = {}) => Column({ type: 'varchar', length: 5, ...o });

/** Instante en UTC: `timestamptz` en PostgreSQL, `datetime` en el resto. */
export const ColumnaInstante = (o: Opciones = {}) =>
  Column({ type: motorActual() === 'postgres' ? 'timestamptz' : 'datetime', ...o });

/** Objeto o lista que no se filtra (AGENTS §5.3). */
export const ColumnaJson = (o: Opciones = {}) => Column({ type: 'simple-json', ...o });
