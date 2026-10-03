import { ALMACEN_ARCHIVOS } from '../../src/comun/archivos/almacen-archivos.js';
import { Reloj } from '../../src/comun/reloj/reloj.js';
import { sembrar } from '../../src/semillas/sembrar.js';
import { esperarContrato } from '../utilidades/contrato.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';

describe('ESPECIFICACION §8 — Semillas completas (M9)', () => {
  let t: AppDePrueba;
  beforeAll(async () => {
    t = await crearApp();
    await sembrar({
      dataSource: t.dataSource,
      reloj: t.app.get(Reloj),
      almacen: t.app.get(ALMACEN_ARCHIVOS),
    });
  });
  afterAll(() => t.cerrar());

  const ingresar = async (email: string) =>
    (await t.http().post('/auth/ingreso').send({ email, contrasena: 'demo1234' }).expect(200)).body
      .datos;

  it.each([
    ['marta@mail.com', 'vecino', null],
    ['nuevo@demo.ar', 'vecino', null],
    ['tornillo@demo.ar', 'comercio', 'com-118'],
    ['otro.comercio@demo.ar', 'comercio', 'com-201'],
  ])(
    '%s ingresa con la contraseña de demo y su /yo cumple el contrato',
    async (email, rol, comercioId) => {
      const { token, usuario } = await ingresar(email);
      expect(usuario).toMatchObject({ rol, comercioId });
      const res = await t.http().get('/yo').set('Authorization', `Bearer ${token}`).expect(200);
      esperarContrato(res.body, 'Usuario');
    },
  );

  it('el panel de cada comercio de demo devuelve su ficha y sus promos válidas', async () => {
    for (const [email, id] of [
      ['tornillo@demo.ar', 'com-118'],
      ['otro.comercio@demo.ar', 'com-201'],
    ]) {
      const { token } = await ingresar(email);
      const ficha = await t
        .http()
        .get('/mi-comercio')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      esperarContrato(ficha.body, 'Comercio');
      expect(ficha.body.datos.id).toBe(id);
      const promos = await t
        .http()
        .get('/mi-comercio/promociones')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      esperarContrato(promos.body, 'Promocion');
      expect(promos.body.datos.length).toBeGreaterThan(0);
    }
  });

  it('el comercio de demo con más promos tiene vencidas y dadas de baja en su panel', async () => {
    const { token } = await ingresar('tornillo@demo.ar');
    const res = await t
      .http()
      .get('/mi-comercio/promociones?porPagina=100')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.datos.some((p: { activa: boolean }) => !p.activa)).toBe(true);
    expect(res.body.datos.some((p: { hasta: string }) => new Date(p.hasta) < new Date())).toBe(
      true,
    );
  });

  it('hay comercios con video de muestra, que se baja entero y por rango (206)', async () => {
    const res = await t.http().get('/comercios?porPagina=1000').expect(200);
    const conVideo = res.body.datos.filter((c: { videoUrl: string | null }) => c.videoUrl);
    expect(conVideo.length).toBeGreaterThanOrEqual(2);
    expect(res.body.datos.some((c: { videoUrl: string | null }) => c.videoUrl === null)).toBe(true);
    const ruta = new URL(conVideo[0].videoUrl).pathname;
    const entero = await t.http().get(ruta).expect(200);
    expect(entero.headers['content-type']).toBe('video/mp4');
    const rango = await t.http().get(ruta).set('Range', 'bytes=0-7').expect(206);
    expect(rango.headers['content-range']).toMatch(/^bytes 0-7\/\d+$/);
    expect(rango.body.length ?? rango.text.length).toBe(8);
  });

  it('el catálogo de medios de pago sembrado sólo usa el catálogo fijo (D11)', async () => {
    const res = await t.http().get('/comercios?porPagina=1000').expect(200);
    const permitidos = ['efectivo', 'debito', 'credito', 'transferencia', 'billetera_virtual'];
    for (const c of res.body.datos) {
      for (const m of c.mediosDePago) expect(permitidos).toContain(m);
    }
  });
});
