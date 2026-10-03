import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';
import { recortar } from '../../../comun/texto/recortar.js';

/** Cuerpo de `POST /mi-comercio/usos/validar`. */
export class ValidarUsoDto {
  @ApiProperty({
    example: 'CCU-7KQ4-M9XH',
    description:
      'El código que muestra el vecino. Se acepta en minúsculas y con espacios sobrantes.',
  })
  @Transform(recortar)
  @Length(1, 40, { message: 'Falta el código del cliente.' })
  @IsString({ message: 'Falta el código del cliente.' })
  codigo: string;
}
