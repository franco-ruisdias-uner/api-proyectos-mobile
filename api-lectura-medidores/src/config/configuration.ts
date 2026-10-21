import type { ConfigService } from '@nestjs/config';
import { type AppSettings, appConfig, buildAppConfig } from './app.config.js';
import { type AuthConfig, authConfig, buildAuthConfig } from './auth.config.js';
import {
  buildDatabaseConfig,
  type DatabaseConfig,
  databaseConfig,
} from './database.config.js';
import { validateEnv } from './env.validation.js';
import { buildHttpConfig, type HttpConfig, httpConfig } from './http.config.js';
import {
  buildNotificationsConfig,
  type NotificationsConfig,
  notificationsConfig,
} from './notifications.config.js';
import {
  buildStorageConfig,
  type StorageConfig,
  storageConfig,
} from './storage.config.js';

// La configuración completa, por área. Se lee con ConfigService, con tipos:
//
//   constructor(private readonly config: AppConfigService) {}
//   const { jwtSecret } = this.config.get('auth', { infer: true });
//   const engine = this.config.get('database.engine', { infer: true });

/** Las áreas que carga ConfigModule (`load`). */
export const configNamespaces = [
  appConfig,
  httpConfig,
  databaseConfig,
  authConfig,
  storageConfig,
  notificationsConfig,
];

export interface Configuration {
  app: AppSettings;
  http: HttpConfig;
  database: DatabaseConfig;
  auth: AuthConfig;
  storage: StorageConfig;
  notifications: NotificationsConfig;
}

/** ConfigService con los tipos de cada área: `get('database.engine', { infer: true })`. */
export type AppConfigService = ConfigService<Configuration, true>;

/** La configuración armada a partir de unas variables, sin Nest (scripts y tests). */
export function buildConfiguration(
  variables: Record<string, unknown>,
): Configuration {
  const env = validateEnv(variables);
  return {
    app: buildAppConfig(env),
    http: buildHttpConfig(env),
    database: buildDatabaseConfig(env),
    auth: buildAuthConfig(env),
    storage: buildStorageConfig(env),
    notifications: buildNotificationsConfig(env),
  };
}
