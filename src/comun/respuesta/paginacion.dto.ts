import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { POR_PAGINA_MAXIMO } from './paginacion.js';

export class PaginacionDto {
  @ApiPropertyOptional({ description: 'Página, desde 1.', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La página tiene que ser un número entero.' })
  @Min(1, { message: 'La página tiene que ser 1 o más.' })
  pagina?: number;

  @ApiPropertyOptional({
    description: 'Elementos por página.',
    default: 20,
    minimum: 1,
    maximum: POR_PAGINA_MAXIMO,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La cantidad por página tiene que ser un número entero.' })
  @Min(1, { message: 'La cantidad por página tiene que ser 1 o más.' })
  @Max(POR_PAGINA_MAXIMO, { message: `La cantidad por página no puede pasar de ${POR_PAGINA_MAXIMO}.` })
  porPagina?: number;
}
