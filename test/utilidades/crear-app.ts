import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module.js';
import { configurarApp } from '../../src/arranque.js';
import { leerEntorno } from '../../src/config/entorno.js';
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
  /** Usar el almacén de tokens en memoria en vez de la tabla. */
  tokensEnMemoria?: boolean;
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
  avisos: Avisos;
  dataSource: DataSource;
  directorioArchivos: string;
  cerrar: () => Promise<void>;
}

/**
 * La app completa contra una base real y limpia (SQLite en memoria salvo que DB_MOTOR diga
 * otra cosa), con RelojFijo y el enviador de push en memoria. Nada de mocks de repositorios.
 */
export async function crearApp(
  opciones: OpcionesApp = {},
): Promise<AppDePrueba> {
  const directorioArchivos = mkdtempSync(
    join(tmpdir(), 'api-medidores-archivos-'),
  );
  const motor = process.env.DB_MOTOR ?? 'better-sqlite3';
  const variables: Record<string, string | undefined> = {
    ENTORNO: 'test',
    DB_MOTOR: motor,
    DB_URL: process.env.DB_URL,
    DB_ARCHIVO: ':memory:',
    DB_SINCRONIZAR: 'true',
    DB_BORRAR_AL_CONECTAR: motor === 'better-sqlite3' ? 'false' : 'true',
    JWT_SECRETO: 'secreto-de-los-tests-no-es-de-verdad',
    DIRECTORIO_ARCHIVOS: directorioArchivos,
    NOTIFICACIONES: 'registro',
    SIMULACION_HABILITADA: 'false',
    SEMBRAR_SI_VACIA: 'false',
    ...opciones.entorno,
  };
  const entorno = leerEntorno(variables);

  const reloj = new RelojFijo(AHORA_DE_PRUEBA);
  const enviador = new EnviadorMemoria();
  let modulo = Test.createTestingModule({
    imports: [AppModule.registrar(variables)],
  })
    .overrideProvider(Reloj)
    .useValue(reloj)
    .overrideProvider(EnviadorPush)
    .useValue(enviador);
  if (opciones.tokensEnMemoria) {
    modulo = modulo
      .overrideProvider(AlmacenTokensPush)
      .useValue(new AlmacenTokensMemoria());
  }
  for (const [token, valor] of opciones.sustitutos ?? []) {
    modulo = modulo.overrideProvider(token as never).useValue(valor as never);
  }
  const compilado = await modulo.compile();

  const app = compilado.createNestApplication<NestExpressApplication>({
    logger: ['error'],
  });
  configurarApp(app, entorno);
  await app.init();

  return {
    app,
    http: () => request(app.getHttpServer()),
    reloj,
    enviador,
    avisos: app.get(Avisos),
    dataSource: app.get(DataSource),
    directorioArchivos,
    cerrar: async () => {
      await app.close();
      rmSync(directorioArchivos, { recursive: true, force: true });
    },
  };
}
