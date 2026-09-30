// AGENTS §17.4 — la misma suite de contrato, contra S3 (S3Proxy de compose.matriz.yaml).
// Sólo corre en la matriz: S3_ENDPOINT_PRUEBA lo define scripts/matriz.mjs.
import { AlmacenS3 } from '../../src/comun/archivos/almacen-s3.js';
import { configuracionS3 } from '../../src/comun/archivos/proveedores.js';
import { probarContratoAlmacen } from './contrato-almacen.js';

const endpoint = process.env.S3_ENDPOINT_PRUEBA;

if (endpoint) {
  probarContratoAlmacen('S3 (S3Proxy)', async () => {
    const r = configuracionS3({
      ARCHIVOS_PROVEEDOR: 's3proxy',
      S3_ENDPOINT: endpoint,
      S3_BUCKET: `prueba-${Math.random().toString(36).slice(2, 10)}`,
    });
    if (!r.ok) throw new Error(r.problemas.join(' '));
    return { almacen: new AlmacenS3(r.config), limpiar: async () => {} };
  });
} else {
  describe('AGENTS §17.4 — Contrato de AlmacenArchivos: S3', () => {
    it('necesita S3Proxy: corre con pnpm test:e2e:matriz', () => {
      expect(endpoint).toBeUndefined();
    });
  });
}
