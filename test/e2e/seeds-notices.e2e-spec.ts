import { ArchivosServicio } from '../../src/common/files/files.service.js';
import { CONTRASENA_DE_DEMO } from '../../src/seeds/data/users.js';
import { sembrar } from '../../src/seeds/seed.js';
import { type AppDePrueba, crearApp } from '../utilities/create-app.js';
import { esperarContrato } from '../utilities/contract.js';

// Espec. §8: avisos de demo y casos feos. AGENTS §10.4: cada registro cumple el contrato.

let ctx: AppDePrueba;
beforeAll(async () => {
  ctx = await crearApp();
  await sembrar(ctx.dataSource, ctx.reloj, ctx.app.get(ArchivosServicio));
});
afterAll(() => ctx.cerrar());

const ids = (cuerpo: { datos: { id: string }[] }) => cuerpo.datos.map((a) => a.id);

describe('Espec. §8 — avisos de demo', () => {
  it('cada aviso sembrado cumple el contrato', async () => {
    const r = await ctx.http.get('/avisos').query({ estado: 'todos' }).expect(200);
    esperarContrato(r.body, 'Aviso');
    expect(r.body.meta.total).toBe(5);
  });

  it('vigentes: suspensión, desvío e informativo, en ese orden', async () => {
    const r = await ctx.http.get('/avisos').expect(200);
    expect(ids(r.body)).toEqual(['avi-090', 'avi-088', 'avi-089']);
  });

  it('hay un aviso próximo y uno terminado', async () => {
    expect(ids((await ctx.http.get('/avisos').query({ estado: 'proximos' })).body)).toEqual([
      'avi-091',
    ]);
    const todos = ids((await ctx.http.get('/avisos').query({ estado: 'todos' })).body);
    expect(todos).toContain('avi-092');
    const vigentes = ids((await ctx.http.get('/avisos')).body);
    expect(vigentes).not.toContain('avi-092');
  });

  it('avi-088 es el desvío por obra en Corrientes de las líneas 2, 7 y 9, con trazado y video', async () => {
    const r = await ctx.http.get('/avisos/avi-088').expect(200);
    esperarContrato(r.body, 'Aviso');
    expect(r.body.datos).toMatchObject({
      id: 'avi-088',
      titulo: 'Desvío por obra en calle Corrientes',
      detalle: expect.stringContaining('desvían por Santa Fe'),
      lineaIds: ['lin-02', 'lin-07', 'lin-09'],
      gravedad: 'desvio',
    });
    expect(r.body.datos.trazadoAlternativo.length).toBeGreaterThanOrEqual(2);
    // El punto del ejemplo del PRD.
    expect(r.body.datos.trazadoAlternativo).toContainEqual({
      latitud: -31.7345,
      longitud: -60.523,
    });
    expect(r.body.datos.videoUrl).toMatch(/\/archivos\/videos\/.+\.mp4$/);
  });

  it('el video de avi-088 existe y se sirve con Range (206)', async () => {
    const aviso = (await ctx.http.get('/avisos/avi-088')).body.datos;
    const ruta = new URL(aviso.videoUrl).pathname;
    const completo = await ctx.http.get(ruta).expect(200);
    expect(completo.headers['content-type']).toBe('video/mp4');
    const parte = await ctx.http.get(ruta).set('Range', 'bytes=0-99').expect(206);
    expect(parte.headers['content-range']).toMatch(/^bytes 0-99\//);
  });

  it('hay un aviso sin video y uno de suspensión', async () => {
    const sinVideo = (await ctx.http.get('/avisos/avi-089')).body.datos;
    expect(sinVideo.videoUrl).toBeNull();
    const suspension = (await ctx.http.get('/avisos/avi-090')).body.datos;
    expect(suspension).toMatchObject({ gravedad: 'suspension', lineaIds: ['lin-08'] });
  });

  it('las fechas son relativas al reloj: con otro "hoy", la demo sigue teniendo vigentes', async () => {
    const otra = await crearApp({ ahora: '2026-12-24T22:00:00-03:00' });
    try {
      await sembrar(otra.dataSource, otra.reloj, otra.app.get(ArchivosServicio));
      const r = await otra.http.get('/avisos').expect(200);
      expect(ids(r.body)).toEqual(['avi-090', 'avi-088', 'avi-089']);
    } finally {
      await otra.cerrar();
    }
  });

  it('la Dirección de demo puede publicar y terminar un aviso', async () => {
    const sesion = await ctx.http
      .post('/auth/ingreso')
      .send({ email: 'transporte@parana.demo.ar', contrasena: CONTRASENA_DE_DEMO })
      .expect(200);
    const auth = { Authorization: `Bearer ${sesion.body.datos.token}` };
    const creado = await ctx.http
      .post('/avisos')
      .set(auth)
      .send({
        titulo: 'Prueba',
        detalle: 'Aviso de prueba.',
        lineaIds: ['lin-05'],
        desde: '2026-09-19T09:00:00-03:00',
        gravedad: 'informativo',
      })
      .expect(201);
    await ctx.http.post(`/avisos/${creado.body.datos.id}/finalizar`).set(auth).expect(200);
  });
});
