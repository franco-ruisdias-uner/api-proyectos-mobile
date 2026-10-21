import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches } from 'class-validator';
import type { Sentido, TipoDeDia } from '../../../../contract/types.js';
import { CampoPagina, CampoPorPagina } from '../../../common/response/query-fields.js';
import { SENTIDOS } from '../../network/dto/list-stops.dto.js';

export const TIPOS_DE_DIA: TipoDeDia[] = ['habil', 'sabado', 'domingo', 'feriado'];

/** La tabla de horarios se baja entera para guardarla en el teléfono (espec. §4). */
export const POR_PAGINA_MAXIMO_HORARIOS = 5000;

export class ListarHorariosDto {
  @CampoPagina()
  pagina?: number;

  @CampoPorPagina(POR_PAGINA_MAXIMO_HORARIOS)
  porPagina?: number;

  @ApiPropertyOptional({ example: 'lin-05', description: 'Hace falta `lineaId` o `paradaId`.' })
  @IsOptional()
  @IsString({ message: 'El identificador de la línea (lineaId) no es válido.' })
  @Matches(/^lin-[A-Za-z0-9_-]{1,36}$/, {
    message: 'El identificador de la línea (lineaId) no es válido.',
  })
  lineaId?: string;

  @ApiPropertyOptional({ example: 'par-101', description: 'Hace falta `lineaId` o `paradaId`.' })
  @IsOptional()
  @IsString({ message: 'El identificador de la parada (paradaId) no es válido.' })
  @Matches(/^par-[A-Za-z0-9_-]{1,36}$/, {
    message: 'El identificador de la parada (paradaId) no es válido.',
  })
  paradaId?: string;

  @ApiPropertyOptional({ enum: SENTIDOS })
  @IsOptional()
  @IsIn(SENTIDOS, { message: 'El sentido (sentido) tiene que ser ida o vuelta.' })
  sentido?: Sentido;

  @ApiPropertyOptional({ enum: TIPOS_DE_DIA })
  @IsOptional()
  @IsIn(TIPOS_DE_DIA, {
    message: 'El tipo de día (tipoDeDia) tiene que ser habil, sabado, domingo o feriado.',
  })
  tipoDeDia?: TipoDeDia;
}
