import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  Recortar,
  VacioANulo,
} from '../../../comun/validacion/transformaciones.js';

export class ActualizarYoDto {
  @ApiPropertyOptional({ example: 'Norma Pereyra', maxLength: 120 })
  @Recortar()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120, { context: { mensaje: 'El nombre es demasiado largo.' } })
  nombre?: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '3446 412233',
    description: 'null lo borra.',
  })
  @VacioANulo()
  @IsOptional()
  @IsString()
  @MaxLength(40, { context: { mensaje: 'El teléfono es demasiado largo.' } })
  telefono?: string | null;

  @ApiPropertyOptional({
    example: false,
    description: 'Interruptor de notificaciones push.',
  })
  @IsOptional()
  @IsBoolean()
  avisosActivos?: boolean;
}
