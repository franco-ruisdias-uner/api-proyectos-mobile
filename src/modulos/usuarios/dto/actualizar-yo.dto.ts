import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsNotEmpty, IsString, MaxLength, ValidateIf } from 'class-validator';
import type { Tema } from '../../../../contrato/tipos.js';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const TEMAS: Tema[] = ['claro', 'oscuro', 'sistema'];

/** `PATCH /yo`: sólo estos tres datos se pueden cambiar (el resto es un dato de más). */
export class ActualizarYoDto {
  @ApiPropertyOptional({ example: 'Julián Ferrari' })
  @ValidateIf((_o, valor) => valor !== undefined)
  @Transform(recortar)
  @IsString({ message: 'El nombre tiene que ser un texto.' })
  @IsNotEmpty({ message: 'Falta tu nombre.' })
  @MaxLength(100, { message: 'El nombre puede tener hasta 100 letras.' })
  nombre?: string;

  @ApiPropertyOptional({ example: true })
  @ValidateIf((_o, valor) => valor !== undefined)
  @IsBoolean({ message: 'Los avisos tienen que ser verdadero o falso.' })
  avisosActivos?: boolean;

  @ApiPropertyOptional({ enum: TEMAS, example: 'oscuro' })
  @ValidateIf((_o, valor) => valor !== undefined)
  @IsIn(TEMAS, { message: 'El tema tiene que ser claro, oscuro o sistema.' })
  tema?: Tema;
}
