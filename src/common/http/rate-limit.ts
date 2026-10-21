import {
  type ExecutionContext,
  Injectable,
  Module,
  SetMetadata,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import {
  ThrottlerGuard,
  type ThrottlerLimitDetail,
  ThrottlerModule,
} from '@nestjs/throttler';
import type { Response } from 'express';
import type { AppConfigService } from '../../config/configuration.js';

// Límite de pedidos (rate limiting) con @nestjs/throttler. Dos reglas:
//   - general: cada IP puede hacer THROTTLE_LIMIT pedidos por ruta cada THROTTLE_TTL_SECONDS;
//   - ingreso: en las rutas marcadas con @LoginRateLimit(), LOGIN_THROTTLE_LIMIT intentos por
//     IP **y legajo**, para frenar a quien prueba contraseñas sin bloquear a todo un curso que
//     sale a internet por la misma IP (el wifi de la facultad).
// Al pasarse, responde 429 DEMASIADOS_PEDIDOS con la cabecera Retry-After.

const LOGIN_ROUTE = 'rate-limit:login';

/** Marca una ruta de ingreso: además del límite general, se le aplica el de ingreso. */
export const LoginRateLimit = () => SetMetadata(LOGIN_ROUTE, true);

const isLoginRoute = (context: ExecutionContext): boolean =>
  Reflect.getMetadata(LOGIN_ROUTE, context.getHandler()) === true;

/**
 * El guard de @nestjs/throttler, con una sola diferencia: al pasarse responde la cabecera
 * estándar `Retry-After` (segundos). La librería, con dos reglas con nombre, mandaría
 * `Retry-After-general` y `Retry-After-login`, que ningún cliente HTTP entiende.
 */
@Injectable()
class RateLimitGuard extends ThrottlerGuard {
  protected override async throwThrottlingException(
    context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    context
      .switchToHttp()
      .getResponse<Response>()
      .setHeader('Retry-After', String(Math.max(1, detail.timeToBlockExpire)));
    return super.throwThrottlingException(context, detail);
  }
}

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: AppConfigService) => {
        const { ttlMs, limit, loginLimit } = config.get('http.throttle', {
          infer: true,
        });
        return {
          setHeaders: false,
          throttlers: [
            { name: 'general', ttl: ttlMs, limit },
            {
              name: 'login',
              ttl: ttlMs,
              limit: loginLimit,
              skipIf: (context) => !isLoginRoute(context),
              getTracker: (req) => {
                const legajo: unknown = req.body?.legajo;
                const user =
                  typeof legajo === 'string' ? legajo.trim().toLowerCase() : '';
                return `${String(req.ip)}:${user}`;
              },
            },
          ],
        };
      },
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: RateLimitGuard }],
})
export class RateLimitModule {}
