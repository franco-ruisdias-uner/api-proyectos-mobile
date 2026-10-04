import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class IngresoDto {
  @ApiProperty({ example: 'emiliano@mail.com' })
  @MaxLength(254, { message: 'El email es demasiado largo.' })
  @MinLength(1, { message: 'Falta el email.' })
  @IsString({ message: 'Falta el email.' })
  email: string;

  @ApiProperty({ example: 'villaguay2026' })
  @MaxLength(200, { message: 'La contraseña es demasiado larga.' })
  @MinLength(1, { message: 'Falta la contraseña.' })
  @IsString({ message: 'Falta la contraseña.' })
  contrasena: string;
}
