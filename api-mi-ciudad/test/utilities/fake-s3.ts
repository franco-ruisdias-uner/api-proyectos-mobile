/**
 * S3Proxy para los tests (AGENTS §17.4). `pnpm test:e2e:matriz` y la CI lo levantan y definen
 * `S3_PRUEBA_ENDPOINT`; sin esa variable, los tests de S3 no corren (el ciclo rápido no necesita Docker).
 */
export const S3_PRUEBA_ENDPOINT = process.env.S3_PRUEBA_ENDPOINT;

export const hayS3 = Boolean(S3_PRUEBA_ENDPOINT);

/** Variables de entorno para apuntar la API (o un adaptador) al S3Proxy de prueba. */
export function entornoS3Prueba(bucket: string): Record<string, string> {
  return {
    ARCHIVOS_PROVEEDOR: 's3proxy',
    S3_ENDPOINT: S3_PRUEBA_ENDPOINT ?? '',
    S3_BUCKET: bucket,
    ARCHIVOS_CREAR_BUCKET: 'true',
  };
}
