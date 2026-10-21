import { applyDecorators } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDefined,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import type { Gravedad } from '../../../../contract/types.js';
import { CampoInstante } from '../../../common/dates/instant-field.js';

export const GRAVEDADES: Gravedad[] = ['informativo', 'desvio', 'suspension'];

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Cómo se trata la ausencia de un campo:
 * - `obligatorio`: tiene que venir (alta);
 * - `opcional`: puede faltar, pero si viene no puede ser null (edición);
 * - `anulable`: puede faltar o ser null.
 */
export const Presencia = (modo: 'obligatorio' | 'opcional' | 'anulable', falta?: string) =>
  modo === 'obligatorio'
    ? IsDefined({ message: falta })
    : modo === 'opcional'
      ? ValidateIf((_o, valor) => valor !== undefined)
      : IsOptional();

export const ValidarTitulo = () => {
  const message = 'El título (titulo) tiene que ser un texto de 1 a 200 letras.';
  return applyDecorators(
    Transform(recortar),
    IsString({ message }),
    IsNotEmpty({ message }),
    MaxLength(200, { message }),
  );
};

export const ValidarDetalle = () => {
  const message = 'El detalle (detalle) tiene que ser un texto de 1 a 4000 letras.';
  return applyDecorators(
    Transform(recortar),
    IsString({ message }),
    IsNotEmpty({ message }),
    MaxLength(4000, { message }),
  );
};

export const ValidarLineaIds = () => {
  const message =
    'Las líneas (lineaIds) tienen que ser una lista de 1 a 50 identificadores de línea.';
  return applyDecorators(
    IsArray({ message }),
    ArrayMinSize(1, { message }),
    ArrayMaxSize(50, { message }),
    IsString({ each: true, message }),
    Matches(/^lin-[A-Za-z0-9_-]{1,36}$/, { each: true, message }),
  );
};

export const ValidarDesde = () =>
  CampoInstante(
    'El inicio (desde) tiene que ser una fecha y hora con zona, como 2026-11-14T21:00:00-03:00.',
  );

export const ValidarHasta = () =>
  CampoInstante(
    'El fin (hasta) tiene que ser una fecha y hora con zona, como 2026-11-14T21:00:00-03:00.',
  );

export const ValidarGravedad = () =>
  IsIn(GRAVEDADES, {
    message: 'La gravedad (gravedad) tiene que ser informativo, desvio o suspension.',
  });

export class CoordenadaDto {
  @IsDefined({ message: 'Falta la latitud de un punto del trazado.' })
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'La latitud de un punto del trazado tiene que ser un número entre -90 y 90.' },
  )
  @Min(-90, {
    message: 'La latitud de un punto del trazado tiene que ser un número entre -90 y 90.',
  })
  @Max(90, {
    message: 'La latitud de un punto del trazado tiene que ser un número entre -90 y 90.',
  })
  latitud: number;

  @IsDefined({ message: 'Falta la longitud de un punto del trazado.' })
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'La longitud de un punto del trazado tiene que ser un número entre -180 y 180.' },
  )
  @Min(-180, {
    message: 'La longitud de un punto del trazado tiene que ser un número entre -180 y 180.',
  })
  @Max(180, {
    message: 'La longitud de un punto del trazado tiene que ser un número entre -180 y 180.',
  })
  longitud: number;
}

/** R11: `null` o al menos dos puntos. */
export const ValidarTrazado = () => {
  const message =
    'El trazado alternativo (trazadoAlternativo) tiene que tener al menos dos puntos.';
  return applyDecorators(
    IsArray({ message }),
    ArrayMinSize(2, { message }),
    ArrayMaxSize(5000, {
      message: 'El trazado alternativo (trazadoAlternativo) tiene demasiados puntos.',
    }),
    ValidateNested({ each: true }),
    Type(() => CoordenadaDto),
  );
};

export const ValidarVideoUrl = () => {
  const message = 'El video (videoUrl) tiene que ser la dirección de un video que ya subiste.';
  return applyDecorators(IsString({ message }), MaxLength(2000, { message }));
};
