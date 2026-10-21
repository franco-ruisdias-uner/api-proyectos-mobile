import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDefined,
  IsNotEmpty,
  IsObject,
  IsNumber,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateBy,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { parsearInstante } from '../../../common/dates/dates.js';
import { patronId } from '../../../common/ids/ids.js';
import {
  Opcional,
  Recortar,
  VacioANulo,
} from '../../../common/validation/transforms.js';

export const MAX_FOTOS_DEL_PROBLEMA = 2;
export const MAX_DESCRIPCION = 1000;

const conMensaje = (mensaje: string) => ({ context: { mensaje } });

/** Se puede omitir o mandar null. */
const NoNulo = () =>
  ValidateIf(
    (_o: object, valor: unknown) => valor !== undefined && valor !== null,
  );

export class FotoEntranteDto {
  @ApiPropertyOptional({
    example: 'fot-k3x9a1',
    description:
      'Lo genera el teléfono si la creó sin señal. Si no viene, lo pone el servidor.',
  })
  @Opcional()
  @IsString()
  @Matches(
    patronId('fot'),
    conMensaje('El identificador de la foto no es válido.'),
  )
  id?: string;

  @ApiProperty({ description: 'La URL que devolvió `POST /archivos`.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  url: string;
}

export class CoordenadasDto {
  @ApiProperty({ example: -33.0089 })
  @IsNumber()
  @Min(-90, conMensaje('La latitud tiene que estar entre -90 y 90.'))
  @Max(90, conMensaje('La latitud tiene que estar entre -90 y 90.'))
  latitud: number;

  @ApiProperty({ example: -58.5142 })
  @IsNumber()
  @Min(-180, conMensaje('La longitud tiene que estar entre -180 y 180.'))
  @Max(180, conMensaje('La longitud tiene que estar entre -180 y 180.'))
  longitud: number;
}

export class CrearReporteDto {
  @ApiPropertyOptional({
    example: 'rep-k3x9a1b2c3',
    description:
      'Lo genera el teléfono si el reporte se creó sin señal (`rep-` + 3 a 36 letras, números, `_` o `-`). Repetir el pedido con el mismo `id` no duplica.',
  })
  @Opcional()
  @IsString()
  @Matches(
    patronId('rep'),
    conMensaje('El identificador del reporte no es válido.'),
  )
  id?: string;

  @ApiProperty({ example: 'tip-bache' })
  @IsString()
  @Matches(patronId('tip'), conMensaje('Elegí qué tipo de problema es.'))
  tipoId: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: MAX_DESCRIPCION,
  })
  @VacioANulo()
  @NoNulo()
  @IsString()
  @MaxLength(MAX_DESCRIPCION, conMensaje('La descripción es demasiado larga.'))
  descripcion?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'URL de un audio subido con `POST /archivos`.',
  })
  @VacioANulo()
  @NoNulo()
  @IsString()
  @MaxLength(500)
  audioUrl?: string | null;

  @ApiProperty({
    type: [FotoEntranteDto],
    description: 'Una o dos fotos del problema. Sin foto no hay reporte.',
    minItems: 1,
    maxItems: MAX_FOTOS_DEL_PROBLEMA,
  })
  @NoNulo()
  @IsArray()
  @ArrayMaxSize(
    MAX_FOTOS_DEL_PROBLEMA,
    conMensaje('Se pueden mandar hasta dos fotos del problema.'),
  )
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => FotoEntranteDto)
  fotos?: FotoEntranteDto[] | null;

  @ApiProperty({ type: CoordenadasDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => CoordenadasDto)
  coordenadas: CoordenadasDto;

  @ApiProperty({ example: 'Rocamora 1240', maxLength: 200 })
  @Recortar()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200, conMensaje('La dirección es demasiado larga.'))
  direccion: string;

  @ApiProperty({
    example: '2026-09-14T10:22:00-03:00',
    description:
      'Cuándo lo hizo el vecino (no cuándo se subió). ISO 8601 con offset; no puede ser futura.',
  })
  @IsString()
  @ValidateBy(
    {
      name: 'esInstante',
      validator: { validate: (v: unknown) => parsearInstante(v) !== null },
    },
    conMensaje('La fecha del reporte no tiene el formato correcto.'),
  )
  creadoEn: string;
}
