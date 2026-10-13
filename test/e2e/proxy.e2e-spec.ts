import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { jpeg } from '../utilidades/archivos.js';
import { bearer, conSesion } from '../utilidades/usuarios.js';

describe('AGENTS §18.2 — CONFIAR_PROXY: las URLs de archivos salen https detrás del proxy', () => {
  describe('con CONFIAR_PROXY=true', () => {
    let c: AppDePrueba;
    beforeAll(
      async () => (c = await crearApp({ entorno: { CONFIAR_PROXY: 'true' } })),
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

  describe('sin CONFIAR_PROXY', () => {
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
