import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDefined, IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class RegistroDto {
  @ApiProperty({ example: 'Julián Ferrari' })
  @IsDefined({ message: 'Falta tu nombre.' })
  @Transform(recortar)
  @IsString({ message: 'El nombre tiene que ser un texto.' })
  @IsNotEmpty({ message: 'Falta tu nombre.' })
  @MaxLength(100, { message: 'El nombre puede tener hasta 100 letras.' })
  nombre: string;

  @ApiProperty({ example: 'julian@mail.com' })
  @IsDefined({ message: 'Falta el email.' })
  @Transform(recortar)
  @IsString({ message: 'El email tiene que ser un texto.' })
  @IsEmail({}, { message: 'El email no es válido.' })
  @MaxLength(200, { message: 'El email es demasiado largo.' })
  email: string;

  @ApiProperty({ example: 'una-clave-segura', minLength: 8 })
  @IsDefined({ message: 'Falta la contraseña.' })
  @IsString({ message: 'La contraseña tiene que ser un texto.' })
  @MinLength(8, { message: 'La contraseña tiene que tener al menos 8 caracteres.' })
  @MaxLength(200, { message: 'La contraseña es demasiado larga.' })
  contrasena: string;
}
