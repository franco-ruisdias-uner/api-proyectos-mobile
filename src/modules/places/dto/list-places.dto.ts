import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsString, Max, MaxLength, Min, Validate } from 'class-validator';
import { EsInstanteConZona } from '../../../common/validation/instant.js';
import { Opcional } from '../../../common/validation/decorators.js';
import { PaginacionHasta } from '../../../common/response/pagination.dto.js';
import type { OrdenLugares } from '../rules/listing.js';

/** El teléfono guarda el catálogo entero: esta lista admite hasta 500 por página. */
export const POR_PAGINA_MAXIMO_LUGARES = 500;
export const RADIO_MAXIMO_METROS = 200_000;
const ORDENES: OrdenLugares[] = ['nombre', 'distancia'];

/**
 * Número de la consulta. A diferencia de `@Type(() => Number)`, un texto vacío no se convierte
 * en 0 (`?latitud=` es un error, no el ecuador).
 */
const NumeroDeConsulta = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN,
  );

const MENSAJE_RADIO = `El radio tiene que ser un número entero de metros, de 1 a ${RADIO_MAXIMO_METROS}.`;
const MENSAJE_INSTANTE =
  'La fecha de «actualizadoDesde» tiene que tener fecha, hora y zona, como 2026-08-01T10:30:00-03:00.';

export class ListarLugaresDto extends PaginacionHasta(POR_PAGINA_MAXIMO_LUGARES) {
  @ApiPropertyOptional({
    description: 'Sólo esa categoría. Un id que no existe da lista vacía.',
    example: 'cat-museos',
  })
  @Opcional()
  @IsString({ message: 'La categoría tiene que ser un texto.' })
  categoriaId?: string;

  @ApiPropertyOptional({
    description: 'Busca en el nombre, sin distinguir mayúsculas ni tildes («colon» encuentra «Colón»).',
    example: 'molino',
  })
  @Opcional()
  @IsString({ message: 'La búsqueda tiene que ser un texto.' })
  @MaxLength(100, { message: 'La búsqueda puede tener hasta 100 letras.' })
  q?: string;

  @ApiPropertyOptional({ description: 'Tu latitud. Va junto con `longitud`.', example: -32.2236 })
  @Opcional()
  @NumeroDeConsulta()
  @IsNumber({ allowNaN: false, allowInfinity: false }, { message: 'La latitud tiene que ser un número.' })
  @Min(-90, { message: 'La latitud tiene que estar entre -90 y 90.' })
  @Max(90, { message: 'La latitud tiene que estar entre -90 y 90.' })
  latitud?: number;

  @ApiPropertyOptional({ description: 'Tu longitud. Va junto con `latitud`.', example: -58.1427 })
  @Opcional()
  @NumeroDeConsulta()
  @IsNumber({ allowNaN: false, allowInfinity: false }, { message: 'La longitud tiene que ser un número.' })
  @Min(-180, { message: 'La longitud tiene que estar entre -180 y 180.' })
  @Max(180, { message: 'La longitud tiene que estar entre -180 y 180.' })
  longitud?: number;

  @ApiPropertyOptional({
    description: `Con tu ubicación: sólo los lugares a esa distancia o menos (en metros, hasta ${RADIO_MAXIMO_METROS}).`,
    example: 2000,
  })
  @Opcional()
  @NumeroDeConsulta()
  @IsInt({ message: MENSAJE_RADIO })
  @Min(1, { message: MENSAJE_RADIO })
  @Max(RADIO_MAXIMO_METROS, { message: MENSAJE_RADIO })
  radioMetros?: number;

  @ApiPropertyOptional({
    enum: ORDENES,
    default: 'nombre',
    description:
      '`distancia` necesita tu ubicación. La distancia no viene en la respuesta: la calcula el teléfono.',
  })
  @Opcional()
  @IsIn(ORDENES, { message: 'El orden tiene que ser «nombre» o «distancia».' })
  orden?: OrdenLugares;

  @ApiPropertyOptional({ enum: ['true'], description: 'Sólo los accesibles para silla de ruedas.' })
  @Opcional()
  @Transform(({ value }: { value: unknown }) => (value === 'true' ? true : value))
  @IsIn([true], { message: 'El filtro de accesibilidad sólo acepta «true».' })
  accesible?: true;

  @ApiPropertyOptional({
    description:
      'Instante ISO con zona. Devuelve los lugares cambiados después, **incluidos los dados de baja** ' +
      '(`activo: false`), para actualizar la copia del teléfono. Sin este parámetro, sólo los activos.',
    example: '2026-08-01T10:30:00-03:00',
  })
  @Opcional()
  @IsString({ message: MENSAJE_INSTANTE })
  @Validate(EsInstanteConZona, { message: MENSAJE_INSTANTE })
  actualizadoDesde?: string;
}
