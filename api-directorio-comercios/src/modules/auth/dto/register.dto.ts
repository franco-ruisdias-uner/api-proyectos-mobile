import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, MaxLength, MinLength } from 'class-validator';
import { recortar } from '../../../common/text/truncate.js';

// class-validator corre primero el decorador más cercano a la propiedad, y con
// stopAtFirstError se queda con el primer problema: el chequeo de tipo va abajo de todo.
export class RegistroDto {
  @ApiProperty({ example: 'Marta Giménez' })
  @Transform(recortar)
  @Length(1, 80, { message: 'El nombre tiene que tener entre 1 y 80 letras.' })
  @IsString({ message: 'Falta tu nombre.' })
  nombre: string;

  @ApiProperty({ example: 'marta@mail.com' })
  @Transform(recortar)
  @IsEmail({}, { message: 'El email no es válido.' })
  @MaxLength(254, { message: 'El email es demasiado largo.' })
  @IsString({ message: 'Falta el email.' })
  email: string;

  @ApiProperty({ example: 'demo1234', minLength: 8, maxLength: 100 })
  @MaxLength(100, { message: 'La contraseña puede tener como máximo 100 caracteres.' })
  @MinLength(8, { message: 'La contraseña tiene que tener al menos 8 caracteres.' })
  @IsString({ message: 'Falta la contraseña.' })
  contrasena: string;
}
