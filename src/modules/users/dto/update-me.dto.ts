import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length, Matches, ValidateIf } from 'class-validator';

const recortar = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class ActualizarYoDto {
  @ApiPropertyOptional({ example: 'Emiliano Ruiz' })
  @ValidateIf((_, valor) => valor !== undefined)
  @Transform(recortar)
  @Length(1, 80, { message: 'El nombre tiene que tener entre 1 y 80 letras.' })
  @IsString({ message: 'El nombre no es válido.' })
  nombre?: string;

  @ApiPropertyOptional({ example: '3455-401122' })
  @ValidateIf((_, valor) => valor !== undefined)
  @Transform(recortar)
  @Matches(/^\+?[0-9][0-9 ()-]{5,28}$/, {
    message: 'El teléfono no es válido: usá sólo números, espacios o guiones.',
  })
  @IsString({ message: 'El teléfono no es válido.' })
  telefono?: string;
}
