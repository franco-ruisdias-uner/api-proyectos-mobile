import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsNotEmpty, IsString, Matches, MaxLength, Validate } from 'class-validator';
import { Opcional, OpcionalONulo } from '../../../common/validation/decorators.js';
import { EsInstanteConZona } from '../../../common/validation/instant.js';
import { PaginacionHasta } from '../../../common/response/pagination.dto.js';
import { LARGO_MAXIMO_NOTA } from '../rules/visits.js';

export const ORIGENES_VISITA = ['qr', 'gps', 'manual'] as const;
export const POR_PAGINA_MAXIMO_VISITAS = 500;

const MENSAJE_NOTA = `La nota tiene que ser un texto de hasta ${LARGO_MAXIMO_NOTA} caracteres.`;
const MENSAJE_FOTO = 'La foto no es válida.';

export class ListarVisitasDto extends PaginacionHasta(POR_PAGINA_MAXIMO_VISITAS) {}

export class CrearVisitaDto {
  @ApiPropertyOptional({
    description:
      'Id generado por el teléfono (`vis-…`, 3 a 36 caracteres). Si ya existe y es tuyo, se devuelve el existente.',
    example: 'vis-311',
  })
  @Opcional()
  @IsString({ message: 'El identificador de la visita no es válido.' })
  @Matches(/^vis-[A-Za-z0-9_-]{3,36}$/, { message: 'El identificador de la visita no es válido.' })
  id?: string;

  @ApiProperty({ example: 'lug-004' })
  @IsString({ message: 'Falta el lugar visitado.' })
  @IsNotEmpty({ message: 'Falta el lugar visitado.' })
  @MaxLength(60, { message: 'Falta el lugar visitado.' })
  lugarId: string;

  @ApiProperty({ example: '2026-09-14T17:42:00-03:00', description: 'Cuándo se hizo la visita, con zona.' })
  @IsString({
    message: 'La fecha y hora de la visita tienen que tener zona, como 2026-09-14T17:42:00-03:00.',
  })
  @Validate(EsInstanteConZona, {
    message: 'La fecha y hora de la visita tienen que tener zona, como 2026-09-14T17:42:00-03:00.',
  })
  fechaHora: string;

  @ApiProperty({ enum: ORIGENES_VISITA, example: 'qr' })
  @IsIn(ORIGENES_VISITA, { message: 'El origen de la visita tiene que ser qr, gps o manual.' })
  origen: (typeof ORIGENES_VISITA)[number];

  @ApiPropertyOptional({ nullable: true, description: 'URL devuelta por POST /archivos.' })
  @OpcionalONulo()
  @IsString({ message: MENSAJE_FOTO })
  @MaxLength(2000, { message: MENSAJE_FOTO })
  fotoUri?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: LARGO_MAXIMO_NOTA })
  @OpcionalONulo()
  @IsString({ message: MENSAJE_NOTA })
  @MaxLength(LARGO_MAXIMO_NOTA, { message: MENSAJE_NOTA })
  nota?: string | null;

  @ApiPropertyOptional({ description: 'Se ignora: en el servidor siempre es true.' })
  @Opcional()
  @IsBoolean({ message: 'El campo «sincronizada» tiene que ser sí o no.' })
  sincronizada?: boolean;
}

export class ActualizarVisitaDto {
  @ApiPropertyOptional({
    nullable: true,
    description: 'URL devuelta por POST /archivos, o null para sacarla.',
  })
  @OpcionalONulo()
  @IsString({ message: MENSAJE_FOTO })
  @MaxLength(2000, { message: MENSAJE_FOTO })
  fotoUri?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: LARGO_MAXIMO_NOTA })
  @OpcionalONulo()
  @IsString({ message: MENSAJE_NOTA })
  @MaxLength(LARGO_MAXIMO_NOTA, { message: MENSAJE_NOTA })
  nota?: string | null;
}
