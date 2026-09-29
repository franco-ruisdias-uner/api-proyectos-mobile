import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsString, Matches } from 'class-validator';
import { PaginacionDto } from '../../../comun/respuesta/paginacion.dto.js';
import { BooleanoDeTexto } from '../../../comun/validacion/transformaciones.js';
import { Opcional } from '../../../comun/validacion/transformaciones.js';

export class FiltroCuadrillasDto extends PaginacionDto {
  @ApiPropertyOptional({
    example: 'zon-norte',
    description: 'Sólo las de esa zona.',
  })
  @Opcional()
  @IsString()
  @Matches(/^zon-[A-Za-z0-9_-]{3,36}$/)
  zonaId?: string;

  @ApiPropertyOptional({
    type: Boolean,
    description: '`true` sólo las activas, `false` sólo las inactivas.',
  })
  @Opcional()
  @BooleanoDeTexto()
  @IsBoolean()
  activa?: boolean;
}
