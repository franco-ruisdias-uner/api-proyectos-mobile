import { Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { RespuestaLista, RespuestaUno } from '../../../contract/api.js';
import type { Visita } from '../../../contract/types.js';
import { UsuarioActual, type UsuarioAutenticado } from '../../common/auth/decorators.js';
import { respuestaLista, respuestaUno } from '../../common/response/response.js';
import { ejemploError } from '../../common/swagger/examples.js';
import { ActualizarVisitaDto, CrearVisitaDto, ListarVisitasDto } from './dto/visits.dto.js';
import { VisitasServicio } from './visits.service.js';

const EJEMPLO_VISITA: Visita = {
  id: 'vis-311',
  usuarioId: 'usr-201',
  lugarId: 'lug-004',
  fechaHora: '2026-09-14T17:42:00-03:00',
  origen: 'qr',
  fotoUri: 'http://192.168.0.10:3000/archivos/imagenes/2026/09/abc123def456.jpg',
  nota: 'Lindo atardecer.',
  sincronizada: true,
};

@ApiTags('Mi recorrido')
@ApiBearerAuth()
@Controller('yo/visitas')
export class VisitasControlador {
  constructor(private readonly visitas: VisitasServicio) {}

  @Get()
  @ApiOperation({
    summary: 'Mi recorrido',
    description: 'Con sesión. Por `fechaHora` ascendente ("en orden"). `porPagina` hasta 500.',
  })
  @ApiResponse({
    status: 200,
    schema: { example: { datos: [EJEMPLO_VISITA], meta: { total: 1, pagina: 1, porPagina: 20 } } },
  })
  @ApiResponse({ status: 400, description: 'VALIDACION_FALLIDA', schema: ejemploError('VALIDACION_FALLIDA') })
  @ApiResponse({ status: 401, description: 'NO_AUTENTICADO', schema: ejemploError('NO_AUTENTICADO') })
  async listar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Query() consulta: ListarVisitasDto,
  ): Promise<RespuestaLista<Visita>> {
    const { datos, meta } = await this.visitas.listar(usuario.id, consulta);
    return respuestaLista(datos, meta);
  }

  @Post()
  @ApiOperation({
    summary: 'Registrar una visita',
    description:
      'Con sesión. Idempotente por `id` (cola offline): si mandás un `id` que ya es tuyo, devuelve 200 con ' +
      'la visita existente sin duplicarla; si es de otra persona, 409 `ID_EN_USO`. `fechaHora` es cuándo ' +
      'se hizo la visita (no puede estar más de 5 minutos en el futuro). `fotoUri` tiene que venir de ' +
      '`POST /archivos`. `sincronizada` se ignora. Se puede visitar el mismo lugar más de una vez.',
  })
  @ApiResponse({
    status: 200,
    description: 'Ya existía (mismo id, mismo usuario).',
    schema: { example: { datos: EJEMPLO_VISITA, meta: null } },
  })
  @ApiResponse({ status: 201, schema: { example: { datos: EJEMPLO_VISITA, meta: null } } })
  @ApiResponse({ status: 400, description: 'VALIDACION_FALLIDA', schema: ejemploError('VALIDACION_FALLIDA') })
  @ApiResponse({ status: 401, description: 'NO_AUTENTICADO', schema: ejemploError('NO_AUTENTICADO') })
  @ApiResponse({
    status: 404,
    description: 'LUGAR_NO_ENCONTRADO',
    schema: ejemploError('LUGAR_NO_ENCONTRADO'),
  })
  @ApiResponse({ status: 409, description: 'ID_EN_USO', schema: ejemploError('ID_EN_USO') })
  @ApiResponse({
    status: 422,
    description: 'FECHA_EN_EL_FUTURO o ARCHIVO_NO_SUBIDO',
    schema: ejemploError('FECHA_EN_EL_FUTURO'),
  })
  async crear(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() cuerpo: CrearVisitaDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RespuestaUno<Visita>> {
    const { visita, creada } = await this.visitas.crear(usuario.id, cuerpo);
    res.status(creada ? 201 : 200);
    return respuestaUno(visita);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Agregar la foto o la nota a una visita',
    description:
      'Con sesión; sólo la persona dueña. Todo es opcional; `null` saca la foto o la nota. La foto puede ' +
      'llegar después que la visita.',
  })
  @ApiParam({ name: 'id', example: 'vis-311' })
  @ApiResponse({ status: 200, schema: { example: { datos: EJEMPLO_VISITA, meta: null } } })
  @ApiResponse({ status: 400, description: 'VALIDACION_FALLIDA', schema: ejemploError('VALIDACION_FALLIDA') })
  @ApiResponse({ status: 401, description: 'NO_AUTENTICADO', schema: ejemploError('NO_AUTENTICADO') })
  @ApiResponse({ status: 403, description: 'SIN_PERMISO', schema: ejemploError('SIN_PERMISO') })
  @ApiResponse({
    status: 404,
    description: 'VISITA_NO_ENCONTRADA',
    schema: ejemploError('VISITA_NO_ENCONTRADA'),
  })
  @ApiResponse({ status: 422, description: 'ARCHIVO_NO_SUBIDO', schema: ejemploError('ARCHIVO_NO_SUBIDO') })
  async actualizar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
    @Body() cuerpo: ActualizarVisitaDto,
  ): Promise<RespuestaUno<Visita>> {
    return respuestaUno(await this.visitas.actualizar(usuario.id, id, cuerpo));
  }
}
