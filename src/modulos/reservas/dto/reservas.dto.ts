import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PaginacionDto } from '../../../comun/respuesta/paginacion.js';

export class CrearReservaDto {
  @ApiProperty({ example: 'tur-esp-02-20260919-19' })
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
