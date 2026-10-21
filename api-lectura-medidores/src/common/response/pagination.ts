import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/** `?pagina=1&porPagina=20`. Las listas que permiten más extienden esta clase. */
export class PaginacionDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt({ message: 'La página tiene que ser un número entero.' })
  @Min(1, { message: 'La página tiene que ser 1 o más.' })
  pagina: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt({ message: 'La cantidad por página tiene que ser un número entero.' })
  @Min(1, { message: 'La cantidad por página tiene que ser 1 o más.' })
  @Max(100, { message: 'La cantidad por página no puede pasar de 100.' })
  porPagina: number = 20;
}

/** Para las listas que el teléfono recorre entera (los suministros de una ruta): 50 por defecto, hasta 200. */
export class PaginacionAmpliaDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt({ message: 'La página tiene que ser un número entero.' })
  @Min(1, { message: 'La página tiene que ser 1 o más.' })
  pagina: number = 1;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 200 })
  @Type(() => Number)
  @IsInt({ message: 'La cantidad por página tiene que ser un número entero.' })
  @Min(1, { message: 'La cantidad por página tiene que ser 1 o más.' })
  @Max(200, { message: 'La cantidad por página no puede pasar de 200.' })
  porPagina: number = 50;
}

export function paginar<T>(
  todos: T[],
  { pagina, porPagina }: { pagina: number; porPagina: number },
): { datos: T[]; meta: { total: number; pagina: number; porPagina: number } } {
  const inicio = (pagina - 1) * porPagina;
  return {
    datos: todos.slice(inicio, inicio + porPagina),
    meta: { total: todos.length, pagina, porPagina },
  };
}
