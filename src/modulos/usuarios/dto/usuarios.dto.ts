import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import type { Rol } from '../../../../contrato/tipos.js';
import { PaginacionDto } from '../../../comun/respuesta/paginacion.js';
import { LARGO_MAXIMO_LEGAJO } from '../reglas/legajo.js';

export const ROLES: Rol[] = ['lector', 'administracion'];
export const LARGO_MINIMO_CONTRASENA = 8;

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Opcional en un PATCH: puede no venir, pero si viene no puede ser null. */
const Opcional = () =>
  ValidateIf((_dto: object, valor: unknown) => valor !== undefined);

export class ListarUsuariosDto extends PaginacionDto {
  @ApiPropertyOptional({ enum: ROLES })
  @IsOptional()
  @IsIn(ROLES, { message: 'El rol tiene que ser "lector" o "administracion".' })
  rol?: Rol;

  @ApiPropertyOptional({ description: 'Parte del legajo o del nombre.' })
  @IsOptional()
  @IsString({ message: 'La búsqueda tiene que ser un texto.' })
  @MaxLength(100, { message: 'La búsqueda es demasiado larga.' })
  buscar?: string;
}

export class CrearUsuarioDto {
  @ApiProperty({ example: 'L-031', maxLength: LARGO_MAXIMO_LEGAJO })
  @Transform(recortar)
  @IsString({ message: 'Falta el legajo.' })
  @IsNotEmpty({ message: 'Falta el legajo.' })
  @MaxLength(LARGO_MAXIMO_LEGAJO, {
    message: `El legajo no puede tener más de ${LARGO_MAXIMO_LEGAJO} caracteres.`,
  })
  legajo: string;

  @ApiProperty({ example: 'Julia Ríos', maxLength: 100 })
  @Transform(recortar)
  @IsString({ message: 'Falta el nombre.' })
  @IsNotEmpty({ message: 'Falta el nombre.' })
  @MaxLength(100, {
    message: 'El nombre no puede tener más de 100 caracteres.',
  })
  nombre: string;

  @ApiProperty({ enum: ROLES, example: 'lector' })
  @IsIn(ROLES, { message: 'El rol tiene que ser "lector" o "administracion".' })
  rol: Rol;

  @ApiProperty({
    example: 'una-clave-segura',
    minLength: LARGO_MINIMO_CONTRASENA,
  })
  @IsString({ message: 'Falta la contraseña.' })
  @MinLength(LARGO_MINIMO_CONTRASENA, {
    message: `La contraseña tiene que tener al menos ${LARGO_MINIMO_CONTRASENA} caracteres.`,
  })
  @MaxLength(200, { message: 'La contraseña es demasiado larga.' })
  contrasena: string;
}

export class ActualizarUsuarioDto {
  @ApiPropertyOptional({ example: 'Julia Ríos', maxLength: 100 })
  @Opcional()
  @Transform(recortar)
  @IsString({ message: 'El nombre tiene que ser un texto.' })
  @IsNotEmpty({ message: 'El nombre no puede quedar vacío.' })
  @MaxLength(100, {
    message: 'El nombre no puede tener más de 100 caracteres.',
  })
  nombre?: string;

  @ApiPropertyOptional({
    description:
      'Contraseña nueva (blanqueo). Cierra todas las sesiones de ese usuario.',
    minLength: LARGO_MINIMO_CONTRASENA,
  })
  @Opcional()
  @IsString({ message: 'La contraseña tiene que ser un texto.' })
  @MinLength(LARGO_MINIMO_CONTRASENA, {
    message: `La contraseña tiene que tener al menos ${LARGO_MINIMO_CONTRASENA} caracteres.`,
  })
  @MaxLength(200, { message: 'La contraseña es demasiado larga.' })
  contrasena?: string;
}

export class ActualizarYoDto {
  @ApiPropertyOptional({ example: true })
  @Opcional()
  @IsBoolean({ message: 'biometriaActiva tiene que ser verdadero o falso.' })
  biometriaActiva?: boolean;

  @ApiPropertyOptional({
    description: 'Obligatoria si se manda contrasenaNueva.',
  })
  @ValidateIf(
    (dto: ActualizarYoDto) =>
      dto.contrasenaNueva !== undefined || dto.contrasenaActual !== undefined,
  )
  @IsString({
    message: 'Para cambiar la contraseña falta la contraseña actual.',
  })
  @IsNotEmpty({
    message: 'Para cambiar la contraseña falta la contraseña actual.',
  })
  @MaxLength(200, { message: 'La contraseña es demasiado larga.' })
  contrasenaActual?: string;

  @ApiPropertyOptional({ minLength: LARGO_MINIMO_CONTRASENA })
  @ValidateIf(
    (dto: ActualizarYoDto) =>
      dto.contrasenaNueva !== undefined || dto.contrasenaActual !== undefined,
  )
  @IsString({ message: 'Falta la contraseña nueva.' })
  @MinLength(LARGO_MINIMO_CONTRASENA, {
    message: `La contraseña nueva tiene que tener al menos ${LARGO_MINIMO_CONTRASENA} caracteres.`,
  })
  @MaxLength(200, { message: 'La contraseña es demasiado larga.' })
  contrasenaNueva?: string;
}
