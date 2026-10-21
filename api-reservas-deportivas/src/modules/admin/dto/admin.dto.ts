import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginacionDto } from '../../../common/response/pagination.js';

const ID_ESPACIO = /^esp-[A-Za-z0-9_-]{1,36}$/;
const recortar = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;
const aBooleano = ({ value }: { value: unknown }): unknown =>
  value === 'true' ? true : value === 'false' ? false : value;

export class CrearBloqueoDto {
  @ApiProperty({ example: ['esp-02', 'esp-03'] })
  @Matches(ID_ESPACIO, {
    each: true,
    message: 'Los espacios tienen que ser ids de espacio.',
  })
  @ArrayMaxSize(50, { message: 'Son demasiados espacios.' })
  @ArrayNotEmpty({ message: 'Elegí al menos un espacio.' })
  @IsArray({ message: 'Elegí al menos un espacio.' })
  espacioIds: string[];

  @ApiProperty({ example: '2026-09-21' })
  @IsString({ message: 'Falta la fecha, con la forma AAAA-MM-DD.' })
  fecha: string;

  @ApiPropertyOptional({ example: '10:00', nullable: true })
  @IsOptional()
  @IsString({ message: 'El horario de inicio no es válido.' })
  inicio?: string | null;

  @ApiPropertyOptional({ example: '12:00', nullable: true })
  @IsOptional()
  @IsString({ message: 'El horario de fin no es válido.' })
  fin?: string | null;

  @ApiProperty({ example: 'Cancha anegada' })
  @IsOptional()
  @Transform(recortar)
  @MaxLength(200, { message: 'El motivo es demasiado largo.' })
  @IsString({ message: 'El motivo tiene que ser un texto.' })
  motivo?: string;
}

export class FiltrosBloqueosDto extends PaginacionDto {
  @ApiPropertyOptional({ example: 'esp-02' })
  @IsOptional()
  @Matches(ID_ESPACIO, { message: 'El espacio no es válido.' })
  espacioId?: string;

  @ApiPropertyOptional({
    example: '2026-09-19',
    description: 'Primer día a listar. Default: hoy.',
  })
  @IsOptional()
  @IsString({ message: 'La fecha tiene que ser un día AAAA-MM-DD.' })
  desde?: string;
}

export class FiltrosFijasDto extends PaginacionDto {
  @ApiPropertyOptional({ example: 'esp-02' })
  @IsOptional()
  @Matches(ID_ESPACIO, { message: 'El espacio no es válido.' })
  espacioId?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(aBooleano)
  @IsBoolean({ message: 'Activa tiene que ser true o false.' })
  activa?: boolean;
}

export class CrearFijaDto {
  @ApiProperty({ example: 'esp-02' })
  @Matches(ID_ESPACIO, {
    message: 'El espacio tiene que ser un id de espacio.',
  })
  espacioId: string;

  @ApiProperty({ example: 'Grupo de los martes' })
  @Transform(recortar)
  @MaxLength(120, { message: 'El titular es demasiado largo.' })
  @IsNotEmpty({ message: 'Falta el titular.' })
  @IsString({ message: 'Falta el titular.' })
  titular: string;

  @ApiProperty({ example: 2, description: '0 = domingo … 6 = sábado.' })
  @Max(6, { message: 'El día tiene que ir de 0 (domingo) a 6 (sábado).' })
  @Min(0, { message: 'El día tiene que ir de 0 (domingo) a 6 (sábado).' })
  @IsInt({ message: 'El día tiene que ir de 0 (domingo) a 6 (sábado).' })
  dia: number;

  @ApiProperty({ example: '21:00' })
  @IsString({ message: 'Falta el horario de inicio.' })
  inicio: string;

  @ApiProperty({ example: '22:00' })
  @IsString({ message: 'Falta el horario de fin.' })
  fin: string;

  @ApiProperty({ example: '2026-09-01' })
  @IsString({ message: 'Falta la fecha de inicio, con la forma AAAA-MM-DD.' })
  desde: string;

  @ApiPropertyOptional({ example: null, nullable: true })
  @IsOptional()
  @IsString({ message: 'La fecha de fin tiene que ser AAAA-MM-DD.' })
  hasta?: string | null;
}

/** Edita una fija: sólo cambia lo que viene. El espacio no se cambia. */
export class EditarFijaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(recortar)
  @MaxLength(120, { message: 'El titular es demasiado largo.' })
  @IsNotEmpty({ message: 'Falta el titular.' })
  @IsString({ message: 'Falta el titular.' })
  titular?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Max(6, { message: 'El día tiene que ir de 0 (domingo) a 6 (sábado).' })
  @Min(0, { message: 'El día tiene que ir de 0 (domingo) a 6 (sábado).' })
  @IsInt({ message: 'El día tiene que ir de 0 (domingo) a 6 (sábado).' })
  dia?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'El horario de inicio no es válido.' })
  inicio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'El horario de fin no es válido.' })
  fin?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'La fecha de inicio tiene que ser AAAA-MM-DD.' })
  desde?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString({ message: 'La fecha de fin tiene que ser AAAA-MM-DD.' })
  hasta?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean({ message: 'Activa tiene que ser true o false.' })
  activa?: boolean;
}

export class CambiarPrecioDto {
  @ApiProperty({ example: 9500 })
  @Max(100_000_000, { message: 'El precio es demasiado alto.' })
  @Min(1, { message: 'El precio tiene que ser mayor que cero.' })
  @IsInt({ message: 'El precio tiene que ser un número entero de pesos.' })
  precioPorHora: number;
}
