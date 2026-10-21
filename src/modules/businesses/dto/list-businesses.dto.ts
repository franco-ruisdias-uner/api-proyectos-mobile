import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { recortar } from '../../../common/text/truncate.js';
import { ORDENES_COMERCIOS, type OrdenComercios } from '../rules/businesses.js';

/** Query de `GET /comercios`. A diferencia del resto, `porPagina` llega a 1000 (el teléfono guarda el listado). */
export class ListarComerciosDto {
  @ApiPropertyOptional({ default: 1, minimum: 1, description: 'Número de página, desde 1.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La página tiene que ser un número entero.' })
  @Min(1, { message: 'La página tiene que ser 1 o más.' })
  pagina: number = 1;

  @ApiPropertyOptional({
    default: 20,
    minimum: 1,
    maximum: 1000,
    description: 'Elementos por página (hasta 1000).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La cantidad por página tiene que ser un número entero.' })
  @Min(1, { message: 'La cantidad por página tiene que ser 1 o más.' })
  @Max(1000, { message: 'La cantidad por página puede ser como máximo 1000.' })
  porPagina: number = 20;

  @ApiPropertyOptional({
    example: 'rub-ferreteria',
    description: 'Sólo los comercios de ese rubro.',
  })
  @IsOptional()
  @Matches(/^rub-[A-Za-z0-9_-]{1,36}$/, { message: 'El rubro no es válido.' })
  rubroId?: string;

  @ApiPropertyOptional({
    example: 'pintura',
    description: 'Texto a buscar en el nombre y la descripción, sin importar tildes ni mayúsculas.',
  })
  @IsOptional()
  @Transform(recortar)
  @MaxLength(100, { message: 'La búsqueda puede tener hasta 100 letras.' })
  @IsString({ message: 'La búsqueda tiene que ser un texto.' })
  q?: string;

  @ApiPropertyOptional({ example: -32.4825, description: 'Mi posición. Va junto con `longitud`.' })
  @IsOptional()
  @Type(() => Number)
  @Min(-90, { message: 'La latitud tiene que estar entre -90 y 90.' })
  @Max(90, { message: 'La latitud tiene que estar entre -90 y 90.' })
  @IsNumber({}, { message: 'La latitud tiene que ser un número.' })
  latitud?: number;

  @ApiPropertyOptional({ example: -58.2372, description: 'Mi posición. Va junto con `latitud`.' })
  @IsOptional()
  @Type(() => Number)
  @Min(-180, { message: 'La longitud tiene que estar entre -180 y 180.' })
  @Max(180, { message: 'La longitud tiene que estar entre -180 y 180.' })
  @IsNumber({}, { message: 'La longitud tiene que ser un número.' })
  longitud?: number;

  @ApiPropertyOptional({
    example: 1000,
    description: 'Sólo los que están a esa distancia o menos. Pide `latitud` y `longitud`.',
  })
  @IsOptional()
  @Type(() => Number)
  @Min(1, { message: 'El radio tiene que ser de 1 metro o más.' })
  @IsNumber({}, { message: 'El radio tiene que ser un número.' })
  radioMetros?: number;

  @ApiPropertyOptional({
    enum: ORDENES_COMERCIOS,
    default: 'nombre',
    description: '`distancia` pide `latitud` y `longitud`; `puntaje` va de mayor a menor.',
  })
  @IsOptional()
  @IsIn(ORDENES_COMERCIOS, { message: 'El orden tiene que ser nombre, distancia o puntaje.' })
  orden?: OrdenComercios;
}
