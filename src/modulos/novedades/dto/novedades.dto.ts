import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  Allow,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import type { MotivoNovedad } from '../../../../contrato/tipos.js';
import {
  PaginacionAmpliaDto,
  PaginacionDto,
} from '../../../comun/respuesta/paginacion.js';
import { PATRON_BIMESTRE } from '../../rutas/reglas/rutas.js';
import { MOTIVOS_NOVEDAD } from '../reglas/novedades.js';

export const MAXIMO_COMENTARIO = 500;

const MENSAJE_MOTIVO = `El motivo no es válido. Tiene que ser uno de: ${MOTIVOS_NOVEDAD.join(', ')}.`;
const MENSAJE_BIMESTRE =
  'El bimestre tiene que ser AAAA-NN, con NN de 01 a 06 (por ejemplo 2026-05).';
const PATRON_DIA = /^\d{4}-\d{2}-\d{2}$/;

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CargarNovedadDto {
  @ApiPropertyOptional({ example: 'nov-3312' })
  @IsOptional()
  @IsString({ message: 'El identificador de la novedad no es válido.' })
  @Matches(/^nov-[A-Za-z0-9_-]{3,36}$/, {
    message: 'El identificador de la novedad no es válido.',
  })
  id?: string;

  @ApiProperty({ example: 'rut-07-2026-05' })
  @IsString({ message: 'Falta la ruta de la novedad.' })
  @Matches(/^rut-[A-Za-z0-9_-]{1,36}$/, { message: 'La ruta no es válida.' })
  rutaId: string;

  @ApiProperty({ example: 'sum-004150' })
  @IsString({ message: 'Falta el suministro de la novedad.' })
  @Matches(/^sum-[A-Za-z0-9_-]{1,36}$/, {
    message: 'El suministro no es válido.',
  })
  suministroId: string;

  @ApiProperty({ enum: MOTIVOS_NOVEDAD })
  @IsIn(MOTIVOS_NOVEDAD, { message: MENSAJE_MOTIVO })
  motivo: MotivoNovedad;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: MAXIMO_COMENTARIO,
    description: 'Hasta 500 caracteres. `""` se guarda como `null`.',
  })
  @ValidateIf((_d: object, v: unknown) => v !== null && v !== undefined)
  @IsString({ message: 'El comentario no es válido.' })
  @MaxLength(MAXIMO_COMENTARIO, {
    message: 'El comentario no puede pasar de 500 caracteres.',
  })
  comentario?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'URL de una nota de voz subida con `POST /archivos`.',
  })
  @ValidateIf((_d: object, v: unknown) => v !== null && v !== undefined)
  @IsString({ message: 'La nota de voz no es válida.' })
  audioUri?: string | null;

  @ApiProperty({ description: 'URL de una foto subida con `POST /archivos`.' })
  @IsOptional()
  @IsString({ message: 'La foto no es válida.' })
  fotoUri?: string | null;

  @ApiProperty({ example: '2026-09-15T08:31:00-03:00' })
  @IsString({ message: 'Falta la fecha y hora de la novedad.' })
  fechaHora: string;

  // Los calcula el servidor: si vienen (la app manda la `Novedad` tal cual la tiene), se ignoran.
  @ApiPropertyOptional({ description: 'Se ignora: es el del token.' })
  @Allow()
  lectorId?: unknown;

  @ApiPropertyOptional({ description: 'Se ignora: siempre `true` al salir.' })
  @Allow()
  sincronizada?: unknown;
}

export class ListarNovedadesDeRutaDto extends PaginacionAmpliaDto {
  @ApiPropertyOptional({ enum: MOTIVOS_NOVEDAD })
  @IsOptional()
  @IsIn(MOTIVOS_NOVEDAD, { message: MENSAJE_MOTIVO })
  motivo?: MotivoNovedad;
}

export class ListarNovedadesDto extends PaginacionDto {
  @ApiPropertyOptional({ enum: MOTIVOS_NOVEDAD })
  @IsOptional()
  @IsIn(MOTIVOS_NOVEDAD, { message: MENSAJE_MOTIVO })
  motivo?: MotivoNovedad;

  @ApiPropertyOptional({
    description:
      'Zona = nombre de la ruta (D10), sin importar mayúsculas ni tildes.',
  })
  @IsOptional()
  @Transform(recortar)
  @IsString({ message: 'La zona no es válida.' })
  zona?: string;

  @ApiPropertyOptional({ example: '2026-05' })
  @IsOptional()
  @IsString({ message: MENSAJE_BIMESTRE })
  @Matches(PATRON_BIMESTRE, { message: MENSAJE_BIMESTRE })
  bimestre?: string;

  @ApiPropertyOptional({
    example: '2026-09-14',
    description: 'Día `AAAA-MM-DD` (hora argentina), inclusive.',
  })
  @IsOptional()
  @IsString({ message: 'La fecha "desde" tiene que ser AAAA-MM-DD.' })
  @Matches(PATRON_DIA, {
    message: 'La fecha "desde" tiene que ser AAAA-MM-DD.',
  })
  desde?: string;

  @ApiPropertyOptional({
    example: '2026-09-15',
    description: 'Día `AAAA-MM-DD` (hora argentina), inclusive.',
  })
  @IsOptional()
  @IsString({ message: 'La fecha "hasta" tiene que ser AAAA-MM-DD.' })
  @Matches(PATRON_DIA, {
    message: 'La fecha "hasta" tiene que ser AAAA-MM-DD.',
  })
  hasta?: string;
}

export class ResumenNovedadesDto extends PaginacionDto {
  @ApiPropertyOptional({
    example: '2026-05',
    description: 'Por defecto, el bimestre actual.',
  })
  @IsOptional()
  @IsString({ message: MENSAJE_BIMESTRE })
  @Matches(PATRON_BIMESTRE, { message: MENSAJE_BIMESTRE })
  bimestre?: string;
}
