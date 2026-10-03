import { ALMACEN_ARCHIVOS } from '../../src/comun/archivos/almacen-archivos.js';
import { Reloj } from '../../src/comun/reloj/reloj.js';
import { promedioDeEstrellas } from '../../src/modulos/resenas/reglas/resenas.js';
import { sembrar } from '../../src/semillas/sembrar.js';
import { esperarContrato } from '../utilidades/contrato.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';

interface ResenaJson {
  id: string;
  usuarioId: string;
  estrellas: number;
  respuesta: string | null;
  reportada: boolean;
}

describe('ESPECIFICACION §8 — Semillas de M4: reseñas', () => {
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

  const resenas = async (comercioId: string): Promise<ResenaJson[]> => {
    const res = await t.http().get(`/comercios/${comercioId}/resenas?porPagina=100`).expect(200);
    esperarContrato(res.body, 'Resena');
    return res.body.datos;
  };
  const comercio = async (id: string) =>
    (await t.http().get(`/comercios/${id}`).expect(200)).body.datos;

  it('cada reseña sembrada cumple el contrato y cada comercio tiene el puntaje de sus reseñas (R8)', async () => {
    const lista = await t.http().get('/comercios?porPagina=1000').expect(200);
    const baja = await comercio('com-139');
    for (const c of [...lista.body.datos, baja]) {
      const propias = await resenas(c.id);
      expect([c.puntaje, c.cantidadResenas], c.id).toEqual([
        promedioDeEstrellas(propias.map((r) => r.estrellas)),
        propias.length,
      ]);
    }
  });

  it('PRD: res-2210 de Marta en com-118, con respuesta; com-118 tiene 12 reseñas', async () => {
    const lista = await resenas('com-118');
    expect(lista).toHaveLength(12);
    const r = lista.find((x) => x.id === 'res-2210');
    expect(r).toMatchObject({ usuarioId: 'usr-512', estrellas: 5, reportada: false });
    expect(r?.respuesta).toEqual(expect.any(String));
  });

  it('caso feo: un comercio sin reseñas (lista vacía, puntaje 0)', async () => {
    expect(await resenas('com-104')).toEqual([]);
    expect((await comercio('com-104')).puntaje).toBe(0);
  });

  it('caso feo: un comercio con muchas reseñas', async () => {
    expect((await resenas('com-125')).length).toBeGreaterThanOrEqual(50);
  });

  it('caso feo: una reseña reportada (sigue visible) y reseñas sin respuesta', async () => {
    const lista = await resenas('com-125');
    expect(lista.filter((r) => r.reportada)).toHaveLength(1);
    expect(lista.some((r) => r.respuesta === null)).toBe(true);
  });

  it('Marta ya reseñó com-118: no puede dejar otra; nuevo@demo.ar sí puede', async () => {
    const ingreso = async (email: string) =>
      (await t.http().post('/auth/ingreso').send({ email, contrasena: 'demo1234' }).expect(200))
        .body.datos.token;
    const marta = await ingreso('marta@mail.com');
    await t
      .http()
      .post('/comercios/com-118/resenas')
      .set('Authorization', `Bearer ${marta}`)
      .send({ estrellas: 1, comentario: 'Otra.' })
      .expect(409);
    const nuevo = await ingreso('nuevo@demo.ar');
    await t
      .http()
      .post('/comercios/com-118/resenas')
      .set('Authorization', `Bearer ${nuevo}`)
      .send({ estrellas: 4, comentario: 'Mi primera reseña.' })
      .expect(201);
    expect((await comercio('com-118')).cantidadResenas).toBe(13);
  });

  it('el comercio puede responder una reseña sembrada sin respuesta', async () => {
    const ingreso = await t
      .http()
      .post('/auth/ingreso')
      .send({ email: 'tornillo@demo.ar', contrasena: 'demo1234' })
      .expect(200);
    const sin = (await resenas('com-118')).find((r) => r.respuesta === null)!;
    await t
      .http()
      .post(`/resenas/${sin.id}/respuesta`)
      .set('Authorization', `Bearer ${ingreso.body.datos.token}`)
      .send({ respuesta: 'Gracias por la visita.' })
      .expect(200);
  });
});
