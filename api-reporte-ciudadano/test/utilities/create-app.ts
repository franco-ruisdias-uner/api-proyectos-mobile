// crearApp(): la app de Nest completa, con base real y limpia, RelojFijo y NotificadorMemoria.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configurarAplicacion, OPCIONES_NEST } from '../../src/setup-app.js';
import { Reloj } from '../../src/common/clock/clock.js';
import { RelojFijo } from '../../src/common/clock/fixed-clock.js';
import {
  ALMACEN_TOKENS_PUSH,
  ENVIADOR_PUSH,
} from '../../src/common/notifications/ports.js';
import {
  AlmacenTokensMemoria,
  EnviadorMemoria,
  ExpoFalso,
  type NotificadorDePrueba,
} from './notifications.js';
import { Avisos } from '../../src/common/notifications/notices.service.js';

export const AHORA_POR_DEFECTO = '2026-09-14T10:00:00-03:00';

export interface OpcionesApp {
  /** Instante inicial del reloj (ISO con offset). */
  ahora?: string;
  /** Variables de entorno que pisan las de prueba. */
  entorno?: Record<string, string>;
  /**
   * Usa el almacén de tokens y el enviador reales (los que programan los alumnos) contra un
   * Expo falso, en vez de los dobles en memoria. Es para los tests de `/dispositivos`.
   */
  puertosReales?: boolean;
}

export interface AppDePrueba {
  app: NestExpressApplication;
  http: () => ReturnType<typeof request>;
  reloj: RelojFijo;
  /** Qué push se mandaron: el enviador en memoria o, con `puertosReales`, el Expo falso. */
  notificador: NotificadorDePrueba;
  /** Sólo con `puertosReales`. */
  expo: ExpoFalso | null;
  /** Le registra un dispositivo a un usuario sin pasar por la API (sólo sin `puertosReales`). */
  registrarDispositivo: (
    usuarioId: string,
    tokenExpo?: string,
  ) => Promise<string>;
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
  const expo = opciones.puertosReales ? new ExpoFalso() : null;
  await expo?.iniciar();
  const enviador = new EnviadorMemoria();
  const almacen = new AlmacenTokensMemoria();
  const notificador: NotificadorDePrueba = expo ?? enviador;

  let constructor = Test.createTestingModule({
    imports: [
      AppModule.registrar({
        ...entornoDePrueba(directorioArchivos),
        ...(expo ? { NOTIFICACIONES: 'expo', EXPO_PUSH_URL: expo.url } : {}),
        ...opciones.entorno,
      }),
    ],
  })
    .overrideProvider(Reloj)
    .useValue(reloj);
  if (!expo)
    constructor = constructor
      .overrideProvider(ALMACEN_TOKENS_PUSH)
      .useValue(almacen)
      .overrideProvider(ENVIADOR_PUSH)
      .useValue(enviador);
  const modulo = await constructor.compile();

  const app = modulo.createNestApplication<NestExpressApplication>({
    ...OPCIONES_NEST,
    logger: ['error'],
  });
  configurarAplicacion(app);
  // Un servidor fijo por archivo, en vez del efímero que supertest abre y cierra en cada
  // pedido: con cientos de pedidos seguidos, reciclar puertos daba ECONNRESET intermitentes.
  await app.listen(0, '127.0.0.1');
  const direccion = app.getHttpServer().address() as AddressInfo;
  const origen = `http://127.0.0.1:${direccion.port}`;

  const dataSource = app.get<DataSource>(getDataSourceToken());
  // Base limpia por archivo de test, también en los motores de red de la matriz.
  if (dataSource.options.type !== 'better-sqlite3')
    await dataSource.synchronize(true);

  const avisos = app.get(Avisos);
  return {
    app,
    http: () => request(origen),
    reloj,
    notificador,
    expo,
    registrarDispositivo: async (usuarioId, tokenExpo) => {
      const token =
        tokenExpo ??
        `ExponentPushToken[prueba-${Math.random().toString(36).slice(2, 12)}]`;
      await almacen.guardar(usuarioId, token, 'android');
      return token;
    },
    dataSource,
    esperarAvisos: () => avisos.esperarEnvios(),
    directorioArchivos,
    cerrar: async () => {
      await avisos.esperarEnvios();
      await app.close();
      await expo?.cerrar();
      rmSync(directorioArchivos, { recursive: true, force: true });
    },
  };
}
