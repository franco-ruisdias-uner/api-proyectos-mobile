import { applyDecorators } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { POR_PAGINA_POR_DEFECTO } from './respuesta.js';

// Decoradores de los DTO de consulta (?pagina=1&porPagina=20…). Cada campo usa un solo
// mensaje para todas sus validaciones: así el texto que ve la persona no depende del orden
// en que class-validator las reporte.

/** "" y texto que no es número quedan como vienen (y la validación los rechaza). */
const aNumero = Transform(({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() !== '' ? Number(value) : value,
);

/** `?pagina=`: entero desde 1. */
export const CampoPagina = () =>
  applyDecorators(
    ApiPropertyOptional({ minimum: 1, default: 1, description: 'Número de página, desde 1.' }),
    IsOptional(),
    aNumero,
    IsInt({ message: 'La página (pagina) tiene que ser un número entero desde 1.' }),
    Min(1, { message: 'La página (pagina) tiene que ser un número entero desde 1.' }),
  );

/** `?porPagina=`: entero de 1 a `maximo` (AGENTS §4.2). */
export const CampoPorPagina = (maximo: number) => {
  const mensaje = `La cantidad por página (porPagina) tiene que ser un número entero de 1 a ${maximo}.`;
  return applyDecorators(
    ApiPropertyOptional({
      minimum: 1,
      maximum: maximo,
      default: POR_PAGINA_POR_DEFECTO,
      description: `Elementos por página, hasta ${maximo}.`,
    }),
    IsOptional(),
    aNumero,
    IsInt({ message: mensaje }),
    Min(1, { message: mensaje }),
    Max(maximo, { message: mensaje }),
  );
};

/** Número decimal (finito) entre `minimo` y `maximo`, que viene en la consulta. */
export const CampoNumero = (
  nombre: string,
  etiqueta: string,
  minimo: number,
  maximo: number,
  extra = '',
) => {
  const mensaje = `${etiqueta} (${nombre}) tiene que ser un número entre ${minimo} y ${maximo}${extra}.`;
  return applyDecorators(
    IsOptional(),
    aNumero,
    IsNumber({ allowNaN: false, allowInfinity: false }, { message: mensaje }),
    Min(minimo, { message: mensaje }),
    Max(maximo, { message: mensaje }),
  );
};

/** Número entero entre `minimo` y `maximo`, que viene en la consulta. */
export const CampoEntero = (
  nombre: string,
  etiqueta: string,
  minimo: number,
  maximo: number,
  descripcion?: string,
) => {
  const mensaje = `${etiqueta} (${nombre}) tiene que ser un número entero de ${minimo} a ${maximo}.`;
  return applyDecorators(
    ApiPropertyOptional({ minimum: minimo, maximum: maximo, description: descripcion }),
    IsOptional(),
    aNumero,
    IsInt({ message: mensaje }),
    Min(minimo, { message: mensaje }),
    Max(maximo, { message: mensaje }),
  );
};
