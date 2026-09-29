import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { NormalizarEmail } from '../../../comun/validacion/transformaciones.js';

export class IngresoDto {
  @ApiProperty({ example: 'norma@mail.com' })
  @NormalizarEmail()
  @IsString()
  @IsNotEmpty()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: 'clave1234' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  contrasena: string;
}
