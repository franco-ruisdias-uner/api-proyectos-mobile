import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { esperarError } from '../utilidades/contrato.js';
import { bearer, conSesion } from '../utilidades/usuarios.js';

const TOKEN = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]';

// En `main` el guardado de tokens y el envío los programan los alumnos (AGENTS §19.3).
// La consigna completa está en test/notificaciones/ (`pnpm test:notificaciones`).
// En la rama `solucion-notificaciones` este archivo no existe.
describe('AGENTS §19.3 — /dispositivos todavía lo completan los alumnos: 501 NO_IMPLEMENTADO', () => {
  let c: AppDePrueba;
  beforeAll(async () => (c = await crearApp({ almacenReal: true })));
  afterAll(() => c.cerrar());

  it.each([
    ['post', '/dispositivos'],
    ['post', '/dispositivos/prueba'],
    ['delete', `/dispositivos/${encodeURIComponent(TOKEN)}`],
  ])('%s %s → 501 con el sobre de error', async (metodo, ruta) => {
    const u = await conSesion(c, 'lector');
    const r = await c
      .http()
      [metodo as 'post' | 'delete'](ruta)
      .set(bearer(u.token))
      .send({ tokenExpo: TOKEN, plataforma: 'android' })
      .expect(501);
    esperarError(r.body, 'NO_IMPLEMENTADO');
    expect(r.body.error.mensaje).toBe(
      'Esta parte la programan ustedes. Mirá docs/NOTIFICACIONES.md.',
    );
  });

  it('sin sesión sigue siendo 401', async () => {
    esperarError(
      (await c.http().post('/dispositivos').expect(401)).body,
      'NO_AUTENTICADO',
    );
  });

  it('con un cuerpo mal formado sigue siendo 400', async () => {
    const u = await conSesion(c, 'lector');
    esperarError(
      (
        await c
          .http()
          .post('/dispositivos')
          .set(bearer(u.token))
          .send({ tokenExpo: 'abc', plataforma: 'android' })
          .expect(400)
      ).body,
      'VALIDACION_FALLIDA',
    );
  });

  it('los flujos que avisan siguen andando y no revientan: asignar una ruta → 201', async () => {
    const admin = await conSesion(c, 'administracion');
    const lector = await conSesion(c, 'lector');
    const { crearSuministro } = await import('../utilidades/suministros.js');
    const sum = (await crearSuministro(c)).suministro.id;
    const r = await c
      .http()
      .post('/rutas')
      .set(bearer(admin.token))
      .send({
        numero: '07',
        nombre: 'Barrio Brasil',
        bimestre: '2026-05',
        lectorId: lector.id,
        suministroIds: [sum],
      })
      .expect(201);
    expect(r.body.datos.lectorId).toBe(lector.id);
    await c.avisos.esperarPendientes();
    expect(c.enviador.enviados).toEqual([]);
  });
});
