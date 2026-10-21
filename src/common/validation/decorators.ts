import { Transform } from 'class-transformer';
import { ValidateIf } from 'class-validator';

/**
 * Campo que puede no venir. A diferencia de `@IsOptional()`, un `null` explícito sí se valida
 * (y falla si el campo no admite nulos).
 */
export const Opcional = () => ValidateIf((_objeto, valor) => valor !== undefined);

/** Campo que puede no venir o venir en `null` (para borrar el valor). */
export const OpcionalONulo = () => ValidateIf((_objeto, valor) => valor !== undefined && valor !== null);

/** Saca los espacios de los costados de un texto. */
export const Recortar = () =>
  Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value));
