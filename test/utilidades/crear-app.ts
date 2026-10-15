import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module.js';
import type { AppConfigService } from '../../src/config/configuration.js';
import { setupApp } from '../../src/setup-app.js';
import { Avisos } from '../../src/comun/notificaciones/avisos.js';
import {
  AlmacenTokensPush,
  EnviadorPush,
} from '../../src/comun/notificaciones/puertos.js';
import { Reloj, RelojFijo } from '../../src/comun/reloj/reloj.js';
import {
  AlmacenTokensMemoria,
  EnviadorMemoria,
} from './notificaciones-memoria.js';

/** Martes 15/09/2026, 8 de la mañana en Chajarí: el día que el lector sale con la ruta 07. */
export const AHORA_DE_PRUEBA = '2026-09-15T08:00:00-03:00';

export interface OpcionesApp {
  /** Variables de entorno que pisan las de prueba. */
  entorno?: Record<string, string>;
  /**
   * Usar el almacén de tokens de la app (el que programan los alumnos) en vez del doble en
   * memoria. Sólo lo piden los tests de `test/notificaciones/`: los de dominio verifican qué
   * decidió `Avisos`, no dónde viven los tokens (AGENTS §19.2).
   */
  almacenReal?: boolean;
  /**
   * Proveedores que se sustituyen (`[token, valor]`). Sólo para módulos que todavía no existen
   * (p. ej. el acceso de los lectores a sus rutas antes de M2); nunca repositorios ni la base.
   */
  sustitutos?: Array<[unknown, unknown]>;
}

export interface AppDePrueba {
  app: NestExpressApplication;
  http: () => ReturnType<typeof request>;
  reloj: RelojFijo;
  enviador: EnviadorMemoria;
  /** El doble del almacén; en una app con `almacenReal` no se usa. */
  almacenTokens: AlmacenTokensMemoria;
  avisos: Avisos;
  dataSource: DataSource;
  directorioArchivos: string;
  cerrar: () => Promise<void>;
}

/**
 * La app completa contra una base real y limpia (SQLite en memoria salvo que DB_ENGINE diga
 * otra cosa), con RelojFijo y el enviador de push en memoria. Nada de mocks de repositorios.
 *
 * La configuración sale de process.env como en producción: crearApp pone las variables de esta
 * app, compila (ahí ConfigModule arma cada área con ellas) y deja process.env como estaba.
 */
export async function crearApp(
  opciones: OpcionesApp = {},
): Promise<AppDePrueba> {
  const directorioArchivos = mkdtempSync(
    join(tmpdir(), 'api-medidores-archivos-'),
  );
  const motor = process.env.DB_ENGINE ?? 'better-sqlite3';
  const variables: Record<string, string | undefined> = {
    DB_ENGINE: motor,
    DB_URL: process.env.DB_URL,
    DB_FILE: ':memory:',
    DB_SYNCHRONIZE: 'true',
    DB_DROP_SCHEMA: motor === 'better-sqlite3' ? 'false' : 'true',
    STORAGE_DIR: directorioArchivos,
    PUSH_PROVIDER: 'log',
    SIMULATION_ENABLED: 'false',
    SEED_IF_EMPTY: 'false',
    ...opciones.entorno,
  };

  const reloj = new RelojFijo(AHORA_DE_PRUEBA);
  const enviador = new EnviadorMemoria();
  let modulo = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(Reloj)
    .useValue(reloj)
    .overrideProvider(EnviadorPush)
    .useValue(enviador);
  const almacenTokens = new AlmacenTokensMemoria();
  if (!opciones.almacenReal) {
    modulo = modulo.overrideProvider(AlmacenTokensPush).useValue(almacenTokens);
  }
  for (const [token, valor] of opciones.sustitutos ?? []) {
    modulo = modulo.overrideProvider(token as never).useValue(valor as never);
  }
  const compilado = await conVariables(variables, () => modulo.compile());

  const app = compilado.createNestApplication<NestExpressApplication>({
    logger: ['error'],
  });
  setupApp(app, app.get<AppConfigService>(ConfigService));
  await app.init();

  return {
    app,
    http: () => request(app.getHttpServer()),
    reloj,
    enviador,
    almacenTokens,
    avisos: app.get(Avisos),
    dataSource: app.get(DataSource),
    directorioArchivos,
    cerrar: async () => {
      await app.close();
      rmSync(directorioArchivos, { recursive: true, force: true });
    },
  };
}

/** Corre `fn` con esas variables en process.env y después lo deja como estaba. */
async function conVariables<T>(
  variables: Record<string, string | undefined>,
  fn: () => Promise<T>,
): Promise<T> {
  const antes = { ...process.env };
  for (const [nombre, valor] of Object.entries(variables)) {
    if (valor === undefined) delete process.env[nombre];
    else process.env[nombre] = valor;
  }
  try {
    return await fn();
  } finally {
    for (const nombre of Object.keys(process.env)) {
      if (!(nombre in antes)) delete process.env[nombre];
    }
    Object.assign(process.env, antes);
  }
}
