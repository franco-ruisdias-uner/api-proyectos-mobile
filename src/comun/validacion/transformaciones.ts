// Normalizaciones de entrada que usan los DTO.
import { Transform } from 'class-transformer';

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
