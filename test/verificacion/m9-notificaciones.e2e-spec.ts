// Verificación independiente de M9 — Notificaciones para completar (AGENTS §19.3).
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { crearDeporte, crearEspacio } from '../utilidades/espacios.js';
import { crearReserva } from '../utilidades/turnos.js';
import {
  crearUsuario,
  registrarJugador,
  type UsuarioDePrueba,
} from '../utilidades/usuarios.js';

const TOKEN = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';
const MENSAJE = 'Esta parte la programan ustedes. Mirá docs/NOTIFICACIONES.md.';
const con = (u: UsuarioDePrueba) => ({ Authorization: `Bearer ${u.token}` });

describe('AGENTS §19.3 — verificación M9 con las piezas vacías', () => {
  let a: AppDePrueba;
  beforeAll(async () => {
    a = await crearApp({
      notificacionesReales: true,
      entorno: { NOTIFICACIONES: 'expo' },
    });
  });
  afterAll(() => a.cerrar());

  describe('501 NO_IMPLEMENTADO con sobre exacto', () => {
    const llamadas = (
      u: UsuarioDePrueba,
      tokenRuta = encodeURIComponent(TOKEN),
    ) => [
      () =>
        a
          .http()
          .post('/dispositivos')
          .set(con(u))
          .send({ tokenExpo: TOKEN, plataforma: 'android' }),
      () => a.http().delete(`/dispositivos/${tokenRuta}`).set(con(u)),
      () => a.http().post('/dispositivos/prueba').set(con(u)),
      () => a.http().post('/dispositivos/prueba').set(con(u)).send({}),
    ];

    it.each([['jugador'], ['encargado'], ['administrador']] as const)(
      'rol %s: 501, sólo codigo y mensaje',
      async (rol) => {
        const u =
          rol === 'jugador'
            ? await registrarJugador(a)
            : await crearUsuario(a, rol);
        for (const f of llamadas(u)) {
          const res = await f();
          esperarError(res, 501, 'NO_IMPLEMENTADO');
          expect(res.body).toEqual({
            error: { codigo: 'NO_IMPLEMENTADO', mensaje: MENSAJE },
          });
        }
      },
    );

    it('DELETE con un token que no tiene forma de token de Expo: 400 (se valida antes del 501)', async () => {
      const u = await registrarJugador(a);
      const res = await a
        .http()
        .delete('/dispositivos/cualquier-cosa')
        .set(con(u));
      esperarError(res, 400, 'VALIDACION_FALLIDA');
    });

    it('sin token: 401; token basura: 401', async () => {
      const u = await registrarJugador(a);
      for (const f of [
        () => a.http().post('/dispositivos').send({}),
        () => a.http().delete(`/dispositivos/${encodeURIComponent(TOKEN)}`),
        () => a.http().post('/dispositivos/prueba'),
        () =>
          a
            .http()
            .post('/dispositivos/prueba')
            .set({ Authorization: `Bearer ${u.token}x` }),
      ]) {
        esperarError(await f(), 401, 'NO_AUTENTICADO');
      }
    });

    it('POST /dispositivos con cuerpo inválido sigue siendo 400', async () => {
      const u = await registrarJugador(a);
      const cuerpos = [
        {},
        { tokenExpo: TOKEN },
        { tokenExpo: TOKEN, plataforma: 'windows' },
        { tokenExpo: '', plataforma: 'ios' },
        { tokenExpo: TOKEN, plataforma: 'ios', extra: 1 },
        { tokenExpo: 5, plataforma: 'ios' },
      ];
      for (const c of cuerpos) {
        const res = await a.http().post('/dispositivos').set(con(u)).send(c);
        esperarError(res, 400, 'VALIDACION_FALLIDA');
      }
    });
  });

  describe('Swagger sigue listando los tres endpoints', () => {
    it('/docs-json', async () => {
      const res = await a.http().get('/docs-json').expect(200);
      const rutas = res.body.paths as Record<string, Record<string, unknown>>;
      expect(rutas['/dispositivos']?.post).toBeDefined();
      expect(rutas['/dispositivos/prueba']?.post).toBeDefined();
      const borrar = Object.entries(rutas).find(([r]) =>
        r.startsWith('/dispositivos/{'),
      );
      expect(borrar?.[1].delete).toBeDefined();
    });
  });

  describe('Los flujos que avisan siguen bien', () => {
    let deporteId: string;
    let espacioId: string;
    let encargado: UsuarioDePrueba;
    beforeAll(async () => {
      deporteId = (await crearDeporte(a)).id;
      encargado = await crearUsuario(a, 'encargado');
    });
    beforeEach(async () => {
      espacioId = (await crearEspacio(a, { deporteId })).id;
    });

    it('bloquear con reservas confirmadas: 201 y la reserva queda cancelada', async () => {
      const j = await registrarJugador(a);
      const r = await crearReserva(a, {
        espacioId,
        usuarioId: j.usuario.id,
        fecha: '2026-09-20',
        inicio: '19:00',
      });
      const res = await a
        .http()
        .post('/bloqueos')
        .set(con(encargado))
        .send({
          espacioIds: [espacioId],
          fecha: '2026-09-20',
          motivo: 'Cancha anegada',
        });
      expect(res.status).toBe(201);
      esperarContrato(res.body, 'Bloqueo');
      const rr = await a.http().get(`/reservas/${r.id}`).set(con(j));
      expect(rr.status).toBe(200);
      expect(rr.body.datos.estado).toBe('cancelada');
    });

    it('cancelar una reserva de un espacio favorito: 200 aunque haya favoritos', async () => {
      const dueno = await registrarJugador(a);
      const fan = await registrarJugador(a);
      await a
        .http()
        .put(`/yo/espacios-favoritos/${espacioId}`)
        .set(con(fan))
        .expect(200);
      const r = await crearReserva(a, {
        espacioId,
        usuarioId: dueno.usuario.id,
        fecha: '2026-09-21',
        inicio: '20:00',
      });
      const res = await a
        .http()
        .post(`/reservas/${r.id}/cancelacion`)
        .set(con(dueno))
        .send({});
      expect(res.status).toBe(200);
      esperarContrato(res.body, 'Reserva');
      expect(res.body.datos.estado).toBe('cancelada');
    });
  });
});
