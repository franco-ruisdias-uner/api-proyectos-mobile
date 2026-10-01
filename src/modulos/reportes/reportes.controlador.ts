import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { RespuestaLista, RespuestaUno, ResumenDemoras } from '../../../contrato/api.js';
import type { ReporteDeDemora } from '../../../contrato/tipos.js';
import {
  Publico,
  Roles,
  UsuarioActual,
  type UsuarioDeSesion,
} from '../../comun/auth/decoradores.js';
import { Ejemplo, ErroresPosibles } from '../../comun/documentacion/swagger.js';
import { respuestaLista, respuestaUno } from '../../comun/respuesta/respuesta.js';
import { CrearReporteDto } from './dto/crear-reporte.dto.js';
import { ListarReportesDto } from './dto/listar-reportes.dto.js';
import { ResumenReportesDto } from './dto/resumen-reportes.dto.js';
import { REPORTE_DE_EJEMPLO, RESUMEN_DE_EJEMPLO } from './ejemplos.js';
import { ReportesServicio } from './reportes.servicio.js';

@ApiTags('Reportes de demora')
@Controller('reportes-demora')
export class ReportesControlador {
  constructor(private readonly servicio: ReportesServicio) {}

  @Post()
  @ApiOperation({
    summary: 'Reportar una demora',
    description:
      'Con sesión. Idempotente por `id` (cola offline): si ese `id` ya es de la persona, ' +
      'devuelve 200 con el reporte existente sin duplicarlo; si es de otra, 409 `ID_EN_USO`. ' +
      'La línea tiene que parar en esa parada. `fechaHora` es cuándo pasó y no puede ser futura ' +
      '(se toleran 5 minutos). `fotoUri` tiene que ser una foto subida antes con `POST /archivos`. ' +
      'Una persona no puede reportar la misma línea en la misma parada más de una vez cada 15 ' +
      'minutos. `usuarioId`, `confirmaciones` y `sincronizado` se ignoran si vienen.',
  })
  @Ejemplo(201, 'El reporte creado', { datos: REPORTE_DE_EJEMPLO, meta: null })
  @ErroresPosibles(
    'VALIDACION_FALLIDA',
    'NO_AUTENTICADO',
    'LINEA_NO_ENCONTRADA',
    'PARADA_NO_ENCONTRADA',
    'LINEA_NO_PARA_EN_PARADA',
    'FECHA_EN_EL_FUTURO',
    'ARCHIVO_NO_SUBIDO',
    'REPORTE_YA_ENVIADO',
    'ID_EN_USO',
  )
  async crear(
    @UsuarioActual() usuario: UsuarioDeSesion,
    @Body() cuerpo: CrearReporteDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RespuestaUno<ReporteDeDemora>> {
    const { reporte, creado } = await this.servicio.crear(usuario.id, cuerpo);
    res.status(creado ? 201 : 200);
    return respuestaUno(reporte);
  }

  @Get()
  @Publico()
  @ApiOperation({
    summary: 'Reportes recientes de una parada o una línea',
    description:
      'Público. Hace falta `paradaId` o `lineaId`. Sólo los reportes de los últimos 90 minutos, ' +
      'el más nuevo primero.',
  })
  @Ejemplo(200, 'Reportes recientes', {
    datos: [REPORTE_DE_EJEMPLO],
    meta: { total: 1, pagina: 1, porPagina: 20 },
  })
  @ErroresPosibles('VALIDACION_FALLIDA')
  async listar(@Query() consulta: ListarReportesDto): Promise<RespuestaLista<ReporteDeDemora>> {
    const { datos, meta } = await this.servicio.listar(consulta);
    return respuestaLista(datos, meta);
  }

  @Get('resumen')
  @Roles('direccion')
  @ApiOperation({
    summary: 'Resumen de reportes para la Dirección',
    description:
      'Rol `direccion`. `agrupar=linea` (por defecto) o `parada`; `desde` y `hasta` (incluidos) ' +
      'acotan por la fecha del reporte. Más reportes primero. No es parte de la app de los alumnos.',
  })
  @Ejemplo(200, 'El resumen', {
    datos: [RESUMEN_DE_EJEMPLO],
    meta: { total: 1, pagina: 1, porPagina: 20 },
  })
  @ErroresPosibles('VALIDACION_FALLIDA', 'NO_AUTENTICADO', 'SIN_PERMISO')
  async resumen(@Query() consulta: ResumenReportesDto): Promise<RespuestaLista<ResumenDemoras>> {
    const { datos, meta } = await this.servicio.resumen(consulta);
    return respuestaLista(datos, meta);
  }

  @Post(':id/confirmaciones')
  @ApiOperation({
    summary: 'Confirmar un reporte',
    description:
      'Con sesión. 201 con el reporte actualizado; 200 si esa persona ya lo había confirmado. ' +
      'No se puede confirmar el propio reporte ni uno de más de 90 minutos.',
  })
  @ApiParam({ name: 'id', example: 'rep-3390' })
  @Ejemplo(201, 'El reporte con su confirmación', { datos: REPORTE_DE_EJEMPLO, meta: null })
  @ErroresPosibles(
    'NO_AUTENTICADO',
    'REPORTE_NO_ENCONTRADO',
    'CONFIRMACION_PROPIA',
    'REPORTE_VENCIDO',
  )
  async confirmar(
    @UsuarioActual() usuario: UsuarioDeSesion,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RespuestaUno<ReporteDeDemora>> {
    const { reporte, creada } = await this.servicio.confirmar(usuario.id, id);
    res.status(creada ? 201 : 200);
    return respuestaUno(reporte);
  }
}
