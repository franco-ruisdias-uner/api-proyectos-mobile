import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ArchivosServicio } from '../comun/archivos/archivos.servicio.js';
import { hashearContrasena } from '../comun/auth/contrasenas.js';
import { Reloj } from '../comun/reloj/reloj.js';
import { normalizarParaBusqueda } from '../comun/texto/normalizar.js';
import { normalizarLegajo } from '../modulos/usuarios/reglas/legajo.js';
import { UsuarioEntidad } from '../modulos/usuarios/usuario.entidad.js';
import { RutaSuministroEntidad } from '../modulos/rutas/ruta-suministro.entidad.js';
import { RutaEntidad } from '../modulos/rutas/ruta.entidad.js';
import { MedidorEntidad } from '../modulos/suministros/medidor.entidad.js';
import { SuministroEntidad } from '../modulos/suministros/suministro.entidad.js';
import { generarRutas } from './datos/rutas.js';
import {
  generarSuministrosYMedidores,
  type SemillaSuministro,
} from './datos/suministros.js';
import { CONTRASENA_DEMO, USUARIOS } from './datos/usuarios.js';
import { videoDeDemo } from './medios/video-demo.js';

const MODELOS_CON_VIDEO = [
  'agujas',
  'agujas_viejo',
  'digital',
  'multiplicador',
] as const;

/** Inserta de a tandas para no pasar el máximo de variables de una consulta. */
function enTandas<T>(filas: T[], tamano = 100): T[][] {
  const tandas: T[][] = [];
  for (let i = 0; i < filas.length; i += tamano)
    tandas.push(filas.slice(i, i + tamano));
  return tandas;
}

/** Carga los datos de demo. Se usa desde `pnpm db:reiniciar` y con SEMBRAR_SI_VACIA. */
@Injectable()
export class Sembrador {
  private readonly log = new Logger('Semillas');

  constructor(
    private readonly dataSource: DataSource,
    private readonly reloj: Reloj,
    private readonly archivos: ArchivosServicio,
  ) {}

  async estaVacia(): Promise<boolean> {
    return (await this.dataSource.getRepository(UsuarioEntidad).count()) === 0;
  }

  async sembrar(): Promise<void> {
    const ahora = this.reloj.ahora();
    // Una sola sal para todas las cuentas de demo sería más rápido, pero cada usuario
    // lleva la suya, como cualquier otra cuenta.
    const usuarios = await Promise.all(
      USUARIOS.map(async (u) => ({
        ...u,
        legajoBusqueda: normalizarLegajo(u.legajo),
        nombreBusqueda: normalizarParaBusqueda(u.nombre),
        hashContrasena: await hashearContrasena(CONTRASENA_DEMO),
        versionSesion: 0,
        creadoEn: ahora,
      })),
    );
    await this.dataSource.transaction(async (m) => {
      await m.getRepository(UsuarioEntidad).insert(usuarios);
    });
    this.log.log(
      `Sembrados ${usuarios.length} usuarios (contraseña de demo: "${CONTRASENA_DEMO}").`,
    );
    await this.sembrarSuministros();
  }

  /** Suministros y medidores de la app de clase; los videos se suben por el puerto de archivos. */
  private async sembrarSuministros(): Promise<void> {
    const videos = new Map<string, string>();
    for (const modelo of MODELOS_CON_VIDEO) {
      videos.set(
        modelo,
        await this.archivos.guardar(
          videoDeDemo(modelo),
          'video',
          'mp4',
          'video/mp4',
        ),
      );
    }
    const { suministros, medidores } = generarSuministrosYMedidores();
    const filasMedidores = medidores.map(({ videoModelo, ...m }) => ({
      ...m,
      videoClave:
        videoModelo === null ? null : (videos.get(videoModelo) ?? null),
    }));
    const filasSuministros = suministros.map((s) => ({
      ...s,
      titularBusqueda: normalizarParaBusqueda(s.titular),
      direccionBusqueda: normalizarParaBusqueda(s.direccion),
    }));
    await this.dataSource.transaction(async (m) => {
      for (const tanda of enTandas(filasMedidores))
        await m.getRepository(MedidorEntidad).insert(tanda);
      for (const tanda of enTandas(filasSuministros))
        await m.getRepository(SuministroEntidad).insert(tanda);
    });
    this.log.log(
      `Sembrados ${filasSuministros.length} suministros y ${filasMedidores.length} medidores.`,
    );
    await this.sembrarRutas(suministros);
  }

  /** Las rutas de la app de clase, con el recorrido en `posicion` (R4). */
  private async sembrarRutas(suministros: SemillaSuministro[]): Promise<void> {
    const rutas = generarRutas(suministros);
    const posiciones = rutas.flatMap((r) =>
      r.suministroIds.map((suministroId, posicion) => ({
        rutaId: r.id,
        suministroId,
        bimestre: r.bimestre,
        posicion,
      })),
    );
    await this.dataSource.transaction(async (m) => {
      await m
        .getRepository(RutaEntidad)
        .insert(rutas.map(({ suministroIds: _ids, ...ruta }) => ruta));
      for (const tanda of enTandas(posiciones))
        await m.getRepository(RutaSuministroEntidad).insert(tanda);
    });
    this.log.log(`Sembradas ${rutas.length} rutas.`);
  }
}
