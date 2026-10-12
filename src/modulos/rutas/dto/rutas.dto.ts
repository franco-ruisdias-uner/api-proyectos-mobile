import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import type { EstadoRuta } from '../../../../contrato/tipos.js';
import { PaginacionDto } from '../../../comun/respuesta/paginacion.js';
import { PATRON_BIMESTRE } from '../reglas/rutas.js';

export const ESTADOS_RUTA: EstadoRuta[] = ['asignada', 'en_curso', 'cerrada'];
export const MAXIMO_SUMINISTROS_POR_RUTA = 300;

const PATRON_USUARIO = /^usr-[A-Za-z0-9_-]{1,36}$/;
const PATRON_SUMINISTRO = /^sum-[A-Za-z0-9_-]{1,36}$/;
const MENSAJE_ESTADO =
  'El estado tiene que ser "asignada", "en_curso" o "cerrada" (o varios separados por comas).';
const MENSAJE_BIMESTRE =
  'El bimestre tiene que ser AAAA-NN, con NN de 01 a 06 (por ejemplo 2026-05).';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** "asignada,en_curso" → ['asignada', 'en_curso']. Lo que no es texto queda para que lo rechace la validación. */
const aLista = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.split(',').map((e) => e.trim()) : value;

/** Opcional en un PATCH: puede no venir, pero si viene no puede ser null. */
const Opcional = () =>
  ValidateIf((_dto: object, valor: unknown) => valor !== undefined);

export class MisRutasDto extends PaginacionDto {
  @ApiPropertyOptional({
    description:
      'Estados separados por comas. Por defecto `asignada,en_curso`.',
    example: 'asignada,en_curso',
  })
  @IsOptional()
  @Transform(aLista)
  @IsArray({ message: MENSAJE_ESTADO })
  @IsIn(ESTADOS_RUTA, { each: true, message: MENSAJE_ESTADO })
  estado?: EstadoRuta[];
}

export class ListarRutasDto extends MisRutasDto {
  @ApiPropertyOptional({ example: '2026-05' })
  @IsOptional()
  @IsString({ message: MENSAJE_BIMESTRE })
  @Matches(PATRON_BIMESTRE, { message: MENSAJE_BIMESTRE })
  bimestre?: string;

  @ApiPropertyOptional({ example: 'usr-011' })
  @IsOptional()
  @IsString({ message: 'El lector no es válido.' })
  @Matches(PATRON_USUARIO, { message: 'El lector no es válido.' })
  lectorId?: string;
}

export class CrearRutaDto {
  @ApiProperty({ example: '07', description: 'Sólo dígitos, hasta 6.' })
  @Transform(recortar)
  @IsString({ message: 'Falta el número de la ruta.' })
  @Matches(/^\d{1,6}$/, {
    message: 'El número de la ruta tiene que tener sólo dígitos (hasta 6).',
  })
  numero: string;

  @ApiProperty({ example: 'Barrio Brasil', maxLength: 100 })
  @Transform(recortar)
  @IsString({ message: 'Falta el nombre de la ruta.' })
  @IsNotEmpty({ message: 'Falta el nombre de la ruta.' })
  @MaxLength(100, {
    message: 'El nombre de la ruta no puede tener más de 100 caracteres.',
  })
  nombre: string;

  @ApiProperty({ example: '2026-05' })
  @IsString({ message: MENSAJE_BIMESTRE })
  @Matches(PATRON_BIMESTRE, { message: MENSAJE_BIMESTRE })
  bimestre: string;

  @ApiProperty({ example: 'usr-011' })
  @IsString({ message: 'Falta el lector de la ruta.' })
  @Matches(PATRON_USUARIO, { message: 'El lector no es válido.' })
  lectorId: string;

  @ApiProperty({
    type: [String],
    example: ['sum-004162', 'sum-004120', 'sum-004150'],
    description: 'En el orden del recorrido. De 1 a 300.',
  })
  @IsArray({ message: 'Faltan los suministros de la ruta.' })
  @ArrayMinSize(1, { message: 'La ruta necesita al menos un suministro.' })
  @ArrayMaxSize(MAXIMO_SUMINISTROS_POR_RUTA, {
    message: `Una ruta no puede tener más de ${MAXIMO_SUMINISTROS_POR_RUTA} suministros.`,
  })
  @IsString({ each: true, message: 'Hay un suministro que no es válido.' })
  @Matches(PATRON_SUMINISTRO, {
    each: true,
    message: 'Hay un suministro que no es válido.',
  })
  suministroIds: string[];
}

export class ActualizarRutaDto {
  @ApiPropertyOptional({ example: 'Barrio Brasil', maxLength: 100 })
  @Opcional()
  @Transform(recortar)
  @IsString({ message: 'El nombre de la ruta tiene que ser un texto.' })
  @IsNotEmpty({ message: 'El nombre de la ruta no puede quedar vacío.' })
  @MaxLength(100, {
    message: 'El nombre de la ruta no puede tener más de 100 caracteres.',
  })
  nombre?: string;

  @ApiPropertyOptional({ example: 'usr-012' })
  @Opcional()
  @IsString({ message: 'El lector no es válido.' })
  @Matches(PATRON_USUARIO, { message: 'El lector no es válido.' })
  lectorId?: string;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Sólo con la ruta `asignada`. De 1 a 300, en orden de recorrido.',
  })
  @Opcional()
  @IsArray({ message: 'Los suministros de la ruta tienen que ser una lista.' })
  @ArrayMinSize(1, { message: 'La ruta necesita al menos un suministro.' })
  @ArrayMaxSize(MAXIMO_SUMINISTROS_POR_RUTA, {
    message: `Una ruta no puede tener más de ${MAXIMO_SUMINISTROS_POR_RUTA} suministros.`,
  })
  @IsString({ each: true, message: 'Hay un suministro que no es válido.' })
  @Matches(PATRON_SUMINISTRO, {
    each: true,
    message: 'Hay un suministro que no es válido.',
  })
  suministroIds?: string[];
}
