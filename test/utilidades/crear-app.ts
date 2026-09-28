import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module.js';
import { Notificador } from '../../src/comun/notificaciones/notificador.js';
import { NotificadorMemoria } from '../../src/comun/notificaciones/notificador-memoria.js';
import { Reloj, RelojFijo } from '../../src/comun/reloj/reloj.js';
import { configurarApp } from '../../src/configurar-app.js';
import { AvisosServicio } from '../../src/modulos/dispositivos/avisos.servicio.js';

export const AHORA_POR_DEFECTO = '2026-11-14T12:00:00-03:00';

export interface AppDePrueba {
  app: NestExpressApplication;
  /** Cliente HTTP (supertest) contra la app. */
  http: () => ReturnType<typeof request>;
  reloj: RelojFijo;
  notificador: NotificadorMemoria;
  dataSource: DataSource;
  /** Espera a que terminen las push que se mandan en segundo plano. */
  esperarAvisos: () => Promise<void>;
  cerrar: () => Promise<void>;
}

/**
 * Levanta la app completa contra una base limpia del motor elegido (SQLite en memoria por
 * defecto), con `RelojFijo` y `NotificadorMemoria`. Nada de mocks de repositorios.
 */
export async function crearApp(
  opciones: { entorno?: Record<string, string>; ahora?: string } = {},
): Promise<AppDePrueba> {
  const directorio = await mkdtemp(join(tmpdir(), 'api-mi-ciudad-'));
  const reloj = new RelojFijo(opciones.ahora ?? AHORA_POR_DEFECTO);
  const notificador = new NotificadorMemoria();

  const modulo = await Test.createTestingModule({
    imports: [AppModule.registrar({ DIRECTORIO_ARCHIVOS: directorio, ...opciones.entorno })],
  })
    .overrideProvider(Reloj)
    .useValue(reloj)
    .overrideProvider(Notificador)
    .useValue(notificador)
    .compile();

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
    notificador,
    dataSource: app.get(DataSource),
    esperarAvisos: () => app.get(AvisosServicio).esperarPendientes(),
    cerrar: async () => {
      await app.close();
      await rm(directorio, { recursive: true, force: true });
    },
  };
}
