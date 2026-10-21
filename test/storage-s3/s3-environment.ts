/** S3Proxy de compose.matriz.yaml (puerto 58080), o el que diga S3_PRUEBAS_ENDPOINT. */
export const ENTORNO_S3PROXY: Record<string, string> = {
  STORAGE_PROVIDER: 's3proxy',
  S3_ENDPOINT: process.env.S3_PRUEBAS_ENDPOINT ?? 'http://127.0.0.1:58080',
  S3_CREATE_BUCKET: 'true',
  S3_BUCKET: 'archivos',
};
