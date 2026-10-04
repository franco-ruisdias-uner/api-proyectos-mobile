// AGENTS §19.3: mientras los alumnos no programen las dos piezas, /dispositivos responde
// 501 y los flujos que avisan siguen andando. (Los tests de verdad de /dispositivos están
// en test/notificaciones/, la consigna de los alumnos.)
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { esperarError } from '../utilidades/contrato.js';
import { registrarJugador } from '../utilidades/usuarios.js';

const TOKEN = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';

describe('AGENTS §19.3 — /dispositivos sin implementar: 501 NO_IMPLEMENTADO', () => {
  let a: AppDePrueba;
  beforeAll(async () => {
    a = await crearApp({
      notificacionesReales: true,
      entorno: { NOTIFICACIONES: 'expo' },
    });
  });
  afterAll(() => a.cerrar());

  it('POST /dispositivos, DELETE /dispositivos/:tokenExpo y POST /dispositivos/prueba responden 501 con el sobre de error', async () => {
    const j = await registrarJugador(a);
    const con = { Authorization: `Bearer ${j.token}` };
    const respuestas = [
      await a
        .http()
        .post('/dispositivos')
        .set(con)
        .send({ tokenExpo: TOKEN, plataforma: 'ios' }),
      await a.http().post('/dispositivos/prueba').set(con),
      await a
        .http()
        .delete(`/dispositivos/${encodeURIComponent(TOKEN)}`)
        .set(con),
    ];
    for (const res of respuestas) {
      esperarError(res, 501, 'NO_IMPLEMENTADO');
      expect(res.body.error.mensaje).toBe(
        'Esta parte la programan ustedes. Mirá docs/NOTIFICACIONES.md.',
      );
    }
  });

  it('sin sesión sigue siendo 401', async () => {
    esperarError(
      await a.http().post('/dispositivos/prueba'),
      401,
      'NO_AUTENTICADO',
    );
  });

  it('un flujo que avisa (cancelar el bloqueo de un turno, favoritos…) no se rompe: la push queda pendiente en el log', async () => {
    const j = await registrarJugador(a);
    // Avisos es lo que usa el dominio: con las piezas vacías no tira error.
    a.avisos.avisar([j.usuario.id], {
      titulo: 'Turno suspendido',
      cuerpo: 'Cancha anegada',
      datos: {},
    });
    await expect(a.avisos.esperarEnvios()).resolves.toBeUndefined();
  });
});
