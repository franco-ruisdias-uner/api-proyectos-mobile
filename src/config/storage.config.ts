import { type ConfigType, registerAs } from '@nestjs/config';
import { hasS3Problems, s3ConfigFromEnv } from '../common/files/providers.js';
import { type Env, validateEnv } from './env.validation.js';

// Los archivos (fotos, audios, videos): en una carpeta, o en un servicio compatible con S3.

export function buildStorageConfig(env: Env) {
  const s3 = s3ConfigFromEnv(env);
  return {
    provider: env.STORAGE_PROVIDER,
    /** Carpeta de los archivos con STORAGE_PROVIDER=local. */
    dir: env.STORAGE_DIR,
    /** Cliente S3 del proveedor elegido (null con `local`). */
    s3: s3 === null || hasS3Problems(s3) ? null : s3,
  };
}

export const storageConfig = registerAs('storage', () =>
  buildStorageConfig(validateEnv(process.env)),
);
export type StorageConfig = ConfigType<typeof storageConfig>;
