import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent.js';
import type { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module.js';
import { Avisos } from '../../src/common/notifications/notices.js';
import { ALMACEN_TOKENS_PUSH, ENVIADOR_PUSH } from '../../src/common/notifications/ports.js';
import { Reloj, RelojFijo } from '../../src/common/clock/clock.js';
import { configurarApp, OPCIONES_APP } from '../../src/setup-app.js';
import { type Entorno, validarEntorno } from '../../src/config/environment.js';
import { AlmacenTokensMemoria, EnviadorMemoria } from './push-doubles.js';

/** Instante por defecto de los tests: sábado 3 de octubre de 2026, 12:00 en Buenos Aires. */
export const AHORA_DE_PRUEBA = '2026-10-03T12:00:00-03:00';

export interface AppDePrueba {
  app: NestExpressApplication;
  http: () => TestAgent;
  reloj: RelojFijo;
  enviador: EnviadorMemoria;
  /** Almacén de tokens en memoria; con `almacenReal: true` no se usa y vale `null`. */
  almacen: AlmacenTokensMemoria;
  avisos: Avisos;
  dataSource: DataSource;
  entorno: Entorno;
  cerrar: () => Promise<void>;
}

/**
 * Levanta la app completa contra una base limpia (SQLite en memoria por defecto, o el motor de
 * la matriz), con RelojFijo y los dos puertos de push en memoria (AGENTS §10.2, §19.2). La
 * consigna de notificaciones usa `almacenReal: true` para probar el almacén de verdad.
 */
export async function crearApp(
  opciones: {
    ahora?: string;
    variables?: Record<string, string>;
    almacenReal?: boolean;
    enviadorReal?: boolean;
  } = {},
): Promise<AppDePrueba> {
  const directorioArchivos = await mkdtemp(join(tmpdir(), 'api-archivos-'));
  const motor = process.env.DB_MOTOR ?? 'better-sqlite3';
  const entorno = validarEntorno({
    JWT_SECRETO: 'secreto-de-los-tests',
    ENTORNO: 'test',
    DB_MOTOR: motor,
    DB_URL: process.env.DB_URL,
    DB_ARCHIVO: ':memory:',
    DB_SINCRONIZAR: 'true',
    DIRECTORIO_ARCHIVOS: directorioArchivos,
    NOTIFICACIONES: 'registro',
    SIMULACION_HABILITADA: 'false',
    ...opciones.variables,
  });

  const reloj = new RelojFijo(opciones.ahora ?? AHORA_DE_PRUEBA);
  const enviador = new EnviadorMemoria();
  const almacen = new AlmacenTokensMemoria();
  let constructor = Test.createTestingModule({ imports: [AppModule.crear(entorno)] })
    .overrideProvider(Reloj)
    .useValue(reloj);
  if (!opciones.enviadorReal) {
    constructor = constructor.overrideProvider(ENVIADOR_PUSH).useValue(enviador);
  }
  if (!opciones.almacenReal) {
    constructor = constructor.overrideProvider(ALMACEN_TOKENS_PUSH).useValue(almacen);
  }
  const modulo = await constructor.compile();

  const app = modulo.createNestApplication<NestExpressApplication>(OPCIONES_APP);
  configurarApp(app, entorno);
  await app.init();

  const dataSource = app.get<DataSource>(getDataSourceToken());
  // En PostgreSQL/MySQL/MariaDB la base se comparte entre archivos: se arranca de cero.
  if (motor !== 'better-sqlite3') await dataSource.synchronize(true);

  const avisos = app.get(Avisos);
  return {
    app,
    http: () => request(app.getHttpServer()),
    reloj,
    enviador,
    almacen,
    avisos,
    dataSource,
    entorno,
    cerrar: async () => {
      await avisos.esperarPendientes();
      await app.close();
      await rm(directorioArchivos, { recursive: true, force: true });
    },
  };
}
