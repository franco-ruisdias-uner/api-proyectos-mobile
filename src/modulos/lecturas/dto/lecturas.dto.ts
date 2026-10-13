import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  Allow,
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PaginacionAmpliaDto } from '../../../comun/respuesta/paginacion.js';

export class CoordenadasDto {
  @IsNumber({}, { message: 'La latitud no es válida.' })
  latitud: number;

  @IsNumber({}, { message: 'La longitud no es válida.' })
  longitud: number;
}

export class CargarLecturaDto {
  @ApiPropertyOptional({ example: 'lec-88201' })
  @IsOptional()
  @IsString({ message: 'El identificador de la lectura no es válido.' })
  @Matches(/^lec-[A-Za-z0-9_-]{3,36}$/, {
    message: 'El identificador de la lectura no es válido.',
  })
  id?: string;

  @ApiProperty({ example: 'rut-07-2026-05' })
  @IsString({ message: 'Falta la ruta de la lectura.' })
  @Matches(/^rut-[A-Za-z0-9_-]{1,36}$/, { message: 'La ruta no es válida.' })
  rutaId: string;

  @ApiProperty({ example: 'sum-004120' })
  @IsString({ message: 'Falta el suministro de la lectura.' })
  @Matches(/^sum-[A-Za-z0-9_-]{1,36}$/, {
    message: 'El suministro no es válido.',
  })
  suministroId: string;

  @ApiProperty({ example: 1302, description: 'Tal cual se ve en el medidor.' })
  @IsNumber({}, { message: 'Falta el número que marca el medidor.' })
  valor: number;

  @ApiProperty({ description: 'URL de una foto subida con `POST /archivos`.' })
  @IsOptional()
  @IsString({ message: 'La foto no es válida.' })
  fotoUri?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf((_d: object, v: unknown) => v !== null && v !== undefined)
  @IsObject({ message: 'Las coordenadas no son válidas.' })
  @ValidateNested({ message: 'Las coordenadas no son válidas.' })
  @Type(() => CoordenadasDto)
  coordenadas?: CoordenadasDto | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean({ message: 'La confirmación del lector no es válida.' })
  confirmadaPorLector?: boolean;

  @ApiProperty({ example: '2026-09-15T09:12:00-03:00' })
  @IsString({ message: 'Falta la fecha y hora de la lectura.' })
  fechaHora: string;

  // Los calcula el servidor: si vienen (la app manda la `Lectura` tal cual la tiene), se ignoran.
  @ApiPropertyOptional({ description: 'Se ignora: es el del token.' })
  @Allow()
  lectorId?: unknown;

  @ApiPropertyOptional({ description: 'Se ignora: lo calcula el servidor.' })
  @Allow()
  consumo?: unknown;

  @ApiPropertyOptional({ description: 'Se ignora: lo calcula el servidor.' })
  @Allow()
  fueraDeRango?: unknown;

  @ApiPropertyOptional({ description: 'Se ignora: siempre `true` al salir.' })
  @Allow()
  sincronizada?: unknown;
}

const aBooleano = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;

export class ListarLecturasDto extends PaginacionAmpliaDto {
  @ApiPropertyOptional({
    description: 'Sólo las fuera de rango (`true`) o las normales (`false`).',
  })
  @IsOptional()
  @Transform(aBooleano)
  @IsBoolean({ message: 'fueraDeRango tiene que ser true o false.' })
  fueraDeRango?: boolean;
}
