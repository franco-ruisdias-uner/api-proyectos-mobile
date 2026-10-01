import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Allow, IsDefined, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import type { MotivoDemora } from '../../../../contrato/tipos.js';
import { CampoInstante } from '../../../comun/fechas/campo-instante.js';

export const MOTIVOS: MotivoDemora[] = [
  'no_paso',
  'paso_lleno',
  'demorado',
  'unidad_rota',
  'calle_cortada',
];

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/**
 * `POST /reportes-demora`. El teléfono manda el reporte entero de su cola offline, así que
 * `usuarioId`, `confirmaciones` y `sincronizado` se aceptan y se ignoran (AGENTS §4.4).
 */
export class CrearReporteDto {
  @ApiPropertyOptional({
    example: 'rep-3390',
    description: 'Lo genera el teléfono (cola offline): reenviar el mismo `id` no duplica.',
  })
  @IsOptional()
  @IsString({ message: 'El identificador del reporte (id) no es válido.' })
  @Matches(/^rep-[A-Za-z0-9_-]{3,36}$/, {
    message: 'El identificador del reporte (id) no es válido.',
  })
  id?: string;

  @ApiProperty({ example: 'lin-05' })
  @IsDefined({ message: 'Falta la línea (lineaId) del reporte.' })
  @IsString({ message: 'El identificador de la línea (lineaId) no es válido.' })
  @Matches(/^lin-[A-Za-z0-9_-]{1,36}$/, {
    message: 'El identificador de la línea (lineaId) no es válido.',
  })
  lineaId: string;

  @ApiProperty({ example: 'par-101' })
  @IsDefined({ message: 'Falta la parada (paradaId) del reporte.' })
  @IsString({ message: 'El identificador de la parada (paradaId) no es válido.' })
  @Matches(/^par-[A-Za-z0-9_-]{1,36}$/, {
    message: 'El identificador de la parada (paradaId) no es válido.',
  })
  paradaId: string;

  @ApiProperty({ enum: MOTIVOS })
  @IsDefined({ message: 'Falta el motivo (motivo) del reporte.' })
  @IsIn(MOTIVOS, {
    message:
      'El motivo (motivo) tiene que ser no_paso, paso_lleno, demorado, unidad_rota o calle_cortada.',
  })
  motivo: MotivoDemora;

  @ApiPropertyOptional({ nullable: true, maxLength: 500 })
  @IsOptional()
  @Transform(recortar)
  @IsString({ message: 'El comentario (comentario) tiene que ser un texto de hasta 500 letras.' })
  @MaxLength(500, {
    message: 'El comentario (comentario) tiene que ser un texto de hasta 500 letras.',
  })
  comentario?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'URL de una foto subida antes con `POST /archivos`.',
  })
  @IsOptional()
  @IsString({ message: 'La foto (fotoUri) tiene que ser la dirección de una foto que ya subiste.' })
  @MaxLength(2000, {
    message: 'La foto (fotoUri) tiene que ser la dirección de una foto que ya subiste.',
  })
  fotoUri?: string | null;

  @ApiProperty({
    example: '2026-09-30T14:05:00-03:00',
    description: 'Cuándo pasó (ISO 8601 con zona). No puede ser futura.',
  })
  @IsDefined({ message: 'Falta la fecha y hora (fechaHora) del reporte.' })
  @CampoInstante(
    'La fecha y hora (fechaHora) tiene que ser una fecha con zona, como 2026-11-14T21:00:00-03:00.',
  )
  fechaHora: string;

  // Campos de la cola offline del teléfono: se ignoran.
  @Allow()
  usuarioId?: unknown;

  @Allow()
  confirmaciones?: unknown;

  @Allow()
  sincronizado?: unknown;
}
