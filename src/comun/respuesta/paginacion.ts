// Paginación común (AGENTS §4.2): ?pagina=1&porPagina=20, máximo 100 por defecto.
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import type { Meta } from '../../../contrato/api.js';

export const POR_PAGINA_DEFAULT = 20;
export const POR_PAGINA_MAXIMO = 100;

export class PaginacionDto {
  @ApiPropertyOptional({
    description: 'Número de página, desde 1.',
    default: 1,
  })
  @Type(() => Number)
  @Min(1, { message: 'La página tiene que ser 1 o más.' })
  @IsInt({ message: 'La página tiene que ser un número entero.' })
  pagina: number = 1;

  @ApiPropertyOptional({
    description: 'Cuántos por página (máximo 100).',
    default: 20,
  })
  @Type(() => Number)
  @Max(POR_PAGINA_MAXIMO, {
    message: 'La cantidad por página puede ser como mucho 100.',
  })
  @Min(1, { message: 'La cantidad por página tiene que ser 1 o más.' })
  @IsInt({ message: 'La cantidad por página tiene que ser un número entero.' })
  porPagina: number = POR_PAGINA_DEFAULT;
}

/** skip/take de TypeORM para una página. */
export function desplazamiento(p: { pagina: number; porPagina: number }): {
  skip: number;
  take: number;
} {
  return { skip: (p.pagina - 1) * p.porPagina, take: p.porPagina };
}

export function meta(
  total: number,
  p: { pagina: number; porPagina: number },
): Meta {
  return { total, pagina: p.pagina, porPagina: p.porPagina };
}
