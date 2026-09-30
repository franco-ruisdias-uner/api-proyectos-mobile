// Tipos de columna portables entre los cuatro motores (AGENTS §5.3). Las entidades usan
// sólo estos helpers.
import {
  Column,
  PrimaryColumn,
  type ColumnOptions,
  type ValueTransformer,
} from 'typeorm';
import { sinMilisegundos } from '../fechas/fechas.js';
import type { Motor } from '../../config/entorno.js';
import { motorDeProveedor } from './proveedores.js';

/**
 * Motor para el que se declaran las columnas. Los decoradores se evalúan al importar las
 * entidades, antes de que Nest valide el entorno: por eso main.ts carga el .env antes de
 * importar la app, y opcionesTypeOrm() verifica que coincida con el DB_MOTOR validado.
 */
export function motorDeColumnas(): Motor {
  return (motorDeProveedor(process.env.DB_PROVEEDOR) ??
    (process.env.DB_MOTOR?.trim() || 'better-sqlite3')) as Motor;
}

export const LARGO_ID = 40;

/** Id de texto con prefijo: varchar(40). */
export const ColumnaId = (): PropertyDecorator =>
  PrimaryColumn({ type: 'varchar', length: LARGO_ID });

/** Clave primaria de texto que no es un id con prefijo (p. ej. el token de un teléfono). */
export const ColumnaClave = (largo: number): PropertyDecorator =>
  PrimaryColumn({ type: 'varchar', length: largo });

/** Referencia a otra entidad por id (sin clave foránea). */
export const ColumnaRef = (
  opciones: { nulo?: boolean } = {},
): PropertyDecorator =>
  Column({
    type: 'varchar',
    length: LARGO_ID,
    nullable: opciones.nulo ?? false,
  });

/** Texto corto, siempre con largo explícito (MySQL lo exige). */
export const ColumnaTexto = (
  largo: number,
  opciones: { nulo?: boolean; unico?: boolean } = {},
): PropertyDecorator =>
  Column({
    type: 'varchar',
    length: largo,
    nullable: opciones.nulo ?? false,
    unique: opciones.unico ?? false,
  });

export const ColumnaTextoLargo = (
  opciones: { nulo?: boolean } = {},
): PropertyDecorator =>
  Column({ type: 'text', nullable: opciones.nulo ?? false });

export const ColumnaEntero = (
  opciones: { nulo?: boolean } = {},
): PropertyDecorator =>
  Column({ type: 'int', nullable: opciones.nulo ?? false });

/** Coordenadas y puntajes: double precision vuelve como number en los cuatro motores. */
export const ColumnaDecimal = (
  opciones: { nulo?: boolean } = {},
): PropertyDecorator =>
  Column({ type: 'double precision', nullable: opciones.nulo ?? false });

export const ColumnaBooleano = (): PropertyDecorator =>
  Column({ type: 'boolean' });

/** Enum del PRD: varchar(20) + validación en el DTO + tipo unión de TS. */
export const ColumnaEnum = (
  opciones: { nulo?: boolean } = {},
): PropertyDecorator =>
  Column({ type: 'varchar', length: 20, nullable: opciones.nulo ?? false });

/** Día "AAAA-MM-DD" como texto. */
export const ColumnaDia = (
  opciones: { nulo?: boolean } = {},
): PropertyDecorator =>
  Column({ type: 'varchar', length: 10, nullable: opciones.nulo ?? false });

/** Hora "HH:MM" como texto. */
export const ColumnaHora = (
  opciones: { nulo?: boolean } = {},
): PropertyDecorator =>
  Column({ type: 'varchar', length: 5, nullable: opciones.nulo ?? false });

/** Objeto o lista que no se filtra (imágenes, polígonos, horarios). */
export const ColumnaJson = (
  opciones: { nulo?: boolean } = {},
): PropertyDecorator =>
  Column({ type: 'simple-json', nullable: opciones.nulo ?? false });

const sinMs: ValueTransformer = {
  // `any` porque TypeORM también pasa operadores de búsqueda (FindOperator) por el transformer.
  // oxlint-disable-next-line typescript/no-explicit-any
  to: (valor: any) => (valor instanceof Date ? sinMilisegundos(valor) : valor),
  // oxlint-disable-next-line typescript/no-explicit-any
  from: (valor: any) => valor,
};

/**
 * Instante: timestamptz en PostgreSQL, datetime en los otros; se guarda en UTC y sin
 * milisegundos (MySQL redondea los milisegundos en vez de cortarlos).
 */
export const ColumnaInstante = (
  opciones: { nulo?: boolean } = {},
): PropertyDecorator => {
  const tipo: ColumnOptions['type'] =
    motorDeColumnas() === 'postgres' ? 'timestamptz' : 'datetime';
  return Column({
    type: tipo,
    nullable: opciones.nulo ?? false,
    transformer: sinMs,
  });
};
