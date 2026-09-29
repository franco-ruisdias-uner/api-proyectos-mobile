import { crearApp, type AppDePrueba } from '../utilidades/crear-app.js';
import { esperarContrato, esperarForma } from '../utilidades/contrato.js';
import { Cuadrilla } from '../../src/modulos/catalogos/cuadrilla.entidad.js';
import { Zona } from '../../src/modulos/catalogos/zona.entidad.js';
import { sembrar } from '../../src/semillas/sembrar.js';
import {
  USUARIOS_DEMO,
  CONTRASENA_DEMO,
} from '../../src/semillas/datos/usuarios.js';
import { Usuario } from '../../src/modulos/usuarios/usuario.entidad.js';
import { aUsuario } from '../../src/modulos/usuarios/usuarios.mapeador.js';
import { AlmacenArchivos } from '../../src/comun/archivos/almacen-archivos.js';
import { Reloj } from '../../src/comun/reloj/reloj.js';
import { Reporte } from '../../src/modulos/reportes/reporte.entidad.js';
import { ServicioZonas } from '../../src/modulos/catalogos/zonas.servicio.js';
import { anioMesEnZona } from '../../src/comun/fechas/fechas.js';

let ctx: AppDePrueba;
beforeAll(async () => {
  ctx = await crearApp();
});
afterAll(() => ctx.cerrar());

describe('AGENTS §5.2 — El esquema es estable en el motor', () => {
  it('después de sincronizar no queda ninguna consulta pendiente', async () => {
    const pendientes = await ctx.dataSource.driver.createSchemaBuilder().log();
    expect(pendientes.upQueries.map((q) => q.query)).toEqual([]);
  });
});

describe('AGENTS §10.4 — Las semillas de demo cumplen el contrato', () => {
  beforeAll(async () => {
    await sembrar(
      ctx.dataSource,
      ctx.app.get(AlmacenArchivos),
      ctx.app.get(Reloj),
    );
  });

  it('cada usuario sembrado es un Usuario del PRD', async () => {
    const usuarios = await ctx.dataSource.getRepository(Usuario).find();
    expect(usuarios.length).toBeGreaterThanOrEqual(USUARIOS_DEMO.length);
    for (const u of usuarios) esperarForma(aUsuario(u), 'Usuario');
  });

  it('ESPECIFICACION §8 — los ids y roles de los usuarios de demo', async () => {
    const porEmail = new Map(
      (await ctx.dataSource.getRepository(Usuario).find()).map((u) => [
        u.email,
        u,
      ]),
    );
    expect(porEmail.get('norma@mail.com')).toMatchObject({
      id: 'usr-084',
      nombre: 'Norma Pereyra',
      rol: 'vecino',
    });
    expect(porEmail.get('operador.norte@demo.ar')).toMatchObject({
      id: 'usr-003',
      rol: 'operador',
      zonaId: 'zon-norte',
    });
    expect(porEmail.get('operador.sur@demo.ar')).toMatchObject({
      rol: 'operador',
    });
    expect(porEmail.get('operador.sur@demo.ar')?.zonaId).not.toBe('zon-norte');
    expect(porEmail.get('nuevo@demo.ar')).toMatchObject({
      rol: 'vecino',
      zonaId: null,
    });
  });

  it('cada usuario de demo entra con su contraseña y /yo cumple el contrato', async () => {
    for (const { email } of USUARIOS_DEMO) {
      const ingreso = await ctx
        .http()
        .post('/auth/ingreso')
        .send({ email, contrasena: CONTRASENA_DEMO });
      expect(ingreso.status).toBe(200);
      const yo = await ctx
        .http()
        .get('/yo')
        .set('Authorization', `Bearer ${ingreso.body.datos.token}`);
      esperarContrato(yo, 'Usuario');
    }
  });

  it('ESPECIFICACION §8 — los catálogos sembrados cumplen el contrato y salen por la API', async () => {
    const op = await ctx
      .http()
      .post('/auth/ingreso')
      .send({ email: 'operador.norte@demo.ar', contrasena: CONTRASENA_DEMO });
    const auth = ['Authorization', `Bearer ${op.body.datos.token}`] as const;
    const tipos = await ctx.http().get('/tipos-de-reporte');
    esperarContrato(tipos, 'TipoDeReporte');
    expect(tipos.body.meta.total).toBe(8);
    const zonas = await ctx.http().get('/zonas');
    esperarContrato(zonas, 'Zona');
    expect(zonas.body.meta.total).toBe(4);
    const cuadrillas = await ctx
      .http()
      .get('/cuadrillas')
      .set(...auth);
    esperarContrato(cuadrillas, 'Cuadrilla');
    expect(
      cuadrillas.body.datos.find((c: { id: string }) => c.id === 'cua-02'),
    ).toMatchObject({ nombre: 'Cuadrilla 2 — Bacheo', zonaId: 'zon-norte' });
  });

  describe('ESPECIFICACION §8 — los reportes de demo', () => {
    interface R {
      id: string;
      codigo: string;
      estado: string;
      zonaId: string;
      autorId: string;
      audioUrl: string | null;
      duplicadoDe: string | null;
      fotos: { id: string; url: string; momento: string }[];
      coordenadas: { latitud: number; longitud: number };
    }
    let todos: R[];
    let auth: readonly [string, string];

    beforeAll(async () => {
      const norma = await ctx
        .http()
        .post('/auth/ingreso')
        .send({ email: 'norma@mail.com', contrasena: CONTRASENA_DEMO });
      auth = ['Authorization', `Bearer ${norma.body.datos.token}`];
      const filas = await ctx.dataSource.getRepository(Reporte).find();
      todos = [];
      for (const f of filas) {
        const res = await ctx.http().get(`/reportes/${f.id}`);
        esperarContrato(res, 'Reporte');
        todos.push(res.body.datos);
      }
    });

    it('cada reporte y cada cambio sembrado cumple el contrato', async () => {
      expect(todos.length).toBeGreaterThanOrEqual(12);
      for (const r of todos) {
        const cambios = await ctx.http().get(`/reportes/${r.id}/cambios`);
        esperarContrato(cambios, 'CambioDeEstado');
        expect(cambios.body.datos.length, r.id).toBeGreaterThanOrEqual(1);
        expect(cambios.body.datos[0].estado).toBe('recibido');
        expect(cambios.body.datos.at(-1).estado, r.id).toBe(r.estado);
      }
    });

    it('el del PRD: rep-00412 con fot-901, cam-1177 y la Cuadrilla 2, con el código del año en curso', async () => {
      const r = todos.find((x) => x.id === 'rep-00412');
      expect(r?.codigo).toBe(
        `GCHU-${anioMesEnZona(ctx.reloj.ahora()).anio}-00412`,
      );
      expect(r?.fotos.map((f) => f.id)).toEqual(['fot-901']);
      const cambios = await ctx.http().get('/reportes/rep-00412/cambios');
      expect(cambios.body.datos.map((c: { id: string }) => c.id)).toContain(
        'cam-1177',
      );
      const { cuadrillaId } = await ctx.dataSource
        .getRepository(Reporte)
        .findOneByOrFail({ id: 'rep-00412' });
      expect(cuadrillaId).toBe('cua-02');
    });

    it('cubre los cinco estados y las cuatro zonas, y la zona sembrada es la que contiene el punto', async () => {
      expect(new Set(todos.map((r) => r.estado))).toEqual(
        new Set([
          'recibido',
          'en_revision',
          'asignado',
          'resuelto',
          'rechazado',
        ]),
      );
      expect(new Set(todos.map((r) => r.zonaId))).toEqual(
        new Set(['zon-norte', 'zon-este', 'zon-sur', 'zon-oeste']),
      );
      const zonas = ctx.app.get(ServicioZonas);
      for (const r of todos) {
        expect((await zonas.zonaDe(r.coordenadas))?.id, r.id).toBe(r.zonaId);
      }
    });

    it('los códigos no se repiten', () => {
      expect(new Set(todos.map((r) => r.codigo)).size).toBe(todos.length);
    });

    it('caso feo: uno con cinco cambios (con reasignación y foto del arreglo)', async () => {
      const r = todos.find((x) => x.fotos.some((f) => f.momento === 'arreglo'));
      expect(r?.estado).toBe('resuelto');
      const cambios = await ctx.http().get(`/reportes/${r?.id}/cambios`);
      expect(
        cambios.body.datos.map((c: { estado: string }) => c.estado),
      ).toEqual([
        'recibido',
        'en_revision',
        'asignado',
        'asignado',
        'resuelto',
      ]);
    });

    it('caso feo: un rechazado con un motivo de más de 400 caracteres', async () => {
      const r = todos.find(
        (x) => x.estado === 'rechazado' && x.duplicadoDe === null,
      );
      const cambios = await ctx.http().get(`/reportes/${r?.id}/cambios`);
      expect(cambios.body.datos.at(-1).comentario.length).toBeGreaterThan(400);
    });

    it('caso feo: un vecino sin reportes y Norma con varios', async () => {
      const nuevo = await ctx
        .http()
        .post('/auth/ingreso')
        .send({ email: 'nuevo@demo.ar', contrasena: CONTRASENA_DEMO });
      const vacia = await ctx
        .http()
        .get('/yo/reportes')
        .set('Authorization', `Bearer ${nuevo.body.datos.token}`);
      expect(vacia.body.datos).toEqual([]);
      const suyos = await ctx
        .http()
        .get('/yo/reportes')
        .set(...auth);
      esperarContrato(suyos, 'Reporte');
      expect(suyos.body.meta.total).toBeGreaterThanOrEqual(4);
      expect(
        new Set(suyos.body.datos.map((r: R) => r.estado)).size,
      ).toBeGreaterThanOrEqual(3);
    });

    it('la mayoría sin audio, uno con audio y uno con dos fotos; las fotos y el audio se pueden bajar', async () => {
      const conAudio = todos.filter((r) => r.audioUrl !== null);
      expect(conAudio).toHaveLength(1);
      expect(todos.filter((r) => r.audioUrl === null).length).toBeGreaterThan(
        todos.length / 2,
      );
      expect(todos.some((r) => r.fotos.length === 2)).toBe(true);
      const audio = await ctx
        .http()
        .get(new URL(conAudio[0].audioUrl!).pathname);
      expect(audio.status).toBe(200);
      const foto = await ctx
        .http()
        .get(new URL(todos[0].fotos[0].url).pathname);
      expect(foto.status).toBe(200);
      expect(foto.headers['content-type']).toBe('image/png');
    });

    it('cinco baches a menos de 50 m entre sí, uno marcado como duplicado', () => {
      const baches = todos.filter(
        (r) =>
          r.coordenadas.latitud > -33.0095 &&
          r.coordenadas.latitud < -33.0085 &&
          r.coordenadas.longitud > -58.5147 &&
          r.coordenadas.longitud < -58.5137,
      );
      // Cinco baches del caso «catorce baches repetidos», más el del PRD.
      expect(baches.length).toBeGreaterThanOrEqual(5);
      const metros = (a: R['coordenadas'], b: R['coordenadas']) =>
        Math.hypot(
          (a.latitud - b.latitud) * 111_195,
          (a.longitud - b.longitud) *
            111_195 *
            Math.cos((a.latitud * Math.PI) / 180),
        );
      for (const a of baches)
        for (const b of baches)
          expect(metros(a.coordenadas, b.coordenadas)).toBeLessThan(50);
      expect(baches.filter((r) => r.duplicadoDe !== null)).toHaveLength(1);
    });
  });

  it('sembrar dos veces no duplica ni falla', async () => {
    const antes = await ctx.dataSource.getRepository(Usuario).count();
    const reportesAntes = await ctx.dataSource.getRepository(Reporte).count();
    await sembrar(
      ctx.dataSource,
      ctx.app.get(AlmacenArchivos),
      ctx.app.get(Reloj),
    );
    expect(await ctx.dataSource.getRepository(Usuario).count()).toBe(antes);
    expect(await ctx.dataSource.getRepository(Zona).count()).toBe(4);
    expect(await ctx.dataSource.getRepository(Cuadrilla).count()).toBe(9);
    expect(await ctx.dataSource.getRepository(Reporte).count()).toBe(
      reportesAntes,
    );
  });
});
