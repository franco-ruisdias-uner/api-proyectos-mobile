import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { recortar } from '../../../comun/texto/recortar.js';
import { MEDIOS_DE_PAGO } from '../reglas/panel.js';

// Sólo se saltea la validación si el campo no vino: `null` no es "no lo cambio" y tiene que dar 400.
const vino = (_objeto: unknown, valor: unknown) => valor !== undefined;
// Los campos que admiten `null` (vaciarlos) se validan sólo si traen algo.
const traeValor = (_objeto: unknown, valor: unknown) => valor !== undefined && valor !== null;

export class HorarioDto {
  @ApiProperty({ example: 1, minimum: 0, maximum: 6, description: '0 = domingo.' })
  @Max(6, { message: 'El día de un horario va de 0 (domingo) a 6 (sábado).' })
  @Min(0, { message: 'El día de un horario va de 0 (domingo) a 6 (sábado).' })
  @IsInt({ message: 'El día de un horario va de 0 (domingo) a 6 (sábado).' })
  dia: 0 | 1 | 2 | 3 | 4 | 5 | 6;

  @ApiProperty({ example: '08:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'La hora de apertura tiene que ser HH:MM.' })
  @IsString({ message: 'La hora de apertura tiene que ser HH:MM.' })
  abre: string;

  @ApiProperty({ example: '12:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'La hora de cierre tiene que ser HH:MM.' })
  @IsString({ message: 'La hora de cierre tiene que ser HH:MM.' })
  cierra: string;
}

export class CoordenadasDto {
  @ApiProperty({ example: -32.4825 })
  @Max(90, { message: 'La latitud tiene que estar entre -90 y 90.' })
  @Min(-90, { message: 'La latitud tiene que estar entre -90 y 90.' })
  @IsNumber({}, { message: 'La latitud tiene que ser un número.' })
  latitud: number;

  @ApiProperty({ example: -58.2372 })
  @Max(180, { message: 'La longitud tiene que estar entre -180 y 180.' })
  @Min(-180, { message: 'La longitud tiene que estar entre -180 y 180.' })
  @IsNumber({}, { message: 'La longitud tiene que ser un número.' })
  longitud: number;
}

/** Cuerpo de `PATCH /mi-comercio`. Todo es opcional; lo que no viene queda como estaba. */
export class ActualizarComercioDto {
  @ApiPropertyOptional({ example: 'Ferretería El Tornillo' })
  @ValidateIf(vino)
  @Transform(recortar)
  @Length(1, 120, { message: 'El nombre del comercio tiene que tener entre 1 y 120 letras.' })
  @IsString({ message: 'El nombre del comercio tiene que ser un texto.' })
  nombre?: string;

  @ApiPropertyOptional({ example: 'Todo para el hogar y la obra.' })
  @ValidateIf(vino)
  @Transform(recortar)
  @Length(1, 2000, { message: 'La descripción tiene que tener entre 1 y 2000 letras.' })
  @IsString({ message: 'La descripción tiene que ser un texto.' })
  descripcion?: string;

  @ApiPropertyOptional({ example: '9 de Julio 500' })
  @ValidateIf(vino)
  @Transform(recortar)
  @Length(1, 160, { message: 'La dirección tiene que tener entre 1 y 160 letras.' })
  @IsString({ message: 'La dirección tiene que ser un texto.' })
  direccion?: string;

  @ApiPropertyOptional({ type: CoordenadasDto })
  @ValidateIf(vino)
  @ValidateNested()
  @Type(() => CoordenadasDto)
  coordenadas?: CoordenadasDto;

  @ApiPropertyOptional({ example: '3442 421000', nullable: true, description: '`null` lo borra.' })
  @ValidateIf(traeValor)
  @Transform(recortar)
  @Length(1, 40, { message: 'El teléfono tiene que tener entre 1 y 40 caracteres.' })
  @IsString({ message: 'El teléfono tiene que ser un texto.' })
  telefono?: string | null;

  @ApiPropertyOptional({
    example: '5493442421000',
    nullable: true,
    description: 'Sólo dígitos, con código de país. `null` lo borra.',
  })
  @ValidateIf(traeValor)
  @Matches(/^\d{10,15}$/, {
    message:
      'El WhatsApp tiene que ser sólo números, con el código de país (por ejemplo 5493442421000).',
  })
  @IsString({ message: 'El WhatsApp tiene que ser un texto de números.' })
  whatsapp?: string | null;

  @ApiPropertyOptional({
    example: '@eltornillo',
    nullable: true,
    description: 'Empieza con `@`. `null` lo borra.',
  })
  @ValidateIf(traeValor)
  @Matches(/^@[A-Za-z0-9._]{1,30}$/, {
    message: 'El Instagram tiene que empezar con @, por ejemplo @eltornillo.',
  })
  @IsString({ message: 'El Instagram tiene que ser un texto que empiece con @.' })
  instagram?: string | null;

  @ApiPropertyOptional({
    type: [String],
    description: 'Hasta 8 URLs de `/archivos` (fotos ya subidas). Reemplaza la lista entera.',
  })
  @ValidateIf(vino)
  @IsString({ each: true, message: 'Cada foto tiene que ser una dirección.' })
  @ArrayMaxSize(8, { message: 'Se pueden cargar hasta 8 fotos.' })
  @IsArray({ message: 'Las fotos tienen que ser una lista.' })
  imagenes?: string[];

  @ApiPropertyOptional({
    nullable: true,
    description: 'URL de `/archivos` de un video ya subido. `null` lo saca.',
  })
  @ValidateIf(traeValor)
  @IsString({ message: 'El video tiene que ser una dirección.' })
  videoUrl?: string | null;

  @ApiPropertyOptional({
    type: [HorarioDto],
    description: 'Un elemento por tramo; reemplaza la lista entera. `[]` la vacía.',
  })
  @ValidateIf(vino)
  @ValidateNested({ each: true })
  @Type(() => HorarioDto)
  @ArrayMaxSize(50, { message: 'Hay demasiados horarios.' })
  @IsArray({ message: 'Los horarios tienen que ser una lista.' })
  horarios?: HorarioDto[];

  @ApiPropertyOptional({ type: [String], enum: MEDIOS_DE_PAGO, isArray: true })
  @ValidateIf(vino)
  @IsIn(MEDIOS_DE_PAGO, {
    each: true,
    message: `Los medios de pago posibles son: ${MEDIOS_DE_PAGO.join(', ')}.`,
  })
  @IsArray({ message: 'Los medios de pago tienen que ser una lista.' })
  mediosDePago?: string[];

  @ApiPropertyOptional({
    example: '2026-10-10',
    nullable: true,
    description:
      'Cierre por vacaciones (D2): último día cerrado, `AAAA-MM-DD`. Mientras dura, el comercio sale con `horarios: []`. `null` lo levanta.',
  })
  @ValidateIf(traeValor)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'El último día de cierre tiene que ser AAAA-MM-DD.' })
  @IsString({ message: 'El último día de cierre tiene que ser AAAA-MM-DD.' })
  cerradoHasta?: string | null;
}
