import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import type { EstadoReporte } from '../../../../contrato/tipos.js';
import { patronId } from '../../../comun/ids/ids.js';
import { paginacionConMaximo } from '../../../comun/respuesta/paginacion.dto.js';
import {
  Opcional,
  VacioANulo,
} from '../../../comun/validacion/transformaciones.js';
import {
  ESTADOS_ABIERTOS,
  interpretarEstados,
  TODOS_LOS_ESTADOS,
} from '../reglas/estados.js';

const conMensaje = (mensaje: string) => ({ context: { mensaje } });
const MENSAJE_ESTADO_BANDEJA =
  'El estado de la bandeja tiene que ser recibido, en_revision o asignado.';
const MENSAJE_ESTADO_NUEVO =
  'El estado tiene que ser recibido, en_revision, asignado, resuelto o rechazado.';

export const MAX_COMENTARIO = 1000;
export const ZONA_TODAS = 'todas';

/** Un id de cuadrilla: las de las semillas son cortas (`cua-02`). */
export const PATRON_CUADRILLA = /^cua-[A-Za-z0-9_-]{1,36}$/;

/** Se puede omitir o mandar null. */
const NoNulo = () =>
  ValidateIf(
    (_o: object, valor: unknown) => valor !== undefined && valor !== null,
  );

export class FiltroBandejaDto extends paginacionConMaximo(100) {
  @ApiPropertyOptional({
    type: String,
    example: 'recibido,en_revision',
    description:
      'Uno o varios estados abiertos separados por coma. Por defecto, los tres.',
  })
  @Opcional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? (interpretarEstados(value) ?? value) : value,
  )
  @IsArray(conMensaje(MENSAJE_ESTADO_BANDEJA))
  @IsIn(ESTADOS_ABIERTOS, { each: true, ...conMensaje(MENSAJE_ESTADO_BANDEJA) })
  estado?: EstadoReporte[];

  @ApiPropertyOptional({ example: 'tip-bache' })
  @Opcional()
  @IsString()
  @Matches(patronId('tip'), conMensaje('El tipo de problema no es válido.'))
  tipoId?: string;

  @ApiPropertyOptional({
    example: 'zon-norte',
    description:
      'Por defecto, la zona del operador. `todas` muestra todas las zonas.',
  })
  @Opcional()
  @IsString()
  @Matches(
    new RegExp(`^(${ZONA_TODAS}|${patronId('zon').source.slice(1, -1)})$`),
    conMensaje('La zona no es válida.'),
  )
  zonaId?: string;
}

export class CambiarEstadoDto {
  @ApiProperty({ enum: TODOS_LOS_ESTADOS, example: 'en_revision' })
  @IsString(conMensaje(MENSAJE_ESTADO_NUEVO))
  @IsIn(TODOS_LOS_ESTADOS, conMensaje(MENSAJE_ESTADO_NUEVO))
  estado: EstadoReporte;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: MAX_COMENTARIO,
    description: 'Obligatorio para rechazar. Lo ve el vecino.',
  })
  @VacioANulo()
  @NoNulo()
  @IsString()
  @MaxLength(MAX_COMENTARIO, conMensaje('El comentario es demasiado largo.'))
  comentario?: string | null;
}

export class AsignarCuadrillaDto {
  @ApiProperty({ example: 'cua-02' })
  @VacioANulo()
  @NoNulo()
  @IsString()
  @Matches(PATRON_CUADRILLA, conMensaje('La cuadrilla no es válida.'))
  cuadrillaId?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: MAX_COMENTARIO,
  })
  @VacioANulo()
  @NoNulo()
  @IsString()
  @MaxLength(MAX_COMENTARIO, conMensaje('El comentario es demasiado largo.'))
  comentario?: string | null;
}

export class MarcarDuplicadoDto {
  @ApiProperty({ example: 'rep-00412' })
  @IsString(conMensaje('Falta el reporte original.'))
  @Matches(patronId('rep'), conMensaje('El reporte original no es válido.'))
  originalId: string;
}

export class FotoDelArregloDto {
  @ApiPropertyOptional({
    example: 'fot-k3x9a1',
    description:
      'Lo puede mandar el teléfono: repetir el pedido con el mismo `id` no duplica.',
  })
  @Opcional()
  @IsString()
  @Matches(
    patronId('fot'),
    conMensaje('El identificador de la foto no es válido.'),
  )
  id?: string;

  @ApiProperty({ description: 'La URL que devolvió `POST /archivos`.' })
  @IsString(conMensaje('Falta la foto del arreglo.'))
  @MaxLength(500, conMensaje('La dirección de la foto es demasiado larga.'))
  url: string;
}
