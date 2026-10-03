import { ALMACEN_ARCHIVOS } from '../../src/comun/archivos/almacen-archivos.js';
import { Reloj } from '../../src/comun/reloj/reloj.js';
import { Promocion } from '../../src/modulos/promociones/promocion.entidad.js';
import { UsoDePromocion } from '../../src/modulos/usos/uso-de-promocion.entidad.js';
import { sembrar } from '../../src/semillas/sembrar.js';
import { esperarContrato } from '../utilidades/contrato.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';

describe('ESPECIFICACION §8 — Semillas de M6: usos de promociones', () => {
  let t: AppDePrueba;
  let tokenMarta: string;
  beforeAll(async () => {
    t = await crearApp();
    await sembrar({
      dataSource: t.dataSource,
      reloj: t.app.get(Reloj),
      almacen: t.app.get(ALMACEN_ARCHIVOS),
    });
    const ingreso = await t
      .http()
      .post('/auth/ingreso')
      .send({ email: 'marta@mail.com', contrasena: 'demo1234' })
      .expect(200);
    tokenMarta = ingreso.body.datos.token;
  });
  afterAll(() => t.cerrar());

  it('cada uso de Marta es válido contra el contrato; uso-7781 está sin validar', async () => {
    const res = await t
      .http()
      .get('/yo/usos')
      .set('Authorization', `Bearer ${tokenMarta}`)
      .expect(200);
    esperarContrato(res.body, 'UsoDePromocion');
    const porId = Object.fromEntries(res.body.datos.map((u: { id: string }) => [u.id, u]));
    expect(porId['uso-7781']).toMatchObject({
      promocionId: 'pro-441',
      usuarioId: 'usr-512',
      validadoEn: null,
    });
    expect(porId['uso-7781'].codigo).toMatch(/^CCU-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(res.body.datos.some((u: { validadoEn: string | null }) => u.validadoEn)).toBe(true);
  });

  it('cada uso sembrado es válido contra el contrato (validados y pendientes)', async () => {
    const usos = await t.dataSource.getRepository(UsoDePromocion).find();
    expect(usos.some((u) => u.validadoEn === null)).toBe(true);
    expect(usos.some((u) => u.validadoEn !== null)).toBe(true);
    expect(new Set(usos.map((u) => u.codigo)).size).toBe(usos.length);
  });

  it('R13: `usos` de cada promo es la cantidad de usos validados', async () => {
    const promos = await t.dataSource.getRepository(Promocion).find();
    for (const p of promos) {
      const validados = await t.dataSource
        .getRepository(UsoDePromocion)
        .findBy({ promocionId: p.id })
        .then((u) => u.filter((x) => x.validadoEn !== null).length);
      expect(p.usos, p.id).toBe(validados);
    }
    expect(promos.find((p) => p.id === 'pro-441')?.usos).toBe(23);
  });

  it('el comercio valida en la demo el código de Marta y el uso queda registrado', async () => {
    const ingreso = await t
      .http()
      .post('/auth/ingreso')
      .send({ email: 'tornillo@demo.ar', contrasena: 'demo1234' })
      .expect(200);
    const auth = { Authorization: `Bearer ${ingreso.body.datos.token}` };
    const uso = await t
      .http()
      .post('/mi-comercio/usos/validar')
      .set(auth)
      .send({ codigo: 'CCU-7KQ4-M9XH' })
      .expect(200);
    esperarContrato(uso.body, 'UsoDePromocion');
    expect(uso.body.datos.id).toBe('uso-7781');
    expect((await t.http().get('/promociones/pro-441')).body.datos.usos).toBe(24);
  });
});
