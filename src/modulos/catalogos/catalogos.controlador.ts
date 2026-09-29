import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { RespuestaLista } from '../../../contrato/api.js';
import type {
  Cuadrilla as CuadrillaContrato,
  TipoDeReporte as TipoContrato,
  Zona as ZonaContrato,
} from '../../../contrato/tipos.js';
import { Publico, Roles } from '../../comun/auth/decoradores.js';
import { PaginacionDto } from '../../comun/respuesta/paginacion.dto.js';
import { respuestaLista } from '../../comun/respuesta/respuesta.js';
import {
  DocConSesion,
  DocErrores,
  DocRespuestaLista,
} from '../../comun/swagger/documentacion.js';
import {
  CuadrillaDoc,
  TipoDeReporteDoc,
  ZonaDoc,
} from '../../comun/swagger/modelos.js';
import { aCuadrilla, aTipoDeReporte, aZona } from './catalogos.mapeador.js';
import { ServicioCuadrillas } from './cuadrillas.servicio.js';
import { FiltroCuadrillasDto } from './dto/filtro-cuadrillas.dto.js';
import { ServicioTipos } from './tipos.servicio.js';
import { ServicioZonas } from './zonas.servicio.js';

@ApiTags('Catálogos')
@Controller()
export class ControladorCatalogos {
  constructor(
    private readonly tipos: ServicioTipos,
    private readonly zonas: ServicioZonas,
    private readonly cuadrillas: ServicioCuadrillas,
  ) {}

  @Get('tipos-de-reporte')
  @Publico()
  @ApiOperation({
    summary: 'Los tipos de problema que se pueden reportar',
    description:
      'Público: no hace falta cuenta. Ordenados por nombre. Son ocho, así que entran en una sola página.',
  })
  @DocRespuestaLista(TipoDeReporteDoc, 'Los tipos de reporte.')
  @DocErrores('VALIDACION_FALLIDA')
  async listarTipos(
    @Query() q: PaginacionDto,
  ): Promise<RespuestaLista<TipoContrato>> {
    const [filas, total] = await this.tipos.listar(q);
    return respuestaLista(filas.map(aTipoDeReporte), {
      total,
      pagina: q.pagina,
      porPagina: q.porPagina,
    });
  }

  @Get('zonas')
  @Publico()
  @ApiOperation({
    summary: 'Las zonas de la ciudad, con su límite',
    description:
      'Público. `limite` es el polígono de la zona (lista de puntos, sin repetir el primero al final). Ordenadas por nombre.',
  })
  @DocRespuestaLista(ZonaDoc, 'Las zonas.')
  @DocErrores('VALIDACION_FALLIDA')
  async listarZonas(
    @Query() q: PaginacionDto,
  ): Promise<RespuestaLista<ZonaContrato>> {
    const [filas, total] = await this.zonas.listar(q);
    return respuestaLista(filas.map(aZona), {
      total,
      pagina: q.pagina,
      porPagina: q.porPagina,
    });
  }

  @Get('cuadrillas')
  @Roles('operador')
  @DocConSesion()
  @ApiOperation({
    summary: 'Las cuadrillas municipales (sólo operadores)',
    description:
      'Filtros opcionales `zonaId` y `activa`. Ordenadas por id. Un vecino recibe 403.',
  })
  @DocRespuestaLista(CuadrillaDoc, 'Las cuadrillas que cumplen los filtros.')
  @DocErrores('VALIDACION_FALLIDA', 'SIN_PERMISO')
  async listarCuadrillas(
    @Query() q: FiltroCuadrillasDto,
  ): Promise<RespuestaLista<CuadrillaContrato>> {
    const [filas, total] = await this.cuadrillas.listar(
      { zonaId: q.zonaId, activa: q.activa },
      q,
    );
    return respuestaLista(filas.map(aCuadrilla), {
      total,
      pagina: q.pagina,
      porPagina: q.porPagina,
    });
  }
}
