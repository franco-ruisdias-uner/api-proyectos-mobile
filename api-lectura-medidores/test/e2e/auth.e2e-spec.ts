import { type AppDePrueba, crearApp } from '../utilities/create-app.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import {
  bearer,
  conSesion,
  crearUsuario,
  ingresar,
} from '../utilities/users.js';

describe('M0 — Ingreso', () => {
  let c: AppDePrueba;
  beforeAll(async () => (c = await crearApp()));
  afterAll(() => c.cerrar());

  describe('ESPECIFICACION §1 — POST /auth/ingreso con legajo y contraseña', () => {
    it('devuelve el token y el Usuario del PRD', async () => {
      const u = await crearUsuario(c, {
        legajo: 'L-101',
        nombre: 'Ramón Duarte',
        contrasena: 'una-clave-larga',
        biometriaActiva: true,
      });
      const r = await c
        .http()
        .post('/auth/ingreso')
        .send({ legajo: 'L-101', contrasena: 'una-clave-larga' })
        .expect(200);
      esperarContrato(r.body, 'Sesion');
      expect(r.body.datos.usuario).toEqual({
        id: u.id,
        legajo: 'L-101',
        nombre: 'Ramón Duarte',
        rol: 'lector',
        biometriaActiva: true,
        rutasAsignadas: [],
      });
      expect(r.body.datos.token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
      expect(r.body.datos.refreshToken).toEqual(expect.any(String));
      expect(r.body.datos.refreshToken.length).toBeGreaterThan(20);
    });

    it('R1 — el legajo se compara sin distinguir mayúsculas (y sin espacios alrededor)', async () => {
      await crearUsuario(c, { legajo: 'L-102', contrasena: 'una-clave-larga' });
      await c
        .http()
        .post('/auth/ingreso')
        .send({ legajo: 'l-102', contrasena: 'una-clave-larga' })
        .expect(200);
      await c
        .http()
        .post('/auth/ingreso')
        .send({ legajo: ' L-102 ', contrasena: 'una-clave-larga' })
        .expect(200);
    });

    it('CREDENCIALES_INVALIDAS con el mismo mensaje exista o no el legajo', async () => {
      await crearUsuario(c, { legajo: 'L-103', contrasena: 'una-clave-larga' });
      const mala = await c
        .http()
        .post('/auth/ingreso')
        .send({ legajo: 'L-103', contrasena: 'otra-clave-x' })
        .expect(401);
      const inexistente = await c
        .http()
        .post('/auth/ingreso')
        .send({ legajo: 'L-999', contrasena: 'otra-clave-x' })
        .expect(401);
      esperarError(mala.body, 'CREDENCIALES_INVALIDAS');
      expect(inexistente.body).toEqual(mala.body);
    });

    it('la contraseña sí distingue mayúsculas', async () => {
      await crearUsuario(c, { legajo: 'L-104', contrasena: 'una-clave-larga' });
      await c
        .http()
        .post('/auth/ingreso')
        .send({ legajo: 'L-104', contrasena: 'UNA-CLAVE-LARGA' })
        .expect(401);
    });

    it.each([
      [{ contrasena: 'x' }, 'Falta el legajo.'],
      [{ legajo: 'L-1' }, 'Falta la contraseña.'],
      [{ legajo: '', contrasena: 'x' }, 'Falta el legajo.'],
      [{ legajo: 11, contrasena: 'x' }, 'Falta el legajo.'],
      [
        { legajo: 'L-1', contrasena: 'x', email: 'a@b.c' },
        'El dato "email" no corresponde a este pedido.',
      ],
    ])('%o → 400 VALIDACION_FALLIDA', async (cuerpo, mensaje) => {
      const r = await c.http().post('/auth/ingreso').send(cuerpo).expect(400);
      esperarError(r.body, 'VALIDACION_FALLIDA');
      expect(r.body.error.mensaje).toBe(mensaje);
    });

    it('no hay registro público', async () => {
      const r = await c
        .http()
        .post('/auth/registro')
        .send({ legajo: 'L-1', contrasena: 'x' });
      expect([401, 404]).toContain(r.status);
      esperarError(r.body);
    });
  });

  describe('AGENTS §7.3 — Seguro por defecto: todo pide token salvo lo público', () => {
    it.each([
      ['sin cabecera', undefined],
      ['sin Bearer', 'Token abc'],
      ['token roto', 'Bearer abc.def.ghi'],
      [
        'firmado con otra clave',
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c3ItMDExIiwicm9sIjoibGVjdG9yIiwidmVyIjowLCJpYXQiOjE3ODk0NzA4MDAsImV4cCI6MTk4OTUxNDAwMH0.Xx0sEo2vX1H9oZ9g0eYp0P1h2t7l4tXx2n3Q1o5Yl8c',
      ],
    ])('%s → 401 NO_AUTENTICADO', async (_caso, cabecera) => {
      const pedido = c.http().get('/yo');
      if (cabecera) pedido.set('Authorization', cabecera);
      const r = await pedido.expect(401);
      esperarError(r.body, 'NO_AUTENTICADO');
    });
  });

  describe('ESPECIFICACION R2 — Token de 12 horas', () => {
    it('vale hasta las 12 horas y después da 401', async () => {
      const u = await crearUsuario(c);
      const inicio = c.reloj.ahora();
      const token = await ingresar(c, u);
      c.reloj.avanzar(12 * 3600 * 1000 - 1000);
      await c.http().get('/yo').set(bearer(token)).expect(200);
      c.reloj.avanzar(2000);
      const r = await c.http().get('/yo').set(bearer(token)).expect(401);
      esperarError(r.body, 'NO_AUTENTICADO');
      c.reloj.fijar(inicio);
    });
  });

  describe('POST /auth/refresco — renueva la sesión', () => {
    const ingresarConRefresco = async () => {
      const u = await crearUsuario(c);
      const r = await c
        .http()
        .post('/auth/ingreso')
        .send({ legajo: u.legajo, contrasena: u.contrasena })
        .expect(200);
      return {
        usuario: u,
        token: r.body.datos.token as string,
        refreshToken: r.body.datos.refreshToken as string,
      };
    };

    it('devuelve un token nuevo que anda, y otro token de refresco', async () => {
      const { refreshToken } = await ingresarConRefresco();
      const r = await c
        .http()
        .post('/auth/refresco')
        .send({ refreshToken })
        .expect(200);
      esperarContrato(r.body, 'Sesion');
      expect(r.body.datos.refreshToken).not.toBe(refreshToken);
      await c.http().get('/yo').set(bearer(r.body.datos.token)).expect(200);
    });

    it('el token de refresco usado no sirve de nuevo', async () => {
      const { refreshToken } = await ingresarConRefresco();
      await c.http().post('/auth/refresco').send({ refreshToken }).expect(200);
      esperarError(
        (
          await c
            .http()
            .post('/auth/refresco')
            .send({ refreshToken })
            .expect(401)
        ).body,
        'NO_AUTENTICADO',
      );
    });

    it('dos refrescos simultáneos del mismo token: uno pasa y el otro da 401', async () => {
      const { refreshToken } = await ingresarConRefresco();
      const [a, b] = await Promise.all([
        c.http().post('/auth/refresco').send({ refreshToken }),
        c.http().post('/auth/refresco').send({ refreshToken }),
      ]);
      expect([a.status, b.status].sort()).toEqual([200, 401]);
      const fallo = a.status === 401 ? a : b;
      esperarError(fallo.body, 'NO_AUTENTICADO');
    });

    it('con el token de acceso vencido, el de refresco sigue sirviendo', async () => {
      const inicio = c.reloj.ahora();
      const { token, refreshToken } = await ingresarConRefresco();
      c.reloj.avanzar(12 * 3600 * 1000 + 1000);
      await c.http().get('/yo').set(bearer(token)).expect(401);
      const r = await c
        .http()
        .post('/auth/refresco')
        .send({ refreshToken })
        .expect(200);
      await c.http().get('/yo').set(bearer(r.body.datos.token)).expect(200);
      c.reloj.fijar(inicio);
    });

    it('a los 30 días el token de refresco vence', async () => {
      const inicio = c.reloj.ahora();
      const { refreshToken } = await ingresarConRefresco();
      c.reloj.avanzar(30 * 24 * 3600 * 1000);
      esperarError(
        (
          await c
            .http()
            .post('/auth/refresco')
            .send({ refreshToken })
            .expect(401)
        ).body,
        'NO_AUTENTICADO',
      );
      c.reloj.fijar(inicio);
    });

    it('blanquear la contraseña invalida el token de refresco', async () => {
      const admin = await conSesion(c, 'administracion');
      const { usuario, refreshToken } = await ingresarConRefresco();
      await c
        .http()
        .patch(`/usuarios/${usuario.id}`)
        .set(bearer(admin.token))
        .send({ contrasena: 'blanqueada-123' })
        .expect(200);
      esperarError(
        (
          await c
            .http()
            .post('/auth/refresco')
            .send({ refreshToken })
            .expect(401)
        ).body,
        'NO_AUTENTICADO',
      );
    });

    it('un token desconocido → 401', async () => {
      esperarError(
        (
          await c
            .http()
            .post('/auth/refresco')
            .send({ refreshToken: 'no-existe' })
            .expect(401)
        ).body,
        'NO_AUTENTICADO',
      );
    });

    it.each([
      [{}, 'Falta el token de refresco.'],
      [{ refreshToken: '' }, 'Falta el token de refresco.'],
      [{ refreshToken: 1 }, 'Falta el token de refresco.'],
      [
        { refreshToken: 'x', token: 'y' },
        'El dato "token" no corresponde a este pedido.',
      ],
    ])('%o → 400 VALIDACION_FALLIDA', async (cuerpo, mensaje) => {
      const r = await c.http().post('/auth/refresco').send(cuerpo).expect(400);
      esperarError(r.body, 'VALIDACION_FALLIDA');
      expect(r.body.error.mensaje).toBe(mensaje);
    });
  });
});
