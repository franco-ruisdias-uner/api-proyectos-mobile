import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { PAGINA_MAXIMA, POR_PAGINA_MAXIMO } from './pagination.js';

/**
 * `?pagina&porPagina` con el tope que corresponda (AGENTS §4.2). Es una fábrica porque
 * class-validator suma las reglas de la clase madre: una subclase no puede subir el `@Max`.
 */
export function PaginacionHasta(maximo: number) {
  class Paginacion {
    @ApiPropertyOptional({ description: 'Página, desde 1.', default: 1, minimum: 1, maximum: PAGINA_MAXIMA })
    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'La página tiene que ser un número entero.' })
    @Min(1, { message: 'La página tiene que ser 1 o más.' })
    @Max(PAGINA_MAXIMA, { message: `La página no puede pasar de ${PAGINA_MAXIMA}.` })
    pagina?: number;

    @ApiPropertyOptional({ description: 'Elementos por página.', default: 20, minimum: 1, maximum: maximo })
    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'La cantidad por página tiene que ser un número entero.' })
    @Min(1, { message: 'La cantidad por página tiene que ser 1 o más.' })
    @Max(maximo, { message: `La cantidad por página no puede pasar de ${maximo}.` })
    porPagina?: number;
  }
  return Paginacion;
}

export class PaginacionDto extends PaginacionHasta(POR_PAGINA_MAXIMO) {}
