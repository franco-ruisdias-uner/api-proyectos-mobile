// Verificación independiente de /dispositivos (AGENTS §9 / A6), movida de M0 a la consigna de
// los alumnos (AGENTS §19.3): se corre con `pnpm test:notificaciones`.
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { bearer, conSesion } from '../utilidades/usuarios.js';

const JERGA =
  /undefined|null|NaN|\bmust\b|\bshould\b|property|string|number|boolean|exception|SQL|QueryFailed|constraint|Unexpected token|class-validator|stack/i;

function esperarMensajeHumano(cuerpo: { error: { mensaje: string } }): void {
  expect(cuerpo.error.mensaje).not.toMatch(JERGA);
}

describe('Consigna 1 (verificación) — /dispositivos', () => {
  let c: AppDePrueba;
  let admin: Awaited<ReturnType<typeof conSesion>>;
  let lector: Awaited<ReturnType<typeof conSesion>>;

  beforeAll(async () => {
    c = await crearApp({ almacenReal: true });
    admin = await conSesion(c, 'administracion', { legajo: 'V-ADM' });
    lector = await conSesion(c, 'lector', { legajo: 'V-LEC' });
  });
  afterAll(() => c.cerrar());

  describe('AGENTS §9 / A6 — /dispositivos', () => {
    const TOKEN = 'ExponentPushToken[verificacion0000000000]';

    it.each([
      [{ tokenExpo: TOKEN, plataforma: 'web' }],
      [{ tokenExpo: TOKEN, plataforma: 'Android' }],
      [{ tokenExpo: TOKEN }],
      [{ plataforma: 'ios' }],
      [{ tokenExpo: 'no-es-de-expo', plataforma: 'ios' }],
      [{ tokenExpo: '', plataforma: 'ios' }],
      [{ tokenExpo: null, plataforma: 'ios' }],
      [{ tokenExpo: TOKEN, plataforma: 'ios', usuarioId: 'usr-otro' }],
    ])('%o → 400 VALIDACION_FALLIDA', async (cuerpo) => {
      const r = await c
        .http()
        .post('/dispositivos')
        .set(bearer(lector.token))
        .send(cuerpo)
        .expect(400);
      esperarError(r.body, 'VALIDACION_FALLIDA');
      esperarMensajeHumano(r.body);
    });

    it('acepta ExpoPushToken[…] también', async () => {
      const r = await c
        .http()
        .post('/dispositivos')
        .set(bearer(lector.token))
        .send({ tokenExpo: 'ExpoPushToken[otraforma123]', plataforma: 'ios' })
        .expect(201);
      esperarContrato(r.body, 'Dispositivo');
    });

    it('prueba sin dispositivos → 200 { dispositivos: 0 } y no manda nada', async () => {
      c.enviador.limpiar();
      const u = await conSesion(c, 'lector');
      const r = await c
        .http()
        .post('/dispositivos/prueba')
        .set(bearer(u.token))
        .expect(200);
      esperarContrato(r.body, 'PruebaPush');
      expect(r.body.datos).toEqual({ dispositivos: 0 });
      expect(c.enviador.enviados.flatMap((m) => m.tokens)).toEqual([]);
    });

    it('la prueba de un usuario no le llega a otro', async () => {
      c.enviador.limpiar();
      const a = await conSesion(c, 'lector');
      const b = await conSesion(c, 'lector');
      await c
        .http()
        .post('/dispositivos')
        .set(bearer(a.token))
        .send({ tokenExpo: 'ExponentPushToken[deA]', plataforma: 'android' })
        .expect(201);
      await c
        .http()
        .post('/dispositivos')
        .set(bearer(b.token))
        .send({ tokenExpo: 'ExponentPushToken[deB]', plataforma: 'ios' })
        .expect(201);
      const r = await c
        .http()
        .post('/dispositivos/prueba')
        .set(bearer(a.token))
        .expect(200);
      expect(r.body.datos).toEqual({ dispositivos: 1 });
      expect(c.enviador.enviados.flatMap((m) => m.tokens)).toEqual([
        'ExponentPushToken[deA]',
      ]);
    });

    it.each([
      ['post', '/dispositivos'],
      ['post', '/dispositivos/prueba'],
      ['delete', `/dispositivos/${encodeURIComponent(TOKEN)}`],
    ])('%s %s sin token → 401', async (m, ruta) => {
      const r = await c
        .http()
        [m as 'post' | 'delete'](ruta)
        .send({ tokenExpo: TOKEN, plataforma: 'ios' })
        .expect(401);
      esperarError(r.body, 'NO_AUTENTICADO');
    });

    it('la administración también puede registrar su teléfono', async () => {
      await c
        .http()
        .post('/dispositivos')
        .set(bearer(admin.token))
        .send({ tokenExpo: 'ExponentPushToken[admin]', plataforma: 'ios' })
        .expect(201);
    });
  });
});
