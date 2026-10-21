import { type AppDePrueba, crearApp } from '../utilities/create-app.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import { bearer, conSesion, ingresar } from '../utilities/users.js';

describe('M0 — GET y PATCH /yo', () => {
  let c: AppDePrueba;
  beforeAll(async () => (c = await crearApp()));
  afterAll(() => c.cerrar());

  it('GET /yo devuelve el Usuario de la sesión, sin datos internos', async () => {
    const u = await conSesion(c, 'lector', { nombre: 'Silvia Fernández' });
    const r = await c.http().get('/yo').set(bearer(u.token)).expect(200);
    esperarContrato(r.body, 'Usuario');
    expect(r.body.datos).toMatchObject({
      id: u.id,
      legajo: u.legajo,
      nombre: 'Silvia Fernández',
      rol: 'lector',
      rutasAsignadas: [],
    });
    expect(JSON.stringify(r.body)).not.toMatch(
      /hash|contrasena|versionSesion|Busqueda|scrypt/,
    );
  });

  it('ESPECIFICACION §1 — administración tiene rutasAsignadas vacías', async () => {
    const a = await conSesion(c, 'administracion');
    const r = await c.http().get('/yo').set(bearer(a.token)).expect(200);
    esperarContrato(r.body, 'Usuario');
    expect(r.body.datos).toMatchObject({
      rol: 'administracion',
      rutasAsignadas: [],
    });
  });

  it('PATCH /yo cambia la preferencia de huella', async () => {
    const u = await conSesion(c, 'lector');
    const r = await c
      .http()
      .patch('/yo')
      .set(bearer(u.token))
      .send({ biometriaActiva: true })
      .expect(200);
    esperarContrato(r.body, 'Usuario');
    expect(r.body.datos.biometriaActiva).toBe(true);
    const otra = await c.http().get('/yo').set(bearer(u.token)).expect(200);
    expect(otra.body.datos.biometriaActiva).toBe(true);
  });

  it('PATCH /yo vacío no cambia nada', async () => {
    const u = await conSesion(c, 'lector');
    const r = await c
      .http()
      .patch('/yo')
      .set(bearer(u.token))
      .send({})
      .expect(200);
    esperarContrato(r.body, 'Usuario');
    expect(r.body.datos.biometriaActiva).toBe(false);
  });

  it('cambiar la contraseña pide la actual; con la nueva se ingresa y la sesión en curso sigue', async () => {
    const u = await conSesion(c, 'lector');
    await c
      .http()
      .patch('/yo')
      .set(bearer(u.token))
      .send({
        contrasenaActual: u.contrasena,
        contrasenaNueva: 'otra-clave-nueva',
      })
      .expect(200);
    await c.http().get('/yo').set(bearer(u.token)).expect(200);
    await ingresar(c, { legajo: u.legajo, contrasena: 'otra-clave-nueva' });
    await c
      .http()
      .post('/auth/ingreso')
      .send({ legajo: u.legajo, contrasena: u.contrasena })
      .expect(401);
  });

  it('con la contraseña actual equivocada → CREDENCIALES_INVALIDAS y no cambia nada', async () => {
    const u = await conSesion(c, 'lector');
    const r = await c
      .http()
      .patch('/yo')
      .set(bearer(u.token))
      .send({
        contrasenaActual: 'no-es-esta',
        contrasenaNueva: 'otra-clave-nueva',
        biometriaActiva: true,
      })
      .expect(401);
    esperarError(r.body, 'CREDENCIALES_INVALIDAS');
    await ingresar(c, u);
    expect(
      (await c.http().get('/yo').set(bearer(u.token))).body.datos
        .biometriaActiva,
    ).toBe(false);
  });

  it.each([
    [
      { contrasenaNueva: 'otra-clave-nueva' },
      'Para cambiar la contraseña falta la contraseña actual.',
    ],
    [{ contrasenaActual: 'algo-largo' }, 'Falta la contraseña nueva.'],
    [
      { contrasenaActual: 'x', contrasenaNueva: 'corta' },
      'La contraseña nueva tiene que tener al menos 8 caracteres.',
    ],
    [
      { biometriaActiva: 'si' },
      'biometriaActiva tiene que ser verdadero o falso.',
    ],
    [{ rol: 'administracion' }, 'El dato "rol" no corresponde a este pedido.'],
    [{ nombre: 'Otro' }, 'El dato "nombre" no corresponde a este pedido.'],
  ])('%o → 400 VALIDACION_FALLIDA', async (cuerpo, mensaje) => {
    const u = await conSesion(c, 'lector');
    const r = await c
      .http()
      .patch('/yo')
      .set(bearer(u.token))
      .send(cuerpo)
      .expect(400);
    esperarError(r.body, 'VALIDACION_FALLIDA');
    expect(r.body.error.mensaje).toBe(mensaje);
  });

  it('sin token → 401', async () => {
    esperarError(
      (await c.http().get('/yo').expect(401)).body,
      'NO_AUTENTICADO',
    );
    esperarError(
      (await c.http().patch('/yo').send({}).expect(401)).body,
      'NO_AUTENTICADO',
    );
  });
});
