import { crearApp, type AppDePrueba } from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { conSesion, registrarTurista } from '../utilidades/builders.js';
import { DispositivoEntidad } from '../../src/modulos/dispositivos/dispositivo.entidad.js';

const TOKEN_A = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]';
const TOKEN_B = 'ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]';

describe('AGENTS §9 — /dispositivos', () => {
  let ctx: AppDePrueba;
  let lucia: string;
  let pedro: string;
  beforeEach(async () => {
    ctx = await crearApp();
    lucia = (await registrarTurista(ctx)).token;
    pedro = (await registrarTurista(ctx)).token;
  });
  afterEach(() => ctx.cerrar());

  const registrar = (token: string, tokenExpo = TOKEN_A, plataforma = 'android') =>
    ctx.http().post('/dispositivos').set(conSesion(token)).send({ tokenExpo, plataforma });
  const cantidad = () => ctx.dataSource.getRepository(DispositivoEntidad).count();

  it('registra el teléfono: 201 con { tokenExpo, plataforma }', async () => {
    const res = await registrar(lucia).expect(201);
    esperarContrato(res.body, 'Dispositivo');
    expect(res.body.datos).toEqual({ tokenExpo: TOKEN_A, plataforma: 'android' });
  });

  it('idempotente por token: el mismo POST dos veces deja uno (200 la segunda)', async () => {
    const primera = await registrar(lucia).expect(201);
    const segunda = await registrar(lucia).expect(200);
    expect(segunda.body).toEqual(primera.body);
    expect(await cantidad()).toBe(1);
  });

  it('concurrencia: dos POST simultáneos del mismo token dejan uno', async () => {
    const respuestas = await Promise.all([registrar(lucia), registrar(lucia)]);
    expect(respuestas.every((r) => [200, 201].includes(r.status))).toBe(true);
    expect(await cantidad()).toBe(1);
  });

  it('si otro usuario tenía el token, pasa al actual', async () => {
    await registrar(lucia).expect(201);
    await registrar(pedro, TOKEN_A, 'ios').expect(200);
    const guardado = await ctx.dataSource
      .getRepository(DispositivoEntidad)
      .findOneByOrFail({ tokenExpo: TOKEN_A });
    const yoPedro = await ctx.http().get('/yo').set(conSesion(pedro));
    expect(guardado.usuarioId).toBe(yoPedro.body.datos.id);
    expect(guardado.plataforma).toBe('ios');
  });

  it.each([
    [{ tokenExpo: 'cualquier-cosa', plataforma: 'android' }, 'El token de notificaciones no es válido.'],
    [{ plataforma: 'android' }, 'Falta el token de notificaciones del teléfono.'],
    [{ tokenExpo: TOKEN_A, plataforma: 'windows' }, 'La plataforma tiene que ser ios o android.'],
    [{ tokenExpo: TOKEN_A }, 'La plataforma tiene que ser ios o android.'],
  ])('VALIDACION_FALLIDA: %j', async (cuerpo, mensaje) => {
    const res = await ctx.http().post('/dispositivos').set(conSesion(lucia)).send(cuerpo);
    esperarError(res, 400, 'VALIDACION_FALLIDA');
    expect(res.body.error.mensaje).toBe(mensaje);
  });

  it('NO_AUTENTICADO sin token (los tres endpoints)', async () => {
    esperarError(
      await ctx.http().post('/dispositivos').send({ tokenExpo: TOKEN_A, plataforma: 'ios' }),
      401,
      'NO_AUTENTICADO',
    );
    esperarError(await ctx.http().post('/dispositivos/prueba'), 401, 'NO_AUTENTICADO');
    esperarError(
      await ctx.http().delete(`/dispositivos/${encodeURIComponent(TOKEN_A)}`),
      401,
      'NO_AUTENTICADO',
    );
  });

  it('POST /dispositivos/prueba manda una push a mis teléfonos y a nadie más', async () => {
    await registrar(lucia, TOKEN_A);
    await registrar(lucia, TOKEN_B, 'ios');
    await registrar(pedro, 'ExponentPushToken[pppppppppppppppppppppp]');
    const res = await ctx.http().post('/dispositivos/prueba').set(conSesion(lucia)).expect(200);
    esperarContrato(res.body, 'PruebaNotificacion');
    expect(res.body.datos).toEqual({ enviadas: 2 });
    await ctx.esperarAvisos();
    expect(ctx.notificador.enviadas).toHaveLength(1);
    expect(ctx.notificador.enviadas[0].tokens.sort()).toEqual([TOKEN_A, TOKEN_B].sort());
  });

  it('prueba sin teléfonos registrados: enviadas 0 y ninguna push', async () => {
    const res = await ctx.http().post('/dispositivos/prueba').set(conSesion(lucia)).expect(200);
    expect(res.body.datos).toEqual({ enviadas: 0 });
    await ctx.esperarAvisos();
    expect(ctx.notificador.enviadas).toHaveLength(0);
  });

  it('los tokens que Expo informa como inválidos se borran', async () => {
    await registrar(lucia, TOKEN_A);
    await registrar(lucia, TOKEN_B);
    ctx.notificador.invalidos.add(TOKEN_B);
    await ctx.http().post('/dispositivos/prueba').set(conSesion(lucia)).expect(200);
    await ctx.esperarAvisos();
    const quedan = await ctx.dataSource.getRepository(DispositivoEntidad).find();
    expect(quedan.map((d) => d.tokenExpo)).toEqual([TOKEN_A]);
  });

  it('un error del notificador no rompe el pedido', async () => {
    await registrar(lucia);
    ctx.notificador.enviar = () => Promise.reject(new Error('Expo caído'));
    await ctx.http().post('/dispositivos/prueba').set(conSesion(lucia)).expect(200);
    await ctx.esperarAvisos();
  });

  it('DELETE da de baja (204) y es idempotente', async () => {
    await registrar(lucia);
    const ruta = `/dispositivos/${encodeURIComponent(TOKEN_A)}`;
    const res = await ctx.http().delete(ruta).set(conSesion(lucia)).expect(204);
    expect(res.text).toBe('');
    expect(await cantidad()).toBe(0);
    await ctx.http().delete(ruta).set(conSesion(lucia)).expect(204);
  });

  it('DELETE del token de otro usuario no lo borra', async () => {
    await registrar(lucia);
    await ctx
      .http()
      .delete(`/dispositivos/${encodeURIComponent(TOKEN_A)}`)
      .set(conSesion(pedro))
      .expect(204);
    expect(await cantidad()).toBe(1);
  });
});
