import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class IngresoDto {
  @ApiProperty({ example: 'L-011' })
  @IsString({ message: 'Falta el legajo.' })
  @IsNotEmpty({ message: 'Falta el legajo.' })
  @MaxLength(100, { message: 'El legajo es demasiado largo.' })
  legajo: string;

  @ApiProperty({ example: 'lectura' })
  @IsString({ message: 'Falta la contraseña.' })
  @IsNotEmpty({ message: 'Falta la contraseña.' })
  @MaxLength(200, { message: 'La contraseña es demasiado larga.' })
  contrasena: string;
}
