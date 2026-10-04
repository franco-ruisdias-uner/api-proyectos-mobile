// M5 — Administración (ESPECIFICACION §4 y reglas R16 a R20).
// El reloj de prueba arranca el sábado 19/09/2026 a las 10:00 en Villaguay.
import type { Bloqueo } from '../../contrato/api.js';
import type {
  Espacio,
  Reserva,
  ReservaFija,
  Turno,
  Usuario,
} from '../../contrato/tipos.js';
import { UsuarioEntidad } from '../../src/modulos/usuarios/usuario.entidad.js';
import { ReservaEntidad } from '../../src/modulos/turnos/reserva.entidad.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { crearDeporte, crearEspacio } from '../utilidades/espacios.js';
import { crearBloqueo, crearFija, crearReserva } from '../utilidades/turnos.js';
import {
  crearUsuario,
  registrarJugador,
  type UsuarioDePrueba,
} from '../utilidades/usuarios.js';

const HOY = '2026-09-19'; // sábado
const MANANA = '2026-09-20'; // domingo
const MARTES = '2026-09-22';
const con = (u: UsuarioDePrueba): { Authorization: string } => ({
  Authorization: `Bearer ${u.token}`,
});

describe('M5 — Administración', () => {
  let a: AppDePrueba;
  let deporteId: string;
  let espacioId: string;
  let encargado: UsuarioDePrueba;
  let admin: UsuarioDePrueba;
  let jugador: UsuarioDePrueba;

  beforeAll(async () => {
    a = await crearApp();
    deporteId = (await crearDeporte(a)).id;
    encargado = await crearUsuario(a, 'encargado');
    admin = await crearUsuario(a, 'administrador');
  });
  beforeEach(async () => {
    espacioId = (await crearEspacio(a, { deporteId })).id;
    jugador = await registrarJugador(a);
    a.enviador.vaciar();
  });
  afterAll(() => a.cerrar());
  afterEach(() => a.reloj.fijar(`${HOY}T10:00:00-03:00`));

  const pedir = (
    metodo: 'get' | 'post' | 'patch' | 'delete',
    ruta: string,
    u: UsuarioDePrueba | null,
    cuerpo?: object,
  ) => {
    const req = a.http()[metodo](ruta);
    const conSesion = u ? req.set(con(u)) : req;
    return cuerpo ? conSesion.send(cuerpo) : conSesion;
  };
  const bloquear = (u: UsuarioDePrueba | null, cuerpo: object) =>
    pedir('post', '/bloqueos', u, cuerpo);
  const cargarFija = (u: UsuarioDePrueba | null, cuerpo: object) =>
    pedir('post', '/fijas', u, {
      espacioId,
      titular: 'Club Atlético',
      dia: 2,
      inicio: '21:00',
      fin: '22:00',
      desde: '2026-09-01',
      ...cuerpo,
    });
  const reservaDe = (
    fecha: string,
    inicio: string,
    datos: Partial<ReservaEntidad> = {},
    usuario: UsuarioDePrueba = jugador,
  ) =>
    crearReserva(a, {
      espacioId,
      usuarioId: usuario.usuario.id,
      fecha,
      inicio,
      ...datos,
    });
  const registrarPush = async (u: UsuarioDePrueba, token: string) => {
    await a.almacenTokens.guardar(u.usuario.id, token, 'android');
  };
  const grilla = async (fecha: string): Promise<Turno[]> => {
    const res = await a
      .http()
      .get(`/espacios/${espacioId}/turnos`)
      .query({ fecha })
      .expect(200);
    return esperarContrato<Turno[]>(res.body, 'Turno');
  };
  const estadoDe = async (id: string) =>
    (await a.dataSource.getRepository(ReservaEntidad).findOneByOrFail({ id }))
      .estado;

  describe('POST /bloqueos — PRD §6, R4, R17, R18', () => {
    it('201 con los Bloqueo creados (uno por espacio), día entero con inicio y fin en null', async () => {
      const otro = (await crearEspacio(a, { deporteId })).id;
      const res = await bloquear(encargado, {
        espacioIds: [espacioId, otro],
        fecha: MANANA,
        motivo: 'Cancha anegada',
      }).expect(201);
      const datos = esperarContrato<Bloqueo[]>(res.body, 'Bloqueo');
      expect(datos).toHaveLength(2);
      expect(datos.map((b) => b.espacioId).sort()).toEqual(
        [espacioId, otro].sort(),
      );
      expect(datos[0]).toMatchObject({
        fecha: MANANA,
        inicio: null,
        fin: null,
        motivo: 'Cancha anegada',
      });
      expect(datos[0].id).toMatch(/^blo-/);
    });

    it('el administrador también puede', async () => {
      await bloquear(admin, {
        espacioIds: [espacioId],
        fecha: MANANA,
        motivo: 'Poda',
      }).expect(201);
    });

    it('un bloqueo parcial deja en mantenimiento sólo [inicio, fin) en la grilla', async () => {
      await bloquear(encargado, {
        espacioIds: [espacioId],
        fecha: MANANA,
        inicio: '10:00',
        fin: '12:00',
        motivo: 'Pintura de líneas',
      }).expect(201);
      const turnos = await grilla(MANANA);
      expect(
        turnos.filter((t) => t.estado === 'mantenimiento').map((t) => t.inicio),
      ).toEqual(['10:00', '11:00']);
      expect(turnos.find((t) => t.inicio === '10:00')?.motivoBloqueo).toBe(
        'Pintura de líneas',
      );
    });

    it('hoy se puede bloquear (la fecha no es pasada)', async () => {
      await bloquear(encargado, {
        espacioIds: [espacioId],
        fecha: HOY,
        motivo: 'Lluvia',
      }).expect(201);
    });

    it('el mismo espacio repetido en espacioIds crea un solo bloqueo', async () => {
      const res = await bloquear(encargado, {
        espacioIds: [espacioId, espacioId],
        fecha: MANANA,
        motivo: 'Lluvia',
      }).expect(201);
      expect(esperarContrato<Bloqueo[]>(res.body, 'Bloqueo')).toHaveLength(1);
    });

    describe('R18 — cancela las reservas confirmadas que cubre y avisa', () => {
      it('cancela sólo las confirmadas de turnos cubiertos, sin sumar cancelación tardía', async () => {
        const cubierta = await reservaDe(MANANA, '10:00');
        const cubierta2 = await reservaDe(MANANA, '11:00');
        const fuera = await reservaDe(MANANA, '12:00');
        const otroDia = await reservaDe(MARTES, '10:00');
        await bloquear(encargado, {
          espacioIds: [espacioId],
          fecha: MANANA,
          inicio: '10:00',
          fin: '12:00',
          motivo: 'Pintura',
        }).expect(201);
        expect(await estadoDe(cubierta.id)).toBe('cancelada');
        expect(await estadoDe(cubierta2.id)).toBe('cancelada');
        expect(await estadoDe(fuera.id)).toBe('confirmada');
        expect(await estadoDe(otroDia.id)).toBe('confirmada');
        const dueno = await a.dataSource
          .getRepository(UsuarioEntidad)
          .findOneByOrFail({ id: jugador.usuario.id });
        expect(dueno.cancelacionesTardias).toBe(0);
      });

      it('libera la ocupación de la reserva cancelada', async () => {
        const r = await reservaDe(MANANA, '10:00');
        await bloquear(encargado, {
          espacioIds: [espacioId],
          fecha: MANANA,
          motivo: 'Lluvia',
        }).expect(201);
        const fila = await a.dataSource
          .getRepository(ReservaEntidad)
          .findOneByOrFail({ id: r.id });
        expect(fila.ocupacion).toBeNull();
      });

      it('no toca las cumplidas, ausentes ni canceladas', async () => {
        const cumplida = await reservaDe(HOY, '08:00', { estado: 'cumplida' });
        const ausente = await reservaDe(HOY, '09:00', { estado: 'ausente' });
        await bloquear(encargado, {
          espacioIds: [espacioId],
          fecha: HOY,
          motivo: 'Lluvia',
        }).expect(201);
        expect(await estadoDe(cumplida.id)).toBe('cumplida');
        expect(await estadoDe(ausente.id)).toBe('ausente');
      });

      it('no cancela un turno que ya terminó', async () => {
        const pasada = await reservaDe(HOY, '08:00'); // ahora son las 10:00
        const enCurso = await reservaDe(HOY, '10:00');
        const futura = await reservaDe(HOY, '18:00');
        await bloquear(encargado, {
          espacioIds: [espacioId],
          fecha: HOY,
          motivo: 'Lluvia',
        }).expect(201);
        expect(await estadoDe(pasada.id)).toBe('confirmada');
        expect(await estadoDe(enCurso.id)).toBe('cancelada');
        expect(await estadoDe(futura.id)).toBe('cancelada');
      });

      it('cada dueño recibe una push con el motivo; quien no tiene reservas cubiertas, nada', async () => {
        const otroJugador = await registrarJugador(a);
        const sinReserva = await registrarJugador(a);
        await registrarPush(jugador, 'ExponentPushToken[dueno1]');
        await registrarPush(otroJugador, 'ExponentPushToken[dueno2]');
        await registrarPush(sinReserva, 'ExponentPushToken[nada]');
        await a.avisos.esperarEnvios();
        a.enviador.vaciar();
        const r1 = await reservaDe(MANANA, '10:00');
        await reservaDe(MANANA, '11:00', {}, otroJugador);
        await reservaDe(MANANA, '15:00', {}, jugador); // el mismo dueño, otra reserva
        await bloquear(encargado, {
          espacioIds: [espacioId],
          fecha: MANANA,
          inicio: '10:00',
          fin: '12:00',
          motivo: 'Cancha anegada',
        }).expect(201);
        await a.avisos.esperarEnvios();
        const mensajes = a.enviador.enviados;
        expect(mensajes.flatMap((m) => m.tokens).sort()).toEqual([
          'ExponentPushToken[dueno1]',
          'ExponentPushToken[dueno2]',
        ]);
        for (const m of mensajes) {
          expect(m.cuerpo).toContain('Cancha anegada');
          expect(m.cuerpo).toContain('20/09');
        }
        const delPrimero = mensajes.find((m) =>
          m.tokens.includes('ExponentPushToken[dueno1]'),
        );
        expect(delPrimero?.cuerpo).toContain('10:00');
        expect(delPrimero?.datos).toMatchObject({ reservaId: r1.id });
      });

      it('si un dueño tiene dos reservas cubiertas, recibe un aviso por cada una', async () => {
        await registrarPush(jugador, 'ExponentPushToken[dos]');
        await a.avisos.esperarEnvios();
        a.enviador.vaciar();
        await reservaDe(MANANA, '10:00');
        await reservaDe(MANANA, '11:00');
        await bloquear(encargado, {
          espacioIds: [espacioId],
          fecha: MANANA,
          motivo: 'Lluvia',
        }).expect(201);
        await a.avisos.esperarEnvios();
        expect(a.enviador.enviados.flatMap((m) => m.tokens)).toEqual([
          'ExponentPushToken[dos]',
          'ExponentPushToken[dos]',
        ]);
      });

      it('si el bloqueo no cancela nada, no se manda ninguna push', async () => {
        await registrarPush(jugador, 'ExponentPushToken[quieto]');
        await a.avisos.esperarEnvios();
        a.enviador.vaciar();
        await bloquear(encargado, {
          espacioIds: [espacioId],
          fecha: MANANA,
          motivo: 'Lluvia',
        }).expect(201);
        await a.avisos.esperarEnvios();
        expect(a.enviador.enviados).toEqual([]);
      });

      it('si falla la validación no se cancela nada ni se avisa (todo o nada)', async () => {
        const r = await reservaDe(MANANA, '10:00');
        await bloquear(encargado, {
          espacioIds: [espacioId, 'esp-noexiste'],
          fecha: MANANA,
          motivo: 'Lluvia',
        }).expect(404);
        expect(await estadoDe(r.id)).toBe('confirmada');
        expect(await a.dataSource.getRepository('BloqueoEntidad').count()).toBe(
          await a.dataSource.getRepository('BloqueoEntidad').count(),
        );
        const lista = await pedir('get', '/bloqueos', encargado).query({
          espacioId,
        });
        expect(lista.body.datos).toEqual([]);
      });

      it('una reserva cancelada por bloqueo deja el turno en mantenimiento, no libre', async () => {
        await reservaDe(MANANA, '10:00');
        await bloquear(encargado, {
          espacioIds: [espacioId],
          fecha: MANANA,
          motivo: 'Lluvia',
        }).expect(201);
        const t = (await grilla(MANANA)).find((x) => x.inicio === '10:00');
        expect(t).toMatchObject({
          estado: 'mantenimiento',
          reservaId: null,
          motivoBloqueo: 'Lluvia',
        });
      });
    });

    describe('validaciones', () => {
      const valido = () => ({
        espacioIds: [espacioId],
        fecha: MANANA,
        motivo: 'Lluvia',
      });

      it('401 sin sesión', async () => {
        esperarError(await bloquear(null, valido()), 401, 'NO_AUTENTICADO');
      });
      it('403 para un jugador (R16)', async () => {
        esperarError(await bloquear(jugador, valido()), 403, 'SIN_PERMISO');
      });
      it('422 MOTIVO_REQUERIDO si falta, es vacío o son sólo espacios', async () => {
        const { motivo: _m, ...sinMotivo } = valido();
        esperarError(
          await bloquear(encargado, sinMotivo),
          422,
          'MOTIVO_REQUERIDO',
        );
        for (const motivo of ['', '   '])
          esperarError(
            await bloquear(encargado, { ...valido(), motivo }),
            422,
            'MOTIVO_REQUERIDO',
          );
      });
      it('422 FECHA_PASADA para ayer', async () => {
        esperarError(
          await bloquear(encargado, { ...valido(), fecha: '2026-09-18' }),
          422,
          'FECHA_PASADA',
        );
      });
      it('FECHA_PASADA se mide en hora argentina: a las 00:30 del 20/09 el 19 ya pasó', async () => {
        a.reloj.fijar('2026-09-20T00:30:00-03:00');
        esperarError(
          await bloquear(encargado, { ...valido(), fecha: HOY }),
          422,
          'FECHA_PASADA',
        );
        await bloquear(encargado, valido()).expect(201);
      });
      it('404 ESPACIO_NO_ENCONTRADO si algún espacio no existe', async () => {
        esperarError(
          await bloquear(encargado, {
            ...valido(),
            espacioIds: [espacioId, 'esp-fantasma'],
          }),
          404,
          'ESPACIO_NO_ENCONTRADO',
        );
      });
      it.each([
        ['espacioIds vacío', { espacioIds: [] }],
        ['espacioIds que no es lista', { espacioIds: 'esp-02' }],
        ['id sin prefijo de espacio', { espacioIds: ['usr-1'] }],
        ['sin fecha', { fecha: undefined }],
        ['fecha mal formada', { fecha: '20/09/2026' }],
        ['fecha que no existe', { fecha: '2026-02-30' }],
        ['motivo que no es texto', { motivo: 42 }],
        ['sólo inicio', { inicio: '10:00' }],
        ['sólo fin', { fin: '12:00' }],
        ['inicio con minutos', { inicio: '10:30', fin: '12:00' }],
        ['inicio antes de las 08:00', { inicio: '07:00', fin: '12:00' }],
        ['fin después de las 24:00', { inicio: '10:00', fin: '25:00' }],
        ['inicio igual al fin', { inicio: '10:00', fin: '10:00' }],
        ['inicio después del fin', { inicio: '12:00', fin: '10:00' }],
        ['inicio null con fin', { inicio: null, fin: '12:00' }],
        ['campo de más', { color: 'rojo' }],
      ])('400 VALIDACION_FALLIDA: %s', async (_nombre, cambio) => {
        esperarError(
          await bloquear(encargado, { ...valido(), ...cambio }),
          400,
          'VALIDACION_FALLIDA',
        );
      });
      it('inicio y fin en null equivalen a día entero', async () => {
        const res = await bloquear(encargado, {
          ...valido(),
          inicio: null,
          fin: null,
        }).expect(201);
        expect(
          esperarContrato<Bloqueo[]>(res.body, 'Bloqueo')[0],
        ).toMatchObject({ inicio: null, fin: null });
      });
      it('acepta fin 24:00', async () => {
        await bloquear(encargado, {
          ...valido(),
          inicio: '22:00',
          fin: '24:00',
        }).expect(201);
      });
    });
  });

  describe('GET /bloqueos — R16', () => {
    it('lista con el contrato, desde hoy por defecto, ordenada por fecha', async () => {
      await crearBloqueo(a, { espacioId, fecha: MANANA });
      await crearBloqueo(a, { espacioId, fecha: HOY });
      await crearBloqueo(a, { espacioId, fecha: '2026-09-18' }); // ayer: no sale
      const res = await pedir('get', '/bloqueos', encargado)
        .query({ espacioId })
        .expect(200);
      const datos = esperarContrato<Bloqueo[]>(res.body, 'Bloqueo');
      expect(datos.map((b) => b.fecha)).toEqual([HOY, MANANA]);
      expect(res.body.meta).toEqual({ total: 2, pagina: 1, porPagina: 20 });
    });
    it('`desde` incluye días anteriores; `espacioId` filtra', async () => {
      const otro = (await crearEspacio(a, { deporteId })).id;
      await crearBloqueo(a, { espacioId, fecha: '2026-09-18' });
      await crearBloqueo(a, { espacioId: otro, fecha: '2026-09-18' });
      const res = await pedir('get', '/bloqueos', admin)
        .query({ espacioId, desde: '2026-09-01' })
        .expect(200);
      expect(res.body.datos).toHaveLength(1);
      expect(res.body.datos[0].espacioId).toBe(espacioId);
    });
    it('lista vacía y página fuera de rango dan datos: []', async () => {
      const vacia = await pedir('get', '/bloqueos', encargado)
        .query({ espacioId })
        .expect(200);
      expect(vacia.body).toEqual({
        datos: [],
        meta: { total: 0, pagina: 1, porPagina: 20 },
      });
      await crearBloqueo(a, { espacioId, fecha: MANANA });
      const fuera = await pedir('get', '/bloqueos', encargado)
        .query({ espacioId, pagina: 5 })
        .expect(200);
      expect(fuera.body.datos).toEqual([]);
      expect(fuera.body.meta.total).toBe(1);
    });
    it('pagina', async () => {
      for (const f of [HOY, MANANA, MARTES])
        await crearBloqueo(a, { espacioId, fecha: f });
      const res = await pedir('get', '/bloqueos', encargado)
        .query({ espacioId, porPagina: 2, pagina: 2 })
        .expect(200);
      expect(res.body.datos.map((b: Bloqueo) => b.fecha)).toEqual([MARTES]);
      expect(res.body.meta).toEqual({ total: 3, pagina: 2, porPagina: 2 });
    });
    it('401, 403 y 400', async () => {
      esperarError(
        await pedir('get', '/bloqueos', null),
        401,
        'NO_AUTENTICADO',
      );
      esperarError(
        await pedir('get', '/bloqueos', jugador),
        403,
        'SIN_PERMISO',
      );
      esperarError(
        await pedir('get', '/bloqueos', encargado).query({ desde: 'ayer' }),
        400,
        'VALIDACION_FALLIDA',
      );
      esperarError(
        await pedir('get', '/bloqueos', encargado).query({ espacioId: 'x' }),
        400,
        'VALIDACION_FALLIDA',
      );
    });
  });

  describe('DELETE /bloqueos/:id — PRD §6', () => {
    it('204 sin cuerpo; el turno vuelve a libre y las reservas canceladas siguen canceladas', async () => {
      const r = await reservaDe(MANANA, '10:00');
      const res = await bloquear(encargado, {
        espacioIds: [espacioId],
        fecha: MANANA,
        motivo: 'Lluvia',
      }).expect(201);
      const { id } = esperarContrato<Bloqueo[]>(res.body, 'Bloqueo')[0];
      const borrado = await pedir(
        'delete',
        `/bloqueos/${id}`,
        encargado,
      ).expect(204);
      expect(borrado.text).toBe('');
      expect(await estadoDe(r.id)).toBe('cancelada');
      expect((await grilla(MANANA)).every((t) => t.estado === 'libre')).toBe(
        true,
      );
    });
    it('404 BLOQUEO_NO_ENCONTRADO si no existe, ya se borró o el id está mal formado', async () => {
      const b = await crearBloqueo(a, { espacioId, fecha: MANANA });
      await pedir('delete', `/bloqueos/${b.id}`, encargado).expect(204);
      esperarError(
        await pedir('delete', `/bloqueos/${b.id}`, encargado),
        404,
        'BLOQUEO_NO_ENCONTRADO',
      );
      esperarError(
        await pedir('delete', '/bloqueos/blo-nada', encargado),
        404,
        'BLOQUEO_NO_ENCONTRADO',
      );
      esperarError(
        await pedir('delete', '/bloqueos/xyz', encargado),
        404,
        'BLOQUEO_NO_ENCONTRADO',
      );
    });
    it('401 y 403', async () => {
      const b = await crearBloqueo(a, { espacioId, fecha: MANANA });
      esperarError(
        await pedir('delete', `/bloqueos/${b.id}`, null),
        401,
        'NO_AUTENTICADO',
      );
      esperarError(
        await pedir('delete', `/bloqueos/${b.id}`, jugador),
        403,
        'SIN_PERMISO',
      );
    });
  });

  describe('GET /fijas — R16', () => {
    it('lista con el contrato y filtra por espacioId y activa', async () => {
      const otro = (await crearEspacio(a, { deporteId })).id;
      const viva = await crearFija(a, { espacioId });
      await crearFija(a, { espacioId, dia: 3, activa: false });
      await crearFija(a, { espacioId: otro });
      const todas = await pedir('get', '/fijas', encargado)
        .query({ espacioId })
        .expect(200);
      expect(
        esperarContrato<ReservaFija[]>(todas.body, 'ReservaFija'),
      ).toHaveLength(2);
      const activas = await pedir('get', '/fijas', encargado)
        .query({ espacioId, activa: 'true' })
        .expect(200);
      expect(activas.body.datos.map((f: ReservaFija) => f.id)).toEqual([
        viva.id,
      ]);
      const inactivas = await pedir('get', '/fijas', admin)
        .query({ espacioId, activa: 'false' })
        .expect(200);
      expect(inactivas.body.datos).toHaveLength(1);
      expect(inactivas.body.meta.total).toBe(1);
    });
    it('vacía, y 401, 403 y 400', async () => {
      const vacia = await pedir('get', '/fijas', encargado)
        .query({ espacioId })
        .expect(200);
      expect(vacia.body.datos).toEqual([]);
      esperarError(await pedir('get', '/fijas', null), 401, 'NO_AUTENTICADO');
      esperarError(await pedir('get', '/fijas', jugador), 403, 'SIN_PERMISO');
      esperarError(
        await pedir('get', '/fijas', encargado).query({ activa: 'quizás' }),
        400,
        'VALIDACION_FALLIDA',
      );
    });
    it('pagina', async () => {
      for (const dia of [1, 2, 3]) await crearFija(a, { espacioId, dia });
      const res = await pedir('get', '/fijas', encargado)
        .query({ espacioId, porPagina: 2 })
        .expect(200);
      expect(res.body.datos).toHaveLength(2);
      expect(res.body.meta).toEqual({ total: 3, pagina: 1, porPagina: 2 });
    });
  });

  describe('POST /fijas — R3, R19, D4', () => {
    it('201 con la ReservaFija, activa, y la grilla muestra los martes como fijo', async () => {
      const res = await cargarFija(admin, {}).expect(201);
      const f = esperarContrato<ReservaFija>(res.body, 'ReservaFija');
      expect(f).toMatchObject({
        espacioId,
        titular: 'Club Atlético',
        dia: 2,
        inicio: '21:00',
        fin: '22:00',
        desde: '2026-09-01',
        hasta: null,
        activa: true,
      });
      expect(f.id).toMatch(/^fij-/);
      const t = (await grilla(MARTES)).find((x) => x.inicio === '21:00');
      expect(t?.estado).toBe('fijo');
    });
    it('acepta `hasta` y una fija de dos horas cubre dos turnos', async () => {
      const res = await cargarFija(admin, {
        inicio: '20:00',
        fin: '22:00',
        hasta: '2026-12-31',
      }).expect(201);
      expect(esperarContrato<ReservaFija>(res.body, 'ReservaFija').hasta).toBe(
        '2026-12-31',
      );
      const fijos = (await grilla(MARTES)).filter((t) => t.estado === 'fijo');
      expect(fijos.map((t) => t.inicio)).toEqual(['20:00', '21:00']);
    });
    it('`hasta: null` explícito es lo mismo que no mandarlo', async () => {
      const res = await cargarFija(admin, { hasta: null }).expect(201);
      expect(res.body.datos.hasta).toBeNull();
    });
    it('401, y 403 para el encargado y para un jugador (R16)', async () => {
      esperarError(await cargarFija(null, {}), 401, 'NO_AUTENTICADO');
      esperarError(await cargarFija(encargado, {}), 403, 'SIN_PERMISO');
      esperarError(await cargarFija(jugador, {}), 403, 'SIN_PERMISO');
    });
    it('404 ESPACIO_NO_ENCONTRADO', async () => {
      esperarError(
        await cargarFija(admin, { espacioId: 'esp-fantasma' }),
        404,
        'ESPACIO_NO_ENCONTRADO',
      );
    });
    it.each([
      ['sin titular', { titular: undefined }],
      ['titular vacío', { titular: '  ' }],
      ['titular larguísimo', { titular: 'x'.repeat(121) }],
      ['día 7', { dia: 7 }],
      ['día -1', { dia: -1 }],
      ['día como texto', { dia: 'martes' }],
      ['día decimal', { dia: 1.5 }],
      ['inicio con minutos', { inicio: '21:30' }],
      ['inicio antes de las 08:00', { inicio: '06:00' }],
      ['fin después de las 24:00', { fin: '25:00' }],
      ['inicio igual al fin', { inicio: '21:00', fin: '21:00' }],
      ['inicio después del fin', { inicio: '22:00', fin: '21:00' }],
      ['sin desde', { desde: undefined }],
      ['desde mal formado', { desde: '1/9/2026' }],
      ['desde que no existe', { desde: '2026-02-30' }],
      ['hasta mal formado', { hasta: 'siempre' }],
      ['hasta anterior a desde', { hasta: '2026-08-31' }],
      ['espacioId sin prefijo', { espacioId: 'usr-1' }],
      ['campo de más', { activa: true }],
    ])('400 VALIDACION_FALLIDA: %s', async (_nombre, cambio) => {
      esperarError(await cargarFija(admin, cambio), 400, 'VALIDACION_FALLIDA');
    });
    it('409 FIJA_SUPERPUESTA con otra activa que se pisa', async () => {
      await crearFija(a, { espacioId });
      esperarError(
        await cargarFija(admin, { inicio: '20:00', fin: '22:00' }),
        409,
        'FIJA_SUPERPUESTA',
      );
    });
    it('no se superpone con otro día, otro espacio, horas contiguas, una dada de baja ni vigencias disjuntas', async () => {
      const otro = (await crearEspacio(a, { deporteId })).id;
      await crearFija(a, { espacioId });
      await crearFija(a, { espacioId, dia: 4, activa: false });
      await crearFija(a, { espacioId: otro });
      await cargarFija(admin, { dia: 3 }).expect(201);
      await cargarFija(admin, { inicio: '22:00', fin: '23:00' }).expect(201);
      await cargarFija(admin, { dia: 4 }).expect(201); // la de baja no cuenta
      await cargarFija(admin, {
        inicio: '08:00',
        fin: '09:00',
        desde: '2025-01-01',
        hasta: '2025-12-31',
      }).expect(201);
    });
    it('409 CONFLICTO_CON_RESERVAS con una confirmada futura, y no se crea', async () => {
      await reservaDe(MARTES, '21:00');
      esperarError(await cargarFija(admin, {}), 409, 'CONFLICTO_CON_RESERVAS');
      const lista = await pedir('get', '/fijas', admin).query({ espacioId });
      expect(lista.body.datos).toEqual([]);
    });
    it('no hay conflicto con reservas canceladas, de otro horario, de otro día de la semana, de otro espacio, pasadas o de antes de `desde`', async () => {
      const otro = (await crearEspacio(a, { deporteId })).id;
      await reservaDe(MARTES, '21:00', { estado: 'cancelada' });
      await reservaDe(MARTES, '19:00');
      await reservaDe('2026-09-23', '21:00'); // miércoles
      await crearReserva(a, {
        espacioId: otro,
        usuarioId: jugador.usuario.id,
        fecha: MARTES,
        inicio: '21:00',
      });
      await reservaDe('2026-09-15', '21:00', { estado: 'cumplida' }); // martes pasado
      await cargarFija(admin, { desde: '2026-09-22' }).expect(201);
    });
    it('una reserva del último turno cubierto no cuenta si cae justo en `fin`', async () => {
      await reservaDe(MARTES, '22:00');
      await cargarFija(admin, {}).expect(201);
    });
    it('el conflicto respeta `hasta`', async () => {
      await reservaDe(MARTES, '21:00');
      await cargarFija(admin, { hasta: '2026-09-21' }).expect(201);
    });
    it('FIJA_SUPERPUESTA se evalúa antes que CONFLICTO_CON_RESERVAS', async () => {
      await crearFija(a, { espacioId });
      await reservaDe(MARTES, '21:00');
      esperarError(await cargarFija(admin, {}), 409, 'FIJA_SUPERPUESTA');
    });
  });

  describe('PATCH /fijas/:id', () => {
    it('200 con la fija editada; sólo cambia lo que se manda', async () => {
      const f = await crearFija(a, { espacioId, desde: '2026-09-01' });
      const res = await pedir('patch', `/fijas/${f.id}`, admin, {
        titular: 'Otro club',
        fin: '23:00',
        hasta: '2026-12-31',
      }).expect(200);
      expect(esperarContrato<ReservaFija>(res.body, 'ReservaFija')).toEqual({
        id: f.id,
        espacioId,
        titular: 'Otro club',
        dia: 2,
        inicio: '21:00',
        fin: '23:00',
        desde: '2026-09-01',
        hasta: '2026-12-31',
        activa: true,
      });
    });
    it('`hasta: null` la vuelve indefinida; un cuerpo vacío no cambia nada', async () => {
      const f = await crearFija(a, { espacioId, hasta: '2026-12-31' });
      const igual = await pedir('patch', `/fijas/${f.id}`, admin, {}).expect(
        200,
      );
      expect(igual.body.datos.hasta).toBe('2026-12-31');
      const res = await pedir('patch', `/fijas/${f.id}`, admin, {
        hasta: null,
      }).expect(200);
      expect(res.body.datos.hasta).toBeNull();
    });
    it('se puede reactivar una dada de baja', async () => {
      const f = await crearFija(a, { espacioId, activa: false });
      const res = await pedir('patch', `/fijas/${f.id}`, admin, {
        activa: true,
      }).expect(200);
      expect(res.body.datos.activa).toBe(true);
    });
    it('el cambio se ve en la grilla', async () => {
      const f = await crearFija(a, { espacioId });
      await pedir('patch', `/fijas/${f.id}`, admin, { dia: 3 }).expect(200);
      expect((await grilla(MARTES)).every((t) => t.estado === 'libre')).toBe(
        true,
      );
      expect(
        (await grilla('2026-09-23')).find((t) => t.inicio === '21:00')?.estado,
      ).toBe('fijo');
    });
    it('no se superpone consigo misma (cambiar el horario de una sola)', async () => {
      const f = await crearFija(a, { espacioId });
      await pedir('patch', `/fijas/${f.id}`, admin, { inicio: '20:00' }).expect(
        200,
      );
    });
    it('409 FIJA_SUPERPUESTA si el cambio la pisa con otra', async () => {
      await crearFija(a, { espacioId });
      const otra = await crearFija(a, {
        espacioId,
        inicio: '19:00',
        fin: '20:00',
      });
      esperarError(
        await pedir('patch', `/fijas/${otra.id}`, admin, {
          fin: '22:00',
        }),
        409,
        'FIJA_SUPERPUESTA',
      );
    });
    it('409 CONFLICTO_CON_RESERVAS si el cambio cubre una reserva confirmada futura', async () => {
      const f = await crearFija(a, { espacioId });
      await reservaDe(MARTES, '20:00');
      esperarError(
        await pedir('patch', `/fijas/${f.id}`, admin, { inicio: '20:00' }),
        409,
        'CONFLICTO_CON_RESERVAS',
      );
    });
    it('editar sólo el titular no choca con reservas que ya estaban', async () => {
      const f = await crearFija(a, { espacioId });
      await reservaDe(MARTES, '21:00');
      await pedir('patch', `/fijas/${f.id}`, admin, {
        titular: 'Nuevo',
      }).expect(200);
    });
    it('404 FIJA_NO_ENCONTRADA', async () => {
      esperarError(
        await pedir('patch', '/fijas/fij-nada', admin, { titular: 'x' }),
        404,
        'FIJA_NO_ENCONTRADA',
      );
      esperarError(
        await pedir('patch', '/fijas/zzz', admin, { titular: 'x' }),
        404,
        'FIJA_NO_ENCONTRADA',
      );
    });
    it('401 y 403 (también el encargado)', async () => {
      const f = await crearFija(a, { espacioId });
      esperarError(
        await pedir('patch', `/fijas/${f.id}`, null, { titular: 'x' }),
        401,
        'NO_AUTENTICADO',
      );
      esperarError(
        await pedir('patch', `/fijas/${f.id}`, encargado, { titular: 'x' }),
        403,
        'SIN_PERMISO',
      );
    });
    it.each([
      ['inicio con minutos', { inicio: '21:30' }],
      ['inicio después del fin actual', { inicio: '22:00' }],
      ['hasta anterior a desde', { hasta: '2025-12-31' }],
      ['día 9', { dia: 9 }],
      ['titular vacío', { titular: '' }],
      ['cambiar de espacio', { espacioId: 'esp-otro' }],
      ['campo de más', { color: 'rojo' }],
    ])('400 VALIDACION_FALLIDA: %s', async (_nombre, cambio) => {
      const f = await crearFija(a, { espacioId });
      esperarError(
        await pedir('patch', `/fijas/${f.id}`, admin, cambio),
        400,
        'VALIDACION_FALLIDA',
      );
    });
  });

  describe('DELETE /fijas/:id — da de baja', () => {
    it('204 y la fija queda activa: false (sigue en la lista); el turno vuelve a libre', async () => {
      const f = await crearFija(a, { espacioId });
      const res = await pedir('delete', `/fijas/${f.id}`, admin).expect(204);
      expect(res.text).toBe('');
      const lista = await pedir('get', '/fijas', admin).query({ espacioId });
      expect(lista.body.datos).toEqual([
        expect.objectContaining({ id: f.id, activa: false }),
      ]);
      expect((await grilla(MARTES)).every((t) => t.estado === 'libre')).toBe(
        true,
      );
    });
    it('dar de baja dos veces responde 204 las dos', async () => {
      const f = await crearFija(a, { espacioId });
      await pedir('delete', `/fijas/${f.id}`, admin).expect(204);
      await pedir('delete', `/fijas/${f.id}`, admin).expect(204);
    });
    it('404, 401 y 403', async () => {
      const f = await crearFija(a, { espacioId });
      esperarError(
        await pedir('delete', '/fijas/fij-nada', admin),
        404,
        'FIJA_NO_ENCONTRADA',
      );
      esperarError(
        await pedir('delete', `/fijas/${f.id}`, null),
        401,
        'NO_AUTENTICADO',
      );
      esperarError(
        await pedir('delete', `/fijas/${f.id}`, encargado),
        403,
        'SIN_PERMISO',
      );
    });
  });

  describe('PATCH /espacios/:id — R20', () => {
    it('200 con el Espacio actualizado; la grilla usa el precio nuevo y la reserva no guarda precio (D5)', async () => {
      const res = await pedir('patch', `/espacios/${espacioId}`, admin, {
        precioPorHora: 9500,
      }).expect(200);
      expect(esperarContrato<Espacio>(res.body, 'Espacio')).toMatchObject({
        id: espacioId,
        precioPorHora: 9500,
      });
      expect((await grilla(MANANA))[0].precio).toBe(9500);
      const det = await a.http().get(`/espacios/${espacioId}`).expect(200);
      expect(det.body.datos.precioPorHora).toBe(9500);
    });
    it('también funciona con un espacio inactivo', async () => {
      const e = await crearEspacio(a, { deporteId, activo: false });
      await pedir('patch', `/espacios/${e.id}`, admin, {
        precioPorHora: 100,
      }).expect(200);
    });
    it('401, y 403 para el encargado y el jugador', async () => {
      const cuerpo = { precioPorHora: 9000 };
      esperarError(
        await pedir('patch', `/espacios/${espacioId}`, null, cuerpo),
        401,
        'NO_AUTENTICADO',
      );
      esperarError(
        await pedir('patch', `/espacios/${espacioId}`, encargado, cuerpo),
        403,
        'SIN_PERMISO',
      );
      esperarError(
        await pedir('patch', `/espacios/${espacioId}`, jugador, cuerpo),
        403,
        'SIN_PERMISO',
      );
    });
    it('404 ESPACIO_NO_ENCONTRADO', async () => {
      esperarError(
        await pedir('patch', '/espacios/esp-fantasma', admin, {
          precioPorHora: 9000,
        }),
        404,
        'ESPACIO_NO_ENCONTRADO',
      );
    });
    it.each([
      ['cero', { precioPorHora: 0 }],
      ['negativo', { precioPorHora: -5 }],
      ['decimal', { precioPorHora: 99.5 }],
      ['texto', { precioPorHora: '9000' }],
      ['null', { precioPorHora: null }],
      ['absurdamente grande', { precioPorHora: 1e12 }],
      ['sin cuerpo', {}],
      ['otro campo', { precioPorHora: 9000, nombre: 'Cancha VIP' }],
      ['sólo otro campo', { nombre: 'Cancha VIP' }],
    ])('400 VALIDACION_FALLIDA: %s', async (_nombre, cuerpo) => {
      esperarError(
        await pedir('patch', `/espacios/${espacioId}`, admin, cuerpo),
        400,
        'VALIDACION_FALLIDA',
      );
    });
  });

  it('los endpoints de M5 devuelven 401 sin token, aunque el recurso no exista', async () => {
    esperarError(
      await pedir('delete', '/bloqueos/blo-1', null),
      401,
      'NO_AUTENTICADO',
    );
    esperarError(
      await pedir('delete', '/fijas/fij-1', null),
      401,
      'NO_AUTENTICADO',
    );
  });

  it('el Usuario devuelto por /yo no cambia con los bloqueos', async () => {
    await reservaDe(MANANA, '10:00');
    await bloquear(encargado, {
      espacioIds: [espacioId],
      fecha: MANANA,
      motivo: 'Lluvia',
    }).expect(201);
    const res = await a.http().get('/yo').set(con(jugador)).expect(200);
    expect(esperarContrato<Usuario>(res.body, 'Usuario')).toMatchObject({
      cancelacionesTardias: 0,
      ausencias: 0,
    });
  });
});

// Una reserva cancelada por un bloqueo, vista por su dueño.
describe('M5 — la reserva cancelada por un bloqueo, vista por el jugador', () => {
  let a: AppDePrueba;
  beforeAll(async () => {
    a = await crearApp();
  });
  afterAll(() => a.cerrar());
  it('aparece como cancelada en GET /reservas/:id', async () => {
    const deporte = await crearDeporte(a);
    const espacio = await crearEspacio(a, { deporteId: deporte.id });
    const enc = await crearUsuario(a, 'encargado');
    const j = await registrarJugador(a);
    const r = await crearReserva(a, {
      espacioId: espacio.id,
      usuarioId: j.usuario.id,
      fecha: MANANA,
      inicio: '10:00',
    });
    await a
      .http()
      .post('/bloqueos')
      .set(con(enc))
      .send({ espacioIds: [espacio.id], fecha: MANANA, motivo: 'Lluvia' })
      .expect(201);
    const res = await a.http().get(`/reservas/${r.id}`).set(con(j)).expect(200);
    expect(esperarContrato<Reserva>(res.body, 'Reserva').estado).toBe(
      'cancelada',
    );
  });
});
