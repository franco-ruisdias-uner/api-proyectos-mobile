import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import type { EstadoGuardado } from '../rules/agenda.js';

const ESTADOS: EstadoGuardado[] = ['programado', 'suspendido', 'cancelado'];

export class CambiarEstadoDto {
  @ApiProperty({
    enum: ESTADOS,
    description: '`finalizado` no se puede elegir: se calcula solo cuando el evento termina.',
  })
  @IsIn(ESTADOS, { message: 'El estado tiene que ser «programado», «suspendido» o «cancelado».' })
  estado: EstadoGuardado;
}
