import { ALMACEN_ARCHIVOS } from '../../src/comun/archivos/almacen-archivos.js';
import { Reloj } from '../../src/comun/reloj/reloj.js';
import { sembrar } from '../../src/semillas/sembrar.js';
import { esperarContrato } from '../utilidades/contrato.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';

describe('ESPECIFICACION §8 — Semillas de M2: promociones', () => {
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

  const ids = async (consulta: string) =>
    ((await t.http().get(`/promociones?${consulta}`).expect(200)).body.datos as { id: string }[])
      .map((p) => p.id)
      .sort();

  it('cada promo visible es válida contra el contrato', async () => {
    for (const estado of ['vigentes', 'proximas', 'por-vencer']) {
      const res = await t.http().get(`/promociones?estado=${estado}&porPagina=100`).expect(200);
      esperarContrato(res.body, 'Promocion');
      expect(res.body.datos.length).toBeGreaterThan(0);
    }
  });

  it('pro-441 «15% en pinturas» de com-118, vigente y con foto que se puede bajar', async () => {
    const res = await t.http().get('/promociones/pro-441').expect(200);
    esperarContrato(res.body, 'Promocion');
    expect(res.body.datos).toMatchObject({
      comercioId: 'com-118',
      titulo: '15% en pinturas',
      descuento: 15,
      activa: true,
    });
    const foto = await t.http().get(new URL(res.body.datos.imagenUrl).pathname).expect(200);
    expect(foto.headers['content-type']).toBe('image/png');
  });

  it('hay vigentes, por vencer y próximas', async () => {
    expect(await ids('estado=vigentes&porPagina=100')).toEqual(
      ['pro-441', 'pro-442', 'pro-443', 'pro-444', 'pro-450'].sort(),
    );
    expect(await ids('estado=por-vencer')).toEqual(['pro-442', 'pro-444']);
    expect(await ids('estado=proximas')).toEqual(['pro-445', 'pro-446']);
  });

  it('caso feo: una vencida no aparece y su detalle da 410', async () => {
    for (const estado of ['vigentes', 'proximas', 'por-vencer'])
      expect(await ids(`estado=${estado}&porPagina=100`)).not.toContain('pro-447');
    await t.http().get('/promociones/pro-447').expect(410);
  });

  it('caso feo: una dada de baja y una de un comercio dado de baja dan 404', async () => {
    await t.http().get('/promociones/pro-448').expect(404);
    await t.http().get('/promociones/pro-449').expect(404);
    expect(await ids('porPagina=100')).not.toContain('pro-448');
    expect(await ids('porPagina=100')).not.toContain('pro-449');
  });

  it('hay soloApp y no, con y sin descuento', async () => {
    const res = await t.http().get('/promociones?porPagina=100').expect(200);
    const datos = res.body.datos as { soloApp: boolean; descuento: number | null }[];
    expect(datos.some((p) => p.soloApp)).toBe(true);
    expect(datos.some((p) => !p.soloApp)).toBe(true);
    expect(datos.some((p) => p.descuento === null)).toBe(true);
    expect(datos.some((p) => p.descuento !== null)).toBe(true);
  });

  it('caso feo: un rubro sin promociones da lista vacía', async () => {
    const res = await t.http().get('/promociones?rubroId=rub-libreria').expect(200);
    expect(res.body.datos).toEqual([]);
  });

  it('la cuenta otro.comercio (com-201) tiene una promo soloApp', async () => {
    expect(await ids('comercioId=com-201')).toEqual(['pro-450']);
  });
});
