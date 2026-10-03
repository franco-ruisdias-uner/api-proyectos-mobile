import { ALMACEN_ARCHIVOS } from '../../src/comun/archivos/almacen-archivos.js';
import { Reloj } from '../../src/comun/reloj/reloj.js';
import { sembrar } from '../../src/semillas/sembrar.js';
import { esperarContrato } from '../utilidades/contrato.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';

describe('ESPECIFICACION §8 — Semillas de M3: cuenta y favoritos', () => {
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

  const yo = async (email: string) => {
    const ingreso = await t
      .http()
      .post('/auth/ingreso')
      .send({ email, contrasena: 'demo1234' })
      .expect(200);
    esperarContrato(ingreso.body, 'Sesion');
    return ingreso.body.datos.usuario;
  };

  it('Marta tiene favoritos y rubros de interés que existen', async () => {
    const marta = await yo('marta@mail.com');
    expect(marta.favoritos).toEqual(['com-118', 'com-101']);
    expect(marta.rubrosDeInteres).toEqual(['rub-ferreteria', 'rub-gastronomia']);
    for (const id of marta.favoritos) await t.http().get(`/comercios/${id}`).expect(200);
  });

  it('caso feo: un vecino sin favoritos ni rubros', async () => {
    const nuevo = await yo('nuevo@demo.ar');
    expect(nuevo.favoritos).toEqual([]);
    expect(nuevo.rubrosDeInteres).toEqual([]);
  });

  it('las cuentas de comercio tienen las listas vacías', async () => {
    const c = await yo('tornillo@demo.ar');
    expect(c.favoritos).toEqual([]);
  });
});
