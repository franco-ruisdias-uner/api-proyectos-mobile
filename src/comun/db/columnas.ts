import { Column, PrimaryColumn, type ValueTransformer } from 'typeorm';

/**
 * Tipos de columna portables entre SQLite, PostgreSQL, MySQL y MariaDB (AGENTS §5.3).
 * Las entidades usan sólo estos helpers: así ninguna columna depende de un motor.
 */

interface Opciones {
  nulo?: boolean;
  unico?: boolean;
}

const comunes = (o: Opciones = {}) => ({ nullable: o.nulo ?? false, unique: o.unico ?? false });

/** Motor elegido al importar las entidades (se lee de `DB_MOTOR`, cargado antes desde `.env`). */
const motor = () => process.env.DB_MOTOR ?? 'better-sqlite3';

export const ColumnaId = () => PrimaryColumn({ type: 'varchar', length: 40 });

/** Texto corto con largo explícito (MySQL lo exige para `varchar` y para índices). */
export const ColumnaTexto = (largo: number, o?: Opciones) =>
  Column({ type: 'varchar', length: largo, ...comunes(o) });

export const ColumnaTextoLargo = (o?: Opciones) => Column({ type: 'text', ...comunes(o) });

export const ColumnaEntero = (o?: Opciones) => Column({ type: 'int', ...comunes(o) });

/** Coordenadas y puntajes: `double precision` vuelve como `number` en los cuatro motores. */
export const ColumnaDecimal = (o?: Opciones) => Column({ type: 'double precision', ...comunes(o) });

export const ColumnaBooleano = (o?: Opciones) => Column({ type: 'boolean', ...comunes(o) });

/** Enum del PRD: texto + validación en el DTO + tipo unión de TS (nunca `enum` de la base). */
export const ColumnaEnum = (o?: Opciones) => Column({ type: 'varchar', length: 20, ...comunes(o) });

/** Día `AAAA-MM-DD`, como texto: sin conversiones de zona. */
export const ColumnaDia = (o?: Opciones) => Column({ type: 'varchar', length: 10, ...comunes(o) });

/** Hora de tabla `HH:MM`, como texto. */
export const ColumnaHora = (o?: Opciones) => Column({ type: 'varchar', length: 5, ...comunes(o) });

/** Objeto o lista que no se filtra: `simple-json` (texto) en los cuatro motores. */
export const ColumnaJson = (o?: Opciones) => Column({ type: 'simple-json', ...comunes(o) });

/**
 * Se guarda sin milisegundos: MySQL y MariaDB redondean `datetime` al segundo y el resto no;
 * truncando antes, los cuatro motores devuelven exactamente lo mismo.
 */
const sinMilisegundos: ValueTransformer = {
  to: (valor: Date | null | undefined) =>
    valor instanceof Date ? new Date(Math.floor(valor.getTime() / 1000) * 1000) : valor,
  // `any`: TypeORM entrega Date o, en SQLite, a veces texto; se normaliza a Date.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (valor: any) => (valor == null ? null : valor instanceof Date ? valor : new Date(valor)),
};

/** Instante en UTC: `timestamptz` en PostgreSQL, `datetime` en el resto. */
export const ColumnaInstante = (o?: Opciones) =>
  Column({
    type: motor() === 'postgres' ? 'timestamptz' : 'datetime',
    transformer: sinMilisegundos,
    ...comunes(o),
  });
