import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length } from 'class-validator';
import { recortar } from '../../../comun/texto/recortar.js';

export class ActualizarYoDto {
  @ApiPropertyOptional({ example: 'Marta Giménez' })
  @IsOptional()
  @Transform(recortar)
  @Length(1, 80, { message: 'El nombre tiene que tener entre 1 y 80 letras.' })
  @IsString({ message: 'El nombre tiene que ser un texto.' })
  nombre?: string;
}
