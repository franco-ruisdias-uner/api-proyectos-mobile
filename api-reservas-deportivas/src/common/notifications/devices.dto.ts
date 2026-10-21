import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, Matches } from 'class-validator';
import type { Plataforma } from './ports.js';

export const FORMATO_TOKEN_EXPO =
  /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{1,200}\]$/;

export class RegistrarDispositivoDto {
  @ApiProperty({ example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]' })
  @Matches(FORMATO_TOKEN_EXPO, {
    message: 'El token de notificaciones del teléfono no es válido.',
  })
  @IsString({ message: 'Falta el token de notificaciones del teléfono.' })
  tokenExpo: string;

  @ApiProperty({ enum: ['ios', 'android'] })
  @IsIn(['ios', 'android'], {
    message: 'La plataforma tiene que ser "ios" o "android".',
  })
  plataforma: Plataforma;
}
