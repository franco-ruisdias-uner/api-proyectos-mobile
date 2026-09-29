// Normalizaciones de entrada que usan los DTO.
import { Transform } from 'class-transformer';
import { ValidateIf } from 'class-validator';

/** Recorta espacios y colapsa los repetidos; deja pasar lo que no es texto (lo rechaza el validador). */
export const Recortar = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  );

/** Como Recortar, pero un texto vacío pasa a null ("sin valor" viaja como null, nunca ""). */
export const VacioANulo = () =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const limpio = value.trim().replace(/\s+/g, ' ');
    return limpio === '' ? null : limpio;
  });

/** Email normalizado: sin espacios y en minúsculas. */
export const NormalizarEmail = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  );

/**
 * Campo que se puede omitir pero no mandar en null. `@IsOptional()` también deja pasar
 * `null`, y en un campo que no admite nulos eso termina en un error de la base.
 */
export const Opcional = () =>
  ValidateIf((_objeto: object, valor: unknown) => valor !== undefined);
