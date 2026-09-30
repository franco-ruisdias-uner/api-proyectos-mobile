import { CampoPagina, CampoPorPagina } from '../../../comun/respuesta/campos-de-consulta.js';

export class ListarLineasDto {
  @CampoPagina()
  pagina?: number;

  @CampoPorPagina(100)
  porPagina?: number;
}
