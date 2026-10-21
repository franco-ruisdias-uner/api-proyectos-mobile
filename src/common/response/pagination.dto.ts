import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import type { Meta } from '../../../contract/api.js';

/** `?pagina=1&porPagina=20` (AGENTS §4.2). Default 20, máximo 100. */
export class PaginacionDto {
  @ApiPropertyOptional({ default: 1, minimum: 1, description: 'Número de página, desde 1.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La página tiene que ser un número entero.' })
  @Min(1, { message: 'La página tiene que ser 1 o más.' })
  pagina: number = 1;

  @ApiPropertyOptional({
    default: 20,
    minimum: 1,
    maximum: 100,
    description: 'Elementos por página.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La cantidad por página tiene que ser un número entero.' })
  @Min(1, { message: 'La cantidad por página tiene que ser 1 o más.' })
  @Max(100, { message: 'La cantidad por página puede ser como máximo 100.' })
  porPagina: number = 20;
}

/** `skip`/`take` para TypeORM y el `meta` de la respuesta. */
export function paginar(p: { pagina: number; porPagina: number }) {
  return { skip: (p.pagina - 1) * p.porPagina, take: p.porPagina };
}

export function metaDe(p: { pagina: number; porPagina: number }, total: number): Meta {
  return { total, pagina: p.pagina, porPagina: p.porPagina };
}
