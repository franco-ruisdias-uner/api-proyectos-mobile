import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { logAccessUrls } from './comun/http/access-urls.js';
import { createLogger } from './comun/http/logger.js';
import type { AppConfigService } from './config/configuration.js';
import { setupApp } from './setup-app.js';

async function bootstrap(): Promise<void> {
  // bufferLogs: lo que se loguea mientras arranca se guarda hasta que esté el logger definitivo
  // (que depende de la configuración: nivel y formato).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  const config = app.get<AppConfigService>(ConfigService);
  const settings = config.get('app', { infer: true });
  app.useLogger(createLogger(settings));

  setupApp(app, config);
  // Cierra la base y las conexiones con orden cuando Docker o el host mandan SIGTERM.
  app.enableShutdownHooks();

  await app.listen(settings.port, '0.0.0.0');

  const logger = new Logger('Bootstrap');
  logger.log(
    `API escuchando en el puerto ${settings.port} (base: ${config.get('database.engine', { infer: true })}).`,
  );
  logAccessUrls(logger, settings.port);
}

void bootstrap();
