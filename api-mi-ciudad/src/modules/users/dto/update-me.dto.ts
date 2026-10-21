import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Opcional, OpcionalONulo, Recortar } from '../../../common/validation/decorators.js';
import { RADIOS_AVISO, TEMAS } from '../rules/preferences.js';

export class ActualizarPreferenciasDto {
  @ApiPropertyOptional({ type: [String], example: ['cat-museos', 'cat-playas'] })
  @Opcional()
  @IsArray({ message: 'Las categorías favoritas tienen que ser una lista.' })
  @ArrayMaxSize(50, { message: 'Elegiste demasiadas categorías.' })
  @IsString({ each: true, message: 'Alguna de las categorías elegidas no es válida.' })
  @Matches(/^cat-[A-Za-z0-9_-]{1,36}$/, {
    each: true,
    message: 'Alguna de las categorías elegidas no es válida.',
  })
  categoriasFavoritas?: string[];

  @ApiPropertyOptional({ example: true })
  @Opcional()
  @IsBoolean({ message: 'El aviso de lugares cercanos tiene que ser sí o no.' })
  avisarProximidad?: boolean;

  @ApiPropertyOptional({ enum: RADIOS_AVISO, example: 250 })
  @Opcional()
  @IsIn(RADIOS_AVISO, { message: 'La distancia de aviso tiene que ser 100, 250 o 500 metros.' })
  radioAvisoMetros?: 100 | 250 | 500;

  @ApiPropertyOptional({ enum: TEMAS, example: 'sistema' })
  @Opcional()
  @IsIn(TEMAS, { message: 'El tema tiene que ser claro, oscuro o sistema.' })
  tema?: (typeof TEMAS)[number];
}

export class ActualizarYoDto {
  @ApiPropertyOptional({ example: 'Lucía Méndez' })
  @Opcional()
  @Recortar()
  @IsString({ message: 'El nombre no puede quedar vacío.' })
  @IsNotEmpty({ message: 'El nombre no puede quedar vacío.' })
  @MaxLength(100, { message: 'El nombre puede tener hasta 100 letras.' })
  nombre?: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'URL devuelta por POST /archivos, o null para sacar la foto.',
    example: 'http://192.168.0.10:3000/archivos/imagenes/2026/09/abc123def456.jpg',
  })
  @OpcionalONulo()
  @IsString({ message: 'La foto de perfil no es válida.' })
  @MaxLength(2000, { message: 'La foto de perfil no es válida.' })
  avatarUrl?: string | null;

  @ApiPropertyOptional({ type: ActualizarPreferenciasDto, description: 'Se mezcla campo a campo.' })
  @Opcional()
  @IsObject({ message: 'Las preferencias no son válidas.' })
  @ValidateNested()
  @Type(() => ActualizarPreferenciasDto)
  preferencias?: ActualizarPreferenciasDto;
}
