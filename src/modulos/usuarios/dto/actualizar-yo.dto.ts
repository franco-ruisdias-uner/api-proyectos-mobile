import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsString, Length, ValidateIf } from 'class-validator';
import { recortar } from '../../../comun/texto/recortar.js';

// Sólo se saltea la validación si el campo no vino: `null` no es "no lo cambio" y tiene que dar 400.
const vino = (_objeto: unknown, valor: unknown) => valor !== undefined;

export class ActualizarYoDto {
  @ApiPropertyOptional({ example: 'Marta Giménez' })
  @ValidateIf(vino)
  @Transform(recortar)
  @Length(1, 80, { message: 'El nombre tiene que tener entre 1 y 80 letras.' })
  @IsString({ message: 'El nombre tiene que ser un texto.' })
  nombre?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['rub-ferreteria', 'rub-gastronomia'],
    description: 'Reemplaza la lista entera. `[]` la vacía.',
  })
  @ValidateIf(vino)
  @IsString({ each: true, message: 'Cada rubro de interés tiene que ser un texto.' })
  @ArrayMaxSize(50, { message: 'Elegiste demasiados rubros de interés.' })
  @IsArray({ message: 'Los rubros de interés tienen que ser una lista.' })
  rubrosDeInteres?: string[];

  @ApiPropertyOptional({ example: true, description: 'Interruptor de las notificaciones.' })
  @ValidateIf(vino)
  @IsBoolean({ message: 'Avisos activos tiene que ser sí o no.' })
  avisosActivos?: boolean;
}
