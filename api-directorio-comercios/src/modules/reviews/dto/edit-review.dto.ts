import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsString, Length, Max, Min, ValidateIf } from 'class-validator';
import { recortar } from '../../../common/text/truncate.js';

// Sólo se saltea la validación si el campo no vino: `null` no es "no lo cambio" y tiene que dar 400.
const vino = (_objeto: unknown, valor: unknown) => valor !== undefined;

/** Cuerpo de `PATCH /resenas/:id`. */
export class EditarResenaDto {
  @ApiPropertyOptional({ example: 4, minimum: 1, maximum: 5 })
  @ValidateIf(vino)
  @Max(5, { message: 'Las estrellas van de 1 a 5.' })
  @Min(1, { message: 'Las estrellas van de 1 a 5.' })
  @IsInt({ message: 'Las estrellas tienen que ser un número de 1 a 5.' })
  estrellas?: number;

  @ApiPropertyOptional({ example: 'Mejoró mucho.', maxLength: 1000 })
  @ValidateIf(vino)
  @Transform(recortar)
  @Length(1, 1000, { message: 'El comentario tiene que tener entre 1 y 1000 letras.' })
  @IsString({ message: 'El comentario tiene que ser un texto.' })
  comentario?: string;
}
