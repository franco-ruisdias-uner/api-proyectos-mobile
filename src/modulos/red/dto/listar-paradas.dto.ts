import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import type { Sentido } from '../../../../contrato/tipos.js';
import {
  CampoNumero,
  CampoPagina,
  CampoPorPagina,
} from '../../../comun/respuesta/campos-de-consulta.js';

export const SENTIDOS: Sentido[] = ['ida', 'vuelta'];
export const ORDENES_DE_PARADAS = ['nombre', 'distancia'] as const;
export type OrdenDeParadas = (typeof ORDENES_DE_PARADAS)[number];
export const RADIO_MAXIMO_METROS = 50_000;

/** Las paradas se bajan enteras para guardarlas en el teléfono (espec. §4). */
export const POR_PAGINA_MAXIMO_PARADAS = 1000;

export class ListarParadasDto {
  @CampoPagina()
  pagina?: number;

  @CampoPorPagina(POR_PAGINA_MAXIMO_PARADAS)
  porPagina?: number;

  @ApiPropertyOptional({
    example: 'alameda',
    description: 'Texto del nombre o de la calle, sin tildes.',
  })
  @IsOptional()
  @IsString({ message: 'La búsqueda (q) tiene que ser un texto.' })
  @MaxLength(100, { message: 'La búsqueda (q) tiene que tener hasta 100 caracteres.' })
  q?: string;

  @ApiPropertyOptional({ example: 'lin-05', description: 'Sólo las paradas de esa línea.' })
  @IsOptional()
  @IsString({ message: 'El identificador de la línea (lineaId) no es válido.' })
  @Matches(/^lin-[A-Za-z0-9_-]{1,36}$/, {
    message: 'El identificador de la línea (lineaId) no es válido.',
  })
  lineaId?: string;

  @ApiPropertyOptional({ enum: SENTIDOS })
  @IsOptional()
  @IsIn(SENTIDOS, { message: 'El sentido (sentido) tiene que ser ida o vuelta.' })
  sentido?: Sentido;

  @ApiPropertyOptional({
    example: -31.7333,
    description: 'Con longitud, para buscar cerca de un punto.',
  })
  @CampoNumero('latitud', 'La latitud', -90, 90)
  latitud?: number;

  @ApiPropertyOptional({ example: -60.5241 })
  @CampoNumero('longitud', 'La longitud', -180, 180)
  longitud?: number;

  @ApiPropertyOptional({
    example: 500,
    description: 'Con latitud y longitud: sólo las paradas a esa distancia o menos.',
  })
  @CampoNumero('radioMetros', 'El radio', 1, RADIO_MAXIMO_METROS, ' metros')
  radioMetros?: number;

  @ApiPropertyOptional({
    enum: ORDENES_DE_PARADAS,
    default: 'nombre',
    description: '`distancia` pide latitud y longitud.',
  })
  @IsOptional()
  @IsIn(ORDENES_DE_PARADAS, { message: 'El orden (orden) tiene que ser nombre o distancia.' })
  orden?: OrdenDeParadas;
}
