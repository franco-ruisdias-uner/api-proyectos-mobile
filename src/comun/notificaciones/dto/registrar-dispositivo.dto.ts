import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, Matches, MaxLength } from 'class-validator';
import type { Plataforma } from '../puertos.js';

export const FORMATO_TOKEN_EXPO = /^Expo(nent)?PushToken\[[^\]]{1,180}\]$/;

// El chequeo de tipo va abajo de todo: es el primero que corre (ver RegistroDto).
export class RegistrarDispositivoDto {
  @ApiProperty({ example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]' })
  @Matches(FORMATO_TOKEN_EXPO, {
    message:
      'El token de notificaciones no es válido: tiene que ser el que da Expo (ExponentPushToken[…]).',
  })
  @MaxLength(200, { message: 'El token de notificaciones no es válido.' })
  @IsString({ message: 'Falta el token de notificaciones del teléfono.' })
  tokenExpo: string;

  @ApiProperty({ enum: ['ios', 'android'] })
  @IsIn(['ios', 'android'], { message: 'La plataforma tiene que ser «ios» o «android».' })
  plataforma: Plataforma;
}
