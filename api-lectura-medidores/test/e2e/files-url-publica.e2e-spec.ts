import { type AppDePrueba, crearApp } from '../utilities/create-app.js';
import { jpeg } from '../utilities/files.js';
import { bearer, conSesion } from '../utilities/users.js';

describe('AGENTS §8 — Con PUBLIC_URL, las URLs de archivos salen con esa dirección', () => {
  let c: AppDePrueba;
  beforeAll(
    async () =>
      (c = await crearApp({
        entorno: { PUBLIC_URL: 'https://medidores.ejemplo.com' },
      })),
  );
  afterAll(() => c.cerrar());

  it('ignora el Host del pedido', async () => {
    const { token } = await conSesion(c, 'lector');
    const r = await c
      .http()
      .post('/archivos')
      .set(bearer(token))
      .set('Host', '10.0.0.5:3000')
      .attach('archivo', jpeg(), 'f.jpg')
      .expect(201);
    expect(r.body.datos.url).toMatch(
      /^https:\/\/medidores\.ejemplo\.com\/archivos\/imagenes\//,
    );
  });
});
