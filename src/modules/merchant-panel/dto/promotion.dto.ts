import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsString, Length, Max, Min, ValidateIf } from 'class-validator';
import { recortar } from '../../../common/text/truncate.js';

const vino = (_objeto: unknown, valor: unknown) => valor !== undefined;
const traeValor = (_objeto: unknown, valor: unknown) => valor !== undefined && valor !== null;

const MENSAJE_DESCUENTO = 'El descuento tiene que ser un número entero de 1 a 100.';

/** Cuerpo de `POST /mi-comercio/promociones`. */
export class CrearPromocionDto {
  @ApiProperty({ example: '15% en pinturas', maxLength: 120 })
  @Transform(recortar)
  @Length(1, 120, { message: 'El título tiene que tener entre 1 y 120 letras.' })
  @IsString({ message: 'Falta el título de la promoción.' })
  titulo: string;

  @ApiProperty({ example: 'Válido en pinturas de todas las marcas.', maxLength: 2000 })
  @Transform(recortar)
  @Length(1, 2000, { message: 'El detalle tiene que tener entre 1 y 2000 letras.' })
  @IsString({ message: 'Falta el detalle de la promoción.' })
  detalle: string;

  @ApiPropertyOptional({
    example: 15,
    nullable: true,
    minimum: 1,
    maximum: 100,
    description:
      'Porcentaje entero (15, no 0.15). `null` o sin mandar: la promo no es un descuento.',
  })
  @ValidateIf(traeValor)
  @Max(100, { message: MENSAJE_DESCUENTO })
  @Min(1, { message: MENSAJE_DESCUENTO })
  @IsInt({ message: MENSAJE_DESCUENTO })
  descuento?: number | null;

  @ApiPropertyOptional({
    example: '2026-10-01T00:00:00-03:00',
    description: 'ISO 8601 con zona. Por defecto, ahora.',
  })
  @ValidateIf(vino)
  @IsString({ message: 'La fecha de inicio no es válida.' })
  desde?: string;

  @ApiProperty({
    example: '2026-10-31T23:59:59-03:00',
    description: 'ISO 8601 con zona. Tiene que ser posterior a `desde` y a este momento.',
  })
  @IsString({ message: 'Falta la fecha en que termina la promoción.' })
  hasta: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'URL de `/archivos` de una foto ya subida. `null` o sin mandar: sin foto.',
  })
  @ValidateIf(traeValor)
  @IsString({ message: 'La foto tiene que ser una dirección.' })
  imagenUrl?: string | null;

  @ApiPropertyOptional({
    example: false,
    default: false,
    description: 'Sólo con la app: el vecino genera un código y el comercio lo valida.',
  })
  @ValidateIf(vino)
  @IsBoolean({ message: '«Sólo con la app» tiene que ser sí o no.' })
  soloApp?: boolean;
}

/** Cuerpo de `PATCH /mi-comercio/promociones/:id`. Lo que no viene queda como estaba. */
export class EditarPromocionDto {
  @ApiPropertyOptional({ example: '20% en pinturas', maxLength: 120 })
  @ValidateIf(vino)
  @Transform(recortar)
  @Length(1, 120, { message: 'El título tiene que tener entre 1 y 120 letras.' })
  @IsString({ message: 'El título tiene que ser un texto.' })
  titulo?: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @ValidateIf(vino)
  @Transform(recortar)
  @Length(1, 2000, { message: 'El detalle tiene que tener entre 1 y 2000 letras.' })
  @IsString({ message: 'El detalle tiene que ser un texto.' })
  detalle?: string;

  @ApiPropertyOptional({ example: 20, nullable: true, minimum: 1, maximum: 100 })
  @ValidateIf(traeValor)
  @Max(100, { message: MENSAJE_DESCUENTO })
  @Min(1, { message: MENSAJE_DESCUENTO })
  @IsInt({ message: MENSAJE_DESCUENTO })
  descuento?: number | null;

  @ApiPropertyOptional({ example: '2026-10-01T00:00:00-03:00' })
  @ValidateIf(vino)
  @IsString({ message: 'La fecha de inicio no es válida.' })
  desde?: string;

  @ApiPropertyOptional({ example: '2026-10-31T23:59:59-03:00' })
  @ValidateIf(vino)
  @IsString({ message: 'La fecha en que termina la promoción no es válida.' })
  hasta?: string;

  @ApiPropertyOptional({ nullable: true, description: '`null` le saca la foto.' })
  @ValidateIf(traeValor)
  @IsString({ message: 'La foto tiene que ser una dirección.' })
  imagenUrl?: string | null;

  @ApiPropertyOptional()
  @ValidateIf(vino)
  @IsBoolean({ message: '«Sólo con la app» tiene que ser sí o no.' })
  soloApp?: boolean;
}
