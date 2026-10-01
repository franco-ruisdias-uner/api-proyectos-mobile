import { ArchivosServicio } from '../../src/comun/archivos/archivos.servicio.js';
import { CONTRASENA_DE_DEMO } from '../../src/semillas/datos/usuarios.js';
import { sembrar } from '../../src/semillas/sembrar.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { esperarContrato } from '../utilidades/contrato.js';

// Espec. §8: reportes de demora de demo. AGENTS §10.4: cada registro cumple el contrato.

let ctx: AppDePrueba;
beforeAll(async () => {
  ctx = await crearApp();
  await sembrar(ctx.dataSource, ctx.reloj, ctx.app.get(ArchivosServicio));
});
afterAll(() => ctx.cerrar());

const ids = (cuerpo: { datos: { id: string }[] }) => cuerpo.datos.map((a) => a.id);

describe('Espec. §8 — reportes de demora de demo', () => {
  it('los recientes de par-101 cumplen el contrato, el más nuevo primero', async () => {
    const r = await ctx.http.get('/reportes-demora').query({ paradaId: 'par-101' }).expect(200);
    esperarContrato(r.body, 'ReporteDeDemora');
    expect(ids(r.body)).toEqual(['rep-3394', 'rep-3392', 'rep-3390', 'rep-3391']);
  });

  it('rep-3390 es de Julián (usr-320), en la línea 5, con confirmaciones', async () => {
    const r = await ctx.http.get('/reportes-demora').query({ lineaId: 'lin-05' }).expect(200);
    expect(r.body.datos.find((x: { id: string }) => x.id === 'rep-3390')).toMatchObject({
      usuarioId: 'usr-320',
      lineaId: 'lin-05',
      paradaId: 'par-101',
      motivo: 'no_paso',
      comentario: 'Hace 25 minutos que espero',
      fotoUri: null,
      confirmaciones: 2,
      sincronizado: true,
    });
  });

  it('rep-3394 trae foto: la URL es de la API y se descarga', async () => {
    const r = await ctx.http.get('/reportes-demora').query({ paradaId: 'par-101' }).expect(200);
    const reporte = r.body.datos.find((x: { id: string }) => x.id === 'rep-3394');
    expect(reporte.fotoUri).toMatch(/^http:\/\/.+\/archivos\/imagenes\/.+\.png$/);
    const ruta = new URL(reporte.fotoUri).pathname;
    const foto = await ctx.http.get(ruta).expect(200);
    expect(foto.headers['content-type']).toBe('image/png');
  });

  it('hay uno viejo que no se muestra ni se puede confirmar', async () => {
    const r = await ctx.http.get('/reportes-demora').query({ paradaId: 'par-101' });
    expect(ids(r.body)).not.toContain('rep-3393');
    const ingreso = await ctx.http
      .post('/auth/ingreso')
      .send({ email: 'transporte@parana.demo.ar', contrasena: CONTRASENA_DE_DEMO })
      .expect(200);
    const token = ingreso.body.datos.token as string;
    const c = await ctx.http
      .post('/reportes-demora/rep-3393/confirmaciones')
      .set('Authorization', `Bearer ${token}`);
    expect(c.body.error.codigo).toBe('REPORTE_VENCIDO');
  });

  it('Julián puede confirmar el reporte de Usuario Nuevo', async () => {
    const ingreso = await ctx.http
      .post('/auth/ingreso')
      .send({ email: 'julian@mail.com', contrasena: CONTRASENA_DE_DEMO })
      .expect(200);
    const r = await ctx.http
      .post('/reportes-demora/rep-3392/confirmaciones')
      .set('Authorization', `Bearer ${ingreso.body.datos.token}`)
      .expect(201);
    esperarContrato(r.body, 'ReporteDeDemora');
    expect(r.body.datos.confirmaciones).toBe(1);
  });

  it('una parada sin reportes da lista vacía', async () => {
    const r = await ctx.http.get('/reportes-demora').query({ paradaId: 'par-102' }).expect(200);
    expect(r.body.datos).toEqual([]);
  });

  it('el resumen para la Dirección cumple el contrato', async () => {
    const ingreso = await ctx.http
      .post('/auth/ingreso')
      .send({ email: 'transporte@parana.demo.ar', contrasena: CONTRASENA_DE_DEMO })
      .expect(200);
    const r = await ctx.http
      .get('/reportes-demora/resumen')
      .set('Authorization', `Bearer ${ingreso.body.datos.token}`)
      .expect(200);
    esperarContrato(r.body, 'ResumenDemoras');
    expect(r.body.datos[0]).toMatchObject({ lineaId: 'lin-05', paradaId: null, cantidad: 3 });
  });
});
