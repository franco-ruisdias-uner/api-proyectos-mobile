import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { RespuestaLista, RespuestaUno } from '../../../contract/api.js';
import type {
  CambioDeEstado as CambioContrato,
  Reporte as ReporteContrato,
} from '../../../contract/types.js';
import { Publico, Roles, UsuarioActual } from '../../common/auth/decorators.js';
import { PaginacionDto } from '../../common/response/pagination.dto.js';
import {
  respuestaLista,
  respuestaUno,
} from '../../common/response/response.js';
import {
  DocConSesion,
  DocErrores,
  DocRespuestaLista,
  DocRespuestaUno,
} from '../../common/swagger/documentation.js';
import { CambioDeEstadoDoc, ReporteDoc } from '../../common/swagger/models.js';
import type { Usuario } from '../users/user.entity.js';
import { CrearReporteDto } from './dto/create-report.dto.js';
import { ServicioBandeja } from './inbox.service.js';
import {
  AsignarCuadrillaDto,
  CambiarEstadoDto,
  FiltroBandejaDto,
  FotoDelArregloDto,
  MarcarDuplicadoDto,
} from './dto/inbox.dto.js';
import { ServicioAdhesiones } from './follows.service.js';
import { FiltroCercanosDto, FiltroMapaDto } from './dto/map-filter.dto.js';
import { ParametroIdReporteDto } from './dto/parameters.dto.js';
import { aCambioDeEstado, aReporte } from './reports.mapper.js';
import { ServicioReportes } from './reports.service.js';

@ApiTags('Reportes')
@Controller('reportes')
export class ControladorReportes {
  constructor(
    private readonly reportes: ServicioReportes,
    private readonly adhesiones: ServicioAdhesiones,
    private readonly bandeja: ServicioBandeja,
  ) {}

  @Get()
  @Publico()
  @ApiOperation({
    summary: 'El mapa de la ciudad',
    description:
      'Público. Devuelve reportes con la forma completa del PRD, del más nuevo al más viejo. ' +
      'Sin `estado` no incluye los rechazados. Se puede filtrar por `tipoId`, `zonaId`, `estado` (uno o varios separados por coma), ' +
      'por cercanía (`latitud` + `longitud` + `radioMetros`, del más cercano al más lejano) o por la zona visible del mapa ' +
      '(`norte`, `sur`, `este`, `oeste`). `porPagina` admite hasta 500.',
  })
  @DocRespuestaLista(ReporteDoc, 'Los reportes del mapa.')
  @DocErrores('VALIDACION_FALLIDA')
  async mapa(
    @Query() q: FiltroMapaDto,
  ): Promise<RespuestaLista<ReporteContrato>> {
    const [filas, total] = await this.reportes.listarMapa(q);
    return respuestaLista(
      filas.map(({ reporte, fotos }) => aReporte(reporte, fotos)),
      { total, pagina: q.pagina, porPagina: q.porPagina },
    );
  }

  @Get('cercanos')
  @Publico()
  @ApiOperation({
    summary: 'Reportes abiertos cerca de un punto',
    description:
      'Para avisarle al vecino que ya hay un reporte parecido antes de mandar el suyo. ' +
      'Sólo `recibido`, `en_revision` y `asignado`, sin los duplicados, a 50 metros o menos (`radioMetros` hasta 200), ' +
      'del más cercano al más lejano. `tipoId` limita a un tipo.',
  })
  @DocRespuestaLista(ReporteDoc, 'Los reportes cercanos.')
  @DocErrores('VALIDACION_FALLIDA')
  async cercanos(
    @Query() q: FiltroCercanosDto,
  ): Promise<RespuestaLista<ReporteContrato>> {
    const [filas, total] = await this.reportes.listarCercanos(q);
    return respuestaLista(
      filas.map(({ reporte, fotos }) => aReporte(reporte, fotos)),
      { total, pagina: q.pagina, porPagina: q.porPagina },
    );
  }

  @Post(':id/adhesiones')
  @DocConSesion()
  @ApiOperation({
    summary: 'Sumarse a un reporte',
    description:
      'El vecino que ve un reporte igual al suyo se suma en vez de duplicarlo. Una vez por persona: repetir el pedido devuelve `200` con el mismo reporte. ' +
      'No se puede a un reporte propio ni a uno resuelto o rechazado.',
  })
  @DocRespuestaUno(
    201,
    ReporteDoc,
    'Te sumaste: el reporte con `adhesiones` actualizado.',
  )
  @DocRespuestaUno(200, ReporteDoc, 'Ya estabas sumado: el reporte tal cual.')
  @DocErrores(
    'VALIDACION_FALLIDA',
    'REPORTE_NO_ENCONTRADO',
    'ADHESION_A_REPORTE_PROPIO',
    'REPORTE_CERRADO',
  )
  async sumarse(
    @UsuarioActual() usuario: Usuario,
    @Param() { id }: ParametroIdReporteDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RespuestaUno<ReporteContrato>> {
    const { reporte, fotos, creada } = await this.adhesiones.sumar(id, usuario);
    res.status(creada ? 201 : 200);
    return respuestaUno(aReporte(reporte, fotos));
  }

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

  @Patch(':id/estado')
  @Roles('operador')
  @DocConSesion()
  @ApiOperation({
    summary: 'Cambiar el estado de un reporte (operador)',
    description:
      'Pasos válidos: `recibido` → `en_revision` o `rechazado`; `en_revision` → `rechazado`; `asignado` → `resuelto`, `en_revision` o `rechazado`. ' +
      '`asignado` se alcanza sólo con `PATCH /reportes/:id/cuadrilla`. Rechazar exige `comentario`. Crea un cambio de estado con el operador que lo hizo. ' +
      'Devuelve el `Reporte` actualizado.',
  })
  @DocRespuestaUno(200, ReporteDoc, 'El reporte con su nuevo estado.')
  @DocErrores(
    'VALIDACION_FALLIDA',
    'SIN_PERMISO',
    'REPORTE_NO_ENCONTRADO',
    'TRANSICION_INVALIDA',
    'CUADRILLA_REQUERIDA',
    'MOTIVO_REQUERIDO',
  )
  async cambiarEstado(
    @UsuarioActual() operador: Usuario,
    @Param() { id }: ParametroIdReporteDto,
    @Body() dto: CambiarEstadoDto,
  ): Promise<RespuestaUno<ReporteContrato>> {
    const { reporte, fotos } = await this.bandeja.cambiarEstado(
      operador,
      id,
      dto,
    );
    return respuestaUno(aReporte(reporte, fotos));
  }

  @Patch(':id/cuadrilla')
  @Roles('operador')
  @DocConSesion()
  @ApiOperation({
    summary: 'Asignar o reasignar una cuadrilla (operador)',
    description:
      'La cuadrilla tiene que estar activa y ser de la zona del reporte. El reporte tiene que estar `en_revision` o `asignado` (reasignación). ' +
      'Deja el reporte en `asignado` y crea un cambio de estado.',
  })
  @DocRespuestaUno(200, ReporteDoc, 'El reporte asignado.')
  @DocErrores(
    'VALIDACION_FALLIDA',
    'SIN_PERMISO',
    'REPORTE_NO_ENCONTRADO',
    'CUADRILLA_REQUERIDA',
    'TRANSICION_INVALIDA',
    'CUADRILLA_NO_ENCONTRADA',
    'CUADRILLA_INACTIVA',
    'CUADRILLA_DE_OTRA_ZONA',
  )
  async asignarCuadrilla(
    @UsuarioActual() operador: Usuario,
    @Param() { id }: ParametroIdReporteDto,
    @Body() dto: AsignarCuadrillaDto,
  ): Promise<RespuestaUno<ReporteContrato>> {
    const { reporte, fotos } = await this.bandeja.asignarCuadrilla(
      operador,
      id,
      dto,
    );
    return respuestaUno(aReporte(reporte, fotos));
  }

  @Post(':id/duplicado')
  @Roles('operador')
  @HttpCode(200)
  @DocConSesion()
  @ApiOperation({
    summary: 'Marcar un reporte como duplicado de otro (operador)',
    description:
      'El duplicado queda `rechazado` con el comentario «Duplicado de GCHU-…» y su autor se suma al reporte original. ' +
      'El original tiene que estar abierto y no ser duplicado de otro. Repetir el pedido devuelve el mismo resultado. ' +
      'Devuelve el reporte duplicado.',
  })
  @DocRespuestaUno(200, ReporteDoc, 'El reporte marcado como duplicado.')
  @DocErrores(
    'VALIDACION_FALLIDA',
    'SIN_PERMISO',
    'REPORTE_NO_ENCONTRADO',
    'TRANSICION_INVALIDA',
    'DUPLICADO_INVALIDO',
  )
  async marcarDuplicado(
    @UsuarioActual() operador: Usuario,
    @Param() { id }: ParametroIdReporteDto,
    @Body() dto: MarcarDuplicadoDto,
  ): Promise<RespuestaUno<ReporteContrato>> {
    const { reporte, fotos } = await this.bandeja.marcarDuplicado(
      operador,
      id,
      dto,
    );
    return respuestaUno(aReporte(reporte, fotos));
  }

  @Post(':id/fotos')
  @Roles('operador')
  @DocConSesion()
  @ApiOperation({
    summary: 'Agregar una foto del arreglo (operador)',
    description:
      'Primero se sube la foto con `POST /archivos`. Sólo con el reporte `asignado` o `resuelto`, hasta tres. Sale con `momento: "arreglo"`. ' +
      'Con `id` propio, repetir el pedido devuelve `200` sin duplicar.',
  })
  @DocRespuestaUno(201, ReporteDoc, 'El reporte con la foto agregada.')
  @DocRespuestaUno(200, ReporteDoc, 'Esa foto ya estaba: el reporte tal cual.')
  @DocErrores(
    'VALIDACION_FALLIDA',
    'SIN_PERMISO',
    'REPORTE_NO_ENCONTRADO',
    'ESTADO_NO_ADMITE_FOTO',
    'ARCHIVO_NO_SUBIDO',
    'ID_EN_USO',
  )
  async agregarFoto(
    @Param() { id }: ParametroIdReporteDto,
    @Body() dto: FotoDelArregloDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RespuestaUno<ReporteContrato>> {
    const { reporte, fotos, creada } = await this.bandeja.agregarFotoDelArreglo(
      id,
      dto,
    );
    res.status(creada ? 201 : 200);
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

@ApiTags('Bandeja')
@Controller('bandeja')
@Roles('operador')
@DocConSesion()
export class ControladorBandeja {
  constructor(private readonly bandeja: ServicioBandeja) {}

  @Get()
  @ApiOperation({
    summary: 'La bandeja del operador',
    description:
      'Reportes abiertos (`recibido`, `en_revision`, `asignado`): los más apoyados primero (`adhesiones` descendente) y, a igualdad, el más viejo. ' +
      'Por defecto, los de la zona del operador; `zonaId=todas` muestra toda la ciudad. Filtros `estado` (sólo abiertos, separados por coma) y `tipoId`.',
  })
  @DocRespuestaLista(ReporteDoc, 'Los reportes abiertos.')
  @DocErrores('VALIDACION_FALLIDA', 'SIN_PERMISO')
  async listar(
    @UsuarioActual() operador: Usuario,
    @Query() q: FiltroBandejaDto,
  ): Promise<RespuestaLista<ReporteContrato>> {
    const [filas, total] = await this.bandeja.listar(operador, q);
    return respuestaLista(
      filas.map(({ reporte, fotos }) => aReporte(reporte, fotos)),
      { total, pagina: q.pagina, porPagina: q.porPagina },
    );
  }
}
