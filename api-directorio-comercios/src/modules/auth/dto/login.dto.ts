import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { recortar } from '../../../common/text/truncate.js';

export class IngresoDto {
  @ApiProperty({ example: 'marta@mail.com' })
  @Transform(recortar)
  @MaxLength(254, { message: 'El email es demasiado largo.' })
  @MinLength(1, { message: 'Falta el email.' })
  @IsString({ message: 'Falta el email.' })
  email: string;

  @ApiProperty({ example: 'demo1234' })
  @MaxLength(100, { message: 'La contraseña es demasiado larga.' })
  @MinLength(1, { message: 'Falta la contraseña.' })
  @IsString({ message: 'Falta la contraseña.' })
  contrasena: string;
}
