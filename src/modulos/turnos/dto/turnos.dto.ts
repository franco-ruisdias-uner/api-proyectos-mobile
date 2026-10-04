import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
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
