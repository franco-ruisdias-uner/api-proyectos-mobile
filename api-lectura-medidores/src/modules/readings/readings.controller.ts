import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { RespuestaLista, RespuestaUno } from '../../../contract/api.js';
import type { Lectura } from '../../../contract/types.js';
import { Sesion } from '../../common/auth/decorators.js';
import type { SesionActual } from '../../common/auth/current-session.js';
import { IdPipe } from '../../common/ids/id.pipe.js';
import { Doc } from '../../common/response/documentation.js';
import {
  respuestaLista,
  respuestaUno,
} from '../../common/response/response.js';
import { CargarLecturaDto, ListarLecturasDto } from './dto/readings.dto.js';
import { EJEMPLO_LECTURA } from './examples.js';
import { LecturasServicio } from './readings.service.js';

@ApiTags('Lecturas')
@Controller()
export class LecturasControlador {
  constructor(private readonly lecturas: LecturasServicio) {}

  @Post('lecturas')
  @Doc({
    resumen: 'Carga una lectura',
    descripcion:
      'Cuerpo con la forma de `Lectura`. Manda el cliente: `id` (opcional, con prefijo `lec-`), `rutaId`, `suministroId`, ' +
      '`valor`, `fotoUri` (subida antes con `POST /archivos`), `coordenadas`, `confirmadaPorLector` y `fechaHora`. ' +
      'El servidor calcula `lectorId`, `consumo`, `fueraDeRango` y `sincronizada`: si vienen, se ignoran. ' +
      'Una lectura con consumo raro **se guarda igual** y queda marcada `fueraDeRango`. ' +
      'Si el `id` ya existe del mismo lector, responde 200 con la lectura que ya estaba (sirve para reintentar). ' +
      'Un suministro tiene un solo resultado vigente por ruta: el de `fechaHora` más reciente.',
    roles: [],
    estado: 201,
    ejemplo: EJEMPLO_LECTURA,
    errores: [
      'VALIDACION_FALLIDA',
      'RUTA_NO_ENCONTRADA',
      'RUTA_YA_CERRADA',
      'SUMINISTRO_FUERA_DE_RUTA',
      'LECTURA_INVALIDA',
      'FOTO_REQUERIDA',
      'ARCHIVO_NO_SUBIDO',
      'ID_EN_USO',
    ],
  })
  async cargar(
    @Body() dto: CargarLecturaDto,
    @Sesion() sesion: SesionActual,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RespuestaUno<Lectura>> {
    const { lectura, creada } = await this.lecturas.cargar(dto, sesion);
    res.status(creada ? 201 : 200);
    return respuestaUno(lectura);
  }

  @Get('lecturas/:id')
  @Doc({
    resumen: 'Una lectura',
    descripcion: 'El lector dueño de la ruta de la lectura o administración.',
    roles: [],
    ejemplo: EJEMPLO_LECTURA,
    errores: ['VALIDACION_FALLIDA', 'SIN_PERMISO', 'LECTURA_NO_ENCONTRADA'],
  })
  async obtener(
    @Param('id', new IdPipe('lec')) id: string,
    @Sesion() sesion: SesionActual,
  ): Promise<RespuestaUno<Lectura>> {
    return respuestaUno(await this.lecturas.obtener(id, sesion));
  }

  @Get('rutas/:id/lecturas')
  @Doc({
    resumen: 'Las lecturas vigentes de una ruta',
    descripcion:
      'Una por suministro (la vigente), en el orden del recorrido. `fueraDeRango=true` deja sólo las marcadas. ' +
      'Pagina de a 50 por defecto, hasta 200.',
    roles: [],
    ejemplo: EJEMPLO_LECTURA,
    lista: true,
    errores: ['VALIDACION_FALLIDA', 'SIN_PERMISO', 'RUTA_NO_ENCONTRADA'],
  })
  async deLaRuta(
    @Param('id', new IdPipe('rut')) id: string,
    @Sesion() sesion: SesionActual,
    @Query() filtros: ListarLecturasDto,
  ): Promise<RespuestaLista<Lectura>> {
    const { datos, meta } = await this.lecturas.listarDeRuta(
      id,
      sesion,
      filtros,
    );
    return respuestaLista(datos, meta);
  }
}
