import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { RespuestaLista, RespuestaUno } from '../../../contrato/api.js';
import type {
  CambioDeEstado as CambioContrato,
  Reporte as ReporteContrato,
} from '../../../contrato/tipos.js';
import { Publico, UsuarioActual } from '../../comun/auth/decoradores.js';
import { PaginacionDto } from '../../comun/respuesta/paginacion.dto.js';
import {
  respuestaLista,
  respuestaUno,
} from '../../comun/respuesta/respuesta.js';
import {
  DocConSesion,
  DocErrores,
  DocRespuestaLista,
  DocRespuestaUno,
} from '../../comun/swagger/documentacion.js';
import { CambioDeEstadoDoc, ReporteDoc } from '../../comun/swagger/modelos.js';
import type { Usuario } from '../usuarios/usuario.entidad.js';
import { CrearReporteDto } from './dto/crear-reporte.dto.js';
import { ParametroIdReporteDto } from './dto/parametros.dto.js';
import { aCambioDeEstado, aReporte } from './reportes.mapeador.js';
import { ServicioReportes } from './reportes.servicio.js';

@ApiTags('Reportes')
@Controller('reportes')
export class ControladorReportes {
  constructor(private readonly reportes: ServicioReportes) {}

  @Post()
  @DocConSesion()
  @ApiOperation({
    summary: 'Crear un reporte',
    description:
      'Primero se suben las fotos (y el audio) con `POST /archivos` y después se manda el reporte con esas URLs. ' +
      'Si el teléfono lo creó sin señal, manda su propio `id` (`rep-…`): repetir el pedido devuelve el mismo reporte con 200, sin duplicarlo. ' +
      'Un `id` que ya es de otra persona da `ID_EN_USO`. El servidor completa `codigo`, `zonaId`, `estado`, `autorId`, `adhesiones` y crea el primer cambio de estado.',
  })
  @DocRespuestaUno(201, ReporteDoc, 'Reporte creado.')
  @DocRespuestaUno(
    200,
    ReporteDoc,
    'Ya existía con ese `id` (mismo usuario): se devuelve tal cual.',
  )
  @DocErrores(
    'VALIDACION_FALLIDA',
    'FOTO_REQUERIDA',
    'TIPO_NO_ENCONTRADO',
    'FUERA_DE_LA_CIUDAD',
    'FECHA_EN_EL_FUTURO',
    'ARCHIVO_NO_SUBIDO',
    'ID_EN_USO',
  )
  async crear(
    @UsuarioActual() usuario: Usuario,
    @Body() dto: CrearReporteDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RespuestaUno<ReporteContrato>> {
    const { reporte, fotos, creado } = await this.reportes.crear(usuario, dto);
    res.status(creado ? 201 : 200);
    return respuestaUno(aReporte(reporte, fotos));
  }

  @Get('codigo/:codigo')
  @Publico()
  @ApiOperation({
    summary: 'Un reporte por su número de seguimiento',
    description:
      'Es lo que lee el QR del mostrador: `GCHU-2026-00412`. Acepta minúsculas. Un código que no existe (o que no tiene esa forma) da 404.',
  })
  @DocRespuestaUno(200, ReporteDoc, 'El reporte.')
  @DocErrores('REPORTE_NO_ENCONTRADO')
  async porCodigo(
    @Param('codigo') codigo: string,
  ): Promise<RespuestaUno<ReporteContrato>> {
    const { reporte, fotos } = await this.reportes.obtenerPorCodigo(codigo);
    return respuestaUno(aReporte(reporte, fotos));
  }

  @Get(':id')
  @Publico()
  @ApiOperation({
    summary: 'El detalle de un reporte',
    description:
      'Público. Trae el `autorId` pero nunca el nombre, el email ni el teléfono de quien lo hizo.',
  })
  @DocRespuestaUno(200, ReporteDoc, 'El reporte.')
  @DocErrores('VALIDACION_FALLIDA', 'REPORTE_NO_ENCONTRADO')
  async detalle(
    @Param() { id }: ParametroIdReporteDto,
  ): Promise<RespuestaUno<ReporteContrato>> {
    const { reporte, fotos } = await this.reportes.obtener(id);
    return respuestaUno(aReporte(reporte, fotos));
  }

  @Get(':id/cambios')
  @Publico()
  @ApiOperation({
    summary: 'Qué fue pasando con el reporte',
    description: 'Los cambios de estado, del más viejo al más nuevo.',
  })
  @DocRespuestaLista(CambioDeEstadoDoc, 'Los cambios de estado.')
  @DocErrores('VALIDACION_FALLIDA', 'REPORTE_NO_ENCONTRADO')
  async cambios(
    @Param() { id }: ParametroIdReporteDto,
    @Query() q: PaginacionDto,
  ): Promise<RespuestaLista<CambioContrato>> {
    const [filas, total] = await this.reportes.listarCambios(id, q);
    return respuestaLista(filas.map(aCambioDeEstado), {
      total,
      pagina: q.pagina,
      porPagina: q.porPagina,
    });
  }
}

@ApiTags('Reportes')
@Controller('yo/reportes')
@DocConSesion()
export class ControladorMisReportes {
  constructor(private readonly reportes: ServicioReportes) {}

  @Get()
  @ApiOperation({
    summary: 'Mis reportes',
    description:
      'Los que hice yo, del más nuevo al más viejo, en cualquier estado.',
  })
  @DocRespuestaLista(ReporteDoc, 'Mis reportes.')
  @DocErrores('VALIDACION_FALLIDA')
  async mios(
    @UsuarioActual() usuario: Usuario,
    @Query() q: PaginacionDto,
  ): Promise<RespuestaLista<ReporteContrato>> {
    const [filas, total] = await this.reportes.listarPropios(usuario.id, q);
    return respuestaLista(
      filas.map(({ reporte, fotos }) => aReporte(reporte, fotos)),
      { total, pagina: q.pagina, porPagina: q.porPagina },
    );
  }
}
