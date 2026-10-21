import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const recortar = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

// class-validator corre los decoradores de abajo hacia arriba y se queda con el primer
// problema: el "Falta …" va abajo de todo.
export class RegistroDto {
  @ApiProperty({ example: 'Emiliano Ruiz' })
  @Transform(recortar)
  @Length(1, 80, { message: 'El nombre tiene que tener entre 1 y 80 letras.' })
  @IsString({ message: 'Falta tu nombre.' })
  nombre: string;

  @ApiProperty({ example: 'emiliano@mail.com' })
  @Transform(recortar)
  @IsEmail({}, { message: 'El email no es válido.' })
  @MaxLength(254, { message: 'El email es demasiado largo.' })
  @IsString({ message: 'Falta el email.' })
  email: string;

  @ApiProperty({ example: 'clave-segura-123', minLength: 8 })
  @MaxLength(200, { message: 'La contraseña es demasiado larga.' })
  @MinLength(8, {
    message: 'La contraseña tiene que tener al menos 8 caracteres.',
  })
  @IsString({ message: 'Falta la contraseña.' })
  contrasena: string;

  @ApiProperty({
    example: '3455-401122',
    description: 'Obligatorio: así el encargado ubica a quien no vino.',
  })
  @Transform(recortar)
  @Matches(/^\+?[0-9][0-9 ()-]{5,28}$/, {
    message: 'El teléfono no es válido: usá sólo números, espacios o guiones.',
  })
  @IsString({ message: 'Falta el teléfono.' })
  telefono: string;
}
