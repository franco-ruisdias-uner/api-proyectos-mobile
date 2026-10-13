import { motorDelEntorno } from './proveedores.js';
import { Column, type ColumnOptions, PrimaryColumn } from 'typeorm';

// Tipos de columna portables a los cuatro motores (AGENTS §5.3). Las entidades usan
// sólo estos helpers.

/** El motor se lee al cargar las entidades: main.ts carga el .env antes de importarlas. */
function motorActual(): string {
  return motorDelEntorno(process.env);
}

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

/** Instante en UTC: `timestamptz` en PostgreSQL y `datetime` en los otros tres. */
export function ColumnaInstante(
  opciones: Pick<ColumnOptions, 'nullable'> = {},
): PropertyDecorator {
  const type = motorActual() === 'postgres' ? 'timestamptz' : 'datetime';
  return Column({ type, ...opciones });
}

/** Objeto o lista que no se filtra (portable). */
export function ColumnaJson(
  opciones: Pick<ColumnOptions, 'nullable'> = {},
): PropertyDecorator {
  return Column({ type: 'simple-json', ...opciones });
}
