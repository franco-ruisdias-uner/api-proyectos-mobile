import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { PaginacionDto } from '../../../comun/respuesta/paginacion.js';

export class TurnosDto extends PaginacionDto {
  @ApiPropertyOptional({
    example: '2026-09-19',
    description:
      'Día de la grilla, AAAA-MM-DD. Default: hoy. De hoy a hoy + 6.',
  })
  @IsOptional()
  @IsString({
    message: 'La fecha tiene que ser un día con la forma AAAA-MM-DD.',
  })
  fecha?: string;
}

export const AGENDA_POR_PAGINA_MAXIMO = 500;

/** La agenda trae los turnos de todos los espacios: admite páginas de hasta 500. */
export class AgendaDto extends TurnosDto {
  @ApiPropertyOptional({
    description: 'Cuántos por página (máximo 500).',
    default: 20,
  })
  @Type(() => Number)
  @Max(AGENDA_POR_PAGINA_MAXIMO, {
    message: 'La cantidad por página puede ser como mucho 500.',
  })
  @Min(1, { message: 'La cantidad por página tiene que ser 1 o más.' })
  @IsInt({ message: 'La cantidad por página tiene que ser un número entero.' })
  declare porPagina: number;
}
