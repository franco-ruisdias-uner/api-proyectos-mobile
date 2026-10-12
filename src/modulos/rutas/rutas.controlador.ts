import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type {
  AvanceRuta,
  PaqueteRuta,
  RespuestaLista,
  RespuestaUno,
} from '../../../contrato/api.js';
import type { Ruta, Suministro } from '../../../contrato/tipos.js';
import { Roles, Sesion } from '../../comun/auth/decoradores.js';
import type { SesionActual } from '../../comun/auth/sesion-actual.js';
import { IdPipe } from '../../comun/ids/id.pipe.js';
import { PaginacionAmpliaDto } from '../../comun/respuesta/paginacion.js';
import { Doc } from '../../comun/respuesta/documentacion.js';
import {
  respuestaLista,
  respuestaUno,
} from '../../comun/respuesta/respuesta.js';
import { EJEMPLO_SUMINISTRO } from '../suministros/ejemplos.js';
import {
  ActualizarRutaDto,
  CrearRutaDto,
  ListarRutasDto,
  MisRutasDto,
} from './dto/rutas.dto.js';
import { EJEMPLO_AVANCE, EJEMPLO_PAQUETE, EJEMPLO_RUTA } from './ejemplos.js';
import { RutasServicio } from './rutas.servicio.js';

@ApiTags('Rutas')
@Controller()
export class RutasControlador {
  constructor(private readonly rutas: RutasServicio) {}

  @Get('yo/rutas')
  @Doc({
    resumen: 'Mis rutas',
    descripcion:
      'Las rutas del lector de la sesión, por número. `estado` acepta una lista separada por comas ' +
      '(`asignada,en_curso,cerrada`); por defecto trae `asignada` y `en_curso`. Administración no tiene rutas propias: recibe una lista vacía.',
    roles: [],
    ejemplo: EJEMPLO_RUTA,
    lista: true,
    errores: ['VALIDACION_FALLIDA'],
  })
  async mias(
    @Sesion() sesion: SesionActual,
    @Query() filtros: MisRutasDto,
  ): Promise<RespuestaLista<Ruta>> {
    const { datos, meta } = await this.rutas.listarMias(sesion, filtros);
    return respuestaLista(datos, meta);
  }

  @Get('rutas')
  @Roles('administracion')
  @Doc({
    resumen: 'Lista las rutas',
    descripcion:
      'Filtros: `bimestre` (`2026-05`), `lectorId` y `estado` (uno o varios separados por comas). ' +
      'Orden por bimestre descendente y número.',
    roles: ['administracion'],
    ejemplo: EJEMPLO_RUTA,
    lista: true,
    errores: ['VALIDACION_FALLIDA'],
  })
  async listar(
    @Query() filtros: ListarRutasDto,
  ): Promise<RespuestaLista<Ruta>> {
    const { datos, meta } = await this.rutas.listar(filtros);
    return respuestaLista(datos, meta);
  }

  @Post('rutas')
  @Roles('administracion')
  @HttpCode(201)
  @Doc({
    resumen: 'Arma y asigna una ruta',
    descripcion:
      'Cuerpo: `{ numero, nombre, bimestre, lectorId, suministroIds }`. `suministroIds` va en el orden del recorrido ' +
      '(de 1 a 300) y ese orden no se cambia nunca. El id es `rut-<numero>-<bimestre>` y la ruta queda `asignada`. ' +
      'Un suministro no puede estar en dos rutas del mismo bimestre.',
    roles: ['administracion'],
    estado: 201,
    ejemplo: { ...EJEMPLO_RUTA, estado: 'asignada', descargadaEn: null },
    errores: [
      'VALIDACION_FALLIDA',
      'LECTOR_NO_ENCONTRADO',
      'SUMINISTRO_REPETIDO',
      'SUMINISTRO_NO_ENCONTRADO',
      'SUMINISTRO_EN_OTRA_RUTA',
      'RUTA_YA_EXISTE',
    ],
  })
  async crear(@Body() dto: CrearRutaDto): Promise<RespuestaUno<Ruta>> {
    return respuestaUno(await this.rutas.crear(dto));
  }

  @Get('rutas/:id')
  @Doc({
    resumen: 'Una ruta',
    descripcion: 'El lector dueño de la ruta o administración.',
    roles: [],
    ejemplo: EJEMPLO_RUTA,
    errores: ['VALIDACION_FALLIDA', 'SIN_PERMISO', 'RUTA_NO_ENCONTRADA'],
  })
  async obtener(
    @Param('id', new IdPipe('rut')) id: string,
    @Sesion() sesion: SesionActual,
  ): Promise<RespuestaUno<Ruta>> {
    return respuestaUno(await this.rutas.obtener(id, sesion));
  }

  @Patch('rutas/:id')
  @Roles('administracion')
  @Doc({
    resumen: 'Edita una ruta',
    descripcion:
      'Cuerpo: `{ nombre?, lectorId?, suministroIds? }`. Una ruta `cerrada` no se edita. Los suministros sólo se ' +
      'cambian con la ruta `asignada`: con el lector en la calle no se le mueve la lista. El lector sí se puede ' +
      'cambiar con la ruta `en_curso`; lo ya cargado sigue siendo de quien lo cargó.',
    roles: ['administracion'],
    ejemplo: EJEMPLO_RUTA,
    errores: [
      'VALIDACION_FALLIDA',
      'RUTA_NO_ENCONTRADA',
      'RUTA_YA_CERRADA',
      'RUTA_EN_CURSO',
      'LECTOR_NO_ENCONTRADO',
      'SUMINISTRO_REPETIDO',
      'SUMINISTRO_NO_ENCONTRADO',
      'SUMINISTRO_EN_OTRA_RUTA',
    ],
  })
  async actualizar(
    @Param('id', new IdPipe('rut')) id: string,
    @Body() dto: ActualizarRutaDto,
  ): Promise<RespuestaUno<Ruta>> {
    return respuestaUno(await this.rutas.actualizar(id, dto));
  }

  @Get('rutas/:id/suministros')
  @Doc({
    resumen: 'Los suministros de una ruta, en orden de recorrido',
    descripcion:
      'Pagina de a 50 por defecto, hasta 200. Para bajar todo de una vez, usá `POST /rutas/:id/descarga`.',
    roles: [],
    ejemplo: EJEMPLO_SUMINISTRO,
    lista: true,
    errores: ['VALIDACION_FALLIDA', 'SIN_PERMISO', 'RUTA_NO_ENCONTRADA'],
  })
  async suministros(
    @Param('id', new IdPipe('rut')) id: string,
    @Sesion() sesion: SesionActual,
    @Query() paginacion: PaginacionAmpliaDto,
  ): Promise<RespuestaLista<Suministro>> {
    const { datos, meta } = await this.rutas.listarSuministros(
      id,
      sesion,
      paginacion,
    );
    return respuestaLista(datos, meta);
  }

  @Post('rutas/:id/descarga')
  @HttpCode(200)
  @Doc({
    resumen: 'Descarga completa de la ruta',
    descripcion:
      'Todo lo que el teléfono necesita para la jornada, sin paginar: la ruta, sus suministros en orden de recorrido, ' +
      'sus medidores y las lecturas y novedades que el servidor ya tiene. La primera descarga marca `descargadaEn` y ' +
      'pasa la ruta de `asignada` a `en_curso`. Una ruta `cerrada` no se descarga.',
    roles: [],
    ejemplo: EJEMPLO_PAQUETE,
    errores: [
      'VALIDACION_FALLIDA',
      'SIN_PERMISO',
      'RUTA_NO_ENCONTRADA',
      'RUTA_YA_CERRADA',
    ],
  })
  async descargar(
    @Param('id', new IdPipe('rut')) id: string,
    @Sesion() sesion: SesionActual,
  ): Promise<RespuestaUno<PaqueteRuta>> {
    return respuestaUno(await this.rutas.descargar(id, sesion));
  }

  @Get('rutas/:id/avance')
  @Doc({
    resumen: 'Avance de la ruta según el servidor',
    descripcion:
      'Cuenta sólo los resultados vigentes que el servidor ya recibió. Lo que está en el teléfono sin subir lo calcula la app.',
    roles: [],
    ejemplo: EJEMPLO_AVANCE,
    errores: ['VALIDACION_FALLIDA', 'SIN_PERMISO', 'RUTA_NO_ENCONTRADA'],
  })
  async avance(
    @Param('id', new IdPipe('rut')) id: string,
    @Sesion() sesion: SesionActual,
  ): Promise<RespuestaUno<AvanceRuta>> {
    return respuestaUno(await this.rutas.avance(id, sesion));
  }
}
