// crearApp(): la app de Nest completa, con base real y limpia, RelojFijo y NotificadorMemoria.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configurarAplicacion, OPCIONES_NEST } from '../../src/aplicacion.js';
import { Reloj } from '../../src/comun/reloj/reloj.js';
import { RelojFijo } from '../../src/comun/reloj/reloj-fijo.js';
import { Notificador } from '../../src/comun/notificaciones/notificador.js';
import { NotificadorMemoria } from '../../src/comun/notificaciones/notificador-memoria.js';
import { ServicioAvisos } from '../../src/comun/notificaciones/avisos.servicio.js';

export const AHORA_POR_DEFECTO = '2026-09-14T10:00:00-03:00';

export interface OpcionesApp {
  /** Instante inicial del reloj (ISO con offset). */
  ahora?: string;
  /** Variables de entorno que pisan las de prueba. */
  entorno?: Record<string, string>;
}

export interface AppDePrueba {
  app: NestExpressApplication;
  http: () => ReturnType<typeof request>;
  reloj: RelojFijo;
  notificador: NotificadorMemoria;
  dataSource: DataSource;
  /** Espera a que terminen las push que se mandan después de responder. */
  esperarAvisos: () => Promise<void>;
  directorioArchivos: string;
  cerrar: () => Promise<void>;
}

/** Entorno de prueba: SQLite en memoria salvo que la matriz diga otro motor. */
export function entornoDePrueba(
  directorioArchivos: string,
): Record<string, string> {
  const motor = process.env.DB_MOTOR ?? 'better-sqlite3';
  return {
    ENTORNO: 'test',
    JWT_SECRETO: 'secreto-solo-para-los-tests-de-la-api',
    DB_MOTOR: motor,
    DB_ARCHIVO: ':memory:',
    ...(process.env.DB_URL ? { DB_URL: process.env.DB_URL } : {}),
    DB_SINCRONIZAR: 'true',
    DIRECTORIO_ARCHIVOS: directorioArchivos,
    NOTIFICACIONES: 'registro',
    SIMULACION_HABILITADA: 'false',
    SEMBRAR_SI_VACIA: 'false',
    CONFIAR_PROXY: 'false',
    URL_PUBLICA: '',
    RELOJ_FIJO: '',
  };
}

export async function crearApp(
  opciones: OpcionesApp = {},
): Promise<AppDePrueba> {
  const directorioArchivos = mkdtempSync(join(tmpdir(), 'api-archivos-'));
  const reloj = new RelojFijo(new Date(opciones.ahora ?? AHORA_POR_DEFECTO));
  const notificador = new NotificadorMemoria();

  const modulo = await Test.createTestingModule({
    imports: [
      AppModule.registrar({
        ...entornoDePrueba(directorioArchivos),
        ...opciones.entorno,
      }),
    ],
  })
    .overrideProvider(Reloj)
    .useValue(reloj)
    .overrideProvider(Notificador)
    .useValue(notificador)
    .compile();

  const app = modulo.createNestApplication<NestExpressApplication>({
    ...OPCIONES_NEST,
    logger: ['error'],
  });
  configurarAplicacion(app);
  await app.init();

  const dataSource = app.get<DataSource>(getDataSourceToken());
  // Base limpia por archivo de test, también en los motores de red de la matriz.
  if (dataSource.options.type !== 'better-sqlite3')
    await dataSource.synchronize(true);

  const avisos = app.get(ServicioAvisos);
  return {
    app,
    http: () => request(app.getHttpServer()),
    reloj,
    notificador,
    dataSource,
    esperarAvisos: () => avisos.esperarEnvios(),
    directorioArchivos,
    cerrar: async () => {
      await avisos.esperarEnvios();
      await app.close();
      rmSync(directorioArchivos, { recursive: true, force: true });
    },
  };
}
