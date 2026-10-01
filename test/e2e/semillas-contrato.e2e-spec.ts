import { ArchivosServicio } from '../../src/comun/archivos/archivos.servicio.js';
import { CONTRASENA_DE_DEMO, USUARIOS } from '../../src/semillas/datos/usuarios.js';
import { sembrar } from '../../src/semillas/sembrar.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { esperarContrato } from '../utilidades/contrato.js';

// AGENTS §10.4: se siembran los datos de demo completos y se valida CADA registro sembrado contra
// el contrato, entrando por la API como lo haría la app (corre en los cuatro motores).

let ctx: AppDePrueba;
beforeAll(async () => {
  ctx = await crearApp();
  await sembrar(ctx.dataSource, ctx.reloj, ctx.app.get(ArchivosServicio));
});
afterAll(() => ctx.cerrar());

/** Baja una lista entera, página por página. */
async function bajarTodo(ruta: string, filtros: Record<string, string>, porPagina: number) {
  const todos: unknown[] = [];
  for (let pagina = 1; ; pagina++) {
    const r = await ctx.http
      .get(ruta)
      .query({ ...filtros, pagina, porPagina })
      .expect(200);
    todos.push(...r.body.datos);
    if (todos.length >= r.body.meta.total || r.body.datos.length === 0) {
      expect(todos).toHaveLength(r.body.meta.total);
      return { cuerpo: r.body, todos };
    }
  }
}

describe('AGENTS §10.4 — los datos de demo completos cumplen el contrato', () => {
  it('las catorce líneas y cada una por su id', async () => {
    const { cuerpo, todos } = await bajarTodo('/lineas', {}, 100);
    esperarContrato(cuerpo, 'Linea');
    expect(todos).toHaveLength(14);
    for (const { id } of todos as { id: string }[]) {
      esperarContrato((await ctx.http.get(`/lineas/${id}`).expect(200)).body, 'Linea');
    }
  });

  it('todas las paradas, y cada una por su id y por su QR', async () => {
    const { cuerpo, todos } = await bajarTodo('/paradas', {}, 1000);
    esperarContrato(cuerpo, 'Parada');
    for (const p of todos as { id: string; codigoQr: string | null }[]) {
      esperarContrato((await ctx.http.get(`/paradas/${p.id}`).expect(200)).body, 'Parada');
      if (p.codigoQr) {
        const r = await ctx.http.get(`/paradas/qr/${encodeURIComponent(p.codigoQr)}`).expect(200);
        expect(r.body.datos.id).toBe(p.id);
      }
    }
  });

  it('toda la tabla de horarios, línea por línea', async () => {
    const lineas = (await ctx.http.get('/lineas').query({ porPagina: 100 })).body.datos as {
      id: string;
    }[];
    let total = 0;
    for (const { id } of lineas) {
      const { cuerpo, todos } = await bajarTodo('/horarios', { lineaId: id }, 5000);
      if (todos.length) esperarContrato(cuerpo, 'Horario');
      total += todos.length;
    }
    expect(total).toBeGreaterThan(1000);
  });

  it('los feriados de 2026 y 2027', async () => {
    for (const anio of ['2026', '2027']) {
      const r = await ctx.http.get('/feriados').query({ anio }).expect(200);
      esperarContrato(r.body, 'Feriado');
      expect(r.body.datos.length).toBeGreaterThan(10);
    }
  });

  it('todos los avisos, incluidos los próximos y los terminados', async () => {
    const { cuerpo } = await bajarTodo('/avisos', { estado: 'todos' }, 100);
    esperarContrato(cuerpo, 'Aviso');
  });

  it('los reportes de demora de cada parada y línea que tienen alguno', async () => {
    const r = await ctx.http.get('/reportes-demora').query({ paradaId: 'par-101' }).expect(200);
    esperarContrato(r.body, 'ReporteDeDemora');
    expect(r.body.datos.length).toBeGreaterThan(0);
  });

  it('cada cuenta de demo entra, y su Usuario y su sesión cumplen el contrato', async () => {
    for (const u of USUARIOS) {
      const ingreso = await ctx.http
        .post('/auth/ingreso')
        .send({ email: u.email, contrasena: CONTRASENA_DE_DEMO })
        .expect(200);
      esperarContrato(ingreso.body, 'Sesion');
      const yo = await ctx.http
        .get('/yo')
        .set('Authorization', `Bearer ${ingreso.body.datos.token}`)
        .expect(200);
      esperarContrato(yo.body, 'Usuario');
      expect(yo.body.datos.id).toBe(u.id);
    }
  });

  it('el resumen de la Dirección sobre los reportes sembrados', async () => {
    const ingreso = await ctx.http
      .post('/auth/ingreso')
      .send({ email: 'transporte@parana.demo.ar', contrasena: CONTRASENA_DE_DEMO });
    const r = await ctx.http
      .get('/reportes-demora/resumen')
      .set('Authorization', `Bearer ${ingreso.body.datos.token}`)
      .expect(200);
    esperarContrato(r.body, 'ResumenDemoras');
  });
});
