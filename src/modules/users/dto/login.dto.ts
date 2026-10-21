import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsString, MaxLength } from 'class-validator';

export class IngresoDto {
  @ApiProperty({ example: 'julian@mail.com' })
  @IsDefined({ message: 'Falta el email.' })
  @IsString({ message: 'El email tiene que ser un texto.' })
  @MaxLength(200, { message: 'El email es demasiado largo.' })
  email: string;

  @ApiProperty({ example: 'pasajero123' })
  @IsDefined({ message: 'Falta la contraseña.' })
  @IsString({ message: 'La contraseña tiene que ser un texto.' })
  @MaxLength(200, { message: 'La contraseña es demasiado larga.' })
  contrasena: string;
}
