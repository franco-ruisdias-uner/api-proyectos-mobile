import { readFileSync } from 'node:fs';
import { leerConfiguracion } from './configuracion.js';

// El Blueprint de Render (AGENTS §18.2) y la configuración de la API tienen que decir lo mismo.
const yaml = readFileSync('render.yaml', 'utf8');

/** Las variables de render.yaml: `{ clave: valor | null }`, con null si Render la pide o la genera. */
function variables(): Record<string, string | null> {
  const resultado: Record<string, string | null> = {};
  const bloques = yaml.split(/^\s+- key: /m).slice(1);
  for (const bloque of bloques) {
    const [clave, ...resto] = bloque.split('\n');
    const valor = /^\s+value: "?([^"\n]*)"?$/m.exec(resto.join('\n'));
    resultado[clave.trim()] = valor ? valor[1] : null;
  }
  return resultado;
}

describe('AGENTS §18.2 — render.yaml', () => {
  const v = variables();

  it('es un web service de Docker, gratis, con el health check en /salud', () => {
    expect(yaml).toMatch(/runtime: docker/);
    expect(yaml).toMatch(/plan: free/);
    expect(yaml).toMatch(/healthCheckPath: \/salud/);
  });

  it('trae las variables fijas', () => {
    expect(v).toMatchObject({
      ENTORNO: 'publicado',
      CONFIAR_PROXY: 'true',
      DB_PROVEEDOR: 'supabase',
      ARCHIVOS_PROVEEDOR: 'supabase',
      SEMBRAR_SI_VACIA: 'true',
      DB_SINCRONIZAR: 'true',
    });
  });

  it('los secretos no tienen valor: Render los pide', () => {
    for (const secreto of [
      'DB_URL',
      'JWT_SECRETO',
      'SUPABASE_PROYECTO',
      'S3_REGION',
      'S3_BUCKET',
      'S3_ACCESS_KEY_ID',
      'S3_SECRET_ACCESS_KEY',
    ]) {
      expect(v, secreto).toHaveProperty(secreto, null);
    }
  });

  it('con esas variables y valores de ejemplo, la API arranca (ENTORNO=publicado)', () => {
    const entorno: Record<string, string> = {};
    for (const [clave, valor] of Object.entries(v)) if (valor !== null) entorno[clave] = valor;
    const c = leerConfiguracion({
      ...entorno,
      DB_URL: 'postgres://postgres.abc:x@aws-0-sa-east-1.pooler.supabase.com:5432/postgres',
      JWT_SECRETO: 'y'.repeat(44),
      SUPABASE_PROYECTO: 'abc',
      S3_REGION: 'sa-east-1',
      S3_BUCKET: 'archivos',
      S3_ACCESS_KEY_ID: 'a',
      S3_SECRET_ACCESS_KEY: 'b',
    });
    expect(c.db).toMatchObject({ motor: 'postgres', esquema: 'api' });
    expect(c.archivos.s3?.endpoint).toBe('https://abc.storage.supabase.co/storage/v1/s3');
    expect(c.confiarProxy).toBe(true);
  });
});
