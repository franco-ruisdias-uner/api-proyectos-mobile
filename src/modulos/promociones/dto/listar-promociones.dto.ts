import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, Matches } from 'class-validator';
import { PaginacionDto } from '../../../comun/respuesta/paginacion.dto.js';
import { ESTADOS_PROMOCIONES, type EstadoPromociones } from '../reglas/promociones.js';

/** Query de `GET /promociones`. */
export class ListarPromocionesDto extends PaginacionDto {
  @ApiPropertyOptional({
    enum: ESTADOS_PROMOCIONES,
    default: 'vigentes',
    description:
      '`vigentes` (default), `proximas` (empiezan en los próximos 7 días) o `por-vencer` (vigentes que vencen en 3 días o menos).',
  })
  @IsOptional()
  @IsIn(ESTADOS_PROMOCIONES, {
    message: 'El estado tiene que ser vigentes, proximas o por-vencer.',
  })
  estado: EstadoPromociones = 'vigentes';

  @ApiPropertyOptional({
    example: 'rub-ferreteria',
    description: 'Sólo las promos de comercios de ese rubro.',
  })
  @IsOptional()
  @Matches(/^rub-[A-Za-z0-9_-]{1,36}$/, { message: 'El rubro no es válido.' })
  rubroId?: string;

  @ApiPropertyOptional({ example: 'com-118', description: 'Sólo las promos de ese comercio.' })
  @IsOptional()
  @Matches(/^com-[A-Za-z0-9_-]{1,36}$/, { message: 'El comercio no es válido.' })
  comercioId?: string;
}
