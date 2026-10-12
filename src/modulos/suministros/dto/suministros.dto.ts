import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import type { Categoria } from '../../../../contrato/tipos.js';
import { PaginacionDto } from '../../../comun/respuesta/paginacion.js';

export const CATEGORIAS: Categoria[] = [
  'residencial',
  'comercial',
  'industrial',
  'rural',
];

/** "true" / "false" de la query → booleano; cualquier otra cosa queda para que la valide IsBoolean. */
const aBooleano = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;

export class ListarSuministrosDto extends PaginacionDto {
  @ApiPropertyOptional({
    description: 'Número de suministro exacto, con sus ceros ("004120").',
  })
  @IsOptional()
  @IsString({ message: 'El número de suministro tiene que ser un texto.' })
  @MaxLength(20, { message: 'El número de suministro es demasiado largo.' })
  numero?: string;

  @ApiPropertyOptional({
    description:
      'Parte del nombre del titular o de la dirección, sin importar mayúsculas ni tildes.',
  })
  @IsOptional()
  @IsString({ message: 'La búsqueda tiene que ser un texto.' })
  @MaxLength(100, { message: 'La búsqueda es demasiado larga.' })
  buscar?: string;

  @ApiPropertyOptional({ enum: CATEGORIAS })
  @IsOptional()
  @IsIn(CATEGORIAS, {
    message:
      'La categoría tiene que ser "residencial", "comercial", "industrial" o "rural".',
  })
  categoria?: Categoria;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(aBooleano)
  @IsBoolean({ message: 'El filtro "activo" tiene que ser true o false.' })
  activo?: boolean;
}
