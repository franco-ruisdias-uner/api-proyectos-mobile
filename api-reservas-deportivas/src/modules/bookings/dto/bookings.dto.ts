import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PaginacionDto } from '../../../common/response/pagination.js';

export class CrearReservaDto {
  @ApiProperty({ example: 'tur-esp-02-20260919-19' })
  @IsNotEmpty({ message: 'Falta el turno que querés reservar.' })
  @IsString({ message: 'Falta el turno que querés reservar.' })
  turnoId: string;

  @ApiProperty({ example: 10, minimum: 1 })
  @Min(1, { message: 'Tiene que ir al menos una persona.' })
  @IsInt({ message: 'La cantidad de personas tiene que ser un número entero.' })
  cantidadPersonas: number;
}

export const MOMENTOS = ['proximas', 'pasadas'] as const;

export class MisReservasDto extends PaginacionDto {
  @ApiPropertyOptional({
    enum: MOMENTOS,
    default: 'proximas',
    description:
      '`proximas`: confirmadas cuyo turno no terminó. `pasadas`: todas las demás.',
  })
  @IsOptional()
  @IsIn(MOMENTOS, {
    message: 'Pedí las reservas «proximas» o «pasadas».',
  })
  cuando: (typeof MOMENTOS)[number] = 'proximas';
}

/** La cancelación no lleva cuerpo: el DTO vacío hace que el pipe rechace campos de más. */
export class CancelarReservaDto {}

export const ESTADOS = [
  'confirmada',
  'cumplida',
  'cancelada',
  'ausente',
] as const;

export class FiltrosReservasDto extends PaginacionDto {
  @ApiPropertyOptional({
    example: '2026-09-19',
    description: 'Día del turno, AAAA-MM-DD.',
  })
  @IsOptional()
  @IsString({
    message: 'La fecha tiene que ser un día con la forma AAAA-MM-DD.',
  })
  fecha?: string;

  @ApiPropertyOptional({ example: 'esp-02' })
  @IsOptional()
  @IsString({ message: 'El espacio tiene que ser un id de espacio.' })
  espacioId?: string;

  @ApiPropertyOptional({ enum: ESTADOS })
  @IsOptional()
  @IsIn(ESTADOS, {
    message:
      'El estado tiene que ser confirmada, cumplida, cancelada o ausente.',
  })
  estado?: (typeof ESTADOS)[number];
}
