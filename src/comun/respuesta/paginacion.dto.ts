// ?pagina=1&porPagina=20 (AGENTS §4.2). Un endpoint con otro máximo extiende esta clase.
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export const POR_PAGINA_DEFAULT = 20;
export const POR_PAGINA_MAXIMO = 100;

export class PaginacionDto {
  @ApiPropertyOptional({
    description: 'Número de página, desde 1.',
    default: 1,
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina: number = 1;

  @ApiPropertyOptional({
    description: 'Cuántos por página.',
    default: POR_PAGINA_DEFAULT,
    minimum: 1,
    maximum: POR_PAGINA_MAXIMO,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(POR_PAGINA_MAXIMO)
  porPagina: number = POR_PAGINA_DEFAULT;
}
