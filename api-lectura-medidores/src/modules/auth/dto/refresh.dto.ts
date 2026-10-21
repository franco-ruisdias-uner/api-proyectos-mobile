import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RefrescoDto {
  @ApiProperty({ example: 'dGhpcy1pcy1hLXJlZnJlc2gtdG9rZW4' })
  @IsString({ message: 'Falta el token de refresco.' })
  @IsNotEmpty({ message: 'Falta el token de refresco.' })
  @MaxLength(200, { message: 'El token de refresco es demasiado largo.' })
  refreshToken: string;
}
