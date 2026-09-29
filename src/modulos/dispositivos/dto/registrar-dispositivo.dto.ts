import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateBy,
} from 'class-validator';
import { Expo } from 'expo-server-sdk';
import type { Plataforma } from '../../../../contrato/api.js';

export const PLATAFORMAS: Plataforma[] = ['ios', 'android'];

export class RegistrarDispositivoDto {
  @ApiProperty({
    example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
    description:
      'Lo que devuelve getExpoPushTokenAsync() de expo-notifications.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @ValidateBy(
    {
      name: 'esTokenExpo',
      validator: { validate: (v: unknown) => Expo.isExpoPushToken(v) },
    },
    {
      context: {
        mensaje: 'Revisá el token de notificaciones: no es un token de Expo.',
      },
    },
  )
  tokenExpo: string;

  @ApiProperty({ enum: PLATAFORMAS })
  @IsIn(PLATAFORMAS, {
    context: { mensaje: 'La plataforma tiene que ser ios o android.' },
  })
  plataforma: Plataforma;
}
