import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

// Una línea por pedido, cuando termina: método, ruta, estado y cuánto tardó.
//   GET /rutas/rut-07-2026-05 200 12ms
// 5xx sale como error y 4xx como warn, así se ven aunque LOG_LEVEL=warn. /salud va en debug:
// los hosts la piden cada pocos segundos y taparía todo lo demás.
// Nunca se loguean cabeceras ni cuerpos: ahí viajan tokens y contraseñas.

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - start) / 1_000_000;
      const line = `${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(0)}ms`;
      if (res.statusCode >= 500) this.logger.error(line);
      else if (res.statusCode >= 400) this.logger.warn(line);
      else if (req.path === '/salud') this.logger.debug(line);
      else this.logger.log(line);
    });
    next();
  }
}
