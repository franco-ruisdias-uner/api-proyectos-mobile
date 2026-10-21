import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, Matches, MaxLength } from 'class-validator';
import { Recortar } from '../../../common/validation/decorators.js';

export const PLATAFORMAS = ['ios', 'android'] as const;

export class RegistrarDispositivoDto {
  @ApiProperty({ example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]' })
  @Recortar()
  @IsString({ message: 'Falta el token de notificaciones del teléfono.' })
  @MaxLength(200, { message: 'El token de notificaciones no es válido.' })
  @Matches(/^(ExponentPushToken|ExpoPushToken)\[[^\]\s]+\]$/, {
    message: 'El token de notificaciones no es válido.',
  })
  tokenExpo: string;

  @ApiProperty({ enum: PLATAFORMAS, example: 'android' })
  @IsIn(PLATAFORMAS, { message: 'La plataforma tiene que ser ios o android.' })
  plataforma: (typeof PLATAFORMAS)[number];
}
