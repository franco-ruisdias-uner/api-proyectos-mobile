import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length, ValidateIf } from 'class-validator';
import { recortar } from '../../../comun/texto/recortar.js';

export class ActualizarYoDto {
  @ApiPropertyOptional({ example: 'Marta Giménez' })
  // Sólo se saltea si no vino: `null` no es "no lo cambio" y tiene que dar 400.
  @ValidateIf((_objeto, valor) => valor !== undefined)
  @Transform(recortar)
  @Length(1, 80, { message: 'El nombre tiene que tener entre 1 y 80 letras.' })
  @IsString({ message: 'El nombre tiene que ser un texto.' })
  nombre?: string;
}
