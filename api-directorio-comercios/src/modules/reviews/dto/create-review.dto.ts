import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';
import { recortar } from '../../../common/text/truncate.js';

/** Cuerpo de `POST /comercios/:id/resenas`. */
export class CrearResenaDto {
  @ApiPropertyOptional({
    example: 'res-2210',
    description:
      'Id generado por el teléfono (`res-` + letras, números, `_` o `-`, de 3 a 36). Si no viene, lo genera el servidor. Reenviar el mismo `id` no duplica.',
  })
  @IsOptional()
  @Matches(/^res-[A-Za-z0-9_-]{3,36}$/, { message: 'El identificador de la reseña no es válido.' })
  @IsString({ message: 'El identificador de la reseña tiene que ser un texto.' })
  id?: string;

  @ApiProperty({ example: 5, minimum: 1, maximum: 5, description: 'Entero de 1 a 5.' })
  @Max(5, { message: 'Las estrellas van de 1 a 5.' })
  @Min(1, { message: 'Las estrellas van de 1 a 5.' })
  @IsInt({ message: 'Falta elegir las estrellas, de 1 a 5.' })
  estrellas: number;

  @ApiProperty({ example: 'Muy buena atención y buenos precios.', maxLength: 1000 })
  @Transform(recortar)
  @Length(1, 1000, { message: 'El comentario tiene que tener entre 1 y 1000 letras.' })
  @IsString({ message: 'Falta escribir el comentario.' })
  comentario: string;

  @ApiPropertyOptional({
    example: '2026-10-03T12:00:00-03:00',
    description:
      'Cuándo se escribió (ISO 8601 con zona). Por defecto, ahora. No puede ser futura (tolerancia de 5 minutos).',
  })
  @IsOptional()
  @IsString({ message: 'La fecha de la reseña no es válida.' })
  creadaEn?: string;

  @ApiPropertyOptional({ description: 'Se ignora: es de la cola local del teléfono.' })
  @IsOptional()
  @IsBoolean({ message: 'El dato «sincronizada» no es válido.' })
  sincronizada?: boolean;
}
