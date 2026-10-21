import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type {
  RespuestaLista,
  RespuestaUno,
  ResumenNovedades,
} from '../../../contract/api.js';
import type { Novedad } from '../../../contract/types.js';
import { Roles, Sesion } from '../../common/auth/decorators.js';
import type { SesionActual } from '../../common/auth/current-session.js';
import { IdPipe } from '../../common/ids/id.pipe.js';
import { Doc } from '../../common/response/documentation.js';
import {
  respuestaLista,
  respuestaUno,
} from '../../common/response/response.js';
import {
  CargarNovedadDto,
  ListarNovedadesDeRutaDto,
  ListarNovedadesDto,
  ResumenNovedadesDto,
} from './dto/issues.dto.js';
import { EJEMPLO_NOVEDAD, EJEMPLO_RESUMEN } from './examples.js';
import { NovedadesServicio } from './issues.service.js';

@ApiTags('Novedades')
@Controller()
export class NovedadesControlador {
  constructor(private readonly novedades: NovedadesServicio) {}

  @Post('novedades')
  @Doc({
    resumen: 'Carga una novedad',
    descripcion:
      'Cuerpo con la forma de `Novedad`. Manda el cliente: `id` (opcional, con prefijo `nov-`), `rutaId`, `suministroId`, ' +
      '`motivo`, `comentario` (hasta 500 caracteres; `""` se guarda como `null`), `audioUri` (`null` o una nota de voz subida con `POST /archivos`), ' +
      '`fotoUri` (**obligatoria**, subida antes con `POST /archivos`) y `fechaHora`. El servidor pone `lectorId` y `sincronizada`: si vienen, se ignoran. ' +
      'Si el `id` ya existe del mismo lector, responde 200 con la novedad que ya estaba (sirve para reintentar, también con la ruta cerrada). ' +
      'Un suministro tiene un solo resultado vigente por ruta: si tiene una lectura, la novedad deja de ser la vigente.',
    roles: [],
    estado: 201,
    ejemplo: EJEMPLO_NOVEDAD,
    errores: [
      'VALIDACION_FALLIDA',
      'RUTA_NO_ENCONTRADA',
      'RUTA_YA_CERRADA',
      'SUMINISTRO_FUERA_DE_RUTA',
      'FOTO_REQUERIDA',
      'ARCHIVO_NO_SUBIDO',
      'ID_EN_USO',
    ],
  })
  async cargar(
    @Body() dto: CargarNovedadDto,
    @Sesion() sesion: SesionActual,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RespuestaUno<Novedad>> {
    const { novedad, creada } = await this.novedades.cargar(dto, sesion);
    res.status(creada ? 201 : 200);
    return respuestaUno(novedad);
  }

  @Get('novedades')
  @Roles('administracion')
  @Doc({
    resumen: 'Las novedades, para la administración',
    descripcion:
      'Las vigentes, de la más nueva a la más vieja. Filtros: `motivo`, `zona` (nombre de la ruta), `bimestre`, ' +
      '`desde` y `hasta` (días `AAAA-MM-DD` de hora argentina, los dos inclusive).',
    roles: ['administracion'],
    ejemplo: EJEMPLO_NOVEDAD,
    lista: true,
    errores: ['VALIDACION_FALLIDA'],
  })
  async listar(
    @Query() filtros: ListarNovedadesDto,
  ): Promise<RespuestaLista<Novedad>> {
    const { datos, meta } = await this.novedades.listar(filtros);
    return respuestaLista(datos, meta);
  }

  // Va antes de `novedades/:id`.
  @Get('novedades/resumen')
  @Roles('administracion')
  @Doc({
    resumen: 'Resumen de novedades por motivo y zona',
    descripcion:
      'Cuenta las novedades vigentes del `bimestre` (por defecto, el actual), agrupadas por motivo y por zona (el nombre de la ruta). ' +
      'Sólo los grupos con al menos una; por cantidad descendente, después motivo y zona.',
    roles: ['administracion'],
    ejemplo: EJEMPLO_RESUMEN,
    lista: true,
    errores: ['VALIDACION_FALLIDA'],
  })
  async resumen(
    @Query() filtros: ResumenNovedadesDto,
  ): Promise<RespuestaLista<ResumenNovedades>> {
    const { datos, meta } = await this.novedades.resumen(filtros);
    return respuestaLista(datos, meta);
  }

  @Get('novedades/:id')
  @Doc({
    resumen: 'Una novedad',
    descripcion: 'El lector dueño de la ruta de la novedad o administración.',
    roles: [],
    ejemplo: EJEMPLO_NOVEDAD,
    errores: ['VALIDACION_FALLIDA', 'SIN_PERMISO', 'NOVEDAD_NO_ENCONTRADA'],
  })
  async obtener(
    @Param('id', new IdPipe('nov')) id: string,
    @Sesion() sesion: SesionActual,
  ): Promise<RespuestaUno<Novedad>> {
    return respuestaUno(await this.novedades.obtener(id, sesion));
  }

  @Get('rutas/:id/novedades')
  @Doc({
    resumen: 'Las novedades vigentes de una ruta',
    descripcion:
      'Una por suministro (la vigente), en el orden del recorrido. `motivo` filtra. Pagina de a 50 por defecto, hasta 200.',
    roles: [],
    ejemplo: EJEMPLO_NOVEDAD,
    lista: true,
    errores: ['VALIDACION_FALLIDA', 'SIN_PERMISO', 'RUTA_NO_ENCONTRADA'],
  })
  async deLaRuta(
    @Param('id', new IdPipe('rut')) id: string,
    @Sesion() sesion: SesionActual,
    @Query() filtros: ListarNovedadesDeRutaDto,
  ): Promise<RespuestaLista<Novedad>> {
    const { datos, meta } = await this.novedades.listarDeRuta(
      id,
      sesion,
      filtros,
    );
    return respuestaLista(datos, meta);
  }
}
