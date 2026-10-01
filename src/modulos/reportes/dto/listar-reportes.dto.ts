import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';
import { CampoPagina, CampoPorPagina } from '../../../comun/respuesta/campos-de-consulta.js';
import { POR_PAGINA_MAXIMO } from '../../../comun/respuesta/respuesta.js';

export class ListarReportesDto {
  @CampoPagina()
  pagina?: number;

  @CampoPorPagina(POR_PAGINA_MAXIMO)
  porPagina?: number;

  @ApiPropertyOptional({ example: 'par-101', description: 'Hace falta `paradaId` o `lineaId`.' })
  @IsOptional()
  @IsString({ message: 'El identificador de la parada (paradaId) no es válido.' })
  @Matches(/^par-[A-Za-z0-9_-]{1,36}$/, {
    message: 'El identificador de la parada (paradaId) no es válido.',
  })
  paradaId?: string;

  @ApiPropertyOptional({ example: 'lin-05', description: 'Hace falta `paradaId` o `lineaId`.' })
  @IsOptional()
  @IsString({ message: 'El identificador de la línea (lineaId) no es válido.' })
  @Matches(/^lin-[A-Za-z0-9_-]{1,36}$/, {
    message: 'El identificador de la línea (lineaId) no es válido.',
  })
  lineaId?: string;
}
