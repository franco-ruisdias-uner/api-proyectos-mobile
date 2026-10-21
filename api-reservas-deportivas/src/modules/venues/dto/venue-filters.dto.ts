import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginacionDto } from '../../../common/response/pagination.js';

const aBooleano = ({ value }: { value: unknown }): unknown =>
  value === 'true' ? true : value === 'false' ? false : value;

export class FiltrosEspaciosDto extends PaginacionDto {
  @ApiPropertyOptional({ example: 'dep-futbol5' })
  @IsOptional()
  @MaxLength(40, { message: 'El deporte no es válido.' })
  @IsString({ message: 'El deporte no es válido.' })
  deporteId?: string;

  @ApiPropertyOptional({ example: 'Polideportivo Municipal' })
  @IsOptional()
  @MaxLength(120, { message: 'El complejo no es válido.' })
  @IsString({ message: 'El complejo no es válido.' })
  complejo?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(aBooleano)
  @IsBoolean({ message: 'La iluminación tiene que ser true o false.' })
  iluminacion?: boolean;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(aBooleano)
  @IsBoolean({ message: 'Techado tiene que ser true o false.' })
  techado?: boolean;
}
