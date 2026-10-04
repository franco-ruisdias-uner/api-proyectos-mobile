// Levanta la API completa contra una base real y limpia (AGENTS §10.2): SQLite en
// memoria por defecto, o el motor de DB_MOTOR/DB_URL cuando corre la matriz.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DataSource } from 'typeorm';
import request from 'supertest';
import TestAgent from 'supertest/lib/agent.js';
import { AppModule } from '../../src/app.module.js';
import { configurarApp } from '../../src/app.configurar.js';
import { Reloj, RelojFijo } from '../../src/comun/reloj/reloj.js';
import { AlmacenArchivos } from '../../src/comun/archivos/almacen-archivos.js';
import { EnviadorPush } from '../../src/comun/notificaciones/puertos.js';
import { Avisos } from '../../src/comun/notificaciones/avisos.servicio.js';
import { EnviadorMemoria } from './notificaciones.js';

export interface OpcionesApp {
  /** Instante inicial del reloj. Default: sábado 19/09/2026 10:00 en Villaguay. */
  ahora?: string;
  /** Variables de entorno que pisan las de prueba. */
  entorno?: Record<string, string>;
}

export interface AppDePrueba {
  app: NestExpressApplication;
  http: () => TestAgent;
  reloj: RelojFijo;
  enviador: EnviadorMemoria;
  avisos: Avisos;
  dataSource: DataSource;
  almacen: AlmacenArchivos;
  cerrar: () => Promise<void>;
}

export const AHORA_POR_DEFECTO = '2026-09-19T10:00:00-03:00';
export const JWT_SECRETO_PRUEBA =
  'secreto-de-prueba-que-no-se-usa-en-ningun-lado';

export async function crearApp(
  opciones: OpcionesApp = {},
): Promise<AppDePrueba> {
  const directorio = mkdtempSync(join(tmpdir(), 'api-archivos-'));
  const motor = process.env.DB_MOTOR ?? 'better-sqlite3';
  const entorno: Record<string, string> = {
    ENTORNO: 'test',
    DB_MOTOR: motor,
    DB_ARCHIVO: ':memory:',
    DB_SINCRONIZAR: 'true',
    SEMBRAR_SI_VACIA: 'false',
    JWT_SECRETO: JWT_SECRETO_PRUEBA,
    DIRECTORIO_ARCHIVOS: directorio,
    ARCHIVOS_PROVEEDOR: 'local',
    NOTIFICACIONES: 'registro',
    SIMULACION_HABILITADA: 'false',
    URL_PUBLICA: '',
    CONFIAR_PROXY: 'false',
    RELOJ_FIJO: '',
    ...opciones.entorno,
  };
  const reloj = new RelojFijo(opciones.ahora ?? AHORA_POR_DEFECTO);
  const enviador = new EnviadorMemoria();

  const modulo = await Test.createTestingModule({
    imports: [
      AppModule.registrar({
        entorno,
        ignorarArchivoEnv: true,
        borrarEsquema: true,
      }),
    ],
  })
    .overrideProvider(Reloj)
    .useValue(reloj)
    .overrideProvider(EnviadorPush)
    .useValue(enviador)
    .compile();

  const app = modulo.createNestApplication<NestExpressApplication>({
    logger: false,
  });
  configurarApp(app);
  await app.init();

  return {
    app,
    http: () => request.agent(app.getHttpServer()),
    reloj,
    enviador,
    avisos: app.get(Avisos),
    dataSource: app.get(DataSource),
    almacen: app.get(AlmacenArchivos),
    cerrar: async () => {
      await app.close();
      rmSync(directorio, { recursive: true, force: true });
    },
  };
}
