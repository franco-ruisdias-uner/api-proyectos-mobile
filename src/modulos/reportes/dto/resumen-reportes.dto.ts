import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { CampoInstante } from '../../../comun/fechas/campo-instante.js';
import { CampoPagina, CampoPorPagina } from '../../../comun/respuesta/campos-de-consulta.js';
import { POR_PAGINA_MAXIMO } from '../../../comun/respuesta/respuesta.js';
import { type AgruparPor } from '../reglas/resumen.js';

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
