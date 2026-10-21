import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { RespuestaLista, RespuestaUno } from '../../../contract/api.js';
import type { Aviso } from '../../../contract/types.js';
import { Publico, Roles } from '../../common/auth/decorators.js';
import { Ejemplo, ErroresPosibles } from '../../common/documentation/swagger.js';
import { respuestaLista, respuestaUno } from '../../common/response/response.js';
import { AvisosServicio } from './notices.service.js';
import { ActualizarAvisoDto } from './dto/update-notice.dto.js';
import { CrearAvisoDto } from './dto/create-notice.dto.js';
import { ListarAvisosDto } from './dto/list-notices.dto.js';
import { AVISO_DE_EJEMPLO } from './examples.js';

@ApiTags('Avisos')
@Controller('avisos')
export class AvisosControlador {
  constructor(private readonly servicio: AvisosServicio) {}

  @Get()
  @Publico()
  @ApiOperation({
    summary: 'Avisos de la Dirección de Transporte',
    description:
      'Público. `estado`: `vigentes` (por defecto: ya empezaron y no terminaron), `proximos` ' +
      '(todavía no empezaron) o `todos`. `lineaId` deja sólo los avisos que mencionan esa línea. ' +
      'Orden: gravedad (`suspension`, `desvio`, `informativo`) y después `desde` descendente.',
  })
  @Ejemplo(200, 'Avisos vigentes', {
    datos: [AVISO_DE_EJEMPLO],
    meta: { total: 1, pagina: 1, porPagina: 20 },
  })
  @ErroresPosibles('VALIDACION_FALLIDA')
  async listar(@Query() consulta: ListarAvisosDto): Promise<RespuestaLista<Aviso>> {
    const { datos, meta } = await this.servicio.listar(consulta);
    return respuestaLista(datos, meta);
  }

  @Get(':id')
  @Publico()
  @ApiOperation({
    summary: 'Detalle de un aviso',
    description: 'Público. Devuelve el aviso aunque ya haya terminado.',
  })
  @ApiParam({ name: 'id', example: 'avi-088' })
  @Ejemplo(200, 'El aviso', { datos: AVISO_DE_EJEMPLO, meta: null })
  @ErroresPosibles('AVISO_NO_ENCONTRADO')
  async obtener(@Param('id') id: string): Promise<RespuestaUno<Aviso>> {
    return respuestaUno(await this.servicio.obtener(id));
  }

  @Post()
  @Roles('direccion')
  @ApiOperation({
    summary: 'Publicar un aviso',
    description:
      'Rol `direccion`. `lineaIds` con al menos una línea que exista; `hasta`, si viene, ' +
      'posterior a `desde`; `trazadoAlternativo` `null` o con al menos dos puntos; `videoUrl` ' +
      'tiene que ser un video subido antes con `POST /archivos`. Manda una push a quienes ' +
      'tienen alguna de esas líneas como favorita y los avisos activos, aunque el aviso empiece ' +
      'más adelante.',
  })
  @Ejemplo(201, 'El aviso publicado', { datos: AVISO_DE_EJEMPLO, meta: null })
  @ErroresPosibles(
    'VALIDACION_FALLIDA',
    'NO_AUTENTICADO',
    'SIN_PERMISO',
    'LINEA_NO_ENCONTRADA',
    'ARCHIVO_NO_SUBIDO',
  )
  async crear(@Body() cuerpo: CrearAvisoDto): Promise<RespuestaUno<Aviso>> {
    return respuestaUno(await this.servicio.crear(cuerpo));
  }

  @Patch(':id')
  @Roles('direccion')
  @ApiOperation({
    summary: 'Editar un aviso',
    description:
      'Rol `direccion`. Parcial: sólo cambia lo que viene. `hasta`, `trazadoAlternativo` y ' +
      '`videoUrl` aceptan `null` para borrarlos; `lineaIds` reemplaza la lista. No manda push.',
  })
  @ApiParam({ name: 'id', example: 'avi-088' })
  @Ejemplo(200, 'El aviso actualizado', { datos: AVISO_DE_EJEMPLO, meta: null })
  @ErroresPosibles(
    'VALIDACION_FALLIDA',
    'NO_AUTENTICADO',
    'SIN_PERMISO',
    'AVISO_NO_ENCONTRADO',
    'LINEA_NO_ENCONTRADA',
    'ARCHIVO_NO_SUBIDO',
  )
  async editar(
    @Param('id') id: string,
    @Body() cambios: ActualizarAvisoDto,
  ): Promise<RespuestaUno<Aviso>> {
    return respuestaUno(await this.servicio.editar(id, cambios));
  }

  @Post(':id/finalizar')
  @HttpCode(200)
  @Roles('direccion')
  @ApiOperation({
    summary: 'Terminar un aviso ahora',
    description:
      'Rol `direccion`. Pone `hasta` en este momento. Idempotente: si ya había terminado, no ' +
      'cambia nada. Si todavía no había empezado, queda cancelado (`desde` y `hasta` en este momento).',
  })
  @ApiParam({ name: 'id', example: 'avi-088' })
  @Ejemplo(200, 'El aviso terminado', { datos: AVISO_DE_EJEMPLO, meta: null })
  @ErroresPosibles('NO_AUTENTICADO', 'SIN_PERMISO', 'AVISO_NO_ENCONTRADO')
  async finalizar(@Param('id') id: string): Promise<RespuestaUno<Aviso>> {
    return respuestaUno(await this.servicio.finalizar(id));
  }
}
