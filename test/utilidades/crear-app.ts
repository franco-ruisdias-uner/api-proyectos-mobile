import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Type } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent.js';
import type { DataSource } from 'typeorm';
import { configurarAplicacion } from '../../src/aplicacion.js';
import { AppModule } from '../../src/app.module.js';
import { Notificador } from '../../src/comun/notificaciones/notificador.js';
import { NotificadorMemoria } from '../../src/comun/notificaciones/notificador-memoria.js';
import { Reloj, RelojFijo } from '../../src/comun/reloj/reloj.js';
import {
  CONFIGURACION,
  type Configuracion,
  leerConfiguracion,
} from '../../src/config/configuracion.js';
import { DispositivosServicio } from '../../src/modulos/dispositivos/dispositivos.servicio.js';

/** Instante por defecto de los tests: un sábado a la mañana en Paraná. */
export const AHORA_POR_DEFECTO = '2026-09-19T10:30:00-03:00';

export interface OpcionesDeApp {
  /** Variables de entorno que pisan las de los tests. */
  entorno?: Record<string, string>;
  ahora?: string;
  /** Controladores extra, sólo para probar piezas transversales (guards, filtros). */
  controladores?: Type[];
}

export interface AppDePrueba {
  app: NestExpressApplication;
  http: TestAgent;
  reloj: RelojFijo;
  notificador: NotificadorMemoria;
  dataSource: DataSource;
  config: Configuracion;
  /** Espera los envíos de push que quedaron en segundo plano. */
  esperarPush(): Promise<void>;
  cerrar(): Promise<void>;
}

/** Entorno de los tests: el motor sale de DB_MOTOR/DB_URL (matriz), SQLite en memoria si no. */
export function entornoDePrueba(extra: Record<string, string> = {}): Record<string, string> {
  const base: Record<string, string> = {
    ENTORNO: 'test',
    JWT_SECRETO: 'secreto-de-los-tests',
    DB_MOTOR: process.env.DB_MOTOR ?? 'better-sqlite3',
    DB_ARCHIVO: ':memory:',
    DB_SINCRONIZAR: 'true',
    NOTIFICACIONES: 'registro',
    SIMULACION_HABILITADA: 'false',
  };
  if (process.env.DB_URL) base.DB_URL = process.env.DB_URL;
  return { ...base, ...extra };
}

/**
 * Levanta la app completa contra una base limpia, con RelojFijo y NotificadorMemoria
 * (AGENTS §10.2). Sin mocks de repositorios.
 */
export async function crearApp(opciones: OpcionesDeApp = {}): Promise<AppDePrueba> {
  const directorio = await mkdtemp(join(tmpdir(), 'archivos-test-'));
  const config = leerConfiguracion(
    entornoDePrueba({ DIRECTORIO_ARCHIVOS: directorio, ...opciones.entorno }),
  );
  const reloj = new RelojFijo(opciones.ahora ?? AHORA_POR_DEFECTO);
  const notificador = new NotificadorMemoria();

  const modulo = await Test.createTestingModule({
    imports: [AppModule],
    controllers: opciones.controladores ?? [],
  })
    .overrideProvider(CONFIGURACION)
    .useValue(config)
    .overrideProvider(Reloj)
    .useValue(reloj)
    .overrideProvider(Notificador)
    .useValue(notificador)
    .compile();

  const app = modulo.createNestApplication<NestExpressApplication>({ logger: ['fatal'] });
  configurarAplicacion(app);
  await app.init();

  const dataSource = app.get<DataSource>(getDataSourceToken());
  if (config.db.motor !== 'better-sqlite3') {
    // La base del servidor es compartida entre archivos: se arranca siempre de cero.
    await dataSource.synchronize(true);
  }
  const dispositivos = app.get(DispositivosServicio);

  return {
    app,
    http: request(app.getHttpServer()),
    reloj,
    notificador,
    dataSource,
    config,
    esperarPush: () => dispositivos.esperarEnvios(),
    cerrar: () => app.close(),
  };
}
