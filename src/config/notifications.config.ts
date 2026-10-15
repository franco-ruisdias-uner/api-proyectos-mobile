import { type ConfigType, registerAs } from '@nestjs/config';
import { type Env, validateEnv } from './env.validation.js';

// Notificaciones push: `expo` las manda de verdad; `log` sólo las escribe en la consola.

export function buildNotificationsConfig(env: Env) {
  return {
    provider: env.PUSH_PROVIDER,
    expoPushUrl: env.EXPO_PUSH_URL,
  };
}

export const notificationsConfig = registerAs('notifications', () =>
  buildNotificationsConfig(validateEnv(process.env)),
);
export type NotificationsConfig = ConfigType<typeof notificationsConfig>;
