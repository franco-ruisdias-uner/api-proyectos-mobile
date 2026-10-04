// Verificación independiente de M5 — Administración (ESPECIFICACION §4 M5, R16-R20, D4, D5, D12).
// Caja negra: sólo HTTP contra la app completa (más builders para armar datos).
import { createHmac } from 'node:crypto';
import type { Bloqueo } from '../../contrato/api.js';
import type {
  Espacio,
  Reserva,
  ReservaFija,
  Turno,
  Usuario,
} from '../../contrato/tipos.js';
import {
  JWT_SECRETO_PRUEBA,
  type AppDePrueba,
  crearApp,
} from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { crearDeporte, crearEspacio } from '../utilidades/espacios.js';
import { crearBloqueo, crearFija, crearReserva } from '../utilidades/turnos.js';
import {
  crearUsuario,
  registrarJugador,
  type UsuarioDePrueba,
} from '../utilidades/usuarios.js';

const HOY = '2026-09-19'; // sábado
const MANANA = '2026-09-20';
const MARTES = '2026-09-22';
const MIERCOLES = '2026-09-23';
const con = (u: UsuarioDePrueba) => ({ Authorization: `Bearer ${u.token}` });
const CLAVES_BLOQUEO = ['espacioId', 'fecha', 'fin', 'id', 'inicio', 'motivo'];
const CLAVES_FIJA = [
  'activa',
  'desde',
  'dia',
  'espacioId',
  'fin',
  'hasta',
  'id',
  'inicio',
  'titular',
];

function jwt(payload: object, secreto: string): string {
  const b = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const cuerpo = `${b({ alg: 'HS256', typ: 'JWT' })}.${b(payload)}`;
  return `${cuerpo}.${createHmac('sha256', secreto).update(cuerpo).digest('base64url')}`;
}
const esperarMensajeLimpio = (res: { body: unknown }) => {
  const m = (res.body as { error: { mensaje: string } }).error.mensaje;
  expect(m).not.toMatch(
    /undefined|must be|should|property|whitelist|\bDTO\b|TypeError|SQLITE|constraint/i,
  );
};
/** Error esperado: estado entre los admitidos y sobre exacto. */
const esperarFallo = (
  res: import('supertest').Response,
  estados: number[],
  codigo?: string,
) => {
  expect(estados, JSON.stringify(res.body)).toContain(res.status);
  esperarError(
    res,
    res.status,
    codigo ?? (res.body as { error: { codigo: string } }).error?.codigo,
  );
  esperarMensajeLimpio(res);
};

describe('M5 verificación — administración', () => {
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
  const bloquear = (u: UsuarioDePrueba | null, cuerpo: object) =>
    pedir('post', '/bloqueos', u, cuerpo);
  const bloqueoBase = (extra: object = {}) => ({
    espacioIds: [espacioId],
    fecha: MANANA,
    motivo: 'Poda',
    ...extra,
  });
  const fijaBase = (extra: object = {}) => ({
    espacioId,
    titular: 'Club Atlético',
    dia: 2,
    inicio: '21:00',
    fin: '22:00',
    desde: '2026-09-01',
    ...extra,
  });
  const cargarFija = (u: UsuarioDePrueba | null, extra: object = {}) =>
    pedir('post', '/fijas', u, fijaBase(extra));
  const reservaDe = (
    fecha: string,
    inicio: string,
    extra: object = {},
    dueno: UsuarioDePrueba = jugador,
    esp: string = espacioId,
  ) =>
    crearReserva(a, {
      espacioId: esp,
      usuarioId: dueno.usuario.id,
      fecha,
      inicio,
      ...extra,
    });
  const grilla = async (fecha: string, esp = espacioId) =>
    esperarContrato<Turno[]>(
      (
        await a
          .http()
          .get(`/espacios/${esp}/turnos`)
          .query({ fecha })
          .expect(200)
      ).body,
      'Turno',
    );
  const usuario = async (id: string) =>
    (await pedir('get', `/usuarios/${id}`, encargado).expect(200)).body
      .datos as Usuario;
  const reserva = async (id: string) =>
    esperarContrato<Reserva>(
      (await pedir('get', `/reservas/${id}`, encargado).expect(200)).body,
      'Reserva',
    );
  const registrarPush = (u: UsuarioDePrueba, token: string) =>
    a.almacenTokens.guardar(u.usuario.id, token, 'android');
  const espera = () => new Promise((r) => setTimeout(r, 150));

  // ---------------------------------------------------------------- permisos
  describe('R16 — permisos y autenticación en los ocho endpoints', () => {
    const rutas: Array<[string, string, 'encargado' | 'admin']> = [
      ['post', '/bloqueos', 'encargado'],
      ['get', '/bloqueos', 'encargado'],
      ['delete', '/bloqueos/blo-abc123', 'encargado'],
      ['get', '/fijas', 'encargado'],
      ['post', '/fijas', 'admin'],
      ['patch', '/fijas/fij-abc123', 'admin'],
      ['delete', '/fijas/fij-abc123', 'admin'],
      ['patch', '/espacios/esp-abc123', 'admin'],
    ];
    type Agente = Record<string, (r: string) => import('supertest').Test>;
    const ag = () => a.http() as never as Agente;
    it.each(rutas)('%s %s: sin token → 401', async (m, ruta) => {
      esperarError(await ag()[m](ruta), 401, 'NO_AUTENTICADO');
    });
    it.each(rutas)('%s %s: token mal firmado → 401', async (m, ruta) => {
      const t = jwt(
        { sub: admin.usuario.id, rol: 'administrador', exp: 9999999999 },
        'otro-secreto',
      );
      esperarError(
        await ag()[m](ruta).set('Authorization', `Bearer ${t}`),
        401,
        'NO_AUTENTICADO',
      );
    });
    it.each(rutas)('%s %s: token vencido → 401', async (m, ruta) => {
      const t = jwt(
        { sub: admin.usuario.id, rol: 'administrador', iat: 1000, exp: 2000 },
        JWT_SECRETO_PRUEBA,
      );
      esperarError(
        await ag()[m](ruta).set('Authorization', `Bearer ${t}`),
        401,
        'NO_AUTENTICADO',
      );
    });
    it.each(rutas)('%s %s: jugador → 403 SIN_PERMISO', async (m, ruta) => {
      esperarError(await ag()[m](ruta).set(con(jugador)), 403, 'SIN_PERMISO');
    });
    it.each(rutas.filter((r) => r[2] === 'admin'))(
      '%s %s: encargado → 403 SIN_PERMISO (sólo administrador)',
      async (m, ruta) => {
        esperarError(
          await ag()[m](ruta).set(con(encargado)),
          403,
          'SIN_PERMISO',
        );
      },
    );
    it('el 403 llega antes que la validación o el 404 (jugador con cuerpo inválido)', async () => {
      esperarError(
        await pedir('post', '/bloqueos', jugador, { basura: 1 }),
        403,
        'SIN_PERMISO',
      );
      esperarError(
        await pedir('patch', '/espacios/esp-noexiste', encargado, {
          precioPorHora: -5,
        }),
        403,
        'SIN_PERMISO',
      );
    });
  });

  // ---------------------------------------------------------------- bloqueos
  describe('POST /bloqueos — forma y R4/R17 (D12)', () => {
    it('Bloqueo con exactamente las claves del tipo, con y sin horas', async () => {
      const dia = await bloquear(encargado, bloqueoBase()).expect(201);
      const [entero] = esperarContrato<Bloqueo[]>(dia.body, 'Bloqueo');
      expect(Object.keys(entero).sort()).toEqual(CLAVES_BLOQUEO);
      expect(entero.inicio).toBeNull();
      expect(entero.fin).toBeNull();
      const parcial = await bloquear(
        encargado,
        bloqueoBase({ fecha: MARTES, inicio: '08:00', fin: '09:00' }),
      ).expect(201);
      const [p] = esperarContrato<Bloqueo[]>(parcial.body, 'Bloqueo');
      expect(p).toMatchObject({ inicio: '08:00', fin: '09:00' });
    });

    it('inicio y fin explícitamente null equivalen a día entero', async () => {
      const res = await bloquear(
        encargado,
        bloqueoBase({ inicio: null, fin: null }),
      ).expect(201);
      const [b] = esperarContrato<Bloqueo[]>(res.body, 'Bloqueo');
      expect(b.inicio).toBeNull();
    });

    it('el motivo se guarda sin espacios sobrantes o tal cual, nunca vacío', async () => {
      const res = await bloquear(
        encargado,
        bloqueoBase({ motivo: '  Cancha anegada  ' }),
      ).expect(201);
      const [b] = esperarContrato<Bloqueo[]>(res.body, 'Bloqueo');
      expect(b.motivo.trim()).toBe('Cancha anegada');
    });

    it('termina en 24:00 (último turno 23-24)', async () => {
      const res = await bloquear(
        encargado,
        bloqueoBase({ inicio: '23:00', fin: '24:00' }),
      ).expect(201);
      esperarContrato<Bloqueo[]>(res.body, 'Bloqueo');
      const t = await grilla(MANANA);
      expect(t[15].estado).toBe('mantenimiento');
      expect(t[14].estado).toBe('libre');
    });

    it('día entero bloquea los 16 turnos', async () => {
      await bloquear(encargado, bloqueoBase()).expect(201);
      const t = await grilla(MANANA);
      expect(t).toHaveLength(16);
      expect(t.every((x) => x.estado === 'mantenimiento')).toBe(true);
      expect(t.every((x) => x.motivoBloqueo === 'Poda')).toBe(true);
    });

    it('MOTIVO_REQUERIDO: ausente, vacío, sólo espacios', async () => {
      for (const motivo of [undefined, '', '   ']) {
        const cuerpo: Record<string, unknown> = bloqueoBase();
        if (motivo === undefined) delete cuerpo.motivo;
        else cuerpo.motivo = motivo;
        esperarFallo(
          await bloquear(encargado, cuerpo),
          [422],
          'MOTIVO_REQUERIDO',
        );
      }
    });

    it('FECHA_PASADA ayer; hoy sí se puede', async () => {
      esperarFallo(
        await bloquear(encargado, bloqueoBase({ fecha: '2026-09-18' })),
        [422],
        'FECHA_PASADA',
      );
      await bloquear(encargado, bloqueoBase({ fecha: HOY })).expect(201);
    });

    it('FECHA_PASADA se calcula en hora argentina (21/09 01:30Z es 20/09 22:30 local)', async () => {
      a.reloj.fijar('2026-09-20T01:30:00Z');
      await bloquear(encargado, bloqueoBase({ fecha: HOY })).expect(201);
    });

    it('31/12 23:59 sí se puede bloquear ese día; a las 00:00 del 1/1 ya es FECHA_PASADA', async () => {
      a.reloj.fijar('2026-12-31T23:59:00-03:00');
      const enc = await crearUsuario(a, 'encargado');
      await bloquear(enc, bloqueoBase({ fecha: '2026-12-31' })).expect(201);
      a.reloj.fijar('2027-01-01T00:00:00-03:00');
      esperarFallo(
        await bloquear(enc, bloqueoBase({ fecha: '2026-12-31' })),
        [422],
        'FECHA_PASADA',
      );
      await bloquear(enc, bloqueoBase({ fecha: '2027-01-01' })).expect(201);
    });

    it('último día del mes: 30/09 se puede bloquear un 30/09 a las 23:59', async () => {
      a.reloj.fijar('2026-09-30T23:59:00-03:00');
      await bloquear(encargado, bloqueoBase({ fecha: '2026-09-30' })).expect(
        201,
      );
      await bloquear(encargado, bloqueoBase({ fecha: '2026-10-01' })).expect(
        201,
      );
    });

    it.each([
      ['inicio sin fin', { inicio: '10:00' }],
      ['fin sin inicio', { fin: '11:00' }],
      ['inicio = fin', { inicio: '10:00', fin: '10:00' }],
      ['inicio > fin', { inicio: '12:00', fin: '10:00' }],
      ['hora no en punto', { inicio: '10:30', fin: '12:00' }],
      ['fin no en punto', { inicio: '10:00', fin: '11:15' }],
      ['antes de las 08:00', { inicio: '07:00', fin: '09:00' }],
      ['después de 24:00', { inicio: '23:00', fin: '25:00' }],
      ['inicio 24:00', { inicio: '24:00', fin: '24:00' }],
      ['formato H:MM', { inicio: '9:00', fin: '10:00' }],
      ['con segundos', { inicio: '10:00:00', fin: '11:00:00' }],
      ['no es hora', { inicio: 'abc', fin: 'def' }],
      ['hora numérica', { inicio: 10, fin: 11 }],
    ])('horas inválidas (%s) → 400/422', async (_n, extra) => {
      esperarFallo(await bloquear(encargado, bloqueoBase(extra)), [400, 422]);
    });

    it.each([
      ['espacioIds vacío', { espacioIds: [] }],
      ['espacioIds no es lista', { espacioIds: 'esp-1' }],
      ['espacioIds con id sin prefijo', { espacioIds: ['123'] }],
      ['espacioIds con numérico', { espacioIds: [5] }],
      ['sin espacioIds', { espacioIds: undefined }],
      ['fecha mal formada', { fecha: '2026-9-20' }],
      ['fecha imposible', { fecha: '2026-02-30' }],
      ['fecha con hora', { fecha: '2026-09-20T10:00:00-03:00' }],
      ['fecha numérica', { fecha: 20260920 }],
      ['sin fecha', { fecha: undefined }],
      ['motivo no es texto', { motivo: 42 }],
      ['campo de más', { creadoEn: 'x' }],
      ['campo password de más', { password: 'x' }],
    ])('entrada inválida (%s) → 400', async (_n, extra) => {
      const cuerpo: Record<string, unknown> = { ...bloqueoBase(), ...extra };
      for (const k of Object.keys(cuerpo))
        if (cuerpo[k] === undefined) delete cuerpo[k];
      esperarFallo(
        await bloquear(encargado, cuerpo),
        [400],
        'VALIDACION_FALLIDA',
      );
    });

    it('cuerpo vacío → 400', async () => {
      esperarFallo(await bloquear(encargado, {}), [400, 422]);
    });

    it('espacio inexistente → 404 ESPACIO_NO_ENCONTRADO y no crea nada (atomicidad)', async () => {
      esperarFallo(
        await bloquear(
          encargado,
          bloqueoBase({ espacioIds: [espacioId, 'esp-noexiste'] }),
        ),
        [404],
        'ESPACIO_NO_ENCONTRADO',
      );
      const lista = await pedir('get', '/bloqueos', encargado).query({
        espacioId,
      });
      expect(lista.body.datos).toEqual([]);
    });

    it('no se puede bloquear más de siete días adelante sin error de rango (bloquear no está limitado por R6)', async () => {
      const res = await bloquear(
        encargado,
        bloqueoBase({ fecha: '2026-12-01' }),
      );
      expect(res.status).toBe(201);
    });
  });

  describe('R18 — al bloquear se cancelan las reservas confirmadas y se avisa', () => {
    it('cancela sólo las confirmadas cubiertas, no suma tardía, y avisa al dueño con el motivo', async () => {
      const otro = await registrarJugador(a);
      await registrarPush(jugador, 'ExponentPushToken[dueno1]');
      await registrarPush(otro, 'ExponentPushToken[ajeno1]');
      const r1 = await reservaDe(MANANA, '10:00');
      const r2 = await reservaDe(MANANA, '11:00');
      const fuera = await reservaDe(MANANA, '12:00');
      const otroDia = await reservaDe(MARTES, '10:00');
      const cumplida = await reservaDe(MANANA, '08:00', {
        estado: 'cumplida',
        ocupacion: `${espacioId}|${MANANA}|08:00`,
      });
      const ajena = await reservaDe(
        MANANA,
        '10:00',
        {},
        otro,
        (await crearEspacio(a, { deporteId })).id,
      );
      a.enviador.vaciar();

      await bloquear(
        encargado,
        bloqueoBase({
          inicio: '10:00',
          fin: '12:00',
          motivo: 'Pintura de líneas',
        }),
      ).expect(201);
      await espera();

      expect((await reserva(r1.id)).estado).toBe('cancelada');
      expect((await reserva(r2.id)).estado).toBe('cancelada');
      expect((await reserva(fuera.id)).estado).toBe('confirmada'); // fin exclusivo
      expect((await reserva(otroDia.id)).estado).toBe('confirmada');
      expect((await reserva(cumplida.id)).estado).toBe('cumplida');
      expect((await reserva(ajena.id)).estado).toBe('confirmada'); // otro espacio
      expect((await usuario(jugador.usuario.id)).cancelacionesTardias).toBe(0);

      const paraDueno = a.enviador.enviados.filter((m) =>
        m.tokens.includes('ExponentPushToken[dueno1]'),
      );
      expect(paraDueno.length).toBeGreaterThanOrEqual(1);
      expect(
        paraDueno.some((m) =>
          `${m.titulo} ${m.cuerpo}`.includes('Pintura de líneas'),
        ),
      ).toBe(true);
      expect(
        a.enviador.enviados.some((m) =>
          m.tokens.includes('ExponentPushToken[ajeno1]'),
        ),
      ).toBe(false);
    });

    it('cancelar dentro de las cuatro horas (aun así) no cuenta como tardía', async () => {
      a.reloj.fijar(`${HOY}T17:30:00-03:00`);
      await reservaDe(HOY, '19:00');
      await bloquear(
        encargado,
        bloqueoBase({ fecha: HOY, inicio: '19:00', fin: '20:00' }),
      ).expect(201);
      expect((await usuario(jugador.usuario.id)).cancelacionesTardias).toBe(0);
    });

    it('sin reservas afectadas no se manda ninguna push', async () => {
      await bloquear(encargado, bloqueoBase()).expect(201);
      await espera();
      expect(a.enviador.enviados).toHaveLength(0);
    });

    it('si el bloqueo es inválido (MOTIVO_REQUERIDO) no se cancela nada ni se avisa', async () => {
      await registrarPush(jugador, 'ExponentPushToken[dueno2]');
      const r = await reservaDe(MANANA, '10:00');
      a.enviador.vaciar();
      await bloquear(encargado, bloqueoBase({ motivo: '' }));
      await espera();
      expect((await reserva(r.id)).estado).toBe('confirmada');
      expect(a.enviador.enviados).toHaveLength(0);
    });

    it('si falla por un espacio inexistente, ninguna reserva del espacio válido se cancela', async () => {
      const r = await reservaDe(MANANA, '10:00');
      await bloquear(
        encargado,
        bloqueoBase({ espacioIds: [espacioId, 'esp-noexiste'] }),
      );
      expect((await reserva(r.id)).estado).toBe('confirmada');
    });

    it('un bloqueo sobre varios espacios cancela en todos', async () => {
      const otroEsp = (await crearEspacio(a, { deporteId })).id;
      const r1 = await reservaDe(MANANA, '10:00');
      const r2 = await reservaDe(MANANA, '10:00', {}, jugador, otroEsp);
      await bloquear(
        encargado,
        bloqueoBase({ espacioIds: [espacioId, otroEsp] }),
      ).expect(201);
      expect((await reserva(r1.id)).estado).toBe('cancelada');
      expect((await reserva(r2.id)).estado).toBe('cancelada');
    });

    it('la reserva cancelada libera su ocupación: tras borrar el bloqueo el turno se puede reservar otra vez', async () => {
      const r = await reservaDe(MANANA, '10:00');
      const b = esperarContrato<Bloqueo[]>(
        (await bloquear(encargado, bloqueoBase())).body,
        'Bloqueo',
      )[0];
      await pedir('delete', `/bloqueos/${b.id}`, encargado).expect(204);
      expect((await reserva(r.id)).estado).toBe('cancelada');
      const t = await grilla(MANANA);
      expect(t[2].estado).toBe('libre');
      const turnoId = t[2].id;
      const nueva = await pedir('post', '/reservas', jugador, {
        turnoId,
        cantidadPersonas: 4,
      });
      expect(nueva.status).toBe(201);
    });

    it('concurrencia: reservar y bloquear a la vez no deja una confirmada en un turno bloqueado', async () => {
      const t = await grilla(MANANA);
      const turnoId = t[4].id;
      const [rr, rb] = await Promise.all([
        pedir('post', '/reservas', jugador, { turnoId, cantidadPersonas: 4 }),
        bloquear(encargado, bloqueoBase({ inicio: '12:00', fin: '13:00' })),
      ]);
      expect(rb.status).toBe(201);
      expect([201, 409]).toContain(rr.status);
      if (rr.status === 201) {
        const id = (rr.body as { datos: { id: string } }).datos.id;
        expect((await reserva(id)).estado).toBe('cancelada');
      }
      expect((await grilla(MANANA))[4].estado).toBe('mantenimiento');
    });

    it('concurrencia: dos bloqueos iguales a la vez → ambos 201 sin romper', async () => {
      await reservaDe(MANANA, '10:00');
      const rs = await Promise.all([
        bloquear(encargado, bloqueoBase()),
        bloquear(encargado, bloqueoBase()),
      ]);
      for (const r of rs) expect(r.status, JSON.stringify(r.body)).toBe(201);
    });
  });

  describe('GET /bloqueos — filtros y paginación', () => {
    it('forma, orden y filtro por espacio; desde por defecto es hoy', async () => {
      const otro = (await crearEspacio(a, { deporteId })).id;
      await crearBloqueo(a, { espacioId, fecha: '2026-09-18' }); // ayer
      await crearBloqueo(a, { espacioId, fecha: HOY });
      await crearBloqueo(a, { espacioId, fecha: MARTES });
      await crearBloqueo(a, { espacioId: otro, fecha: MANANA });
      const res = await pedir('get', '/bloqueos', encargado)
        .query({ espacioId })
        .expect(200);
      const datos = esperarContrato<Bloqueo[]>(res.body, 'Bloqueo');
      expect(datos.map((b) => b.fecha)).toEqual([HOY, MARTES]);
      expect(res.body.meta).toEqual({ total: 2, pagina: 1, porPagina: 20 });
      datos.forEach((b) =>
        expect(Object.keys(b).sort()).toEqual(CLAVES_BLOQUEO),
      );
    });

    it('desde incluye el propio día y acepta el pasado', async () => {
      await crearBloqueo(a, { espacioId, fecha: '2026-09-18' });
      await crearBloqueo(a, { espacioId, fecha: MANANA });
      const res = await pedir('get', '/bloqueos', encargado)
        .query({ espacioId, desde: MANANA })
        .expect(200);
      expect(res.body.datos.map((b: Bloqueo) => b.fecha)).toEqual([MANANA]);
      const res2 = await pedir('get', '/bloqueos', encargado)
        .query({ espacioId, desde: '2026-09-18' })
        .expect(200);
      expect(res2.body.meta.total).toBe(2);
    });

    it('lista vacía, página fuera de rango y paginación estable', async () => {
      const vacia = await pedir('get', '/bloqueos', encargado)
        .query({ espacioId })
        .expect(200);
      esperarContrato<Bloqueo[]>(vacia.body, 'Bloqueo');
      expect(vacia.body.datos).toEqual([]);
      expect(vacia.body.meta.total).toBe(0);
      for (const d of ['2026-09-20', '2026-09-20', '2026-09-21'])
        await crearBloqueo(a, { espacioId, fecha: d });
      const p1 = await pedir('get', '/bloqueos', encargado)
        .query({ espacioId, porPagina: 2, pagina: 1 })
        .expect(200);
      const p2 = await pedir('get', '/bloqueos', encargado)
        .query({ espacioId, porPagina: 2, pagina: 2 })
        .expect(200);
      const p9 = await pedir('get', '/bloqueos', encargado)
        .query({ espacioId, porPagina: 2, pagina: 9 })
        .expect(200);
      expect(p9.body.datos).toEqual([]);
      expect(p9.body.meta).toEqual({ total: 3, pagina: 9, porPagina: 2 });
      const ids = [...p1.body.datos, ...p2.body.datos].map(
        (b: Bloqueo) => b.id,
      );
      expect(new Set(ids).size).toBe(3);
    });

    it.each([
      [{ desde: '2026-9-1' }],
      [{ desde: 'ayer' }],
      [{ espacioId: '5' }],
      [{ pagina: 0 }],
      [{ porPagina: 0 }],
      [{ porPagina: 'x' }],
      [{ cualquiera: 'x' }],
    ])('parámetros inválidos %j → 400', async (q) => {
      esperarFallo(
        await pedir('get', '/bloqueos', encargado).query(q),
        [400],
        'VALIDACION_FALLIDA',
      );
    });

    it('encargado y administrador ven lo mismo', async () => {
      await crearBloqueo(a, { espacioId, fecha: MANANA });
      const e = await pedir('get', '/bloqueos', encargado).query({ espacioId });
      const ad = await pedir('get', '/bloqueos', admin).query({ espacioId });
      expect(ad.body).toEqual(e.body);
    });
  });

  describe('DELETE /bloqueos/:id', () => {
    it('204 sin cuerpo; la grilla vuelve a libre; las canceladas siguen canceladas; segunda vez 404', async () => {
      const r = await reservaDe(MANANA, '10:00');
      const b = esperarContrato<Bloqueo[]>(
        (await bloquear(encargado, bloqueoBase())).body,
        'Bloqueo',
      )[0];
      const del = await pedir('delete', `/bloqueos/${b.id}`, encargado);
      expect(del.status).toBe(204);
      expect(del.text).toBe('');
      expect((await reserva(r.id)).estado).toBe('cancelada');
      expect((await grilla(MANANA)).every((t) => t.estado === 'libre')).toBe(
        true,
      );
      esperarFallo(
        await pedir('delete', `/bloqueos/${b.id}`, encargado),
        [404],
      );
      const lista = await pedir('get', '/bloqueos', encargado).query({
        espacioId,
      });
      expect(lista.body.datos).toEqual([]);
    });

    it('un bloqueo borrado no pisa a otro que sigue cubriendo el turno', async () => {
      const b1 = await crearBloqueo(a, {
        espacioId,
        fecha: MANANA,
        motivo: 'A',
      });
      await crearBloqueo(a, {
        espacioId,
        fecha: MANANA,
        inicio: '10:00',
        fin: '11:00',
        motivo: 'B',
      });
      await pedir('delete', `/bloqueos/${b1.id}`, encargado).expect(204);
      const t = await grilla(MANANA);
      expect(t[2].estado).toBe('mantenimiento');
      expect(t[2].motivoBloqueo).toBe('B');
      expect(t[3].estado).toBe('libre');
    });

    it.each(['blo-noexiste', 'xyz', 'esp-123', '123'])(
      'id %s → 404',
      async (id) => {
        esperarFallo(
          await pedir('delete', `/bloqueos/${id}`, encargado),
          [404],
        );
      },
    );

    it('el administrador también puede', async () => {
      const b = await crearBloqueo(a, { espacioId, fecha: MANANA });
      await pedir('delete', `/bloqueos/${b.id}`, admin).expect(204);
    });
  });

  // ------------------------------------------------------------------- fijas
  describe('POST /fijas — forma y R19', () => {
    it('201 con ReservaFija exacta; hasta null y hasta lleno', async () => {
      const res = await cargarFija(admin).expect(201);
      const f = esperarContrato<ReservaFija>(res.body, 'ReservaFija');
      expect(Object.keys(f).sort()).toEqual(CLAVES_FIJA);
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
      const res2 = await cargarFija(admin, {
        dia: 3,
        hasta: '2026-12-31',
      }).expect(201);
      expect(esperarContrato<ReservaFija>(res2.body, 'ReservaFija').hasta).toBe(
        '2026-12-31',
      );
    });

    it('hasta null explícito es abierta; hasta == desde es válido', async () => {
      await cargarFija(admin, { hasta: null }).expect(201);
      await cargarFija(admin, {
        dia: 4,
        desde: '2026-09-24',
        hasta: '2026-09-24',
      }).expect(201);
    });

    it('fin 24:00 es válido y cubre el último turno', async () => {
      const res = await cargarFija(admin, {
        dia: 2,
        inicio: '22:00',
        fin: '24:00',
      }).expect(201);
      esperarContrato<ReservaFija>(res.body, 'ReservaFija');
      const t = await grilla(MARTES);
      expect(t[14].estado).toBe('fijo');
      expect(t[15].estado).toBe('fijo');
      expect(t[13].estado).toBe('libre');
    });

    it('una fija de dos horas cubre dos turnos de la grilla (R3) y no los de otro día', async () => {
      await cargarFija(admin, { inicio: '20:00', fin: '22:00' }).expect(201);
      const t = await grilla(MARTES);
      expect(t.filter((x) => x.estado === 'fijo').map((x) => x.inicio)).toEqual(
        ['20:00', '21:00'],
      );
      expect((await grilla(MIERCOLES)).every((x) => x.estado === 'libre')).toBe(
        true,
      );
    });

    it('dia 0 (domingo) funciona con la grilla del domingo en hora argentina', async () => {
      await cargarFija(admin, { dia: 0, inicio: '21:00', fin: '24:00' }).expect(
        201,
      );
      const t = await grilla(MANANA); // domingo 20/09
      expect(t[13].estado).toBe('fijo');
      expect(t[15].estado).toBe('fijo');
    });

    it('desde en el futuro: no cubre antes del desde', async () => {
      await cargarFija(admin, { desde: '2026-09-29' }).expect(201);
      expect((await grilla(MARTES))[13].estado).toBe('libre');
    });

    it.each([
      ['dia 7', { dia: 7 }],
      ['dia -1', { dia: -1 }],
      ['dia texto', { dia: '2' }],
      ['dia decimal', { dia: 2.5 }],
      ['dia null', { dia: null }],
      ['inicio no en punto', { inicio: '21:30' }],
      ['fin no en punto', { fin: '22:15' }],
      ['inicio = fin', { inicio: '21:00', fin: '21:00' }],
      ['inicio > fin', { inicio: '22:00', fin: '21:00' }],
      ['hora mal formada', { inicio: '9:00' }],
      ['titular vacío', { titular: '' }],
      ['titular sólo espacios', { titular: '   ' }],
      ['titular numérico', { titular: 5 }],
      ['hasta < desde', { desde: '2026-09-10', hasta: '2026-09-09' }],
      ['desde mal formada', { desde: '1/9/2026' }],
      ['desde imposible', { desde: '2026-02-30' }],
      ['hasta mal formada', { hasta: 'mañana' }],
      ['espacioId sin prefijo', { espacioId: '12' }],
      ['campo de más activa', { activa: false }],
      ['campo de más id', { id: 'fij-mio' }],
      ['campo de más createdAt', { createdAt: 'x' }],
    ])('inválida (%s) → 400/422 con sobre limpio', async (_n, extra) => {
      esperarFallo(await cargarFija(admin, extra), [400, 422]);
    });

    it.each(['espacioId', 'titular', 'dia', 'inicio', 'fin', 'desde'])(
      'falta %s → 400 VALIDACION_FALLIDA',
      async (campo) => {
        const cuerpo: Record<string, unknown> = fijaBase();
        delete cuerpo[campo];
        esperarFallo(
          await pedir('post', '/fijas', admin, cuerpo),
          [400],
          'VALIDACION_FALLIDA',
        );
      },
    );

    it('espacio inexistente → 404 ESPACIO_NO_ENCONTRADO', async () => {
      esperarFallo(
        await cargarFija(admin, { espacioId: 'esp-noexiste' }),
        [404],
        'ESPACIO_NO_ENCONTRADO',
      );
    });

    it('FIJA_SUPERPUESTA: mismo horario, parcial, contenida y que contiene', async () => {
      await cargarFija(admin, { inicio: '20:00', fin: '22:00' }).expect(201);
      for (const [inicio, fin] of [
        ['20:00', '22:00'],
        ['21:00', '23:00'],
        ['19:00', '21:00'],
        ['20:00', '21:00'],
        ['19:00', '24:00'],
      ]) {
        esperarFallo(
          await cargarFija(admin, { inicio, fin }),
          [409],
          'FIJA_SUPERPUESTA',
        );
      }
    });

    it('horarios contiguos, otro día u otro espacio NO se superponen', async () => {
      await cargarFija(admin, { inicio: '20:00', fin: '22:00' }).expect(201);
      await cargarFija(admin, { inicio: '22:00', fin: '23:00' }).expect(201);
      await cargarFija(admin, { inicio: '19:00', fin: '20:00' }).expect(201);
      await cargarFija(admin, {
        dia: 3,
        inicio: '20:00',
        fin: '22:00',
      }).expect(201);
      const otro = (await crearEspacio(a, { deporteId })).id;
      await cargarFija(admin, {
        espacioId: otro,
        inicio: '20:00',
        fin: '22:00',
      }).expect(201);
    });

    it('rangos de fechas disjuntos no se superponen; solapados sí; abierta contra cerrada', async () => {
      await cargarFija(admin, {
        desde: '2026-09-01',
        hasta: '2026-09-30',
      }).expect(201);
      await cargarFija(admin, {
        desde: '2026-10-01',
        hasta: '2026-10-31',
      }).expect(201);
      esperarFallo(
        await cargarFija(admin, { desde: '2026-10-31', hasta: '2026-11-30' }),
        [409],
        'FIJA_SUPERPUESTA',
      );
      await cargarFija(admin, { desde: '2026-12-01' }).expect(201); // abierta, después de todas
    });

    it('abierta (hasta null) choca con una cerrada futura de mismo día y horario', async () => {
      await cargarFija(admin, {
        desde: '2027-03-01',
        hasta: '2027-03-31',
      }).expect(201);
      esperarFallo(
        await cargarFija(admin, { desde: '2026-09-01', hasta: null }),
        [409],
        'FIJA_SUPERPUESTA',
      );
    });

    it('una fija dada de baja no cuenta para la superposición', async () => {
      const f = esperarContrato<ReservaFija>(
        (await cargarFija(admin)).body,
        'ReservaFija',
      );
      await pedir('delete', `/fijas/${f.id}`, admin).expect(204);
      await cargarFija(admin).expect(201);
    });

    it('concurrencia: dos fijas iguales a la vez → una 201 y otra 409 FIJA_SUPERPUESTA', async () => {
      const rs = await Promise.all([cargarFija(admin), cargarFija(admin)]);
      const estados = rs.map((r) => r.status).sort();
      expect(estados, JSON.stringify(rs.map((r) => r.body))).toEqual([
        201, 409,
      ]);
      const lista = await pedir('get', '/fijas', admin).query({ espacioId });
      expect(lista.body.meta.total).toBe(1);
    });
  });

  describe('R19 / D4 — CONFLICTO_CON_RESERVAS', () => {
    it('reserva confirmada futura dentro de la fija → 409 y no se crea', async () => {
      await reservaDe(MARTES, '21:00');
      esperarFallo(await cargarFija(admin), [409], 'CONFLICTO_CON_RESERVAS');
      const lista = await pedir('get', '/fijas', admin).query({ espacioId });
      expect(lista.body.datos).toEqual([]);
    });

    it('en cualquiera de las horas de una fija de dos horas', async () => {
      await reservaDe(MARTES, '22:00');
      esperarFallo(
        await cargarFija(admin, { fin: '23:00' }),
        [409],
        'CONFLICTO_CON_RESERVAS',
      );
    });

    it('semanas más adelante también cuentan (fija abierta)', async () => {
      await reservaDe('2026-10-20', '21:00'); // martes
      esperarFallo(await cargarFija(admin), [409], 'CONFLICTO_CON_RESERVAS');
    });

    it('no conflictúan: cancelada, otro día, otra hora, antes de desde, después de hasta, otro espacio, pasada', async () => {
      const otroEsp = (await crearEspacio(a, { deporteId })).id;
      await reservaDe(MARTES, '21:00', {
        estado: 'cancelada',
        ocupacion: null,
      });
      await reservaDe(MIERCOLES, '21:00');
      await reservaDe(MARTES, '20:00');
      await reservaDe(MARTES, '22:00'); // fin exclusivo
      await reservaDe(MARTES, '21:00', {}, jugador, otroEsp);
      await reservaDe('2026-09-15', '21:00'); // martes pasado
      const r = await cargarFija(admin, {
        desde: '2026-09-29',
        hasta: '2026-10-27',
      });
      // El martes 22/09 queda antes de "desde" y el 15/09 también.
      expect(r.status, JSON.stringify(r.body)).toBe(201);
    });

    it('una reserva confirmada que empezó hoy más temprano no es "futura"; una de hoy más tarde sí', async () => {
      // hoy es sábado 19/09 10:00; fija de sábados 9-10 (pasada) y de 20-21 (futura)
      await reservaDe(HOY, '09:00');
      const ok = await cargarFija(admin, {
        dia: 6,
        inicio: '09:00',
        fin: '10:00',
      });
      expect(ok.status, JSON.stringify(ok.body)).toBe(201);
      await reservaDe(HOY, '20:00');
      esperarFallo(
        await cargarFija(admin, { dia: 6, inicio: '20:00', fin: '21:00' }),
        [409],
        'CONFLICTO_CON_RESERVAS',
      );
    });

    it('cumplida/ausente futuras o pasadas no bloquean', async () => {
      await reservaDe(MARTES, '21:00', { estado: 'ausente' });
      await cargarFija(admin).expect(201);
    });
  });

  describe('GET /fijas', () => {
    it('filtros espacioId y activa, solos y combinados; forma completa', async () => {
      const otro = (await crearEspacio(a, { deporteId })).id;
      await crearFija(a, { espacioId, activa: true });
      await crearFija(a, { espacioId, activa: false, dia: 3 });
      await crearFija(a, {
        espacioId: otro,
        activa: true,
        hasta: '2026-12-31',
      });
      const todas = await pedir('get', '/fijas', encargado)
        .query({ espacioId })
        .expect(200);
      expect(
        esperarContrato<ReservaFija[]>(todas.body, 'ReservaFija'),
      ).toHaveLength(2);
      expect(todas.body.meta.total).toBe(2);
      const act = await pedir('get', '/fijas', encargado)
        .query({ espacioId, activa: 'true' })
        .expect(200);
      expect(act.body.datos.map((f: ReservaFija) => f.activa)).toEqual([true]);
      const inact = await pedir('get', '/fijas', encargado)
        .query({ espacioId, activa: 'false' })
        .expect(200);
      expect(inact.body.datos.map((f: ReservaFija) => f.activa)).toEqual([
        false,
      ]);
      const sinEsp = await pedir('get', '/fijas', encargado)
        .query({ activa: 'false' })
        .expect(200);
      expect(
        sinEsp.body.datos.every((f: ReservaFija) => f.activa === false),
      ).toBe(true);
      const delOtro = await pedir('get', '/fijas', encargado)
        .query({ espacioId: otro })
        .expect(200);
      expect(delOtro.body.datos[0].hasta).toBe('2026-12-31');
    });

    it('paginación: página fuera de rango y desempate estable', async () => {
      for (let i = 0; i < 3; i++)
        await crearFija(a, {
          espacioId,
          dia: (i + 1) as 1,
          inicio: '10:00',
          fin: '11:00',
        });
      const p1 = await pedir('get', '/fijas', encargado)
        .query({ espacioId, porPagina: 2 })
        .expect(200);
      const p2 = await pedir('get', '/fijas', encargado)
        .query({ espacioId, porPagina: 2, pagina: 2 })
        .expect(200);
      const p3 = await pedir('get', '/fijas', encargado)
        .query({ espacioId, porPagina: 2, pagina: 3 })
        .expect(200);
      expect(p3.body.datos).toEqual([]);
      expect(p3.body.meta).toEqual({ total: 3, pagina: 3, porPagina: 2 });
      const ids = [...p1.body.datos, ...p2.body.datos].map(
        (f: ReservaFija) => f.id,
      );
      expect(new Set(ids).size).toBe(3);
    });

    it.each([
      [{ activa: 'quizas' }],
      [{ activa: '1' }],
      [{ espacioId: 'xx' }],
      [{ porPagina: 1000 }],
      [{ pagina: -1 }],
    ])('parámetros inválidos %j → 400', async (q) => {
      esperarFallo(
        await pedir('get', '/fijas', encargado).query(q),
        [400],
        'VALIDACION_FALLIDA',
      );
    });

    it('lista vacía con espacioId que no existe pero con forma de id', async () => {
      const r = await pedir('get', '/fijas', encargado)
        .query({ espacioId: 'esp-noexiste' })
        .expect(200);
      expect(r.body.datos).toEqual([]);
    });
  });

  describe('PATCH /fijas/:id', () => {
    const crear = async (extra: object = {}) =>
      esperarContrato<ReservaFija>(
        (await cargarFija(admin, extra).expect(201)).body,
        'ReservaFija',
      );

    it('edita titular, horas, hasta y activa; el resto queda igual', async () => {
      const f = await crear();
      const res = await pedir('patch', `/fijas/${f.id}`, admin, {
        titular: 'Otro club',
      }).expect(200);
      expect(esperarContrato<ReservaFija>(res.body, 'ReservaFija')).toEqual({
        ...f,
        titular: 'Otro club',
      });
      const res2 = await pedir('patch', `/fijas/${f.id}`, admin, {
        inicio: '20:00',
        fin: '23:00',
        hasta: '2026-12-31',
      }).expect(200);
      expect(
        esperarContrato<ReservaFija>(res2.body, 'ReservaFija'),
      ).toMatchObject({
        inicio: '20:00',
        fin: '23:00',
        hasta: '2026-12-31',
        titular: 'Otro club',
      });
      const res3 = await pedir('patch', `/fijas/${f.id}`, admin, {
        hasta: null,
      }).expect(200);
      expect(res3.body.datos.hasta).toBeNull();
      const res4 = await pedir('patch', `/fijas/${f.id}`, admin, {
        activa: false,
      }).expect(200);
      expect(res4.body.datos.activa).toBe(false);
      expect((await grilla(MARTES)).every((t) => t.estado === 'libre')).toBe(
        true,
      );
    });

    it('editarse a sí misma sin cambiar el horario no es superposición', async () => {
      const f = await crear();
      await pedir('patch', `/fijas/${f.id}`, admin, {
        inicio: '21:00',
        fin: '22:00',
      }).expect(200);
      await pedir('patch', `/fijas/${f.id}`, admin, { fin: '23:00' }).expect(
        200,
      );
    });

    it('FIJA_SUPERPUESTA al moverla encima de otra, o al reactivarla', async () => {
      await crear({ inicio: '20:00', fin: '21:00' });
      const g = await crear({ inicio: '21:00', fin: '22:00' });
      esperarFallo(
        await pedir('patch', `/fijas/${g.id}`, admin, { inicio: '20:00' }),
        [409],
        'FIJA_SUPERPUESTA',
      );
      await pedir('delete', `/fijas/${g.id}`, admin).expect(204);
      await cargarFija(admin, { inicio: '21:00', fin: '22:00' }).expect(201);
      esperarFallo(
        await pedir('patch', `/fijas/${g.id}`, admin, { activa: true }),
        [409],
        'FIJA_SUPERPUESTA',
      );
    });

    it('CONFLICTO_CON_RESERVAS al ampliarla sobre una reserva confirmada futura', async () => {
      const f = await crear();
      await reservaDe(MARTES, '22:00');
      esperarFallo(
        await pedir('patch', `/fijas/${f.id}`, admin, { fin: '23:00' }),
        [409],
        'CONFLICTO_CON_RESERVAS',
      );
      expect(
        (await pedir('get', '/fijas', admin).query({ espacioId })).body.datos[0]
          .fin,
      ).toBe('22:00');
    });

    it('sólo con un cambio de titular no revisa reservas ya cubiertas', async () => {
      const f = await crear();
      await reservaDe(MIERCOLES, '10:00');
      await pedir('patch', `/fijas/${f.id}`, admin, {
        titular: 'Nuevo',
      }).expect(200);
    });

    it.each([
      ['inicio >= fin resultante', { inicio: '22:00' }],
      ['fin <= inicio resultante', { fin: '21:00' }],
      ['hasta < desde existente', { hasta: '2026-08-31' }],
      ['hora no en punto', { inicio: '20:30' }],
      ['dia 9', { dia: 9 }],
      ['titular vacío', { titular: '' }],
      ['id', { id: 'fij-otro' }],
      ['espacioId', { espacioId: 'esp-otro' }],
      ['campo de más', { color: 'rojo' }],
      ['activa texto', { activa: 'si' }],
      ['desde mal', { desde: 'x' }],
    ])('inválido (%s) → 400/422', async (_n, extra) => {
      const f = await crear();
      esperarFallo(
        await pedir('patch', `/fijas/${f.id}`, admin, extra),
        [400, 422],
      );
    });

    it('cuerpo vacío → 400 o 200 sin cambios (no 500)', async () => {
      const f = await crear();
      const r = await pedir('patch', `/fijas/${f.id}`, admin, {});
      expect([200, 400]).toContain(r.status);
    });

    it.each(['fij-noexiste', 'abc', 'blo-1'])('id %s → 404', async (id) => {
      esperarFallo(
        await pedir('patch', `/fijas/${id}`, admin, { titular: 'x' }),
        [404],
      );
    });
  });

  describe('DELETE /fijas/:id — baja lógica', () => {
    it('204; sigue en el listado como activa:false; libera la grilla', async () => {
      const f = esperarContrato<ReservaFija>(
        (await cargarFija(admin).expect(201)).body,
        'ReservaFija',
      );
      expect((await grilla(MARTES))[13].estado).toBe('fijo');
      const del = await pedir('delete', `/fijas/${f.id}`, admin);
      expect(del.status).toBe(204);
      expect(del.text).toBe('');
      expect((await grilla(MARTES))[13].estado).toBe('libre');
      const lista = await pedir('get', '/fijas', admin)
        .query({ espacioId, activa: 'false' })
        .expect(200);
      expect(lista.body.datos).toEqual([{ ...f, activa: false }]);
    });

    it('repetirlo no da 500 (204 idempotente o 404)', async () => {
      const f = await crearFija(a, { espacioId });
      await pedir('delete', `/fijas/${f.id}`, admin).expect(204);
      const otra = await pedir('delete', `/fijas/${f.id}`, admin);
      expect([204, 404]).toContain(otra.status);
    });

    it('no cancela reservas ya hechas', async () => {
      const f = await crearFija(a, { espacioId });
      const r = await reservaDe(MIERCOLES, '21:00');
      await pedir('delete', `/fijas/${f.id}`, admin).expect(204);
      expect((await reserva(r.id)).estado).toBe('confirmada');
    });

    it.each(['fij-noexiste', 'zzz'])('id %s → 404', async (id) => {
      esperarFallo(await pedir('delete', `/fijas/${id}`, admin), [404]);
    });
  });

  // ----------------------------------------------------------------- precios
  describe('PATCH /espacios/:id — R20, D5', () => {
    it('actualiza el precio y devuelve el Espacio completo sin tocar otros campos', async () => {
      const antes = esperarContrato<Espacio>(
        (await a.http().get(`/espacios/${espacioId}`).expect(200)).body,
        'Espacio',
      );
      const res = await pedir('patch', `/espacios/${espacioId}`, admin, {
        precioPorHora: 12345,
      }).expect(200);
      const e = esperarContrato<Espacio>(res.body, 'Espacio');
      expect(e).toEqual({ ...antes, precioPorHora: 12345 });
      const det = await a.http().get(`/espacios/${espacioId}`).expect(200);
      expect(det.body.datos.precioPorHora).toBe(12345);
    });

    it('D5: la grilla usa el precio actual y las reservas existentes no cambian de forma', async () => {
      const r = await reservaDe(MANANA, '10:00');
      const antes = await reserva(r.id);
      await pedir('patch', `/espacios/${espacioId}`, admin, {
        precioPorHora: 777,
      }).expect(200);
      const t = await grilla(MANANA);
      expect(t.every((x) => x.precio === 777)).toBe(true);
      expect(await reserva(r.id)).toEqual(antes);
    });

    it('mismo precio dos veces → 200 las dos', async () => {
      for (let i = 0; i < 2; i++)
        await pedir('patch', `/espacios/${espacioId}`, admin, {
          precioPorHora: 900,
        }).expect(200);
    });

    it.each([
      ['0', 0],
      ['negativo', -100],
      ['decimal', 1500.5],
      ['texto', '1500'],
      ['null', null],
      ['booleano', true],
      ['lista', [1]],
      ['NaN como texto', 'NaN'],
    ])('precio inválido (%s) → 400/422', async (_n, v) => {
      const r = await pedir('patch', `/espacios/${espacioId}`, admin, {
        precioPorHora: v,
      });
      esperarFallo(r, [400, 422]);
      const det = await a.http().get(`/espacios/${espacioId}`).expect(200);
      expect(det.body.datos.precioPorHora).not.toBe(v);
    });

    it.each([
      ['sin cuerpo', {}],
      ['campo de más nombre', { precioPorHora: 100, nombre: 'Hackeada' }],
      ['campo de más activo', { precioPorHora: 100, activo: false }],
      ['sólo otros campos', { nombre: 'x' }],
      ['capacidad', { precioPorHora: 100, capacidad: 99 }],
    ])('cuerpo inválido (%s) → 400', async (_n, cuerpo) => {
      esperarFallo(
        await pedir('patch', `/espacios/${espacioId}`, admin, cuerpo),
        [400],
        'VALIDACION_FALLIDA',
      );
    });

    it('espacio inexistente → 404 ESPACIO_NO_ENCONTRADO', async () => {
      esperarFallo(
        await pedir('patch', '/espacios/esp-noexiste', admin, {
          precioPorHora: 100,
        }),
        [404],
        'ESPACIO_NO_ENCONTRADO',
      );
      esperarFallo(
        await pedir('patch', '/espacios/xyz', admin, { precioPorHora: 100 }),
        [404],
        'ESPACIO_NO_ENCONTRADO',
      );
    });
  });

  describe('Mensajes de error en castellano (AGENTS §4.6)', () => {
    it('los códigos de M5 traen mensaje en castellano sin jerga', async () => {
      for (const [cuerpo, codigo] of [
        [bloqueoBase({ motivo: '' }), 'MOTIVO_REQUERIDO'],
        [bloqueoBase({ fecha: '2026-01-01' }), 'FECHA_PASADA'],
      ] as Array<[object, string]>) {
        const res = await bloquear(encargado, cuerpo);
        esperarError(res, 422, codigo);
        expect(res.body.error.mensaje).toMatch(/[a-záéíóú]{3,}/i);
      }
      await crearFija(a, { espacioId });
      const sup = await cargarFija(admin);
      esperarError(sup, 409, 'FIJA_SUPERPUESTA');
      expect(sup.body.error.mensaje).toBe(
        'Ya hay una reserva fija en ese horario.',
      );
    });
  });
});
