import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsIn, IsString, Matches } from 'class-validator';
import { PLATAFORMAS, type Plataforma } from '../dispositivo.entidad.js';

export const FORMATO_TOKEN_EXPO = /^(Exponent|Expo)PushToken\[[^\]\s]{1,180}\]$/;

export class RegistrarDispositivoDto {
  @ApiProperty({ example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]' })
  @IsDefined({ message: 'Falta el token de notificaciones del teléfono (tokenExpo).' })
  @IsString({ message: 'El token de notificaciones (tokenExpo) tiene que ser un texto.' })
  @Matches(FORMATO_TOKEN_EXPO, {
    message: 'El token de notificaciones (tokenExpo) no tiene el formato de Expo.',
  })
  tokenExpo: string;

  @ApiProperty({ enum: PLATAFORMAS, example: 'android' })
  @IsDefined({ message: 'Falta la plataforma del teléfono (android o ios).' })
  @IsIn(PLATAFORMAS, { message: 'La plataforma tiene que ser android o ios.' })
  plataforma: Plataforma;
}
