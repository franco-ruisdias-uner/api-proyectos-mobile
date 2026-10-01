import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  CampoEntero,
  CampoPagina,
  CampoPorPagina,
} from '../../../comun/respuesta/campos-de-consulta.js';
import { POR_PAGINA_MAXIMO } from '../../../comun/respuesta/respuesta.js';

export class ListarFeriadosDto {
  @CampoPagina()
  pagina?: number;

  @CampoPorPagina(POR_PAGINA_MAXIMO)
  porPagina?: number;

  @ApiPropertyOptional({ example: 2026, description: 'Por defecto, el año actual.' })
  @CampoEntero('anio', 'El año', 2000, 2100)
  anio?: number;
}
