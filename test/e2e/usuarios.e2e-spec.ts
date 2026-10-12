import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import {
  bearer,
  conSesion,
  crearUsuario,
  ingresar,
} from '../utilidades/usuarios.js';

describe('M0 — Usuarios (sólo administración)', () => {
  let c: AppDePrueba;
  let admin: { token: string; id: string };
  let lector: { token: string };

  beforeAll(async () => {
    c = await crearApp();
    admin = await conSesion(c, 'administracion', {
      legajo: 'A-001',
      nombre: 'Laura Vidal',
    });
    lector = await conSesion(c, 'lector', { legajo: 'Z-999' });
  });
  afterAll(() => c.cerrar());

  describe('ESPECIFICACION R3 — Un lector en un endpoint 🛡 → 403 SIN_PERMISO', () => {
    it.each([
      ['get', '/usuarios'],
      ['post', '/usuarios'],
      ['patch', '/usuarios/usr-011'],
    ])('%s %s', async (metodo, ruta) => {
      const r = await c
        .http()
        [metodo as 'get' | 'post' | 'patch'](ruta)
        .set(bearer(lector.token))
        .send({})
        .expect(403);
      esperarError(r.body, 'SIN_PERMISO');
    });

    it.each([
      ['get', '/usuarios'],
      ['post', '/usuarios'],
      ['patch', '/usuarios/usr-011'],
    ])('%s %s sin token → 401', async (metodo, ruta) => {
      const r = await c
        .http()
        [metodo as 'get' | 'post' | 'patch'](ruta)
        .send({})
        .expect(401);
      esperarError(r.body, 'NO_AUTENTICADO');
    });
  });

  describe('POST /usuarios', () => {
    it('crea un lector: 201, id usr-…, sin huella y sin rutas; puede ingresar', async () => {
      const r = await c
        .http()
        .post('/usuarios')
        .set(bearer(admin.token))
        .send({
          legajo: ' L-131 ',
          nombre: ' Julia Ríos ',
          rol: 'lector',
          contrasena: 'clave-de-julia',
        })
        .expect(201);
      esperarContrato(r.body, 'Usuario');
      expect(r.body.datos).toEqual({
        id: expect.stringMatching(/^usr-[a-z0-9]{12}$/),
        legajo: 'L-131',
        nombre: 'Julia Ríos',
        rol: 'lector',
        biometriaActiva: false,
        rutasAsignadas: [],
      });
      await ingresar(c, { legajo: 'l-131', contrasena: 'clave-de-julia' });
    });

    it('puede crear otra cuenta de administración', async () => {
      const r = await c
        .http()
        .post('/usuarios')
        .set(bearer(admin.token))
        .send({
          legajo: 'A-132',
          nombre: 'Otra Admin',
          rol: 'administracion',
          contrasena: 'clave-larga-1',
        })
        .expect(201);
      expect(r.body.datos.rol).toBe('administracion');
    });

    it('R1 — legajo repetido, aunque cambien las mayúsculas → 409 LEGAJO_YA_REGISTRADO', async () => {
      await crearUsuario(c, { legajo: 'L-133' });
      const r = await c
        .http()
        .post('/usuarios')
        .set(bearer(admin.token))
        .send({
          legajo: 'l-133',
          nombre: 'X',
          rol: 'lector',
          contrasena: 'clave-larga-1',
        })
        .expect(409);
      esperarError(r.body, 'LEGAJO_YA_REGISTRADO');
      expect(r.body.error.mensaje).toBe('Ya hay una cuenta con ese legajo.');
    });

    it('R1 — dos altas simultáneas con el mismo legajo: una pasa y la otra da LEGAJO_YA_REGISTRADO', async () => {
      const alta = (nombre: string) =>
        c
          .http()
          .post('/usuarios')
          .set(bearer(admin.token))
          .send({
            legajo: 'L-134',
            nombre,
            rol: 'lector',
            contrasena: 'clave-larga-1',
          });
      const [a, b] = await Promise.all([alta('Uno'), alta('Dos')]);
      expect([a.status, b.status].sort()).toEqual([201, 409]);
      esperarError((a.status === 409 ? a : b).body, 'LEGAJO_YA_REGISTRADO');
      const lista = await c
        .http()
        .get('/usuarios?buscar=L-134')
        .set(bearer(admin.token))
        .expect(200);
      expect(lista.body.meta.total).toBe(1);
    });

    it.each([
      [
        { nombre: 'X', rol: 'lector', contrasena: 'clave-larga-1' },
        'Falta el legajo.',
      ],
      [
        {
          legajo: '   ',
          nombre: 'X',
          rol: 'lector',
          contrasena: 'clave-larga-1',
        },
        'Falta el legajo.',
      ],
      [
        {
          legajo: 'L-' + '1'.repeat(19),
          nombre: 'X',
          rol: 'lector',
          contrasena: 'clave-larga-1',
        },
        'El legajo no puede tener más de 20 caracteres.',
      ],
      [
        { legajo: 'L-1', rol: 'lector', contrasena: 'clave-larga-1' },
        'Falta el nombre.',
      ],
      [
        {
          legajo: 'L-1',
          nombre: 'X',
          rol: 'jefe',
          contrasena: 'clave-larga-1',
        },
        'El rol tiene que ser "lector" o "administracion".',
      ],
      [
        { legajo: 'L-1', nombre: 'X', rol: 'lector', contrasena: 'corta' },
        'La contraseña tiene que tener al menos 8 caracteres.',
      ],
      [{ legajo: 'L-1', nombre: 'X', rol: 'lector' }, 'Falta la contraseña.'],
      [
        {
          legajo: 'L-1',
          nombre: 'X',
          rol: 'lector',
          contrasena: 'clave-larga-1',
          id: 'usr-1',
        },
        'El dato "id" no corresponde a este pedido.',
      ],
    ])('%o → 400 VALIDACION_FALLIDA', async (cuerpo, mensaje) => {
      const r = await c
        .http()
        .post('/usuarios')
        .set(bearer(admin.token))
        .send(cuerpo)
        .expect(400);
      esperarError(r.body, 'VALIDACION_FALLIDA');
      expect(r.body.error.mensaje).toBe(mensaje);
    });

    it('un legajo de 20 caracteres entra justo', async () => {
      await c
        .http()
        .post('/usuarios')
        .set(bearer(admin.token))
        .send({
          legajo: 'B'.repeat(20),
          nombre: 'X',
          rol: 'lector',
          contrasena: 'clave-larga-1',
        })
        .expect(201);
    });
  });

  describe('PATCH /usuarios/:id', () => {
    it('cambia el nombre', async () => {
      const u = await crearUsuario(c, { nombre: 'Nombre Viejo' });
      const r = await c
        .http()
        .patch(`/usuarios/${u.id}`)
        .set(bearer(admin.token))
        .send({ nombre: 'Nombre Nuevo' })
        .expect(200);
      esperarContrato(r.body, 'Usuario');
      expect(r.body.datos).toMatchObject({
        id: u.id,
        nombre: 'Nombre Nuevo',
        legajo: u.legajo,
      });
    });

    it('R2 — el blanqueo de contraseña invalida sus sesiones; con la nueva puede ingresar', async () => {
      const u = await conSesion(c, 'lector');
      await c
        .http()
        .patch(`/usuarios/${u.id}`)
        .set(bearer(admin.token))
        .send({ contrasena: 'blanqueada-123' })
        .expect(200);
      esperarError(
        (await c.http().get('/yo').set(bearer(u.token)).expect(401)).body,
        'NO_AUTENTICADO',
      );
      await ingresar(c, { legajo: u.legajo, contrasena: 'blanqueada-123' });
    });

    it('cambiar sólo el nombre no cierra sus sesiones', async () => {
      const u = await conSesion(c, 'lector');
      await c
        .http()
        .patch(`/usuarios/${u.id}`)
        .set(bearer(admin.token))
        .send({ nombre: 'Otro' })
        .expect(200);
      await c.http().get('/yo').set(bearer(u.token)).expect(200);
    });

    it('USUARIO_NO_ENCONTRADO', async () => {
      const r = await c
        .http()
        .patch('/usuarios/usr-noexiste')
        .set(bearer(admin.token))
        .send({ nombre: 'X' })
        .expect(404);
      esperarError(r.body, 'USUARIO_NO_ENCONTRADO');
    });

    it.each([
      ['/usuarios/lec-011', { nombre: 'X' }, 'El identificador no es válido.'],
      ['/usuarios/usr-011', { nombre: '' }, 'El nombre no puede quedar vacío.'],
      [
        '/usuarios/usr-011',
        { contrasena: 'corta' },
        'La contraseña tiene que tener al menos 8 caracteres.',
      ],
      [
        '/usuarios/usr-011',
        { rol: 'administracion' },
        'El dato "rol" no corresponde a este pedido.',
      ],
      [
        '/usuarios/usr-011',
        { legajo: 'L-1' },
        'El dato "legajo" no corresponde a este pedido.',
      ],
    ])('%s %o → 400', async (ruta, cuerpo, mensaje) => {
      const r = await c
        .http()
        .patch(ruta)
        .set(bearer(admin.token))
        .send(cuerpo)
        .expect(400);
      esperarError(r.body, 'VALIDACION_FALLIDA');
      expect(r.body.error.mensaje).toBe(mensaje);
    });
  });
});
