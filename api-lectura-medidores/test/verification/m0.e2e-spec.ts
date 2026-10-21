// Verificación independiente de M0 — Base (caja negra, AGENTS §12).
// Un solo crearApp() por archivo: en la matriz los archivos comparten base.
import { createHmac } from 'node:crypto';
import { type AppDePrueba, crearApp } from '../utilities/create-app.js';
import { jpeg, m4a, mp4 } from '../utilities/files.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import {
  bearer,
  conSesion,
  crearUsuario,
  ingresar,
} from '../utilities/users.js';

const SECRETO_DE_LOS_TESTS = 'secreto-de-los-tests-no-es-de-verdad';

const b64url = (o: unknown) =>
  Buffer.from(JSON.stringify(o)).toString('base64url');

function firmar(payload: Record<string, unknown>, secreto: string): string {
  const cabecera = b64url({ alg: 'HS256', typ: 'JWT' });
  const cuerpo = b64url(payload);
  const firma = createHmac('sha256', secreto)
    .update(`${cabecera}.${cuerpo}`)
    .digest('base64url');
  return `${cabecera}.${cuerpo}.${firma}`;
}

function decodificar(token: string): Record<string, unknown> {
  return JSON.parse(
    Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
  ) as Record<string, unknown>;
}

/** Jerga técnica que no puede aparecer en un mensaje para mostrar en pantalla. */
const JERGA =
  /undefined|null|NaN|\bmust\b|\bshould\b|property|string|number|boolean|exception|SQL|QueryFailed|constraint|Unexpected token|class-validator|stack/i;

function esperarMensajeHumano(cuerpo: { error: { mensaje: string } }): void {
  expect(cuerpo.error.mensaje).not.toMatch(JERGA);
}

describe('Verificación M0 — Base', () => {
  let c: AppDePrueba;
  let admin: Awaited<ReturnType<typeof conSesion>>;
  let lector: Awaited<ReturnType<typeof conSesion>>;
  const inicio = new Date('2026-09-15T08:00:00-03:00');

  beforeAll(async () => {
    c = await crearApp();
    admin = await conSesion(c, 'administracion', { legajo: 'V-ADM' });
    lector = await conSesion(c, 'lector', { legajo: 'V-LEC' });
  });
  afterAll(() => c.cerrar());
  afterEach(() => c.reloj.fijar(inicio));

  // ───────────────────────────── /health ─────────────────────────────
  describe('AGENTS §11.4 — GET /health es público y tiene la forma de Salud', () => {
    it('responde con el motor en uso y el almacén local', async () => {
      const r = await c.http().get('/salud').expect(200);
      esperarContrato(r.body, 'Salud');
      expect(r.body.datos.motor).toBe(
        process.env.DB_ENGINE ?? 'better-sqlite3',
      );
      expect(r.body.datos.almacen).toBe('local');
      expect(r.body.datos.version.length).toBeGreaterThan(0);
    });

    it('un token roto en un endpoint público no lo rompe', async () => {
      await c
        .http()
        .get('/salud')
        .set('Authorization', 'Bearer basura')
        .expect(200);
    });
  });

  // ───────────────────────────── ingreso ─────────────────────────────
  describe('ESPECIFICACION §1 / D1 — POST /auth/ingreso', () => {
    it('200 (no 201) con Sesion; el JWT dura 12 horas y lleva sub y rol, sin datos internos', async () => {
      const r = await c
        .http()
        .post('/auth/ingreso')
        .send({ legajo: lector.legajo, contrasena: lector.contrasena })
        .expect(200);
      esperarContrato(r.body, 'Sesion');
      expect(r.body.datos.usuario).toEqual({
        id: lector.id,
        legajo: lector.legajo,
        nombre: lector.nombre,
        rol: 'lector',
        biometriaActiva: false,
        rutasAsignadas: [],
      });
      const p = decodificar(r.body.datos.token as string);
      expect(p.sub).toBe(lector.id);
      expect(p.rol).toBe('lector');
      expect((p.exp as number) - (p.iat as number)).toBe(12 * 3600);
      expect(p.iat).toBe(Math.floor(inicio.getTime() / 1000));
      expect(JSON.stringify(p)).not.toMatch(/contrasena|hash|clave/i);
    });

    it('un token roto en la cabecera no impide ingresar (es público)', async () => {
      await c
        .http()
        .post('/auth/ingreso')
        .set('Authorization', 'Bearer vencido.roto.malo')
        .send({ legajo: lector.legajo, contrasena: lector.contrasena })
        .expect(200);
    });

    it.each([
      [{}],
      [{ legajo: 'V-LEC' }],
      [{ contrasena: 'clave-de-prueba' }],
      [{ legajo: 123, contrasena: 'clave-de-prueba' }],
      [{ legajo: 'V-LEC', contrasena: 12345678 }],
      [{ legajo: ['V-LEC'], contrasena: 'clave-de-prueba' }],
      [{ legajo: { $ne: '' }, contrasena: 'clave-de-prueba' }],
      [
        {
          legajo: 'V-LEC',
          contrasena: 'clave-de-prueba',
          rol: 'administracion',
        },
      ],
      [{ email: 'a@b.com', contrasena: 'clave-de-prueba' }],
    ])('%o → 400 VALIDACION_FALLIDA en castellano', async (cuerpo) => {
      const r = await c.http().post('/auth/ingreso').send(cuerpo).expect(400);
      esperarError(r.body, 'VALIDACION_FALLIDA');
      esperarMensajeHumano(r.body);
    });

    it('un cuerpo que es una lista o null → 400, no 500', async () => {
      for (const crudo of ['[]', 'null', '"texto"', '42']) {
        const r = await c
          .http()
          .post('/auth/ingreso')
          .set('Content-Type', 'application/json')
          .send(crudo);
        expect(r.status, crudo).toBe(400);
        esperarError(r.body, 'VALIDACION_FALLIDA');
      }
    });

    it('un legajo larguísimo o con comodines de LIKE no entra: 401 o 400, nunca 500', async () => {
      for (const legajo of ['x'.repeat(5000), '%', 'V-LE_', "' OR 1=1 --"]) {
        const r = await c
          .http()
          .post('/auth/ingreso')
          .send({ legajo, contrasena: lector.contrasena });
        expect([400, 401], legajo.slice(0, 20)).toContain(r.status);
        esperarError(r.body);
      }
    });

    it('CREDENCIALES_INVALIDAS: el mensaje no dice si el legajo existe', async () => {
      const r = await c
        .http()
        .post('/auth/ingreso')
        .send({ legajo: lector.legajo, contrasena: 'equivocada-1' })
        .expect(401);
      esperarError(r.body, 'CREDENCIALES_INVALIDAS');
      esperarMensajeHumano(r.body);
      expect(r.body.error.mensaje).not.toMatch(/legajo no existe|no existe/i);
    });

    it('una contraseña vacía → 400 o 401, nunca entra', async () => {
      const r = await c
        .http()
        .post('/auth/ingreso')
        .send({ legajo: lector.legajo, contrasena: '' });
      expect([400, 401]).toContain(r.status);
    });
  });

  // ───────────────────────────── tokens ─────────────────────────────
  describe('AGENTS §7.2 / R2 — Tokens inválidos → 401 NO_AUTENTICADO', () => {
    it('alg "none" (sin firma) → 401', async () => {
      const t = `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url({
        sub: admin.id,
        rol: 'administracion',
        ver: 0,
        iat: Math.floor(inicio.getTime() / 1000),
        exp: Math.floor(inicio.getTime() / 1000) + 3600,
      })}.`;
      const r = await c.http().get('/usuarios').set(bearer(t)).expect(401);
      esperarError(r.body, 'NO_AUTENTICADO');
    });

    it('token bien firmado de un usuario que no existe → 401, no 404 ni 500', async () => {
      const ahora = Math.floor(inicio.getTime() / 1000);
      const t = firmar(
        {
          sub: 'usr-noexiste0000',
          rol: 'lector',
          ver: 0,
          iat: ahora,
          exp: ahora + 3600,
        },
        SECRETO_DE_LOS_TESTS,
      );
      const r = await c.http().get('/yo').set(bearer(t)).expect(401);
      esperarError(r.body, 'NO_AUTENTICADO');
    });

    it('un token de un lector con la firma alterada para decir administración → 401', async () => {
      const [cab, , firma] = lector.token.split('.');
      const p = decodificar(lector.token);
      const t = `${cab}.${b64url({ ...p, rol: 'administracion' })}.${firma}`;
      const r = await c.http().get('/usuarios').set(bearer(t)).expect(401);
      esperarError(r.body, 'NO_AUTENTICADO');
    });

    it('"Bearer" sin token y "Bearer " con espacios → 401', async () => {
      for (const v of ['Bearer', 'Bearer    ', `Basic ${lector.token}`]) {
        const r = await c.http().get('/yo').set('Authorization', v);
        expect(r.status, v).toBe(401);
        esperarError(r.body, 'NO_AUTENTICADO');
      }
    });

    it('R2 — vence a las 12 horas aunque cruce la medianoche del 31/12', async () => {
      c.reloj.fijar(new Date('2026-12-31T23:59:00-03:00'));
      const u = await crearUsuario(c);
      const t = await ingresar(c, u);
      c.reloj.fijar(new Date('2027-01-01T11:58:59-03:00'));
      await c.http().get('/yo').set(bearer(t)).expect(200);
      c.reloj.fijar(new Date('2027-01-01T11:59:01-03:00'));
      esperarError(
        (await c.http().get('/yo').set(bearer(t)).expect(401)).body,
        'NO_AUTENTICADO',
      );
    });

    it('un token emitido "en el futuro" (reloj atrasado) no vale antes de tiempo ni rompe', async () => {
      const u = await crearUsuario(c);
      c.reloj.fijar(new Date('2026-09-15T20:00:00-03:00'));
      const t = await ingresar(c, u);
      c.reloj.fijar(inicio);
      const r = await c.http().get('/yo').set(bearer(t));
      expect([200, 401]).toContain(r.status);
    });

    it('R2 — el blanqueo de la administración cierra también el teléfono que ingresó antes con la misma contraseña', async () => {
      const u = await crearUsuario(c);
      const t1 = await ingresar(c, u);
      await c
        .http()
        .patch(`/usuarios/${u.id}`)
        .set(bearer(admin.token))
        .send({ contrasena: u.contrasena })
        .expect(200);
      await c.http().get('/yo').set(bearer(t1)).expect(401);
    });

    it('la autenticación va antes que la validación: sin token y cuerpo malo → 401', async () => {
      const r = await c
        .http()
        .post('/usuarios')
        .send({ legajo: 5, extra: true })
        .expect(401);
      esperarError(r.body, 'NO_AUTENTICADO');
    });

    it('R3 — el permiso va antes que la validación: lector con cuerpo malo → 403', async () => {
      const r = await c
        .http()
        .post('/usuarios')
        .set(bearer(lector.token))
        .send({ legajo: 5, extra: true })
        .expect(403);
      esperarError(r.body, 'SIN_PERMISO');
      esperarMensajeHumano(r.body);
    });
  });

  // ───────────────────────────── /yo ─────────────────────────────
  describe('M0 — GET /yo y PATCH /yo', () => {
    it('GET /yo de administración y con biometría activa cumple el contrato', async () => {
      const u = await crearUsuario(c, {
        rol: 'administracion',
        biometriaActiva: true,
      });
      const t = await ingresar(c, u);
      const r = await c.http().get('/yo').set(bearer(t)).expect(200);
      esperarContrato(r.body, 'Usuario');
      expect(r.body.datos).toEqual({
        id: u.id,
        legajo: u.legajo,
        nombre: u.nombre,
        rol: 'administracion',
        biometriaActiva: true,
        rutasAsignadas: [],
      });
    });

    it('PATCH /yo devuelve el Usuario completo, con el contrato', async () => {
      const u = await conSesion(c, 'lector');
      const r = await c
        .http()
        .patch('/yo')
        .set(bearer(u.token))
        .send({ biometriaActiva: true })
        .expect(200);
      esperarContrato(r.body, 'Usuario');
      expect(r.body.datos.biometriaActiva).toBe(true);
      const r2 = await c
        .http()
        .patch('/yo')
        .set(bearer(u.token))
        .send({ biometriaActiva: false })
        .expect(200);
      expect(r2.body.datos.biometriaActiva).toBe(false);
    });

    it.each([
      [{ biometriaActiva: null }],
      [{ biometriaActiva: 'true' }],
      [{ biometriaActiva: 1 }],
      [{ contrasenaActual: null, contrasenaNueva: 'otra-clave-nueva' }],
      [{ contrasenaActual: 'clave-de-prueba', contrasenaNueva: null }],
      [{ contrasenaActual: 'clave-de-prueba', contrasenaNueva: 12345678 }],
      [{ id: 'usr-otro' }],
      [{ rutasAsignadas: ['rut-07-2026-05'] }],
    ])('%o → 400 VALIDACION_FALLIDA y no cambia nada', async (cuerpo) => {
      const u = await conSesion(c, 'lector');
      const r = await c
        .http()
        .patch('/yo')
        .set(bearer(u.token))
        .send(cuerpo)
        .expect(400);
      esperarError(r.body, 'VALIDACION_FALLIDA');
      esperarMensajeHumano(r.body);
      const yo = await c.http().get('/yo').set(bearer(u.token)).expect(200);
      expect(yo.body.datos.biometriaActiva).toBe(false);
      await ingresar(c, u);
    });

    it('A2 — con la actual equivocada la sesión en curso sigue valiendo', async () => {
      const u = await conSesion(c, 'lector');
      await c
        .http()
        .patch('/yo')
        .set(bearer(u.token))
        .send({
          contrasenaActual: 'no-es-esta',
          contrasenaNueva: 'otra-clave-1',
        })
        .expect(401);
      await c.http().get('/yo').set(bearer(u.token)).expect(200);
    });

    it('cambia contraseña y huella a la vez', async () => {
      const u = await conSesion(c, 'lector');
      const r = await c
        .http()
        .patch('/yo')
        .set(bearer(u.token))
        .send({
          contrasenaActual: u.contrasena,
          contrasenaNueva: '12345678',
          biometriaActiva: true,
        })
        .expect(200);
      expect(r.body.datos.biometriaActiva).toBe(true);
      await ingresar(c, { legajo: u.legajo, contrasena: '12345678' });
    });

    it('lo que cambia la administración en PATCH /usuarios/:id se ve en GET /yo', async () => {
      const u = await conSesion(c, 'lector');
      await c
        .http()
        .patch(`/usuarios/${u.id}`)
        .set(bearer(admin.token))
        .send({ nombre: 'Nombre Corregido' })
        .expect(200);
      const r = await c.http().get('/yo').set(bearer(u.token)).expect(200);
      expect(r.body.datos.nombre).toBe('Nombre Corregido');
    });
  });

  // ───────────────────────────── /usuarios ─────────────────────────────
  describe('M0 — POST /usuarios (R1)', () => {
    const alta = (cuerpo: Record<string, unknown>) =>
      c.http().post('/usuarios').set(bearer(admin.token)).send(cuerpo);

    it('201 con el Usuario: id usr- + 12 [a-z0-9], legajo como lo escribieron', async () => {
      const r = await alta({
        legajo: 'v-Mixto-1',
        nombre: 'Ramón Ñandú Pérez',
        rol: 'lector',
        contrasena: '12345678',
      }).expect(201);
      esperarContrato(r.body, 'Usuario');
      expect(r.body.datos.id).toMatch(/^usr-[a-z0-9]{12}$/);
      expect(r.body.datos).toMatchObject({
        legajo: 'v-Mixto-1',
        nombre: 'Ramón Ñandú Pérez',
        rol: 'lector',
        biometriaActiva: false,
        rutasAsignadas: [],
      });
      await ingresar(c, { legajo: 'V-MIXTO-1', contrasena: '12345678' });
    });

    it('R1 — el legajo con espacios alrededor choca con el mismo sin espacios', async () => {
      await alta({
        legajo: 'V-ESP-1',
        nombre: 'Uno',
        rol: 'lector',
        contrasena: 'clave-larga-1',
      }).expect(201);
      const r = await alta({
        legajo: '  v-esp-1 ',
        nombre: 'Dos',
        rol: 'lector',
        contrasena: 'clave-larga-1',
      }).expect(409);
      esperarError(r.body, 'LEGAJO_YA_REGISTRADO');
      expect(r.body.error.mensaje).toBe('Ya hay una cuenta con ese legajo.');
    });

    it.each([
      [
        {
          legajo: null,
          nombre: 'X',
          rol: 'lector',
          contrasena: 'clave-larga-1',
        },
      ],
      [
        {
          legajo: 'V-N1',
          nombre: null,
          rol: 'lector',
          contrasena: 'clave-larga-1',
        },
      ],
      [
        {
          legajo: 'V-N2',
          nombre: '   ',
          rol: 'lector',
          contrasena: 'clave-larga-1',
        },
      ],
      [{ legajo: 'V-N3', nombre: 'X', rol: null, contrasena: 'clave-larga-1' }],
      [
        {
          legajo: 'V-N4',
          nombre: 'X',
          rol: 'Lector',
          contrasena: 'clave-larga-1',
        },
      ],
      [{ legajo: 'V-N5', nombre: 'X', rol: 'lector', contrasena: null }],
      [{ legajo: 77, nombre: 'X', rol: 'lector', contrasena: 'clave-larga-1' }],
      [
        {
          legajo: 'V-N6',
          nombre: 'X',
          rol: 'lector',
          contrasena: 'clave-larga-1',
          biometriaActiva: true,
        },
      ],
      [
        {
          legajo: 'V-N7',
          nombre: 'X',
          rol: 'lector',
          contrasena: 'clave-larga-1',
          rutasAsignadas: [],
        },
      ],
      [{ legajo: '', nombre: 'X', rol: 'lector', contrasena: 'clave-larga-1' }],
    ])('%o → 400 VALIDACION_FALLIDA en castellano', async (cuerpo) => {
      const r = await alta(cuerpo).expect(400);
      esperarError(r.body, 'VALIDACION_FALLIDA');
      esperarMensajeHumano(r.body);
    });

    it('una contraseña de 8 justos entra', async () => {
      await alta({
        legajo: 'V-OCHO',
        nombre: 'Ocho',
        rol: 'lector',
        contrasena: 'abcdefgh',
      }).expect(201);
    });
  });

  describe('M0 — GET /usuarios (paginación AGENTS §4.2, filtros)', () => {
    beforeAll(async () => {
      await crearUsuario(c, { legajo: 'Q-001', nombre: 'Ramón Duarte' });
      await crearUsuario(c, {
        legajo: 'q-002',
        nombre: 'Laura Vidal',
        rol: 'administracion',
      });
      await crearUsuario(c, { legajo: 'Q-003', nombre: 'Señora 100% Pérez' });
    });
    const lista = (q: string) =>
      c.http().get(`/usuarios${q}`).set(bearer(admin.token));

    it('cumple el contrato, default 20 por página, total de la tabla sin filtro', async () => {
      const r = await lista('').expect(200);
      esperarContrato(r.body, 'Usuario');
      expect(r.body.meta.pagina).toBe(1);
      expect(r.body.meta.porPagina).toBe(20);
      expect(r.body.datos.length).toBeLessThanOrEqual(20);
      expect(r.body.meta.total).toBeGreaterThanOrEqual(5);
    });

    it('buscar sin tildes ni mayúsculas encuentra "Ramón Duarte"', async () => {
      const r = await lista('?buscar=RAMON').expect(200);
      expect(r.body.datos.map((u: { legajo: string }) => u.legajo)).toContain(
        'Q-001',
      );
    });

    it('buscar por legajo parcial, sin distinguir mayúsculas', async () => {
      const r = await lista('?buscar=q-00').expect(200);
      esperarContrato(r.body, 'Usuario');
      expect(r.body.datos.map((u: { legajo: string }) => u.legajo)).toEqual([
        'Q-001',
        'q-002',
        'Q-003',
      ]);
      expect(r.body.meta.total).toBe(3);
    });

    it('buscar "%" no es un comodín: sólo encuentra el que tiene "%"', async () => {
      const r = await lista(`?buscar=${encodeURIComponent('%')}`).expect(200);
      expect(r.body.datos.map((u: { legajo: string }) => u.legajo)).toEqual([
        'Q-003',
      ]);
    });

    it('buscar "_" no es un comodín', async () => {
      const r = await lista('?buscar=q_00').expect(200);
      expect(r.body.meta.total).toBe(0);
    });

    it.each(['\\', '\\%', 'a\\_b', '!', '[a]', "'"])(
      'buscar %j con caracteres de escape → 200 sin resultados, nunca 500',
      async (termino) => {
        const r = await lista(`?buscar=${encodeURIComponent(termino)}`).expect(
          200,
        );
        esperarContrato(r.body, 'Usuario');
        expect(r.body.meta.total).toBe(0);
      },
    );

    it('rol=administracion con buscar', async () => {
      const r = await lista('?rol=administracion&buscar=q-').expect(200);
      expect(r.body.datos.map((u: { legajo: string }) => u.legajo)).toEqual([
        'q-002',
      ]);
    });

    it('porPagina=100 vale; meta refleja lo pedido', async () => {
      const r = await lista('?pagina=1&porPagina=100').expect(200);
      expect(r.body.meta).toMatchObject({ pagina: 1, porPagina: 100 });
    });

    it('página fuera de rango con filtro: datos [] y el total filtrado', async () => {
      const r = await lista('?buscar=q-00&pagina=9&porPagina=2').expect(200);
      esperarContrato(r.body, 'Usuario');
      expect(r.body.datos).toEqual([]);
      expect(r.body.meta).toEqual({ total: 3, pagina: 9, porPagina: 2 });
    });

    it('paginar de a 1 recorre todos sin repetir ni saltear', async () => {
      const todos = (await lista('?buscar=q-00').expect(200)).body.datos.map(
        (u: { id: string }) => u.id,
      );
      const vistos: string[] = [];
      for (let p = 1; p <= 3; p++) {
        const r = await lista(`?buscar=q-00&pagina=${p}&porPagina=1`).expect(
          200,
        );
        vistos.push(r.body.datos[0].id as string);
      }
      expect(vistos).toEqual(todos);
    });

    it.each([
      '?porPagina=0',
      '?porPagina=101',
      '?porPagina=-5',
      '?pagina=0',
      '?pagina=-1',
      '?pagina=abc',
      '?pagina=1.5',
      '?porPagina=1e3',
      '?rol=jefe',
      '?rol=',
      '?pagina=1&pagina=2',
      '?ordenar=nombre',
    ])('%s → 400 VALIDACION_FALLIDA, sin 500', async (q) => {
      const r = await lista(q);
      expect(r.status).toBe(400);
      esperarError(r.body, 'VALIDACION_FALLIDA');
      esperarMensajeHumano(r.body);
    });
  });

  describe('M0 — PATCH /usuarios/:id', () => {
    it.each([
      '/usuarios/USR-011',
      '/usuarios/usr-',
      `/usuarios/usr-${'a'.repeat(60)}`,
      '/usuarios/usr-a%20b',
      '/usuarios/011',
    ])('%s → 400 VALIDACION_FALLIDA (A4)', async (ruta) => {
      const r = await c
        .http()
        .patch(ruta)
        .set(bearer(admin.token))
        .send({ nombre: 'X' })
        .expect(400);
      esperarError(r.body, 'VALIDACION_FALLIDA');
    });

    it('USUARIO_NO_ENCONTRADO con el mensaje del catálogo', async () => {
      const r = await c
        .http()
        .patch('/usuarios/usr-zzzzzzzzzzzz')
        .set(bearer(admin.token))
        .send({ nombre: 'X' })
        .expect(404);
      esperarError(r.body, 'USUARIO_NO_ENCONTRADO');
      expect(r.body.error.mensaje).toBe('No existe ese usuario.');
    });

    it.each([
      [{ nombre: null }],
      [{ contrasena: null }],
      [{ nombre: '   ' }],
      [{ nombre: 5 }],
      [{ biometriaActiva: true }],
    ])('%o → 400 y el usuario queda igual', async (cuerpo) => {
      const u = await conSesion(c, 'lector');
      const r = await c
        .http()
        .patch(`/usuarios/${u.id}`)
        .set(bearer(admin.token))
        .send(cuerpo)
        .expect(400);
      esperarError(r.body, 'VALIDACION_FALLIDA');
      const yo = await c.http().get('/yo').set(bearer(u.token)).expect(200);
      expect(yo.body.datos.nombre).toBe(u.nombre);
    });

    it('cuerpo vacío → 200 con el Usuario sin cambios y sin cerrar sesiones', async () => {
      const u = await conSesion(c, 'lector');
      const r = await c
        .http()
        .patch(`/usuarios/${u.id}`)
        .set(bearer(admin.token))
        .send({})
        .expect(200);
      esperarContrato(r.body, 'Usuario');
      expect(r.body.datos.nombre).toBe(u.nombre);
      await c.http().get('/yo').set(bearer(u.token)).expect(200);
    });

    it('después del blanqueo la contraseña vieja ya no entra', async () => {
      const u = await crearUsuario(c);
      await c
        .http()
        .patch(`/usuarios/${u.id}`)
        .set(bearer(admin.token))
        .send({ contrasena: 'blanqueo-nuevo-1' })
        .expect(200);
      esperarError(
        (
          await c
            .http()
            .post('/auth/ingreso')
            .send({ legajo: u.legajo, contrasena: u.contrasena })
            .expect(401)
        ).body,
        'CREDENCIALES_INVALIDAS',
      );
    });
  });

  // ───────────────────────────── sobre y rutas ─────────────────────────────
  describe('ESPECIFICACION §7 — RECURSO_NO_ENCONTRADO con el mensaje exacto', () => {
    it.each([
      ['get', '/auth/ingreso'],
      ['post', '/auth/registro'],
      ['delete', '/yo'],
      ['put', '/usuarios'],
      ['get', '/no-existe'],
    ])('%s %s → 404', async (metodo, ruta) => {
      const r = await c
        .http()
        [metodo as 'get' | 'post' | 'put' | 'delete'](ruta)
        .set(bearer(admin.token))
        .expect(404);
      esperarError(r.body, 'RECURSO_NO_ENCONTRADO');
      expect(r.body.error.mensaje).toBe('Esa dirección no existe en la API.');
    });
  });

  describe('AGENTS §4.1 — Las respuestas son JSON con el sobre', () => {
    it('Content-Type application/json en éxito y en error', async () => {
      const ok = await c.http().get('/yo').set(bearer(lector.token));
      expect(ok.headers['content-type']).toMatch(/application\/json/);
      const mal = await c.http().get('/yo');
      expect(mal.headers['content-type']).toMatch(/application\/json/);
    });

    it('cuerpo en text/plain a /auth/ingreso → 400 con el sobre', async () => {
      const r = await c
        .http()
        .post('/auth/ingreso')
        .set('Content-Type', 'text/plain')
        .send('legajo=V-LEC');
      expect(r.status).toBe(400);
      esperarError(r.body, 'VALIDACION_FALLIDA');
    });

    it('Swagger /docs-json es público y no documenta /auth/registro', async () => {
      const r = await c.http().get('/docs-json').expect(200);
      const rutas = Object.keys(r.body.paths as Record<string, unknown>);
      expect(rutas).not.toContain('/auth/registro');
      for (const ruta of [
        '/auth/ingreso',
        '/yo',
        '/usuarios',
        '/usuarios/{id}',
        '/salud',
        '/archivos',
        '/dispositivos',
        '/dispositivos/prueba',
      ]) {
        expect(rutas, ruta).toContain(ruta);
      }
    });
  });

  // ───────────────────────────── archivos ─────────────────────────────
  describe('AGENTS §8 — Archivos', () => {
    const subir = (contenido: Buffer, nombre: string, token = lector.token) =>
      c
        .http()
        .post('/archivos')
        .set(bearer(token))
        .attach('archivo', contenido, nombre);

    const png = () => {
      const b = Buffer.alloc(800, 1);
      b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
      return b;
    };
    const webp = () => {
      const b = Buffer.alloc(800, 1);
      b.write('RIFF', 0, 'latin1');
      b.writeUInt32LE(792, 4);
      b.write('WEBPVP8 ', 8, 'latin1');
      return b;
    };
    const mp3 = () => {
      const b = Buffer.alloc(800, 1);
      b.write('ID3', 0, 'latin1');
      b.set([0x04, 0x00, 0x00, 0, 0, 0, 0], 3);
      return b;
    };
    const gif = () => {
      const b = Buffer.alloc(800, 1);
      b.write('GIF89a', 0, 'latin1');
      return b;
    };

    it.each([
      ['png', png, 'f.png', 'imagen', /\.png$/],
      ['webp', webp, 'f.webp', 'imagen', /\.webp$/],
      ['mp3', mp3, 'n.mp3', 'audio', /\.mp3$/],
    ])('sube %s', async (_n, fabricar, nombre, tipo, ext) => {
      const contenido = fabricar();
      const r = await subir(contenido, nombre).expect(201);
      esperarContrato(r.body, 'ArchivoSubido');
      expect(r.body.datos.tipo).toBe(tipo);
      expect(r.body.datos.bytes).toBe(contenido.length);
      expect(r.body.datos.url).toMatch(ext);
    });

    it('un GIF (no permitido) → 415 TIPO_DE_ARCHIVO_NO_PERMITIDO', async () => {
      const r = await subir(gif(), 'f.gif').expect(415);
      esperarError(r.body, 'TIPO_DE_ARCHIVO_NO_PERMITIDO');
      esperarMensajeHumano(r.body);
    });

    it('un JPEG con nombre .mp4 se guarda como imagen (manda la firma)', async () => {
      const r = await subir(jpeg(), 'video.mp4').expect(201);
      expect(r.body.datos.tipo).toBe('imagen');
      expect(r.body.datos.url).toMatch(/\/imagenes\/.+\.jpg$/);
    });

    it('un video de más de 30 MB → 413 ARCHIVO_DEMASIADO_GRANDE', async () => {
      const r = await subir(mp4(30 * 1024 * 1024 + 1), 'v.mp4').expect(413);
      esperarError(r.body, 'ARCHIVO_DEMASIADO_GRANDE');
      esperarMensajeHumano(r.body);
    });

    it('el archivo en otro campo → 400', async () => {
      const r = await c
        .http()
        .post('/archivos')
        .set(bearer(lector.token))
        .attach('foto', jpeg(), 'f.jpg');
      expect(r.status).toBe(400);
      esperarError(r.body, 'VALIDACION_FALLIDA');
    });

    it('con token vencido → 401', async () => {
      const u = await conSesion(c, 'lector');
      c.reloj.avanzar(12 * 3600 * 1000 + 1000);
      const r = await subir(jpeg(), 'f.jpg', u.token).expect(401);
      esperarError(r.body, 'NO_AUTENTICADO');
    });

    it('sin TRUST_PROXY, X-Forwarded-Host/Proto no cambian la URL', async () => {
      const r = await subir(jpeg(), 'f.jpg')
        .set('Host', '192.168.0.10:3000')
        .set('X-Forwarded-Proto', 'https')
        .set('X-Forwarded-Host', 'malicioso.example.com')
        .expect(201);
      expect(r.body.datos.url).toMatch(
        /^http:\/\/192\.168\.0\.10:3000\/archivos\//,
      );
    });

    describe('GET /archivos/<clave> con Range', () => {
      const contenido = Buffer.concat([
        jpeg(4),
        Buffer.from(Array.from({ length: 96 }, (_, i) => i)),
      ]);
      let ruta: string;
      beforeAll(async () => {
        const r = await subir(contenido, 'f.jpg').expect(201);
        ruta = new URL(r.body.datos.url as string).pathname;
      });

      it('A9 — se baja sin sesión', async () => {
        await c.http().get(ruta).buffer(true).expect(200);
      });

      it('bytes=-10 (los últimos 10) → 206', async () => {
        const r = await c
          .http()
          .get(ruta)
          .set('Range', 'bytes=-10')
          .buffer(true)
          .expect(206);
        expect(r.headers['content-range']).toBe('bytes 90-99/100');
        expect(
          Buffer.from(r.body as Buffer).equals(contenido.subarray(90)),
        ).toBe(true);
      });

      it('bytes=95- (hasta el final) → 206', async () => {
        const r = await c
          .http()
          .get(ruta)
          .set('Range', 'bytes=95-')
          .buffer(true)
          .expect(206);
        expect(r.headers['content-range']).toBe('bytes 95-99/100');
        expect(r.headers['content-length']).toBe('5');
      });

      it('bytes=0-1000 (fin más allá del archivo) se recorta → 206 0-99/100', async () => {
        const r = await c
          .http()
          .get(ruta)
          .set('Range', 'bytes=0-1000')
          .buffer(true)
          .expect(206);
        expect(r.headers['content-range']).toBe('bytes 0-99/100');
        expect(Buffer.from(r.body as Buffer).equals(contenido)).toBe(true);
      });

      it('HEAD responde 200 con el largo y sin cuerpo', async () => {
        const r = await c.http().head(ruta).expect(200);
        expect(r.headers['content-length']).toBe('100');
        expect(r.headers['accept-ranges']).toBe('bytes');
      });

      it('audio y video se sirven con su tipo', async () => {
        const a = await subir(m4a(), 'n.m4a').expect(201);
        const v = await subir(mp4(), 'v.mp4').expect(201);
        const ra = await c
          .http()
          .get(new URL(a.body.datos.url).pathname)
          .buffer(true)
          .expect(200);
        const rv = await c
          .http()
          .get(new URL(v.body.datos.url).pathname)
          .buffer(true)
          .expect(200);
        expect(ra.headers['content-type']).toMatch(/^audio\//);
        expect(rv.headers['content-type']).toBe('video/mp4');
      });

      it.each([
        '/archivos/imagenes/2026/09/../../../../package.json',
        '/archivos/%2e%2e/%2e%2e/package.json',
        '/archivos/imagenes%2F..%2F..%2Fpackage.json',
      ])('%s no sale del almacén', async (r) => {
        const res = await c.http().get(r);
        expect([400, 404]).toContain(res.status);
        esperarError(res.body);
      });
    });
  });
});
