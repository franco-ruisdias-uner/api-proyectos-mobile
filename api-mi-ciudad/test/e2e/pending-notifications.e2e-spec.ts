// AGENTS §19.3: mientras las piezas de los alumnos están vacías, /dispositivos responde 501 y
// los flujos que avisan siguen andando. Cuando las completen, este archivo deja de aplicar.
import { conSesion, registrarTurista } from '../utilities/builders.js';
import { esperarError } from '../utilities/contract.js';
import { crearApp, type AppDePrueba } from '../utilities/create-app.js';

describe('Notificaciones para completar: las piezas de los alumnos están vacías', () => {
  let ctx: AppDePrueba;
  let token: string;
  beforeEach(async () => {
    ctx = await crearApp({ reales: true, entorno: { NOTIFICACIONES: 'registro' } });
    token = (await registrarTurista(ctx)).token;
  });
  afterEach(() => ctx.cerrar());

  it('POST /dispositivos → 501 NO_IMPLEMENTADO', async () => {
    const res = await ctx
      .http()
      .post('/dispositivos')
      .set(conSesion(token))
      .send({ tokenExpo: 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]', plataforma: 'android' });
    esperarError(res, 501, 'NO_IMPLEMENTADO');
  });

  it('POST /dispositivos/prueba → 501 NO_IMPLEMENTADO', async () => {
    const res = await ctx.http().post('/dispositivos/prueba').set(conSesion(token));
    esperarError(res, 501, 'NO_IMPLEMENTADO');
  });

  it('DELETE /dispositivos/:tokenExpo → 501 NO_IMPLEMENTADO', async () => {
    const res = await ctx
      .http()
      .delete(`/dispositivos/${encodeURIComponent('ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]')}`)
      .set(conSesion(token));
    esperarError(res, 501, 'NO_IMPLEMENTADO');
  });

  it('sin sesión sigue siendo 401', async () => {
    await ctx.http().post('/dispositivos/prueba').expect(401);
  });
});
