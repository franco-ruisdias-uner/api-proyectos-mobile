import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNumber,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { patronId } from '../../../comun/ids/ids.js';
import { paginacionConMaximo } from '../../../comun/respuesta/paginacion.dto.js';
import {
  NumeroDeTexto,
  Opcional,
} from '../../../comun/validacion/transformaciones.js';
import type { EstadoReporte } from '../../../../contrato/tipos.js';
import { interpretarEstados, TODOS_LOS_ESTADOS } from '../reglas/estados.js';

/** El mapa trae muchos puntos de una vez. */
export const POR_PAGINA_MAXIMO_DEL_MAPA = 500;
export const RADIO_MAXIMO_DEL_MAPA = 50_000;
export const RADIO_MAXIMO_CERCANOS = 200;
export const RADIO_CERCANOS_POR_DEFECTO = 50;

const conMensaje = (mensaje: string) => ({ context: { mensaje } });
const MENSAJE_LATITUD = 'La latitud tiene que estar entre -90 y 90.';
const MENSAJE_LONGITUD = 'La longitud tiene que estar entre -180 y 180.';

const EstadosDeTexto = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? (interpretarEstados(value) ?? value) : value,
  );

export class FiltroMapaDto extends paginacionConMaximo(
  POR_PAGINA_MAXIMO_DEL_MAPA,
) {
  @ApiPropertyOptional({ example: 'tip-bache' })
  @Opcional()
  @IsString()
  @Matches(patronId('tip'), conMensaje('El tipo de problema no es válido.'))
  tipoId?: string;

  @ApiPropertyOptional({ example: 'zon-norte' })
  @Opcional()
  @IsString()
  @Matches(patronId('zon'), conMensaje('La zona no es válida.'))
  zonaId?: string;

  @ApiPropertyOptional({
    type: String,
    example: 'recibido,en_revision',
    description:
      'Uno o varios estados separados por coma. Sin este filtro no se incluyen los `rechazado`.',
  })
  @Opcional()
  @EstadosDeTexto()
  @IsArray(
    conMensaje(
      'El estado tiene que ser recibido, en_revision, asignado, resuelto o rechazado.',
    ),
  )
  @IsIn(TODOS_LOS_ESTADOS, {
    each: true,
    ...conMensaje(
      'El estado tiene que ser recibido, en_revision, asignado, resuelto o rechazado.',
    ),
  })
  estado?: EstadoReporte[];

  @ApiPropertyOptional({
    example: -33.0089,
    description:
      'Centro de la búsqueda por cercanía (con `longitud` y `radioMetros`).',
  })
  @Opcional()
  @NumeroDeTexto()
  @IsNumber()
  @Min(-90, conMensaje(MENSAJE_LATITUD))
  @Max(90, conMensaje(MENSAJE_LATITUD))
  latitud?: number;

  @ApiPropertyOptional({ example: -58.5142 })
  @Opcional()
  @NumeroDeTexto()
  @IsNumber()
  @Min(-180, conMensaje(MENSAJE_LONGITUD))
  @Max(180, conMensaje(MENSAJE_LONGITUD))
  longitud?: number;

  @ApiPropertyOptional({
    example: 500,
    description: `Radio en metros, hasta ${RADIO_MAXIMO_DEL_MAPA}. Los resultados salen del más cercano al más lejano.`,
  })
  @Opcional()
  @NumeroDeTexto()
  @IsNumber()
  @Min(1, conMensaje('El radio tiene que ser de al menos un metro.'))
  @Max(RADIO_MAXIMO_DEL_MAPA, conMensaje('El radio es demasiado grande.'))
  radioMetros?: number;

  @ApiPropertyOptional({
    description: 'Límite norte de la zona visible del mapa (latitud).',
  })
  @Opcional()
  @NumeroDeTexto()
  @IsNumber()
  @Min(-90, conMensaje(MENSAJE_LATITUD))
  @Max(90, conMensaje(MENSAJE_LATITUD))
  norte?: number;

  @ApiPropertyOptional({ description: 'Límite sur (latitud).' })
  @Opcional()
  @NumeroDeTexto()
  @IsNumber()
  @Min(-90, conMensaje(MENSAJE_LATITUD))
  @Max(90, conMensaje(MENSAJE_LATITUD))
  sur?: number;

  @ApiPropertyOptional({ description: 'Límite este (longitud).' })
  @Opcional()
  @NumeroDeTexto()
  @IsNumber()
  @Min(-180, conMensaje(MENSAJE_LONGITUD))
  @Max(180, conMensaje(MENSAJE_LONGITUD))
  este?: number;

  @ApiPropertyOptional({ description: 'Límite oeste (longitud).' })
  @Opcional()
  @NumeroDeTexto()
  @IsNumber()
  @Min(-180, conMensaje(MENSAJE_LONGITUD))
  @Max(180, conMensaje(MENSAJE_LONGITUD))
  oeste?: number;
}

export class FiltroCercanosDto extends paginacionConMaximo(100) {
  @ApiProperty({ example: -33.0089 })
  @NumeroDeTexto()
  @IsNumber()
  @Min(-90, conMensaje(MENSAJE_LATITUD))
  @Max(90, conMensaje(MENSAJE_LATITUD))
  latitud: number;

  @ApiProperty({ example: -58.5142 })
  @NumeroDeTexto()
  @IsNumber()
  @Min(-180, conMensaje(MENSAJE_LONGITUD))
  @Max(180, conMensaje(MENSAJE_LONGITUD))
  longitud: number;

  @ApiPropertyOptional({
    example: 'tip-bache',
    description: 'Sólo del mismo tipo (D9: por defecto, cualquiera).',
  })
  @Opcional()
  @IsString()
  @Matches(patronId('tip'), conMensaje('El tipo de problema no es válido.'))
  tipoId?: string;

  @ApiPropertyOptional({
    default: RADIO_CERCANOS_POR_DEFECTO,
    maximum: RADIO_MAXIMO_CERCANOS,
    description: `Radio en metros (por defecto ${RADIO_CERCANOS_POR_DEFECTO}, hasta ${RADIO_MAXIMO_CERCANOS}).`,
  })
  @Opcional()
  @NumeroDeTexto()
  @IsNumber()
  @Min(1, conMensaje('El radio tiene que ser de al menos un metro.'))
  @Max(
    RADIO_MAXIMO_CERCANOS,
    conMensaje(`El radio puede ser de hasta ${RADIO_MAXIMO_CERCANOS} metros.`),
  )
  radioMetros?: number;
}
