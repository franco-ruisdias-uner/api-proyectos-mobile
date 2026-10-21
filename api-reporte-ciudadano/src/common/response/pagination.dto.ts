// ?pagina=1&porPagina=20 (AGENTS §4.2). Un endpoint con otro máximo extiende `paginacionConMaximo(n)`.
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export const POR_PAGINA_DEFAULT = 20;
export const POR_PAGINA_MAXIMO = 100;

/**
 * Clase base de paginación con un máximo propio. No se puede extender `PaginacionDto` para
 * cambiar el máximo: class-validator sumaría los dos `@Max`.
 */
export function paginacionConMaximo(maximo: number) {
  class Paginacion {
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
      maximum: maximo,
    })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(maximo)
    porPagina: number = POR_PAGINA_DEFAULT;
  }
  return Paginacion;
}

export class PaginacionDto extends paginacionConMaximo(POR_PAGINA_MAXIMO) {}
