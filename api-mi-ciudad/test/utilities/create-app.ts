import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module.js';
import { AvisosServicio } from '../../src/common/notifications/notices.service.js';
import { ALMACEN_TOKENS_PUSH, ENVIADOR_PUSH } from '../../src/common/notifications/ports.js';
import { Reloj, RelojFijo } from '../../src/common/clock/clock.js';
import { configurarApp } from '../../src/setup-app.js';
import { AlmacenTokensMemoria } from './in-memory-token-store.js';
import { EnviadorMemoria } from './in-memory-sender.js';

export const AHORA_POR_DEFECTO = '2026-11-14T12:00:00-03:00';

export interface AppDePrueba {
  app: NestExpressApplication;
  /** Cliente HTTP (supertest) contra la app. */
  http: () => ReturnType<typeof request>;
  reloj: RelojFijo;
  /** Doble del enviador de push (siempre presente; sólo recibe algo si la app lo usa). */
  enviador: EnviadorMemoria;
  /** Doble del almacén de tokens: `ctx.tokens.guardar(usuarioId, token, 'ios')` para dar de alta un teléfono. */
  tokens: AlmacenTokensMemoria;
  dataSource: DataSource;
  /** Espera a que terminen las push que se mandan en segundo plano. */
  esperarAvisos: () => Promise<void>;
  cerrar: () => Promise<void>;
}

/**
 * Levanta la app completa contra una base limpia del motor elegido (SQLite en memoria por
 * defecto), con `RelojFijo` y dobles en memoria de los dos puertos de push (con `reales`, la app usa los suyos). Nada de mocks de repositorios.
 */
export async function crearApp(
  opciones: { entorno?: Record<string, string>; ahora?: string; reales?: boolean } = {},
): Promise<AppDePrueba> {
  const directorio = await mkdtemp(join(tmpdir(), 'api-mi-ciudad-'));
  const reloj = new RelojFijo(opciones.ahora ?? AHORA_POR_DEFECTO);
  const enviador = new EnviadorMemoria();
  const tokens = new AlmacenTokensMemoria();

  const constructor = Test.createTestingModule({
    imports: [AppModule.registrar({ DIRECTORIO_ARCHIVOS: directorio, ...opciones.entorno })],
  })
    .overrideProvider(Reloj)
    .useValue(reloj);
  if (!opciones.reales) {
    constructor
      .overrideProvider(ALMACEN_TOKENS_PUSH)
      .useValue(tokens)
      .overrideProvider(ENVIADOR_PUSH)
      .useValue(enviador);
  }
  const modulo = await constructor.compile();

  const app = modulo.createNestApplication<NestExpressApplication>({ logger: ['error', 'warn'] });
  configurarApp(app);
  // Escucha una vez en un puerto libre de 127.0.0.1 (en vez de que supertest abra y cierre uno
  // por pedido, que con muchos archivos en paralelo a veces choca con otro proceso).
  await app.listen(0, '127.0.0.1');
  const direccion = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;

  return {
    app,
    http: () => request(direccion),
    reloj,
    enviador,
    tokens,
    dataSource: app.get(DataSource),
    esperarAvisos: () => app.get(AvisosServicio).esperarPendientes(),
    cerrar: async () => {
      await app.close();
      await rm(directorio, { recursive: true, force: true });
    },
  };
}
