import { crearApp, type AppDePrueba } from '../utilities/create-app.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import { crearLugar } from '../utilities/builders.js';

describe('PRD §4 y R6 — GET /lugares/qr/:codigo', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
    await crearLugar(ctx, { id: 'lug-004', nombre: 'Molino Forclaz', conQr: true });
    await crearLugar(ctx, { id: 'lug-sinqr', nombre: 'Sin cartel', conQr: false });
    await crearLugar(ctx, { id: 'lug-baja', nombre: 'Dado de baja', conQr: true, activo: false });
  });
  afterAll(() => ctx.cerrar());

  it('D5 — «COLON:<lugarId>» (URL-encoded) resuelve al Lugar, sin pedir sesión', async () => {
    const res = await ctx
      .http()
      .get(`/lugares/qr/${encodeURIComponent('COLON:lug-004')}`)
      .expect(200);
    esperarContrato(res.body, 'Lugar');
    expect(res.body.datos).toMatchObject({ id: 'lug-004', codigoQr: 'COLON:lug-004' });
  });

  it('también sin codificar los dos puntos', async () => {
    const res = await ctx.http().get('/lugares/qr/COLON:lug-004').expect(200);
    expect(res.body.datos.id).toBe('lug-004');
  });

  it('tolera espacios o un salto de línea alrededor (algunos lectores los agregan)', async () => {
    const res = await ctx
      .http()
      .get(`/lugares/qr/${encodeURIComponent(' COLON:lug-004\n')}`)
      .expect(200);
    expect(res.body.datos.id).toBe('lug-004');
  });

  it('D6 — un lugar dado de baja se resuelve igual, con activo: false', async () => {
    const res = await ctx
      .http()
      .get(`/lugares/qr/${encodeURIComponent('COLON:lug-baja')}`)
      .expect(200);
    esperarContrato(res.body, 'Lugar');
    expect(res.body.datos.activo).toBe(false);
  });

  it.each([
    ['un id que no existe', 'COLON:lug-999'],
    ['un lugar sin cartel con QR', 'COLON:lug-sinqr'],
    ['texto al azar', 'hola mundo'],
    ['una URL', 'https://qr.consultora.com.ar/colon/peatonal?id=4'],
    ['un QR de otro sistema', 'WIFI:S:MiRed;T:WPA;P:clave;;'],
    ['el prefijo solo', 'COLON:'],
    ['el prefijo en minúsculas', 'colon:lug-004'],
    ['el id en mayúsculas', 'COLON:LUG-004'],
    ['otra entidad', 'COLON:cat-museos'],
    ['con algo de más', 'COLON:lug-004:extra'],
    ['un emoji', '📍'],
    ['comillas y símbolos', `'"<>;--`],
    ['muy largo', 'COLON:lug-' + 'x'.repeat(3000)],
  ])('R6 — %s → 404 QR_NO_RECONOCIDO', async (_caso, codigo) => {
    esperarError(await ctx.http().get(`/lugares/qr/${encodeURIComponent(codigo)}`), 404, 'QR_NO_RECONOCIDO');
  });

  it.each([
    ['una URL sin codificar (con barras)', '/lugares/qr/https://ejemplo.com/a/b'],
    ['vacío', '/lugares/qr/'],
    ['vacío sin barra', '/lugares/qr'],
    ['un escape roto', '/lugares/qr/%E0%A4%A'],
    ['un % suelto', '/lugares/qr/100%'],
  ])('R6 — %s → 404 QR_NO_RECONOCIDO, nunca 500', async (_caso, ruta) => {
    esperarError(await ctx.http().get(ruta), 404, 'QR_NO_RECONOCIDO');
  });

  it('el mensaje se puede mostrar tal cual', async () => {
    const res = await ctx.http().get('/lugares/qr/cualquier-cosa');
    expect(res.body.error.mensaje).toBe('Ese código no es de Mi Ciudad. Probá con el cartel de otro lugar.');
  });
});
