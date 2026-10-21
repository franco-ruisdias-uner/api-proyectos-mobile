import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';
import { Opcional } from '../../../common/validation/decorators.js';
import { PaginacionDto } from '../../../common/response/pagination.dto.js';

const ESTADOS = ['programado', 'suspendido', 'cancelado', 'finalizado'] as const;
const MENSAJE_DIA = 'El día tiene que tener el formato AAAA-MM-DD, por ejemplo 2026-11-14.';

export class ListarEventosDto extends PaginacionDto {
  @ApiPropertyOptional({
    description: 'Un solo día (`AAAA-MM-DD`). No se combina con `desde` ni `hasta`.',
    example: '2026-11-14',
  })
  @Opcional()
  @IsString({ message: MENSAJE_DIA })
  fecha?: string;

  @ApiPropertyOptional({
    description: 'Desde este día, inclusive. Sin nada: desde hoy.',
    example: '2026-11-14',
  })
  @Opcional()
  @IsString({ message: MENSAJE_DIA })
  desde?: string;

  @ApiPropertyOptional({
    description: 'Hasta este día, inclusive. Sin tope si no se manda.',
    example: '2026-11-30',
  })
  @Opcional()
  @IsString({ message: MENSAJE_DIA })
  hasta?: string;

  @ApiPropertyOptional({ description: 'Sólo los eventos de este lugar.', example: 'lug-009' })
  @Opcional()
  @IsString({ message: 'El lugar tiene que ser un texto.' })
  lugarId?: string;

  @ApiPropertyOptional({
    enum: ESTADOS,
    description: '`finalizado` se calcula: es un evento programado que ya terminó.',
  })
  @Opcional()
  @IsIn(ESTADOS, {
    message: 'El estado tiene que ser «programado», «suspendido», «cancelado» o «finalizado».',
  })
  estado?: (typeof ESTADOS)[number];
}
