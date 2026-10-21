import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, Matches, MaxLength } from 'class-validator';
import type { Plataforma } from '../../../common/notifications/ports.js';

export const PATRON_TOKEN_EXPO = /^Expo(nent)?PushToken\[[^\]]{1,180}\]$/;

export class RegistrarDispositivoDto {
  @ApiProperty({ example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]' })
  @IsString({ message: 'Falta el token de notificaciones del teléfono.' })
  @MaxLength(200, { message: 'El token de notificaciones no es válido.' })
  @Matches(PATRON_TOKEN_EXPO, {
    message: 'El token de notificaciones no es válido.',
  })
  tokenExpo: string;

  @ApiProperty({ enum: ['ios', 'android'], example: 'android' })
  @IsIn(['ios', 'android'], {
    message: 'La plataforma tiene que ser "ios" o "android".',
  })
  plataforma: Plataforma;
}
