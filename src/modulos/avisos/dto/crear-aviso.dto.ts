import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

/** `POST /avisos`. El id lo genera el servidor. */
export class CrearAvisoDto {
  @ApiProperty({ example: 'Desvío por obra en calle Corrientes' })
  @Presencia('obligatorio', 'Falta el título (titulo) del aviso.')
  @ValidarTitulo()
  titulo: string;

  @ApiProperty({
    example: 'Por una obra, las líneas 2, 7 y 9 no pasan por Corrientes entre Urquiza y Racedo.',
  })
  @Presencia('obligatorio', 'Falta el detalle (detalle) del aviso.')
  @ValidarDetalle()
  detalle: string;

  @ApiProperty({
    example: ['lin-02', 'lin-07', 'lin-09'],
    description: 'Líneas afectadas; tienen que existir.',
  })
  @Presencia('obligatorio', 'Faltan las líneas (lineaIds) del aviso.')
  @ValidarLineaIds()
  lineaIds: string[];

  @ApiProperty({ example: '2026-09-19T08:00:00-03:00', description: 'ISO 8601 con zona.' })
  @Presencia('obligatorio', 'Falta el inicio (desde) del aviso.')
  @ValidarDesde()
  desde: string;

  @ApiPropertyOptional({
    example: '2026-09-26T18:00:00-03:00',
    nullable: true,
    description: 'Posterior a `desde`. Sin fin, `null` u omitido.',
  })
  @Presencia('anulable')
  @ValidarHasta()
  hasta?: string | null;

  @ApiProperty({ enum: GRAVEDADES })
  @Presencia('obligatorio', 'Falta la gravedad (gravedad) del aviso.')
  @ValidarGravedad()
  gravedad: Gravedad;

  @ApiPropertyOptional({
    type: [CoordenadaDto],
    nullable: true,
    description: 'Al menos dos puntos, o `null`.',
  })
  @Presencia('anulable')
  @ValidarTrazado()
  trazadoAlternativo?: CoordenadaDto[] | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'URL de un video subido antes con `POST /archivos`.',
  })
  @Presencia('anulable')
  @ValidarVideoUrl()
  videoUrl?: string | null;
}
