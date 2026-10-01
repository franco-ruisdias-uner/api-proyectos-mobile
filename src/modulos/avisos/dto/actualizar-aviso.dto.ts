import { ApiPropertyOptional } from '@nestjs/swagger';
import type { Gravedad } from '../../../../contrato/tipos.js';
import {
  CoordenadaDto,
  GRAVEDADES,
  Presencia,
  ValidarDesde,
  ValidarDetalle,
  ValidarGravedad,
  ValidarHasta,
  ValidarLineaIds,
  ValidarTitulo,
  ValidarTrazado,
  ValidarVideoUrl,
} from './campos.js';

/** `PATCH /avisos/:id`: parcial. `hasta`, `trazadoAlternativo` y `videoUrl` aceptan `null` para borrarlos. */
export class ActualizarAvisoDto {
  @ApiPropertyOptional()
  @Presencia('opcional')
  @ValidarTitulo()
  titulo?: string;

  @ApiPropertyOptional()
  @Presencia('opcional')
  @ValidarDetalle()
  detalle?: string;

  @ApiPropertyOptional({
    example: ['lin-02', 'lin-07'],
    description: 'Reemplaza la lista completa.',
  })
  @Presencia('opcional')
  @ValidarLineaIds()
  lineaIds?: string[];

  @ApiPropertyOptional({ example: '2026-09-19T08:00:00-03:00' })
  @Presencia('opcional')
  @ValidarDesde()
  desde?: string;

  @ApiPropertyOptional({ nullable: true })
  @Presencia('anulable')
  @ValidarHasta()
  hasta?: string | null;

  @ApiPropertyOptional({ enum: GRAVEDADES })
  @Presencia('opcional')
  @ValidarGravedad()
  gravedad?: Gravedad;

  @ApiPropertyOptional({ type: [CoordenadaDto], nullable: true })
  @Presencia('anulable')
  @ValidarTrazado()
  trazadoAlternativo?: CoordenadaDto[] | null;

  @ApiPropertyOptional({ nullable: true })
  @Presencia('anulable')
  @ValidarVideoUrl()
  videoUrl?: string | null;
}
