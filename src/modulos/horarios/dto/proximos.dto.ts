import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';
import { CampoEntero } from '../../../comun/respuesta/campos-de-consulta.js';

export const CANTIDAD_POR_DEFECTO = 3;

export class ProximosDto {
  @ApiPropertyOptional({
    default: CANTIDAD_POR_DEFECTO,
    description: 'Cuántos pasos siguientes por línea.',
  })
  @CampoEntero('cantidad', 'La cantidad', 1, 10)
  cantidad?: number;

  @ApiPropertyOptional({ example: 'lin-05', description: 'Sólo esa línea.' })
  @IsOptional()
  @IsString({ message: 'El identificador de la línea (lineaId) no es válido.' })
  @Matches(/^lin-[A-Za-z0-9_-]{1,36}$/, {
    message: 'El identificador de la línea (lineaId) no es válido.',
  })
  lineaId?: string;
}
