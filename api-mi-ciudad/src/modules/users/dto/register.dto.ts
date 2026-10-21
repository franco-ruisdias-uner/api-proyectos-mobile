import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { Recortar } from '../../../common/validation/decorators.js';

export class RegistroDto {
  @ApiProperty({ example: 'Lucía Méndez' })
  @Recortar()
  @IsString({ message: 'Falta tu nombre.' })
  @IsNotEmpty({ message: 'Falta tu nombre.' })
  @MaxLength(100, { message: 'El nombre puede tener hasta 100 letras.' })
  nombre: string;

  @ApiProperty({ example: 'lucia@mail.com' })
  @Recortar()
  @IsString({ message: 'Falta el email.' })
  @IsNotEmpty({ message: 'Falta el email.' })
  @MaxLength(254, { message: 'El email es demasiado largo.' })
  @IsEmail({}, { message: 'El email no es válido.' })
  email: string;

  @ApiProperty({ example: 'una-clave-segura', minLength: 8, maxLength: 200 })
  @IsString({ message: 'Falta la contraseña.' })
  @MinLength(8, { message: 'La contraseña tiene que tener al menos 8 caracteres.' })
  @MaxLength(200, { message: 'La contraseña puede tener hasta 200 caracteres.' })
  contrasena: string;
}

export class IngresoDto {
  @ApiProperty({ example: 'lucia@mail.com' })
  @Recortar()
  @IsString({ message: 'Falta el email.' })
  @IsNotEmpty({ message: 'Falta el email.' })
  email: string;

  @ApiProperty({ example: 'lucia1234' })
  @IsString({ message: 'Falta la contraseña.' })
  @IsNotEmpty({ message: 'Falta la contraseña.' })
  contrasena: string;
}
