import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class RegistrarIngresoDto {
  @ApiProperty({ example: 'VGY-0919-19-K3X9QM' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty({ message: 'Falta el código de la reserva.' })
  @IsString({ message: 'Falta el código de la reserva.' })
  codigoQr: string;

  @ApiProperty({
    example: 'esp-02',
    description: 'El espacio donde está la puerta.',
  })
  @Matches(/^esp-[A-Za-z0-9_-]{1,36}$/, {
    message: 'El espacio tiene que ser un id de espacio.',
  })
  @IsNotEmpty({ message: 'Falta el espacio.' })
  @IsString({ message: 'Falta el espacio.' })
  espacioId: string;
}

/** Marcar ausente no lleva cuerpo: el DTO vacío rechaza campos de más. */
export class MarcarAusenteDto {}
