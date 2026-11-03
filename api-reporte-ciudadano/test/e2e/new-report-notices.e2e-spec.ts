import { crearApp, type AppDePrueba } from '../utilities/create-app.js';
import {
  crearTipo,
  crearZona,
  cuadradoAlrededorDe,
} from '../utilities/catalogs.js';
import { crearOperador, crearVecino } from '../utilities/users.js';
import { cuerpoReporte, ROCAMORA, subirArchivo } from '../utilities/reports.js';

let ctx: AppDePrueba;
beforeAll(async () => {
  ctx = await crearApp();
});
afterAll(() => ctx.cerrar());
beforeEach(() => ctx.notificador.limpiar());

describe('Push de reporte nuevo → operadores', () => {
  it('avisa a los operadores con avisos activos (incluso a quien no creó el reporte) y a nadie más', async () => {
    const vecino = await crearVecino(ctx);
    const op1 = await crearOperador(ctx);
    const op2 = await crearOperador(ctx);
    const mudo = await crearOperador(ctx, { avisosActivos: false });
    const t1 = await ctx.registrarDispositivo(
      op1.usuario.id,
      'ExponentPushToken[op-1]',
    );
    const t2 = await ctx.registrarDispositivo(
      op2.usuario.id,
      'ExponentPushToken[op-2]',
    );
    await ctx.registrarDispositivo(
      mudo.usuario.id,
      'ExponentPushToken[op-mudo]',
    );
    await ctx.registrarDispositivo(
      vecino.usuario.id,
      'ExponentPushToken[vec-1]',
    );
    const tipoId = (await crearTipo(ctx, { id: 'tip-bache' })).id;
    await crearZona(ctx, {
      id: 'zon-norte',
      limite: cuadradoAlrededorDe(ROCAMORA.latitud, ROCAMORA.longitud),
    });
    const fotoUrl = await subirArchivo(ctx, vecino);

    const res = await ctx
      .http()
      .post('/reportes')
      .set(...vecino.auth)
      .send(cuerpoReporte(fotoUrl, tipoId));
    expect(res.status).toBe(201);
    await ctx.esperarAvisos();

    expect(ctx.notificador.enviadas.map((m) => m.tokenExpo).sort()).toEqual(
      [t1, t2].sort(),
    );
    expect(ctx.notificador.enviadas[0]).toMatchObject({
      cuerpo: 'Nuevo reporte: Bache en Rocamora 1240',
      datos: { tipo: 'nuevo', reporteId: res.body.datos.id },
    });

    // Repetir el POST con el mismo id (reintento) no vuelve a avisar.
    ctx.notificador.limpiar();
    await ctx
      .http()
      .post('/reportes')
      .set(...vecino.auth)
      .send(cuerpoReporte(fotoUrl, tipoId, { id: res.body.datos.id }));
    await ctx.esperarAvisos();
    expect(ctx.notificador.enviadas).toHaveLength(0);
  });
});
