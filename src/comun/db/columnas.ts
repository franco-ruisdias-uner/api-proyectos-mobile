import { Column, type ColumnOptions, PrimaryColumn } from 'typeorm';

// Tipos de columna portables a los cuatro motores (AGENTS §5.3). Las entidades usan
// sólo estos helpers.

export function ColumnaId(): PropertyDecorator {
  return PrimaryColumn({ type: 'varchar', length: 40 });
}

export function ColumnaTexto(
  length: number,
  opciones: Pick<ColumnOptions, 'nullable' | 'unique'> = {},
): PropertyDecorator {
  return Column({ type: 'varchar', length, ...opciones });
}

export function ColumnaTextoLargo(
  opciones: Pick<ColumnOptions, 'nullable'> = {},
): PropertyDecorator {
  return Column({ type: 'text', ...opciones });
}

export function ColumnaEntero(
  opciones: Pick<ColumnOptions, 'nullable' | 'default'> = {},
): PropertyDecorator {
  return Column({ type: 'int', ...opciones });
}

export function ColumnaDecimal(
  opciones: Pick<ColumnOptions, 'nullable'> = {},
): PropertyDecorator {
  return Column({ type: 'double precision', ...opciones });
}

export function ColumnaBooleana(
  opciones: Pick<ColumnOptions, 'default'> = {},
): PropertyDecorator {
  return Column({ type: 'boolean', ...opciones });
}

/** Enum del PRD: varchar(20) + tipo unión en TS + validación en el DTO. */
export function ColumnaEnum(
  opciones: Pick<ColumnOptions, 'nullable'> = {},
): PropertyDecorator {
  return Column({ type: 'varchar', length: 20, ...opciones });
}

// Las columnas de instantes se declaran sin saber el motor: las entidades se importan antes de
// que ConfigModule lea el .env. TypeORM guarda una referencia a estas opciones y recién las lee
// al armar el esquema, así que `usarTipoDeInstante` les pone el tipo justo antes (lo llama
// `opcionesDeBase`, con el motor ya validado).
const columnasDeInstante: ColumnOptions[] = [];

/** Instante en UTC: `timestamptz` en PostgreSQL y `datetime` en los otros tres. */
export function ColumnaInstante(
  opciones: Pick<ColumnOptions, 'nullable'> = {},
): PropertyDecorator {
  const columna: ColumnOptions = { type: 'datetime', ...opciones };
  columnasDeInstante.push(columna);
  return Column(columna);
}

export function usarTipoDeInstante(engine: string): void {
  const type = engine === 'postgres' ? 'timestamptz' : 'datetime';
  for (const columna of columnasDeInstante) columna.type = type;
}

/** Objeto o lista que no se filtra (portable). */
export function ColumnaJson(
  opciones: Pick<ColumnOptions, 'nullable'> = {},
): PropertyDecorator {
  return Column({ type: 'simple-json', ...opciones });
}
