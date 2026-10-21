import { CampoPagina, CampoPorPagina } from '../../../common/response/query-fields.js';

export class ListarLineasDto {
  @CampoPagina()
  pagina?: number;

  @CampoPorPagina(100)
  porPagina?: number;
}
