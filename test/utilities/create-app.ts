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
import { configurarAplicacion } from '../../src/setup-app.js';
import { AppModule } from '../../src/app.module.js';
import { Avisos } from '../../src/common/notifications/notices.js';
import { AlmacenTokensPush, EnviadorPush } from '../../src/common/notifications/ports.js';
import { Reloj, RelojFijo } from '../../src/common/clock/clock.js';
import {
  CONFIGURACION,
  type Configuracion,
  leerConfiguracion,
} from '../../src/config/environment.js';
import { AlmacenTokensMemoria, EnviadorMemoria } from './in-memory-push.js';

/** Instante por defecto de los tests: un sábado a la mañana en Paraná. */
export const AHORA_POR_DEFECTO = '2026-09-19T10:30:00-03:00';

export interface OpcionesDeApp {
  /** Variables de entorno que pisan las de los tests. */
  entorno?: Record<string, string>;
  ahora?: string;
  /** Controladores extra, sólo para probar piezas transversales (guards, filtros). */
  controladores?: Type[];
  /**
   * Con `true` quedan los puertos de verdad (almacén de tokens y enviador) en lugar de los
   * dobles en memoria: lo usa la consigna de los alumnos (`test/notifications/`).
   */
  puertosReales?: boolean;
}

export interface AppDePrueba {
  app: NestExpressApplication;
  http: TestAgent;
  reloj: RelojFijo;
  /** Doble del enviador: lo que `Avisos` decidió mandar (con `puertosReales` no se usa). */
  notificador: EnviadorMemoria;
  /** Doble del almacén de tokens. */
  tokens: AlmacenTokensMemoria;
  /** Deja un token de Expo registrado para ese usuario, sin pasar por HTTP. */
  registrarToken(
    usuarioId: string,
    tokenExpo: string,
    plataforma?: 'android' | 'ios',
  ): Promise<void>;
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
 * Levanta la app completa contra una base limpia, con RelojFijo y dobles en memoria de las push
 * (AGENTS §10.2). Sin mocks de repositorios.
 */
export async function crearApp(opciones: OpcionesDeApp = {}): Promise<AppDePrueba> {
  const directorio = await mkdtemp(join(tmpdir(), 'archivos-test-'));
  const config = leerConfiguracion(
    entornoDePrueba({ DIRECTORIO_ARCHIVOS: directorio, ...opciones.entorno }),
  );
  const reloj = new RelojFijo(opciones.ahora ?? AHORA_POR_DEFECTO);
  const notificador = new EnviadorMemoria();
  const tokens = new AlmacenTokensMemoria();

  let constructor = Test.createTestingModule({
    imports: [AppModule],
    controllers: opciones.controladores ?? [],
  })
    .overrideProvider(CONFIGURACION)
    .useValue(config)
    .overrideProvider(Reloj)
    .useValue(reloj);
  if (!opciones.puertosReales) {
    constructor = constructor
      .overrideProvider(EnviadorPush)
      .useValue(notificador)
      .overrideProvider(AlmacenTokensPush)
      .useValue(tokens);
  }
  const modulo = await constructor.compile();

  const app = modulo.createNestApplication<NestExpressApplication>({ logger: ['fatal'] });
  configurarAplicacion(app);
  // Escucha explícitamente en 127.0.0.1: si supertest levanta el servidor solo, escucha en
  // "::" y en algunas máquinas la conexión a 127.0.0.1:<puerto> la atiende otro proceso.
  await app.listen(0, '127.0.0.1');

  const dataSource = app.get<DataSource>(getDataSourceToken());
  if (config.db.motor !== 'better-sqlite3') {
    // La base del servidor es compartida entre archivos: se arranca siempre de cero.
    await dataSource.synchronize(true);
  }
  const avisos = app.get(Avisos);

  return {
    app,
    http: request(app.getHttpServer()),
    reloj,
    notificador,
    tokens,
    registrarToken: (usuarioId, tokenExpo, plataforma = 'ios') =>
      app.get(AlmacenTokensPush).guardar(usuarioId, tokenExpo, plataforma),
    dataSource,
    config,
    esperarPush: () => avisos.esperarEnvios(),
    cerrar: () => app.close(),
  };
}
