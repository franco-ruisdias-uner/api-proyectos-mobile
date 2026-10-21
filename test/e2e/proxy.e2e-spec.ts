import { type AppDePrueba, crearApp } from '../utilities/create-app.js';
import { jpeg } from '../utilities/files.js';
import { bearer, conSesion } from '../utilities/users.js';

describe('AGENTS §18.2 — TRUST_PROXY: las URLs de archivos salen https detrás del proxy', () => {
  describe('con TRUST_PROXY=true', () => {
    let c: AppDePrueba;
    beforeAll(
      async () => (c = await crearApp({ entorno: { TRUST_PROXY: 'true' } })),
    );
    afterAll(() => c.cerrar());

    it('X-Forwarded-Proto y X-Forwarded-Host se usan para armar la URL', async () => {
      const { token } = await conSesion(c, 'lector');
      const r = await c
        .http()
        .post('/archivos')
        .set(bearer(token))
        .set('X-Forwarded-Proto', 'https')
        .set('X-Forwarded-Host', 'medidores.onrender.com')
        .attach('archivo', jpeg(), 'f.jpg')
        .expect(201);
      expect(r.body.datos.url).toMatch(
        /^https:\/\/medidores\.onrender\.com\/archivos\/imagenes\//,
      );
    });
  });

  describe('sin TRUST_PROXY', () => {
    let c: AppDePrueba;
    beforeAll(async () => (c = await crearApp()));
    afterAll(() => c.cerrar());

    it('las cabeceras X-Forwarded-* se ignoran', async () => {
      const { token } = await conSesion(c, 'lector');
      const r = await c
        .http()
        .post('/archivos')
        .set(bearer(token))
        .set('Host', '192.168.0.10:3000')
        .set('X-Forwarded-Proto', 'https')
        .set('X-Forwarded-Host', 'otro.example.com')
        .attach('archivo', jpeg(), 'f.jpg')
        .expect(201);
      expect(r.body.datos.url).toMatch(
        /^http:\/\/192\.168\.0\.10:3000\/archivos\//,
      );
    });
  });
});
