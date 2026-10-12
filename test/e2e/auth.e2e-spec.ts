import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import {
  bearer,
  conSesion,
  crearUsuario,
  ingresar,
} from '../utilidades/usuarios.js';

describe('M0 — Ingreso y salida', () => {
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

  describe('ESPECIFICACION R2 — POST /auth/salida invalida todos los tokens del usuario', () => {
    it('ingresar, salir y usar el token viejo → 401', async () => {
      const u = await crearUsuario(c);
      const token = await ingresar(c, u);
      const r = await c
        .http()
        .post('/auth/salida')
        .set(bearer(token))
        .expect(204);
      expect(r.text).toBe('');
      esperarError(
        (await c.http().get('/yo').set(bearer(token)).expect(401)).body,
        'NO_AUTENTICADO',
      );
    });

    it('cierra también la sesión del otro teléfono, y se puede volver a ingresar', async () => {
      const u = await crearUsuario(c);
      const telefonoA = await ingresar(c, u);
      c.reloj.avanzar(1000);
      const telefonoB = await ingresar(c, u);
      await c.http().post('/auth/salida').set(bearer(telefonoB)).expect(204);
      await c.http().get('/yo').set(bearer(telefonoA)).expect(401);
      const nuevo = await ingresar(c, u);
      await c.http().get('/yo').set(bearer(nuevo)).expect(200);
    });

    it('no cierra las sesiones de otros usuarios', async () => {
      const otro = await conSesion(c, 'lector');
      const yo = await conSesion(c, 'lector');
      await c.http().post('/auth/salida').set(bearer(yo.token)).expect(204);
      await c.http().get('/yo').set(bearer(otro.token)).expect(200);
    });

    it('sin token → 401', async () => {
      esperarError(
        (await c.http().post('/auth/salida').expect(401)).body,
        'NO_AUTENTICADO',
      );
    });
  });
});
