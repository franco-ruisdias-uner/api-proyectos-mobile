import { ALMACEN_ARCHIVOS } from '../../src/common/files/file-storage.js';
import { Reloj } from '../../src/common/clock/clock.js';
import { sembrar } from '../../src/seeds/seed.js';
import { esperarContrato } from '../utilities/contract.js';
import { type AppDePrueba, crearApp } from '../utilities/create-app.js';

describe('ESPECIFICACION §8 — Semillas de M1: rubros y comercios', () => {
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

  const comercio = async (id: string) =>
    (await t.http().get(`/comercios/${id}`).expect(200)).body.datos;

  it('los 9 rubros del PRD, cada uno válido contra el contrato', async () => {
    const res = await t.http().get('/rubros').expect(200);
    esperarContrato(res.body, 'Rubro');
    expect(res.body.datos).toHaveLength(9);
    expect(res.body.datos.map((r: { id: string }) => r.id)).toContain('rub-ferreteria');
  });

  it('los 40 comercios (39 activos y uno de baja), cada uno válido contra el contrato', async () => {
    const res = await t.http().get('/comercios?porPagina=1000').expect(200);
    esperarContrato(res.body, 'Comercio');
    expect(res.body.meta.total).toBe(39);
    for (const c of res.body.datos) await t.http().get(`/comercios/${c.id}`).expect(200);
    const baja = await t.dataSource.query('SELECT COUNT(*) AS n FROM comercios');
    expect(Number(baja[0].n)).toBe(40);
  });

  it('com-118 Ferretería El Tornillo, con el horario cortado y fotos que se pueden bajar', async () => {
    const c = await comercio('com-118');
    esperarContrato({ datos: c, meta: null }, 'Comercio');
    expect(c.nombre).toBe('Ferretería El Tornillo');
    expect(c.rubroId).toBe('rub-ferreteria');
    expect(c.horarios.filter((h: { dia: number }) => h.dia === 2)).toEqual([
      { dia: 2, abre: '08:00', cierra: '12:00' },
      { dia: 2, abre: '16:30', cierra: '20:30' },
    ]);
    expect(c.imagenes.length).toBeGreaterThan(0);
    const ruta = new URL(c.imagenes[0]).pathname;
    const foto = await t.http().get(ruta).expect(200);
    expect(foto.headers['content-type']).toBe('image/png');
  });

  it('caso feo: un comercio sin fotos ni video', async () => {
    const c = await comercio('com-104');
    expect(c.imagenes).toEqual([]);
    expect(c.videoUrl).toBeNull();
  });

  it('caso feo: uno sin reseñas', async () => {
    const c = await comercio('com-104');
    expect([c.puntaje, c.cantidadResenas]).toEqual([0, 0]);
  });

  it('caso feo: uno con muchas reseñas', async () => {
    expect((await comercio('com-125')).cantidadResenas).toBeGreaterThanOrEqual(50);
  });

  it('caso feo: uno cerrado por vacaciones (horarios vacíos hasta que vuelve)', async () => {
    expect((await comercio('com-138')).horarios).toEqual([]);
    t.reloj.avanzar(13 * 24 * 60 * 60 * 1000);
    expect((await comercio('com-138')).horarios.length).toBeGreaterThan(0);
    t.reloj.avanzar(-13 * 24 * 60 * 60 * 1000);
  });

  it('caso feo: uno dado de baja no está en el listado pero su detalle dice activo: false', async () => {
    const lista = await t.http().get('/comercios?porPagina=1000').expect(200);
    expect(lista.body.datos.map((c: { id: string }) => c.id)).not.toContain('com-139');
    expect((await comercio('com-139')).activo).toBe(false);
  });

  it('variantes de horario: de corrido y con domingos', async () => {
    const corrido = await comercio('com-126');
    expect(corrido.horarios.filter((h: { dia: number }) => h.dia === 3)).toHaveLength(1);
    const domingos = await comercio('com-101');
    expect(domingos.horarios.some((h: { dia: number }) => h.dia === 0)).toBe(true);
  });

  it('el comercio de la cuenta otro.comercio existe (com-201)', async () => {
    expect((await comercio('com-201')).id).toBe('com-201');
  });

  it('las búsquedas de la demo devuelven algo', async () => {
    const res = await t.http().get('/comercios').query({ q: 'pintura' }).expect(200);
    expect(res.body.meta.total).toBeGreaterThan(0);
    const cerca = await t
      .http()
      .get('/comercios')
      .query({ latitud: -32.4825, longitud: -58.2372, radioMetros: 500, orden: 'distancia' })
      .expect(200);
    expect(cerca.body.meta.total).toBeGreaterThan(0);
  });
});
