import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { LARGO_MINIMO_CONTRASENA } from '../../../common/auth/passwords.js';
import {
  NormalizarEmail,
  Recortar,
  VacioANulo,
} from '../../../common/validation/transforms.js';

export const MENSAJE_CONTRASENA_CORTA = `La contraseña tiene que tener al menos ${LARGO_MINIMO_CONTRASENA} caracteres.`;

export class RegistroDto {
  @ApiProperty({ example: 'Norma Pereyra', maxLength: 120 })
  @Recortar()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120, { context: { mensaje: 'El nombre es demasiado largo.' } })
  nombre: string;

  @ApiProperty({ example: 'norma@mail.com' })
  @NormalizarEmail()
  @IsString()
  @IsNotEmpty()
  @IsEmail(
    {},
    {
      context: { mensaje: 'Revisá el email: no parece una dirección válida.' },
    },
  )
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: 'clave1234', minLength: LARGO_MINIMO_CONTRASENA })
  @IsString()
  @IsNotEmpty()
  @MinLength(LARGO_MINIMO_CONTRASENA, {
    context: { mensaje: MENSAJE_CONTRASENA_CORTA },
  })
  @MaxLength(200)
  contrasena: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: '3446 412233' })
  @VacioANulo()
  @IsOptional()
  @IsString()
  @MaxLength(40, { context: { mensaje: 'El teléfono es demasiado largo.' } })
  telefono?: string | null;
}
