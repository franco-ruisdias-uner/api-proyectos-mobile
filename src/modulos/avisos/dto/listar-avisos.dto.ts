import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches } from 'class-validator';
import { CampoPagina, CampoPorPagina } from '../../../comun/respuesta/campos-de-consulta.js';
import { POR_PAGINA_MAXIMO } from '../../../comun/respuesta/respuesta.js';
import { type EstadoDeAviso, ESTADOS_DE_AVISO } from '../reglas/vigencia.js';

export class ListarAvisosDto {
  @CampoPagina()
  pagina?: number;

  @CampoPorPagina(POR_PAGINA_MAXIMO)
  porPagina?: number;

  @ApiPropertyOptional({ enum: ESTADOS_DE_AVISO, default: 'vigentes' })
  @IsOptional()
  @IsIn(ESTADOS_DE_AVISO, {
    message: 'El estado (estado) tiene que ser vigentes, proximos o todos.',
  })
  estado?: EstadoDeAviso;

  @ApiPropertyOptional({
    example: 'lin-05',
    description: 'Sólo los avisos que mencionan esa línea.',
  })
  @IsOptional()
  @IsString({ message: 'El identificador de la línea (lineaId) no es válido.' })
  @Matches(/^lin-[A-Za-z0-9_-]{1,36}$/, {
    message: 'El identificador de la línea (lineaId) no es válido.',
  })
  lineaId?: string;
}
