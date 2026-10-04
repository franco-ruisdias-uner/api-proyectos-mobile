import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RegistrarIngresoDto {
  @ApiProperty({ example: 'VGY-0919-19-K3X9QM' })
  @IsNotEmpty({ message: 'Falta el código de la reserva.' })
  @IsString({ message: 'Falta el código de la reserva.' })
  codigoQr: string;

  @ApiProperty({
    example: 'esp-02',
    description: 'El espacio donde está la puerta.',
  })
  @IsNotEmpty({ message: 'Falta el espacio.' })
  @IsString({ message: 'Falta el espacio.' })
  espacioId: string;
}

/** Marcar ausente no lleva cuerpo: el DTO vacío rechaza campos de más. */
export class MarcarAusenteDto {}
