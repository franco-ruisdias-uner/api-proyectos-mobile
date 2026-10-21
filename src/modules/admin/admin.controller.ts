import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type {
  Bloqueo,
  RespuestaLista,
  RespuestaUno,
} from '../../../contract/api.js';
import type { Espacio, ReservaFija } from '../../../contract/types.js';
import { Roles } from '../../common/auth/decorators.js';
import {
  respuestaLista,
  respuestaUno,
} from '../../common/response/response.js';
import { AdministracionServicio } from './admin.service.js';
import {
  CambiarPrecioDto,
  CrearBloqueoDto,
  CrearFijaDto,
  EditarFijaDto,
  FiltrosBloqueosDto,
  FiltrosFijasDto,
} from './dto/admin.dto.js';

const BLOQUEO = {
  id: 'blo-k3x9qm7a2b1c',
  espacioId: 'esp-02',
  fecha: '2026-09-21',
  inicio: null,
  fin: null,
  motivo: 'Cancha anegada',
};
const FIJA = {
  id: 'fij-07',
  espacioId: 'esp-02',
  titular: 'Grupo de los martes',
  dia: 2,
  inicio: '21:00',
  fin: '22:00',
  desde: '2026-01-01',
  hasta: null,
  activa: true,
};
const PAGINADO = { total: 1, pagina: 1, porPagina: 20 };

@ApiTags('Administración')
@ApiBearerAuth()
@Controller()
export class AdministracionControlador {
  constructor(private readonly servicio: AdministracionServicio) {}

  @Post('bloqueos')
  @Roles('encargado', 'administrador')
  @ApiOperation({
    summary: 'Bloquear turnos',
    description:
      'Encargado o administrador. Crea un bloqueo por espacio. Sin `inicio` ni `fin` bloquea ' +
      'el día entero; con horas en punto, el tramo `[inicio, fin)`. Las reservas confirmadas ' +
      'de esos turnos se cancelan (sin contar como cancelación tardía) y sus dueños reciben ' +
      'una push con el motivo.\n\n' +
      'Errores: VALIDACION_FALLIDA (400), NO_AUTENTICADO (401), SIN_PERMISO (403), ' +
      'ESPACIO_NO_ENCONTRADO (404), MOTIVO_REQUERIDO (422), FECHA_PASADA (422).',
  })
  @ApiResponse({
    status: 201,
    schema: {
      example: {
        datos: [BLOQUEO],
        meta: { total: 1, pagina: 1, porPagina: 1 },
      },
    },
  })
  async crearBloqueos(
    @Body() dto: CrearBloqueoDto,
  ): Promise<RespuestaLista<Bloqueo>> {
    const creados = await this.servicio.crearBloqueos(dto);
    return respuestaLista(creados, {
      total: creados.length,
      pagina: 1,
      porPagina: creados.length,
    });
  }

  @Get('bloqueos')
  @Roles('encargado', 'administrador')
  @ApiOperation({
    summary: 'Bloqueos',
    description:
      'Encargado o administrador. Desde `desde` (default hoy), por fecha. Filtro: `espacioId`.\n\n' +
      'Errores: VALIDACION_FALLIDA (400), NO_AUTENTICADO (401), SIN_PERMISO (403).',
  })
  @ApiResponse({
    status: 200,
    schema: { example: { datos: [BLOQUEO], meta: PAGINADO } },
  })
  listarBloqueos(
    @Query() f: FiltrosBloqueosDto,
  ): Promise<RespuestaLista<Bloqueo>> {
    return this.servicio.listarBloqueos(f);
  }

  @Delete('bloqueos/:id')
  @HttpCode(204)
  @Roles('encargado', 'administrador')
  @ApiOperation({
    summary: 'Quitar un bloqueo',
    description:
      'Encargado o administrador. Las reservas que el bloqueo canceló siguen canceladas.\n\n' +
      'Errores: NO_AUTENTICADO (401), SIN_PERMISO (403), BLOQUEO_NO_ENCONTRADO (404).',
  })
  async borrarBloqueo(@Param('id') id: string): Promise<void> {
    await this.servicio.borrarBloqueo(id);
  }

  @Get('fijas')
  @Roles('encargado', 'administrador')
  @ApiOperation({
    summary: 'Reservas fijas',
    description:
      'Encargado o administrador. Filtros: `espacioId`, `activa`.\n\n' +
      'Errores: VALIDACION_FALLIDA (400), NO_AUTENTICADO (401), SIN_PERMISO (403).',
  })
  @ApiResponse({
    status: 200,
    schema: { example: { datos: [FIJA], meta: PAGINADO } },
  })
  async listarFijas(
    @Query() f: FiltrosFijasDto,
  ): Promise<RespuestaLista<ReservaFija>> {
    return this.servicio.listarFijas(f);
  }

  @Post('fijas')
  @Roles('administrador')
  @ApiOperation({
    summary: 'Cargar una reserva fija',
    description:
      'Sólo administrador. `dia`: 0 = domingo. Horas en punto. Si se pisa con otra fija activa ' +
      'o hay reservas confirmadas futuras en ese horario, no se crea.\n\n' +
      'Errores: VALIDACION_FALLIDA (400), NO_AUTENTICADO (401), SIN_PERMISO (403), ' +
      'ESPACIO_NO_ENCONTRADO (404), FIJA_SUPERPUESTA (409), CONFLICTO_CON_RESERVAS (409).',
  })
  @ApiResponse({
    status: 201,
    schema: { example: { datos: FIJA, meta: null } },
  })
  async crearFija(
    @Body() dto: CrearFijaDto,
  ): Promise<RespuestaUno<ReservaFija>> {
    return respuestaUno(await this.servicio.crearFija(dto));
  }

  @Patch('fijas/:id')
  @Roles('administrador')
  @ApiOperation({
    summary: 'Editar una reserva fija',
    description:
      'Sólo administrador. Cambia lo que se manda; `hasta: null` la deja sin fin y ' +
      '`activa: true` reactiva una dada de baja.\n\n' +
      'Errores: VALIDACION_FALLIDA (400), NO_AUTENTICADO (401), SIN_PERMISO (403), ' +
      'FIJA_NO_ENCONTRADA (404), FIJA_SUPERPUESTA (409), CONFLICTO_CON_RESERVAS (409).',
  })
  @ApiResponse({
    status: 200,
    schema: { example: { datos: FIJA, meta: null } },
  })
  async editarFija(
    @Param('id') id: string,
    @Body() dto: EditarFijaDto,
  ): Promise<RespuestaUno<ReservaFija>> {
    return respuestaUno(await this.servicio.editarFija(id, dto));
  }

  @Delete('fijas/:id')
  @HttpCode(204)
  @Roles('administrador')
  @ApiOperation({
    summary: 'Dar de baja una reserva fija',
    description:
      'Sólo administrador. La fija queda con `activa: false` (no se borra). Repetirlo da 204.\n\n' +
      'Errores: NO_AUTENTICADO (401), SIN_PERMISO (403), FIJA_NO_ENCONTRADA (404).',
  })
  async darDeBajaFija(@Param('id') id: string): Promise<void> {
    await this.servicio.darDeBajaFija(id);
  }

  @Patch('espacios/:id')
  @Roles('administrador')
  @ApiOperation({
    summary: 'Cambiar el precio de un espacio',
    description:
      'Sólo administrador. `precioPorHora` entero mayor que cero. Los turnos muestran el ' +
      'precio actual.\n\n' +
      'Errores: VALIDACION_FALLIDA (400), NO_AUTENTICADO (401), SIN_PERMISO (403), ' +
      'ESPACIO_NO_ENCONTRADO (404).',
  })
  async cambiarPrecio(
    @Param('id') id: string,
    @Body() dto: CambiarPrecioDto,
  ): Promise<RespuestaUno<Espacio>> {
    return respuestaUno(await this.servicio.cambiarPrecio(id, dto));
  }
}
