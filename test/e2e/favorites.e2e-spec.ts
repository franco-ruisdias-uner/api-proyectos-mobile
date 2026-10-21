// M6 — Favoritos y avisos (ESPECIFICACION §4 M6, reglas R21 y R22).
// El reloj de prueba arranca el sábado 19/09/2026 a las 10:00 en Villaguay.
import type { Usuario } from '../../contract/types.js';
import { ReservaEntidad } from '../../src/modules/slots/reserva.entity.js';
import { type AppDePrueba, crearApp } from '../utilities/create-app.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import { crearDeporte, crearEspacio } from '../utilities/venues.js';
import { crearReserva } from '../utilities/slots.js';
import {
  crearUsuario,
  registrarJugador,
  type UsuarioDePrueba,
} from '../utilities/users.js';

const MANANA = '2026-09-20';
const con = (u: UsuarioDePrueba): { Authorization: string } => ({
  Authorization: `Bearer ${u.token}`,
});

describe('M6 — Favoritos y avisos', () => {
  let a: AppDePrueba;
  let deporteId: string;
  let espacioId: string;
  let jugador: UsuarioDePrueba;
  let encargado: UsuarioDePrueba;

  beforeAll(async () => {
    a = await crearApp();
    deporteId = (await crearDeporte(a)).id;
    encargado = await crearUsuario(a, 'encargado');
  });
  beforeEach(async () => {
    espacioId = (await crearEspacio(a, { deporteId })).id;
    jugador = await registrarJugador(a);
    a.enviador.vaciar();
  });
  afterAll(() => a.cerrar());

  const favorito = (u: UsuarioDePrueba, id: string) =>
    a.http().put(`/yo/espacios-favoritos/${id}`).set(con(u));
  const quitar = (u: UsuarioDePrueba, id: string) =>
    a.http().delete(`/yo/espacios-favoritos/${id}`).set(con(u));
  const yo = async (u: UsuarioDePrueba): Promise<Usuario> =>
    esperarContrato<Usuario>(
      (await a.http().get('/yo').set(con(u)).expect(200)).body,
      'Usuario',
    );
  const registrarPush = async (u: UsuarioDePrueba, token: string) => {
    await a.almacenTokens.guardar(u.usuario.id, token, 'android');
  };
  const reservaDe = (
    inicio: string,
    usuario: UsuarioDePrueba = jugador,
    fecha = MANANA,
  ) =>
    crearReserva(a, {
      espacioId,
      usuarioId: usuario.usuario.id,
      fecha,
      inicio,
    });
  const cancelar = (u: UsuarioDePrueba, id: string) =>
    a.http().post(`/reservas/${id}/cancelacion`).set(con(u)).send({});

  describe('PUT /yo/espacios-favoritos/:espacioId', () => {
    it('200 con el Usuario y el espacio en espaciosFavoritos; GET /yo lo refleja', async () => {
      const res = await favorito(jugador, espacioId).expect(200);
      const u = esperarContrato<Usuario>(res.body, 'Usuario');
      expect(u.id).toBe(jugador.usuario.id);
      expect(u.espaciosFavoritos).toEqual([espacioId]);
      expect((await yo(jugador)).espaciosFavoritos).toEqual([espacioId]);
    });

    it('es idempotente: el mismo espacio dos veces queda una sola vez', async () => {
      await favorito(jugador, espacioId).expect(200);
      const res = await favorito(jugador, espacioId).expect(200);
      expect(
        esperarContrato<Usuario>(res.body, 'Usuario').espaciosFavoritos,
      ).toEqual([espacioId]);
    });

    it('simultáneos: dos pedidos iguales dejan uno y los dos dan 200', async () => {
      const [r1, r2] = await Promise.all([
        favorito(jugador, espacioId),
        favorito(jugador, espacioId),
      ]);
      expect([r1.status, r2.status]).toEqual([200, 200]);
      expect((await yo(jugador)).espaciosFavoritos).toEqual([espacioId]);
    });

    it('los favoritos salen en el orden en que se agregaron', async () => {
      const b = (await crearEspacio(a, { deporteId })).id;
      const c = (await crearEspacio(a, { deporteId })).id;
      await favorito(jugador, c).expect(200);
      a.reloj.fijar('2026-09-19T10:00:01-03:00');
      await favorito(jugador, espacioId).expect(200);
      a.reloj.fijar('2026-09-19T10:00:02-03:00');
      await favorito(jugador, b).expect(200);
      expect((await yo(jugador)).espaciosFavoritos).toEqual([c, espacioId, b]);
      a.reloj.fijar('2026-09-19T10:00:00-03:00');
    });

    it('cada jugador tiene los suyos', async () => {
      const otro = await registrarJugador(a);
      await favorito(jugador, espacioId).expect(200);
      expect((await yo(otro)).espaciosFavoritos).toEqual([]);
    });

    it('el encargado también puede tener favoritos', async () => {
      await favorito(encargado, espacioId).expect(200);
    });

    it('el ingreso devuelve los favoritos en el Usuario', async () => {
      await favorito(jugador, espacioId).expect(200);
      const res = await a
        .http()
        .post('/auth/ingreso')
        .send({
          email: jugador.usuario.email,
          contrasena: jugador.contrasena,
        })
        .expect(200);
      const datos = (res.body as { datos: { usuario: Usuario } }).datos;
      expect(datos.usuario.espaciosFavoritos).toEqual([espacioId]);
    });

    it('401 sin token', async () => {
      const res = await a.http().put(`/yo/espacios-favoritos/${espacioId}`);
      esperarError(res, 401, 'NO_AUTENTICADO');
    });

    it('404 ESPACIO_NO_ENCONTRADO si no existe o el id no tiene forma de espacio', async () => {
      esperarError(
        await favorito(jugador, 'esp-noexiste'),
        404,
        'ESPACIO_NO_ENCONTRADO',
      );
      esperarError(
        await favorito(jugador, 'lug-0001'),
        404,
        'ESPACIO_NO_ENCONTRADO',
      );
    });
  });

  describe('DELETE /yo/espacios-favoritos/:espacioId', () => {
    it('204 sin cuerpo y deja de ser favorito', async () => {
      await favorito(jugador, espacioId).expect(200);
      const res = await quitar(jugador, espacioId).expect(204);
      expect(res.text).toBe('');
      expect((await yo(jugador)).espaciosFavoritos).toEqual([]);
    });

    it('quitar uno que no era favorito, o dos veces, también da 204', async () => {
      await quitar(jugador, espacioId).expect(204);
      await favorito(jugador, espacioId).expect(200);
      await quitar(jugador, espacioId).expect(204);
      await quitar(jugador, espacioId).expect(204);
    });

    it('no toca los favoritos de otro jugador', async () => {
      const otro = await registrarJugador(a);
      await favorito(otro, espacioId).expect(200);
      await quitar(jugador, espacioId).expect(204);
      expect((await yo(otro)).espaciosFavoritos).toEqual([espacioId]);
    });

    it('401 sin token', async () => {
      const res = await a.http().delete(`/yo/espacios-favoritos/${espacioId}`);
      esperarError(res, 401, 'NO_AUTENTICADO');
    });
  });

  describe('PATCH /yo', () => {
    const patch = (u: UsuarioDePrueba | null, cuerpo: object) => {
      const req = a.http().patch('/yo');
      return (u ? req.set(con(u)) : req).send(cuerpo);
    };

    it('200 con el Usuario actualizado (nombre y teléfono)', async () => {
      const res = await patch(jugador, {
        nombre: '  Emi Ruiz ',
        telefono: '3455-999888',
      }).expect(200);
      const u = esperarContrato<Usuario>(res.body, 'Usuario');
      expect(u).toMatchObject({
        id: jugador.usuario.id,
        nombre: 'Emi Ruiz',
        telefono: '3455-999888',
        email: jugador.usuario.email,
        rol: 'jugador',
      });
      expect(await yo(jugador)).toEqual(u);
    });

    it('con uno solo de los campos, el otro queda igual', async () => {
      const res = await patch(jugador, { nombre: 'Otro Nombre' }).expect(200);
      const u = esperarContrato<Usuario>(res.body, 'Usuario');
      expect(u.nombre).toBe('Otro Nombre');
      expect(u.telefono).toBe(jugador.usuario.telefono);
    });

    it('cuerpo vacío: 200 sin cambios', async () => {
      const res = await patch(jugador, {}).expect(200);
      expect(esperarContrato<Usuario>(res.body, 'Usuario')).toEqual(
        jugador.usuario,
      );
    });

    it('conserva los favoritos', async () => {
      await favorito(jugador, espacioId).expect(200);
      const res = await patch(jugador, { nombre: 'Con Favoritos' }).expect(200);
      expect(
        esperarContrato<Usuario>(res.body, 'Usuario').espaciosFavoritos,
      ).toEqual([espacioId]);
    });

    it('400 con nombre vacío, teléfono inválido o campos de más', async () => {
      for (const cuerpo of [
        { nombre: '   ' },
        { nombre: 'x'.repeat(81) },
        { nombre: 5 },
        { telefono: 'abc' },
        { telefono: '' },
        { telefono: null },
        { email: 'otro@mail.com' },
        { rol: 'administrador' },
        { ausencias: 0 },
        { espaciosFavoritos: [] },
      ])
        esperarError(await patch(jugador, cuerpo), 400, 'VALIDACION_FALLIDA');
      expect((await yo(jugador)).rol).toBe('jugador');
    });

    it('401 sin token', async () => {
      esperarError(await patch(null, { nombre: 'X' }), 401, 'NO_AUTENTICADO');
    });
  });

  describe('R21 — push a favoritos cuando se libera un turno futuro', () => {
    it('avisan a quienes tienen el espacio de favorito, salvo a quien canceló', async () => {
      const fan = await registrarJugador(a);
      const fan2 = await registrarJugador(a);
      const indiferente = await registrarJugador(a);
      await favorito(fan, espacioId).expect(200);
      await favorito(fan2, espacioId).expect(200);
      await favorito(jugador, espacioId).expect(200);
      await registrarPush(fan, 'ExponentPushToken[fan]');
      await registrarPush(fan2, 'ExponentPushToken[fan2]');
      await registrarPush(jugador, 'ExponentPushToken[quien-cancela]');
      await registrarPush(indiferente, 'ExponentPushToken[indiferente]');
      const r = await reservaDe('19:00');
      await a.avisos.esperarEnvios();
      a.enviador.vaciar();

      await cancelar(jugador, r.id).expect(200);
      await a.avisos.esperarEnvios();

      expect(a.enviador.enviados.flatMap((m) => m.tokens).sort()).toEqual([
        'ExponentPushToken[fan2]',
        'ExponentPushToken[fan]',
      ]);
      const m = a.enviador.enviados[0];
      expect(m.cuerpo).toContain('20/09');
      expect(m.cuerpo).toContain('19:00');
      expect(m.datos).toMatchObject({
        espacioId,
        turnoId: r.turnoId,
      });
    });

    it('sin favoritos, no se manda nada', async () => {
      await registrarPush(jugador, 'ExponentPushToken[solo]');
      const r = await reservaDe('19:00');
      await a.avisos.esperarEnvios();
      a.enviador.vaciar();
      await cancelar(jugador, r.id).expect(200);
      await a.avisos.esperarEnvios();
      expect(a.enviador.enviados).toEqual([]);
    });

    it('un favorito de otro espacio no recibe nada', async () => {
      const otroEspacio = (await crearEspacio(a, { deporteId })).id;
      const fan = await registrarJugador(a);
      await favorito(fan, otroEspacio).expect(200);
      await registrarPush(fan, 'ExponentPushToken[otro-espacio]');
      const r = await reservaDe('19:00');
      await a.avisos.esperarEnvios();
      a.enviador.vaciar();
      await cancelar(jugador, r.id).expect(200);
      await a.avisos.esperarEnvios();
      expect(a.enviador.enviados).toEqual([]);
    });

    it('quien lo quitó de favoritos ya no recibe', async () => {
      const fan = await registrarJugador(a);
      await favorito(fan, espacioId).expect(200);
      await quitar(fan, espacioId).expect(204);
      await registrarPush(fan, 'ExponentPushToken[ex-fan]');
      const r = await reservaDe('19:00');
      await a.avisos.esperarEnvios();
      a.enviador.vaciar();
      await cancelar(jugador, r.id).expect(200);
      await a.avisos.esperarEnvios();
      expect(a.enviador.enviados).toEqual([]);
    });

    it('cancelar dos veces avisa una sola vez', async () => {
      const fan = await registrarJugador(a);
      await favorito(fan, espacioId).expect(200);
      await registrarPush(fan, 'ExponentPushToken[una-vez]');
      const r = await reservaDe('19:00');
      await a.avisos.esperarEnvios();
      a.enviador.vaciar();
      await cancelar(jugador, r.id).expect(200);
      await cancelar(jugador, r.id).expect(200);
      await a.avisos.esperarEnvios();
      expect(a.enviador.enviados).toHaveLength(1);
    });

    it('si cancela el encargado (aunque sea tarde), avisa a los favoritos, dueño incluido si lo es', async () => {
      const fan = await registrarJugador(a);
      await favorito(fan, espacioId).expect(200);
      await favorito(jugador, espacioId).expect(200);
      await registrarPush(fan, 'ExponentPushToken[fan-e]');
      await registrarPush(jugador, 'ExponentPushToken[dueno-e]');
      a.reloj.fijar(`${MANANA}T10:00:00-03:00`);
      const r = await reservaDe('12:00');
      await a.avisos.esperarEnvios();
      a.enviador.vaciar();
      await cancelar(encargado, r.id).expect(200);
      await a.avisos.esperarEnvios();
      expect(a.enviador.enviados.flatMap((m) => m.tokens).sort()).toEqual([
        'ExponentPushToken[dueno-e]',
        'ExponentPushToken[fan-e]',
      ]);
      a.reloj.fijar('2026-09-19T10:00:00-03:00');
    });

    it('una cancelación rechazada (fuera de plazo) no avisa', async () => {
      const fan = await registrarJugador(a);
      await favorito(fan, espacioId).expect(200);
      await registrarPush(fan, 'ExponentPushToken[rechazada]');
      a.reloj.fijar(`${MANANA}T10:00:00-03:00`);
      const r = await reservaDe('12:00');
      await a.avisos.esperarEnvios();
      a.enviador.vaciar();
      esperarError(
        await cancelar(jugador, r.id),
        422,
        'CANCELACION_FUERA_DE_PLAZO',
      );
      await a.avisos.esperarEnvios();
      expect(a.enviador.enviados).toEqual([]);
      expect(
        (
          await a.dataSource
            .getRepository(ReservaEntidad)
            .findOneByOrFail({ id: r.id })
        ).estado,
      ).toBe('confirmada');
      a.reloj.fijar('2026-09-19T10:00:00-03:00');
    });

    it('un error del envío no rompe la cancelación', async () => {
      const fan = await registrarJugador(a);
      await favorito(fan, espacioId).expect(200);
      await registrarPush(fan, 'ExponentPushToken[falla]');
      const r = await reservaDe('19:00');
      await a.avisos.esperarEnvios();
      const original = a.enviador.enviar.bind(a.enviador);
      a.enviador.enviar = () => Promise.reject(new Error('Expo caído'));
      await cancelar(jugador, r.id).expect(200);
      await a.avisos.esperarEnvios();
      a.enviador.enviar = original;
    });
  });

  describe('R22 — el recordatorio de dos horas antes no lo manda la API', () => {
    it('reservar no genera ninguna push', async () => {
      await registrarPush(jugador, 'ExponentPushToken[recordatorio]');
      await a.avisos.esperarEnvios();
      a.enviador.vaciar();
      const res = await a
        .http()
        .post('/reservas')
        .set(con(jugador))
        .send({
          turnoId: `tur-${espacioId}-20260920-19`,
          cantidadPersonas: 4,
        });
      expect(res.status).toBe(201);
      await a.avisos.esperarEnvios();
      expect(a.enviador.enviados).toEqual([]);
    });
  });
});
