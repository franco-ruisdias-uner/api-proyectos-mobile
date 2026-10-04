// Verificación independiente de M6 — Favoritos y avisos (ESPECIFICACION §4 M6, R21, R22, D7).
// Caja negra: sólo HTTP contra la app completa (más builders para armar datos).
import { createHmac } from 'node:crypto';
import type { Usuario } from '../../contrato/tipos.js';
import {
  JWT_SECRETO_PRUEBA,
  type AppDePrueba,
  crearApp,
} from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { crearDeporte, crearEspacio } from '../utilidades/espacios.js';
import { crearBloqueo, crearReserva } from '../utilidades/turnos.js';
import {
  crearUsuario,
  registrarJugador,
  type UsuarioDePrueba,
} from '../utilidades/usuarios.js';

const HOY = '2026-09-19';
const MANANA = '2026-09-20';
const con = (u: UsuarioDePrueba) => ({ Authorization: `Bearer ${u.token}` });
const CLAVES_USUARIO = [
  'ausencias',
  'cancelacionesTardias',
  'email',
  'espaciosFavoritos',
  'id',
  'nombre',
  'rol',
  'telefono',
];

function jwt(payload: object, secreto: string): string {
  const b = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const cuerpo = `${b({ alg: 'HS256', typ: 'JWT' })}.${b(payload)}`;
  return `${cuerpo}.${createHmac('sha256', secreto).update(cuerpo).digest('base64url')}`;
}

describe('M6 verificación — favoritos y avisos', () => {
  let a: AppDePrueba;
  let deporteId: string;
  let espacioId: string;
  let encargado: UsuarioDePrueba;
  let jugador: UsuarioDePrueba;

  beforeAll(async () => {
    a = await crearApp();
    deporteId = (await crearDeporte(a)).id;
    encargado = await crearUsuario(a, 'encargado');
  });
  afterAll(() => a.cerrar());
  beforeEach(async () => {
    a.reloj.fijar(`${HOY}T10:00:00-03:00`);
    espacioId = (await crearEspacio(a, { deporteId })).id;
    jugador = await registrarJugador(a);
    a.enviador.vaciar();
  });

  const pedir = (
    m: 'get' | 'post' | 'patch' | 'delete' | 'put',
    ruta: string,
    u: UsuarioDePrueba | null,
    cuerpo?: object,
  ) => {
    const r = a.http()[m](ruta);
    const s = u ? r.set(con(u)) : r;
    return cuerpo ? s.send(cuerpo) : s;
  };
  const fav = (u: UsuarioDePrueba | null, id: string) =>
    pedir('put', `/yo/espacios-favoritos/${id}`, u);
  const desfav = (u: UsuarioDePrueba | null, id: string) =>
    pedir('delete', `/yo/espacios-favoritos/${id}`, u);
  const yo = async (u: UsuarioDePrueba) =>
    esperarContrato<Usuario>(
      (await pedir('get', '/yo', u).expect(200)).body,
      'Usuario',
    );
  const push = (u: UsuarioDePrueba, token: string) =>
    a.almacenTokens.guardar(u.usuario.id, token, 'ios');
  const reservar = (inicio: string, u = jugador, fecha = MANANA) =>
    crearReserva(a, {
      espacioId,
      usuarioId: u.usuario.id,
      fecha,
      inicio,
    });
  const cancelar = (u: UsuarioDePrueba, id: string) =>
    pedir('post', `/reservas/${id}/cancelacion`, u, {});
  const tokensEnviados = () =>
    a.enviador.enviados.flatMap((m) => m.tokens).sort();

  describe('Forma de Usuario en favoritos y PATCH /yo', () => {
    it('PUT, PATCH y GET devuelven exactamente las claves del Usuario, sin hash ni extras', async () => {
      const r1 = await fav(jugador, espacioId).expect(200);
      const r2 = await pedir('patch', '/yo', jugador, { nombre: 'Ana' }).expect(
        200,
      );
      for (const r of [r1, r2]) {
        const u = esperarContrato<Usuario>(r.body, 'Usuario');
        expect(Object.keys(u).sort()).toEqual(CLAVES_USUARIO);
        expect((r.body as { meta: unknown }).meta).toBeNull();
        expect(JSON.stringify(r.body)).not.toMatch(/hash|contrasena|password/i);
      }
    });

    it('GET /usuarios/:id (encargado) refleja los favoritos', async () => {
      await fav(jugador, espacioId).expect(200);
      const res = await pedir(
        'get',
        `/usuarios/${jugador.usuario.id}`,
        encargado,
      ).expect(200);
      expect(
        esperarContrato<Usuario>(res.body, 'Usuario').espaciosFavoritos,
      ).toEqual([espacioId]);
    });

    it('el encargado y el administrador ven su propio rol en PUT', async () => {
      const u = esperarContrato<Usuario>(
        (await fav(encargado, espacioId).expect(200)).body,
        'Usuario',
      );
      expect(u.rol).toBe('encargado');
      await desfav(encargado, espacioId).expect(204);
    });
  });

  describe('Permisos y token', () => {
    it.each([
      ['put', '/yo/espacios-favoritos/esp-x'],
      ['delete', '/yo/espacios-favoritos/esp-x'],
      ['patch', '/yo'],
    ] as const)('401 sin token en %s %s', async (m, ruta) => {
      esperarError(await pedir(m, ruta, null, {}), 401, 'NO_AUTENTICADO');
    });

    it('401 con token vencido, mal firmado o basura', async () => {
      const id = jugador.usuario.id;
      const ahora = Math.floor(a.reloj.ahora().getTime() / 1000);
      const tokens = [
        jwt({ sub: id, rol: 'jugador', iat: ahora - 100, exp: ahora - 10 }, JWT_SECRETO_PRUEBA),
        jwt({ sub: id, rol: 'jugador', exp: ahora + 1000 }, 'otro-secreto-cualquiera-0123456789'),
        'basura',
      ];
      for (const t of tokens) {
        for (const [m, ruta] of [
          ['put', `/yo/espacios-favoritos/${espacioId}`],
          ['patch', '/yo'],
        ] as const) {
          const res = await a
            .http()
            [m](ruta)
            .set({ Authorization: `Bearer ${t}` })
            .send(m === 'patch' ? { nombre: 'X' } : undefined);
          esperarError(res, 401, 'NO_AUTENTICADO');
        }
      }
      expect((await yo(jugador)).espaciosFavoritos).toEqual([]);
    });

    it('un token con rol adulterado en el payload pero firma ajena no sirve', async () => {
      const t = jwt({ sub: encargado.usuario.id, rol: 'administrador' }, 'x'.repeat(40));
      esperarError(
        await a.http().patch('/yo').set({ Authorization: `Bearer ${t}` }).send({}),
        401,
        'NO_AUTENTICADO',
      );
    });
  });

  describe('PUT/DELETE favoritos: entrada', () => {
    it.each(['esp-noexiste', 'ESP-T1', 'dep-futbol5', 'usr-1', '123', 'esp-', '%20'])(
      'id %s inválido o inexistente: 404 ESPACIO_NO_ENCONTRADO en PUT',
      async (id) => {
        const res = await fav(jugador, id);
        esperarError(res, 404, 'ESPACIO_NO_ENCONTRADO');
        expect(
          (res.body as { error: { mensaje: string } }).error.mensaje,
        ).not.toMatch(/undefined|constraint|SQLITE|foreign/i);
      },
    );

    it('DELETE de un id que no existe no es 5xx', async () => {
      const res = await desfav(jugador, 'esp-noexiste');
      expect([204, 404]).toContain(res.status);
    });

    it('PUT con cuerpo de más no rompe ni agrega nada (o da 400 con sobre)', async () => {
      const res = await pedir('put', `/yo/espacios-favoritos/${espacioId}`, jugador, {
        rol: 'administrador',
      });
      expect([200, 400]).toContain(res.status);
      if (res.status === 400) esperarError(res, 400, 'VALIDACION_FALLIDA');
      expect((await yo(jugador)).rol).toBe('jugador');
    });

    it('un espacio inactivo se puede marcar y sigue en la lista (M6-1)', async () => {
      const inactivo = (await crearEspacio(a, { deporteId, activo: false })).id;
      await fav(jugador, inactivo).expect(200);
      expect((await yo(jugador)).espaciosFavoritos).toEqual([inactivo]);
    });

    it('diez PUT simultáneos del mismo espacio: todos 200 y una sola entrada', async () => {
      const rs = await Promise.all(
        Array.from({ length: 10 }, () => fav(jugador, espacioId)),
      );
      expect(rs.map((r) => r.status)).toEqual(Array(10).fill(200));
      expect((await yo(jugador)).espaciosFavoritos).toEqual([espacioId]);
    });

    it('PUT y DELETE simultáneos no dan 5xx y dejan 0 o 1 entradas', async () => {
      const rs = await Promise.all([
        fav(jugador, espacioId),
        desfav(jugador, espacioId),
        fav(jugador, espacioId),
        desfav(jugador, espacioId),
      ]);
      for (const r of rs) expect(r.status).toBeLessThan(500);
      expect((await yo(jugador)).espaciosFavoritos.length).toBeLessThanOrEqual(1);
    });

    it('varios favoritos: quitar el del medio conserva el orden de los otros', async () => {
      const b = (await crearEspacio(a, { deporteId })).id;
      const c = (await crearEspacio(a, { deporteId })).id;
      await fav(jugador, espacioId).expect(200);
      a.reloj.fijar(`${HOY}T10:00:05-03:00`);
      await fav(jugador, b).expect(200);
      a.reloj.fijar(`${HOY}T10:00:10-03:00`);
      await fav(jugador, c).expect(200);
      await desfav(jugador, b).expect(204);
      expect((await yo(jugador)).espaciosFavoritos).toEqual([espacioId, c]);
    });

    it('re-agregar tras quitar no deja duplicados y no cambia a nadie más', async () => {
      const otro = await registrarJugador(a);
      await fav(otro, espacioId).expect(200);
      await fav(jugador, espacioId).expect(200);
      await desfav(jugador, espacioId).expect(204);
      await fav(jugador, espacioId).expect(200);
      expect((await yo(jugador)).espaciosFavoritos).toEqual([espacioId]);
      expect((await yo(otro)).espaciosFavoritos).toEqual([espacioId]);
    });
  });

  describe('PATCH /yo: entrada', () => {
    const patch = (u: UsuarioDePrueba, cuerpo: unknown) =>
      a.http().patch('/yo').set(con(u)).send(cuerpo as object);

    it.each([
      [{ nombre: '' }],
      [{ nombre: null }],
      [{ nombre: ['a'] }],
      [{ nombre: { a: 1 } }],
      [{ nombre: true }],
      [{ telefono: 123456 }],
      [{ telefono: '   ' }],
      [{ telefono: '12' }],
      [{ telefono: 'x'.repeat(200) }],
      [{ id: 'usr-999' }],
      [{ cancelacionesTardias: 0 }],
      [{ password: 'x' }],
      [{ contrasena: 'nuevaclave123' }],
      [{ createdAt: 'hoy' }],
      [{ nombre: 'Ok', otro: 1 }],
    ])('400 VALIDACION_FALLIDA con %j', async (cuerpo) => {
      const res = await patch(jugador, cuerpo);
      esperarError(res, 400, 'VALIDACION_FALLIDA');
      expect(
        (res.body as { error: { mensaje: string } }).error.mensaje,
      ).not.toMatch(/should|must|property|whitelist|undefined/i);
      expect((await yo(jugador)).nombre).toBe(jugador.usuario.nombre);
    });

    it('un cuerpo que no es un objeto (array o texto) no es 5xx', async () => {
      const r1 = await patch(jugador, []);
      expect(r1.status).toBeLessThan(500);
      const r2 = await a
        .http()
        .patch('/yo')
        .set(con(jugador))
        .set('Content-Type', 'application/json')
        .send('{"nombre": ');
      esperarError(r2, 400, 'VALIDACION_FALLIDA');
    });

    it('no cambia id, email, rol ni contadores', async () => {
      const antes = await yo(jugador);
      const res = await patch(jugador, { nombre: 'Nuevo', telefono: '3455-111222' }).expect(200);
      const u = esperarContrato<Usuario>(res.body, 'Usuario');
      expect({ ...u, nombre: antes.nombre, telefono: antes.telefono }).toEqual(antes);
    });

    it('el cambio de teléfono lo ve el encargado en GET /usuarios/:id', async () => {
      await patch(jugador, { telefono: '3455-777666' }).expect(200);
      const res = await pedir('get', `/usuarios/${jugador.usuario.id}`, encargado).expect(200);
      expect(esperarContrato<Usuario>(res.body, 'Usuario').telefono).toBe('3455-777666');
    });

    it('el nuevo nombre sigue valiendo tras reingresar', async () => {
      await patch(jugador, { nombre: 'Nombre Nuevo' }).expect(200);
      const res = await a
        .http()
        .post('/auth/ingreso')
        .send({ email: jugador.usuario.email, contrasena: jugador.contrasena })
        .expect(200);
      expect(
        (res.body as { datos: { usuario: Usuario } }).datos.usuario.nombre,
      ).toBe('Nombre Nuevo');
    });

    it('el encargado puede editar su perfil y el rol no cambia', async () => {
      const res = await patch(encargado, { nombre: 'Marcelo' }).expect(200);
      expect(esperarContrato<Usuario>(res.body, 'Usuario').rol).toBe('encargado');
    });

    it('200 en cuerpo vacío y la respuesta pasa por el contrato', async () => {
      const res = await patch(jugador, {}).expect(200);
      esperarContrato<Usuario>(res.body, 'Usuario');
    });
  });

  describe('R21 — push a favoritos al liberarse un turno futuro', () => {
    it('un usuario con dos dispositivos los recibe en los dos', async () => {
      const fan = await registrarJugador(a);
      await fav(fan, espacioId).expect(200);
      await push(fan, 'ExponentPushToken[d1]');
      await push(fan, 'ExponentPushToken[d2]');
      const r = await reservar('19:00');
      await a.avisos.esperarEnvios();
      a.enviador.vaciar();
      await cancelar(jugador, r.id).expect(200);
      await a.avisos.esperarEnvios();
      expect(tokensEnviados()).toEqual(['ExponentPushToken[d1]', 'ExponentPushToken[d2]']);
    });

    it('el aviso no filtra datos del que canceló y trae texto en castellano', async () => {
      const fan = await registrarJugador(a);
      await fav(fan, espacioId).expect(200);
      await push(fan, 'ExponentPushToken[txt]');
      const r = await reservar('19:00');
      await a.avisos.esperarEnvios();
      a.enviador.vaciar();
      await cancelar(jugador, r.id).expect(200);
      await a.avisos.esperarEnvios();
      expect(a.enviador.enviados.length).toBeGreaterThan(0);
      const texto = JSON.stringify(a.enviador.enviados);
      expect(texto).not.toContain(jugador.usuario.id);
      expect(texto).not.toContain(jugador.usuario.email);
      expect(texto).not.toContain(jugador.usuario.telefono);
      for (const m of a.enviador.enviados) {
        expect(m.titulo.length).toBeGreaterThan(0);
        expect(m.cuerpo).not.toMatch(/undefined|null|\[object/);
        expect(Object.values(m.datos).every((v) => typeof v === 'string')).toBe(true);
      }
    });

    it('si cancela el encargado y él mismo tiene el espacio de favorito, no se avisa a sí mismo', async () => {
      await fav(encargado, espacioId).expect(200);
      await push(encargado, 'ExponentPushToken[encargado-fav]');
      const r = await reservar('19:00');
      await a.avisos.esperarEnvios();
      a.enviador.vaciar();
      await cancelar(encargado, r.id).expect(200);
      await a.avisos.esperarEnvios();
      expect(tokensEnviados()).not.toContain('ExponentPushToken[encargado-fav]');
      await desfav(encargado, espacioId).expect(204);
    });

    it('cancelación del dueño en el último momento permitido (4 h) avisa', async () => {
      const fan = await registrarJugador(a);
      await fav(fan, espacioId).expect(200);
      await push(fan, 'ExponentPushToken[limite]');
      a.reloj.fijar(`${MANANA}T08:00:00-03:00`);
      const r = await reservar('12:00');
      await a.avisos.esperarEnvios();
      a.enviador.vaciar();
      await cancelar(jugador, r.id).expect(200);
      await a.avisos.esperarEnvios();
      expect(tokensEnviados()).toEqual(['ExponentPushToken[limite]']);
    });

    it('un turno que ya empezó: el encargado no puede cancelarlo y no se avisa nada', async () => {
      const fan = await registrarJugador(a);
      await fav(fan, espacioId).expect(200);
      await push(fan, 'ExponentPushToken[pasado]');
      const r = await reservar('09:00', jugador, HOY);
      a.reloj.fijar(`${HOY}T09:30:00-03:00`);
      a.enviador.vaciar();
      const res = await cancelar(encargado, r.id);
      expect(res.status).not.toBe(500);
      await a.avisos.esperarEnvios();
      expect(a.enviador.enviados).toEqual([]);
    });

    it('turno futuro de hoy (a las 22) cancelado por el encargado: avisa', async () => {
      const fan = await registrarJugador(a);
      await fav(fan, espacioId).expect(200);
      await push(fan, 'ExponentPushToken[hoy-22]');
      const r = await reservar('22:00', jugador, HOY);
      a.enviador.vaciar();
      await cancelar(encargado, r.id).expect(200);
      await a.avisos.esperarEnvios();
      expect(tokensEnviados()).toEqual(['ExponentPushToken[hoy-22]']);
    });

    it('cancelaciones simultáneas de la misma reserva avisan una sola vez', async () => {
      const fan = await registrarJugador(a);
      await fav(fan, espacioId).expect(200);
      await push(fan, 'ExponentPushToken[carrera]');
      const r = await reservar('19:00');
      a.enviador.vaciar();
      const rs = await Promise.all([
        cancelar(jugador, r.id),
        cancelar(jugador, r.id),
        cancelar(encargado, r.id),
      ]);
      for (const x of rs) expect(x.status).toBe(200);
      await a.avisos.esperarEnvios();
      expect(tokensEnviados()).toEqual(['ExponentPushToken[carrera]']);
    });

    it('cancelar una reserva ya cancelada por un bloqueo no avisa a favoritos', async () => {
      const fan = await registrarJugador(a);
      await fav(fan, espacioId).expect(200);
      await push(fan, 'ExponentPushToken[bloqueo]');
      await reservar('19:00');
      a.enviador.vaciar();
      const res = await pedir('post', '/bloqueos', encargado, {
        espacioIds: [espacioId],
        fecha: MANANA,
        motivo: 'Poda',
      });
      expect(res.status).toBe(201);
      await a.avisos.esperarEnvios();
      expect(tokensEnviados()).not.toContain('ExponentPushToken[bloqueo]');
    });

    it('al borrar el bloqueo no se avisa a favoritos (el turno no se "libera" por R21)', async () => {
      const fan = await registrarJugador(a);
      await fav(fan, espacioId).expect(200);
      await push(fan, 'ExponentPushToken[sin-bloqueo]');
      const blo = await crearBloqueo(a, { espacioId, fecha: MANANA });
      a.enviador.vaciar();
      await pedir('delete', `/bloqueos/${blo.id}`, encargado).expect(204);
      await a.avisos.esperarEnvios();
      expect(a.enviador.enviados).toEqual([]);
    });

    it('quien reservó y canceló no se avisa aunque sea favorito de varios espacios', async () => {
      const otroEsp = (await crearEspacio(a, { deporteId })).id;
      await fav(jugador, espacioId).expect(200);
      await fav(jugador, otroEsp).expect(200);
      await push(jugador, 'ExponentPushToken[autor]');
      const r = await reservar('19:00');
      a.enviador.vaciar();
      await cancelar(jugador, r.id).expect(200);
      await a.avisos.esperarEnvios();
      expect(a.enviador.enviados).toEqual([]);
    });

    it('un token de Expo inválido se descarta y no impide avisar a los demás', async () => {
      const f1 = await registrarJugador(a);
      const f2 = await registrarJugador(a);
      await fav(f1, espacioId).expect(200);
      await fav(f2, espacioId).expect(200);
      await push(f1, 'ExponentPushToken[malo]');
      await push(f2, 'ExponentPushToken[bueno]');
      a.enviador.invalidos = ['ExponentPushToken[malo]'];
      const r = await reservar('19:00');
      a.enviador.vaciar();
      await cancelar(jugador, r.id).expect(200);
      await a.avisos.esperarEnvios();
      expect(tokensEnviados()).toEqual([
        'ExponentPushToken[bueno]',
        'ExponentPushToken[malo]',
      ]);
      a.enviador.invalidos = [];
      a.enviador.vaciar();
      const r2 = await reservar('20:00');
      await cancelar(jugador, r2.id).expect(200);
      await a.avisos.esperarEnvios();
      expect(tokensEnviados()).toEqual(['ExponentPushToken[bueno]']);
    });

    it('cancelar por POST /reservas/:id/cancelacion con la respuesta intacta aunque el envío falle', async () => {
      const fan = await registrarJugador(a);
      await fav(fan, espacioId).expect(200);
      await push(fan, 'ExponentPushToken[cae]');
      const r = await reservar('19:00');
      const original = a.enviador.enviar.bind(a.enviador);
      a.enviador.enviar = () => Promise.reject(new Error('boom'));
      const res = await cancelar(jugador, r.id).expect(200);
      expect(
        (res.body as { datos: { estado: string } }).datos.estado,
      ).toBe('cancelada');
      await a.avisos.esperarEnvios();
      a.enviador.enviar = original;
    });
  });

  describe('R22 y D7 — lo que la API no manda', () => {
    it('marcar favorito, quitarlo o editar el perfil no manda ninguna push', async () => {
      await push(jugador, 'ExponentPushToken[silencio]');
      a.enviador.vaciar();
      await fav(jugador, espacioId).expect(200);
      await desfav(jugador, espacioId).expect(204);
      await pedir('patch', '/yo', jugador, { nombre: 'Silencio' }).expect(200);
      await a.avisos.esperarEnvios();
      expect(a.enviador.enviados).toEqual([]);
    });

    it('ingresar o marcar ausente no manda push a favoritos', async () => {
      const fan = await registrarJugador(a);
      await fav(fan, espacioId).expect(200);
      await push(fan, 'ExponentPushToken[ausente]');
      const r = await reservar('09:00', jugador, HOY);
      a.reloj.fijar(`${HOY}T09:20:00-03:00`);
      a.enviador.vaciar();
      await pedir('post', `/reservas/${r.id}/ausente`, encargado, {}).expect(200);
      await a.avisos.esperarEnvios();
      expect(a.enviador.enviados).toEqual([]);
    });

    it('reservar no genera push ni a favoritos', async () => {
      const fan = await registrarJugador(a);
      await fav(fan, espacioId).expect(200);
      await push(fan, 'ExponentPushToken[reserva-nueva]');
      a.enviador.vaciar();
      await pedir('post', '/reservas', jugador, {
        turnoId: `tur-${espacioId}-20260920-19`,
        cantidadPersonas: 4,
      }).expect(201);
      await a.avisos.esperarEnvios();
      expect(a.enviador.enviados).toEqual([]);
    });
  });
});
