import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';
import { recortar } from '../../../comun/texto/recortar.js';

/** Cuerpo de `POST /resenas/:id/respuesta`. */
export class ResponderResenaDto {
  @ApiProperty({ example: '¡Gracias por visitarnos!', maxLength: 1000 })
  @Transform(recortar)
  @Length(1, 1000, { message: 'La respuesta tiene que tener entre 1 y 1000 letras.' })
  @IsString({ message: 'Falta escribir la respuesta.' })
  respuesta: string;
}
