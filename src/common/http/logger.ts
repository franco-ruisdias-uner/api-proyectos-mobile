import { ConsoleLogger, type LogLevel } from '@nestjs/common';
import type { AppSettings } from '../../config/app.config.js';

// El logger de la app: texto con colores en la computadora, JSON en producción (una línea por
// evento, que los hosts como Render indexan y permiten filtrar).

const SEVERITY: LogLevel[] = [
  'fatal',
  'error',
  'warn',
  'log',
  'debug',
  'verbose',
];

/** LOG_LEVEL=warn → fatal, error y warn: ese nivel y todos los más graves. */
export function logLevelsFrom(level: LogLevel): LogLevel[] {
  return SEVERITY.slice(0, SEVERITY.indexOf(level) + 1);
}

export function createLogger(app: AppSettings): ConsoleLogger {
  const json = app.logFormat === 'json';
  return new ConsoleLogger({
    json,
    colors: !json,
    logLevels: logLevelsFrom(app.logLevel),
  });
}
