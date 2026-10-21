import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { CampoInstante } from '../../../common/dates/instant-field.js';
import { CampoPagina, CampoPorPagina } from '../../../common/response/query-fields.js';
import { POR_PAGINA_MAXIMO } from '../../../common/response/response.js';
import { type AgruparPor } from '../rules/summary.js';

export const AGRUPAR_POR: AgruparPor[] = ['linea', 'parada'];

export class ResumenReportesDto {
  @CampoPagina()
  pagina?: number;

  @CampoPorPagina(POR_PAGINA_MAXIMO)
  porPagina?: number;

  @ApiPropertyOptional({ example: '2026-09-01T00:00:00-03:00', description: 'Incluido.' })
  @IsOptional()
  @CampoInstante(
    'El inicio (desde) tiene que ser una fecha y hora con zona, como 2026-11-14T21:00:00-03:00.',
  )
  desde?: string;

  @ApiPropertyOptional({ example: '2026-09-30T23:59:59-03:00', description: 'Incluido.' })
  @IsOptional()
  @CampoInstante(
    'El fin (hasta) tiene que ser una fecha y hora con zona, como 2026-11-14T21:00:00-03:00.',
  )
  hasta?: string;

  @ApiPropertyOptional({ enum: AGRUPAR_POR, default: 'linea' })
  @IsOptional()
  @IsIn(AGRUPAR_POR, { message: 'El agrupado (agrupar) tiene que ser linea o parada.' })
  agrupar?: AgruparPor;
}
