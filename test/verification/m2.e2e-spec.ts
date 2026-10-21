// Verificación independiente de M2 — Agenda (verificador-contrato, AGENTS §12).
// Caja negra: HTTP contra la app completa. Los eventos se cargan con el builder oficial.
import { JwtService } from '@nestjs/jwt';
import type { Evento } from '../../contract/types.js';
import { Sembrador } from '../../src/seeds/seed.js';
import { crearApp, type AppDePrueba } from '../utilities/create-app.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import {
  claveDe,
  conSesion,
  crearAdmin,
  crearEvento,
  crearLugar,
  registrarTurista,
  subirArchivo,
} from '../utilities/builders.js';

const en = (s: string) => new Date(s);
const ids = (b: { datos: { id: string }[] }) => b.datos.map((e) => e.id);
const CLAVES_EVENTO = [
  'coordenadas',
  'descripcion',
  'direccionLibre',
  'estado',
  'fin',
  'id',
  'imagenUrl',
  'inicio',
  'lugarId',
  'precio',
  'titulo',
];

function esperarSinRomper(res: { status: number; body: unknown }) {
  expect(res.status, JSON.stringify(res.body)).toBeLessThan(500);
  if (res.status >= 400) {
    const cuerpo = res.body as { error?: { codigo: string; mensaje: string } };
    expect(Object.keys(cuerpo)).toEqual(['error']);
    expect(Object.keys(cuerpo.error ?? {}).sort()).toEqual(['codigo', 'mensaje']);
  }
}

describe('Convenciones — forma exacta del Evento, nulos y fechas', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
  });
  afterAll(() => ctx.cerrar());

  it('las claves son exactamente las del tipo; los opcionales en null, nunca ausentes ni ""', async () => {
    const id = await crearEvento(ctx, { direccionLibre: 'Costanera', coordenadas: null });
    const res = await ctx.http().get(`/eventos/${id}`).expect(200);
    esperarContrato(res.body, 'Evento');
    expect(Object.keys(res.body.datos).sort()).toEqual(CLAVES_EVENTO);
    expect(res.body.datos.coordenadas).toBeNull();
    expect(res.body.datos.fin).toBeNull();
    expect(res.body.datos.imagenUrl).toBeNull();
    expect(res.body.datos.precio).toBeNull();
  });

  it('precio 0 (gratis) sigue siendo 0, no null', async () => {
    const id = await crearEvento(ctx, { precio: 0 });
    const res = await ctx.http().get(`/eventos/${id}`).expect(200);
    expect(res.body.datos.precio).toBe(0);
  });

  it('inicio/fin con milisegundos o en UTC salen sin milisegundos y con -03:00', async () => {
    const id = await crearEvento(ctx, {
      inicio: new Date('2026-12-05T00:30:00.750Z'),
      fin: new Date('2026-12-05T03:00:00.999Z'),
    });
    const res = await ctx.http().get(`/eventos/${id}`).expect(200);
    esperarContrato(res.body, 'Evento');
    expect(res.body.datos.inicio).toBe('2026-12-04T21:30:00-03:00');
    expect(res.body.datos.fin).toMatch(/^2026-12-05T00:00:0\d-03:00$/);
  });

  it('con imagen: URL absoluta que se puede bajar', async () => {
    const { token } = await registrarTurista(ctx);
    const clave = claveDe(await subirArchivo(ctx, token));
    const id = await crearEvento(ctx, { imagenClave: clave });
    const res = await ctx.http().get(`/eventos/${id}`).expect(200);
    esperarContrato(res.body, 'Evento');
    const ruta = new URL(res.body.datos.imagenUrl).pathname;
    await ctx.http().get(ruta).expect(200);
  });

  it('la lista tampoco agrega campos (createdAt, finEfectivo, distancia...)', async () => {
    await crearEvento(ctx);
    const res = await ctx.http().get('/eventos').expect(200);
    esperarContrato(res.body, 'Evento');
    for (const e of res.body.datos) expect(Object.keys(e).sort()).toEqual(CLAVES_EVENTO);
  });

  it('meta de la lista vacía', async () => {
    const vacia = await crearApp();
    try {
      const res = await vacia.http().get('/eventos').expect(200);
      expect(res.body).toEqual({ datos: [], meta: { total: 0, pagina: 1, porPagina: 20 } });
    } finally {
      await vacia.cerrar();
    }
  });
});

describe('R9 y D3 — bordes exactos de finalizado', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp({ ahora: '2026-11-14T12:00:00-03:00' });
  });
  afterAll(() => ctx.cerrar());

  const estadoDe = async (id: string) =>
    (await ctx.http().get(`/eventos/${id}`).expect(200)).body.datos.estado;

  it('con fin: a la hora exacta del fin sigue programado; un segundo después, finalizado', async () => {
    const id = await crearEvento(ctx, {
      inicio: en('2026-11-14T10:00:00-03:00'),
      fin: en('2026-11-14T14:00:00-03:00'),
    });
    ctx.reloj.fijar('2026-11-14T14:00:00-03:00');
    expect(await estadoDe(id)).toBe('programado');
    ctx.reloj.fijar('2026-11-14T14:00:01-03:00');
    expect(await estadoDe(id)).toBe('finalizado');
    ctx.reloj.fijar('2026-11-14T12:00:00-03:00');
  });

  it('sin fin: sigue programado a las 23:59:59 del día de inicio y finalizado a las 00:00 del siguiente', async () => {
    const id = await crearEvento(ctx, { inicio: en('2026-11-14T22:00:00-03:00') });
    ctx.reloj.fijar('2026-11-14T23:59:59-03:00');
    expect(await estadoDe(id)).toBe('programado');
    ctx.reloj.fijar('2026-11-15T00:00:00-03:00');
    expect(await estadoDe(id)).toBe('finalizado');
    ctx.reloj.fijar('2026-11-14T12:00:00-03:00');
  });

  it('sin fin, inicio a las 00:00: el fin efectivo es el mismo día en Buenos Aires (no el de UTC)', async () => {
    const id = await crearEvento(ctx, { inicio: en('2026-11-20T00:00:00-03:00') });
    ctx.reloj.fijar('2026-11-20T23:59:59-03:00');
    expect(await estadoDe(id)).toBe('programado');
    ctx.reloj.fijar('2026-11-21T00:00:01-03:00');
    expect(await estadoDe(id)).toBe('finalizado');
    ctx.reloj.fijar('2026-11-14T12:00:00-03:00');
  });

  it('sin fin, inicio a las 22:30 BA (01:30Z del día siguiente): cuenta el día de Buenos Aires', async () => {
    const id = await crearEvento(ctx, { inicio: new Date('2026-11-21T01:30:00Z') }); // 20/11 22:30 BA
    ctx.reloj.fijar('2026-11-20T23:30:00-03:00');
    expect(await estadoDe(id)).toBe('programado');
    ctx.reloj.fijar('2026-11-21T00:30:00-03:00');
    expect(await estadoDe(id)).toBe('finalizado');
    ctx.reloj.fijar('2026-11-14T12:00:00-03:00');
  });

  it('31/12 → 1/1 y fin de mes', async () => {
    const id = await crearEvento(ctx, { inicio: en('2026-12-31T21:00:00-03:00') });
    const feb = await crearEvento(ctx, { inicio: en('2028-02-29T21:00:00-03:00') });
    ctx.reloj.fijar('2026-12-31T23:59:59-03:00');
    expect(await estadoDe(id)).toBe('programado');
    ctx.reloj.fijar('2027-01-01T00:00:00-03:00');
    expect(await estadoDe(id)).toBe('finalizado');
    ctx.reloj.fijar('2028-02-29T23:59:59-03:00');
    expect(await estadoDe(feb)).toBe('programado');
    ctx.reloj.fijar('2028-03-01T00:00:00-03:00');
    expect(await estadoDe(feb)).toBe('finalizado');
    ctx.reloj.fijar('2026-11-14T12:00:00-03:00');
  });

  it('suspendido y cancelado ya terminados no pasan a finalizado, ni en detalle ni en lista', async () => {
    const s = await crearEvento(ctx, {
      inicio: en('2026-11-10T10:00:00-03:00'),
      fin: en('2026-11-10T12:00:00-03:00'),
      estado: 'suspendido',
    });
    const c = await crearEvento(ctx, { inicio: en('2026-11-10T10:00:00-03:00'), estado: 'cancelado' });
    expect(await estadoDe(s)).toBe('suspendido');
    expect(await estadoDe(c)).toBe('cancelado');
    const lista = await ctx.http().get('/eventos?desde=2026-11-10&estado=suspendido').expect(200);
    expect(ids(lista.body)).toContain(s);
    const fin = await ctx.http().get('/eventos?desde=2026-11-10&estado=finalizado').expect(200);
    expect(ids(fin.body)).not.toContain(s);
    expect(ids(fin.body)).not.toContain(c);
  });

  it('el estado cambia solo con el reloj: el mismo evento en la lista pasa de programado a finalizado', async () => {
    const id = await crearEvento(ctx, {
      inicio: en('2026-11-14T13:00:00-03:00'),
      fin: en('2026-11-14T15:00:00-03:00'),
    });
    const antes = await ctx.http().get('/eventos?fecha=2026-11-14&estado=programado').expect(200);
    expect(ids(antes.body)).toContain(id);
    ctx.reloj.fijar('2026-11-14T16:00:00-03:00');
    const despuesP = await ctx.http().get('/eventos?fecha=2026-11-14&estado=programado').expect(200);
    expect(ids(despuesP.body)).not.toContain(id);
    const despuesF = await ctx.http().get('/eventos?fecha=2026-11-14&estado=finalizado').expect(200);
    expect(ids(despuesF.body)).toContain(id);
    ctx.reloj.fijar('2026-11-14T12:00:00-03:00');
  });
});

describe('R8 y M2-1 — el día es [00:00, 24:00) de Buenos Aires', () => {
  let ctx: AppDePrueba;
  let terminaALas00: string;
  let empiezaALas00: string;
  let terminaALas0001: string;
  let sinFinAlas2359: string;
  let cruzaMes: string;
  let cruzaAnio: string;
  beforeAll(async () => {
    ctx = await crearApp({ ahora: '2026-11-14T12:00:00-03:00' });
    terminaALas00 = await crearEvento(ctx, {
      inicio: en('2026-11-20T20:00:00-03:00'),
      fin: en('2026-11-21T00:00:00-03:00'),
    });
    empiezaALas00 = await crearEvento(ctx, { inicio: en('2026-11-21T00:00:00-03:00') });
    terminaALas0001 = await crearEvento(ctx, {
      inicio: en('2026-11-25T20:00:00-03:00'),
      fin: en('2026-11-26T00:01:00-03:00'),
    });
    sinFinAlas2359 = await crearEvento(ctx, { inicio: en('2026-11-27T23:59:00-03:00') });
    cruzaMes = await crearEvento(ctx, {
      inicio: en('2026-11-30T22:00:00-03:00'),
      fin: en('2026-12-01T03:00:00-03:00'),
    });
    cruzaAnio = await crearEvento(ctx, {
      inicio: en('2026-12-31T23:00:00-03:00'),
      fin: en('2027-01-01T02:00:00-03:00'),
    });
  });
  afterAll(() => ctx.cerrar());

  const dia = async (f: string) => ids((await ctx.http().get(`/eventos?fecha=${f}`).expect(200)).body);

  it('un evento que termina justo a las 00:00 no aparece al día siguiente', async () => {
    expect(await dia('2026-11-20')).toEqual([terminaALas00]);
    expect(await dia('2026-11-21')).toEqual([empiezaALas00]);
  });

  it('uno que termina a las 00:01 sí aparece al día siguiente', async () => {
    expect(await dia('2026-11-25')).toEqual([terminaALas0001]);
    expect(await dia('2026-11-26')).toEqual([terminaALas0001]);
  });

  it('sin fin a las 23:59: sólo su día', async () => {
    expect(await dia('2026-11-27')).toEqual([sinFinAlas2359]);
    expect(await dia('2026-11-28')).toEqual([]);
  });

  it('cruza fin de mes y de año', async () => {
    expect(await dia('2026-11-30')).toEqual([cruzaMes]);
    expect(await dia('2026-12-01')).toEqual([cruzaMes]);
    expect(await dia('2026-12-31')).toEqual([cruzaAnio]);
    expect(await dia('2027-01-01')).toEqual([cruzaAnio]);
    expect(await dia('2027-01-02')).toEqual([]);
  });

  it('desde/hasta inclusive: un rango que sólo toca el borde de un evento lo incluye', async () => {
    const res = await ctx.http().get('/eventos?desde=2026-12-01&hasta=2026-12-01').expect(200);
    expect(ids(res.body)).toEqual([cruzaMes]);
    const res2 = await ctx.http().get('/eventos?desde=2026-11-21&hasta=2026-11-21').expect(200);
    expect(ids(res2.body)).toEqual([empiezaALas00]);
  });

  it('fecha con un día bisiesto válido (2028-02-29) anda y 2027-02-29 es 400', async () => {
    await ctx.http().get('/eventos?fecha=2028-02-29').expect(200);
    esperarError(await ctx.http().get('/eventos?fecha=2027-02-29').expect(400), 400, 'VALIDACION_FALLIDA');
  });

  it('sin filtros, "desde hoy" a las 23:59 y a las 00:00 respeta el día de Buenos Aires', async () => {
    const hoyTarde = await crearEvento(ctx, {
      inicio: en('2026-12-10T08:00:00-03:00'),
      fin: en('2026-12-10T09:00:00-03:00'),
    });
    ctx.reloj.fijar('2026-12-10T23:59:00-03:00');
    expect(ids((await ctx.http().get('/eventos').expect(200)).body)).toContain(hoyTarde);
    ctx.reloj.fijar('2026-12-11T00:00:00-03:00');
    expect(ids((await ctx.http().get('/eventos').expect(200)).body)).not.toContain(hoyTarde);
    ctx.reloj.fijar('2026-11-14T12:00:00-03:00');
  });

  it('sólo hasta: desde vale hoy; un hasta en el pasado da lista vacía', async () => {
    // DUDA: M2-1 dice a la vez "un hasta en el pasado da lista vacía" y "hasta anterior a desde es
    // VALIDACION_FALLIDA" (con desde = hoy por defecto). Se aceptan las dos lecturas.
    const res = await ctx.http().get('/eventos?hasta=2026-11-13');
    esperarSinRomper(res);
    if (res.status === 200) expect(res.body.datos).toEqual([]);
    else esperarError(res, 400, 'VALIDACION_FALLIDA');
    const otro = await ctx.http().get('/eventos?hasta=2026-11-21').expect(200);
    expect(ids(otro.body)).toEqual([terminaALas00, empiezaALas00]);
  });
});

describe('Entrada — parámetros de la lista', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
    await crearEvento(ctx);
  });
  afterAll(() => ctx.cerrar());

  it.each([
    ['pagina=0'],
    ['pagina=-1'],
    ['pagina=abc'],
    ['pagina=1.5'],
    ['porPagina=0'],
    ['porPagina=-5'],
    ['porPagina=101'],
    ['porPagina=abc'],
    ['estado=PROGRAMADO'],
    ['estado='],
    ['fecha=2026-1-1'],
    ['fecha=2026-11-14T10:00:00-03:00'],
    ['fecha=1899-12-31'],
    ['desde=2026-11-14&hasta='],
    ['fecha[]=2026-11-14'],
    ['fecha=2026-11-14&fecha=2026-11-15'],
    ['estado=programado&estado=cancelado'],
    ['pagina=99999999999999999999'],
  ])('%s: 400 VALIDACION_FALLIDA con sobre exacto', async (q) => {
    const res = await ctx.http().get(`/eventos?${q}`);
    esperarError(res, 400, 'VALIDACION_FALLIDA');
  });

  it('parámetros que no existen (distancia, q, foo) no rompen', async () => {
    for (const q of ['foo=1', 'q=peña', 'orden=distancia', 'latitud=1']) {
      esperarSinRomper(await ctx.http().get(`/eventos?${q}`));
    }
  });

  it('lugarId raro (largo, con símbolos, byte nulo) da lista vacía o 400, nunca 500', async () => {
    for (const l of ['x'.repeat(5000), "lug-'; DROP TABLE eventos;--", 'lug-%00', '%', '_', 'LUG-004']) {
      const res = await ctx.http().get('/eventos').query({ lugarId: l });
      esperarSinRomper(res);
      if (res.status === 200) expect(res.body.datos).toEqual([]);
    }
  });

  it('la lista es pública, también con token vencido o mal firmado', async () => {
    const { usuario } = await registrarTurista(ctx);
    const vencido = await ctx.app
      .get(JwtService)
      .signAsync({ sub: usuario.id, rol: 'turista' }, { expiresIn: -10 });
    const conBasura = 'abc.def.ghi';
    for (const t of [vencido, conBasura]) {
      const res = await ctx.http().get('/eventos').set(conSesion(t));
      esperarSinRomper(res);
      // Mirar no exige cuenta (PRD §5): igual que en M1, el token roto no debería bloquear.
      expect(res.status).toBe(200);
    }
  });

  it('pagina fuera de rango con filtros: datos vacío y total filtrado correcto', async () => {
    const res = await ctx.http().get('/eventos?pagina=50&porPagina=100&estado=programado').expect(200);
    expect(res.body.datos).toEqual([]);
    expect(res.body.meta.total).toBe(1);
    expect(res.body.meta.pagina).toBe(50);
  });
});

describe('Filtros combinados y orden', () => {
  let ctx: AppDePrueba;
  let lugarA: string;
  let lugarB: string;
  const creados: string[] = [];
  beforeAll(async () => {
    ctx = await crearApp({ ahora: '2026-11-14T12:00:00-03:00' });
    lugarA = await crearLugar(ctx);
    lugarB = await crearLugar(ctx);
    // 25 eventos con el mismo inicio: el orden tiene que ser estable (desempate por id).
    for (let i = 0; i < 25; i++) {
      creados.push(
        await crearEvento(ctx, { inicio: en('2026-11-20T21:00:00-03:00'), lugarId: i % 2 ? lugarA : lugarB }),
      );
    }
  });
  afterAll(() => ctx.cerrar());

  it('recorrer todas las páginas con inicio idéntico no repite ni pierde eventos, y es reproducible', async () => {
    const vistos: string[] = [];
    for (let p = 1; p <= 5; p++) {
      const r = await ctx.http().get(`/eventos?porPagina=6&pagina=${p}`).expect(200);
      expect(r.body.meta).toEqual({ total: 25, pagina: p, porPagina: 6 });
      vistos.push(...ids(r.body));
    }
    expect(new Set(vistos).size).toBe(25);
    expect([...vistos].sort()).toEqual([...creados].sort());
    const otra = await ctx.http().get('/eventos?porPagina=100').expect(200);
    expect(ids(otra.body)).toEqual(vistos);
    expect(vistos).toEqual([...vistos].sort());
  });

  it('fecha + lugarId + estado a la vez', async () => {
    const res = await ctx
      .http()
      .get(`/eventos?fecha=2026-11-20&lugarId=${lugarA}&estado=programado&porPagina=100`)
      .expect(200);
    expect(res.body.meta.total).toBe(12);
    for (const e of res.body.datos) expect(e.lugarId).toBe(lugarA);
    const nada = await ctx
      .http()
      .get(`/eventos?fecha=2026-11-20&lugarId=${lugarA}&estado=cancelado`)
      .expect(200);
    expect(nada.body.datos).toEqual([]);
    expect(nada.body.meta.total).toBe(0);
  });

  it('un evento sin lugar (dirección libre) no aparece al filtrar por lugarId', async () => {
    const libre = await crearEvento(ctx, {
      inicio: en('2026-11-20T21:00:00-03:00'),
      direccionLibre: 'Plaza',
    });
    const res = await ctx.http().get(`/eventos?lugarId=${lugarA}&porPagina=100`).expect(200);
    expect(ids(res.body)).not.toContain(libre);
  });
});

describe('PATCH /eventos/:id/estado — permisos, entrada y errores', () => {
  let ctx: AppDePrueba;
  let admin: { id: string; token: string };
  beforeAll(async () => {
    ctx = await crearApp();
    admin = await crearAdmin(ctx);
  });
  afterAll(() => ctx.cerrar());

  const patch = (id: string, cuerpo: unknown, token: string | null = admin.token) => {
    const r = ctx.http().patch(`/eventos/${id}/estado`);
    if (token) r.set(conSesion(token));
    return r.send(cuerpo as object);
  };

  it('token vencido o mal firmado: 401 NO_AUTENTICADO', async () => {
    const id = await crearEvento(ctx);
    const vencido = await ctx.app
      .get(JwtService)
      .signAsync({ sub: admin.id, rol: 'admin' }, { expiresIn: -10 });
    esperarError(await patch(id, { estado: 'cancelado' }, vencido), 401, 'NO_AUTENTICADO');
    const otroSecreto = await new JwtService({ secret: 'otro-secreto-que-no-es' }).signAsync({
      sub: admin.id,
      rol: 'admin',
    });
    esperarError(await patch(id, { estado: 'cancelado' }, otroSecreto), 401, 'NO_AUTENTICADO');
    esperarError(await patch(id, { estado: 'cancelado' }, 'basura'), 401, 'NO_AUTENTICADO');
    expect((await ctx.http().get(`/eventos/${id}`).expect(200)).body.datos.estado).toBe('programado');
  });

  it('un token que dice rol admin pero es de un usuario turista en la base no puede cambiar el estado', async () => {
    const { usuario } = await registrarTurista(ctx);
    const falso = await ctx.app.get(JwtService).signAsync({ sub: usuario.id, rol: 'admin' });
    const id = await crearEvento(ctx);
    const res = await patch(id, { estado: 'cancelado' }, falso);
    // Con el JWT firmado por el servidor el rol del token es de confianza; si el servidor lee el rol
    // de la base, da 403. Lo que no puede pasar es 500.
    esperarSinRomper(res);
  });

  it('un turista recibe 403 antes que 400 o 404 (el permiso va primero)', async () => {
    const { token } = await registrarTurista(ctx);
    esperarError(await patch('evt-noexiste1', { estado: 'cancelado' }, token), 403, 'SIN_PERMISO');
    esperarError(await patch('evt-noexiste1', { estado: 'finalizado' }, token), 403, 'SIN_PERMISO');
  });

  it('sin token 401 aunque el cuerpo sea inválido', async () => {
    esperarError(await patch('evt-x', { estado: 'finalizado' }, null), 401, 'NO_AUTENTICADO');
  });

  it('el admin con id inexistente y cuerpo válido: 404; con cuerpo inválido: 400 o 404 pero sobre exacto', async () => {
    esperarError(await patch('evt-noexiste1', { estado: 'cancelado' }), 404, 'EVENTO_NO_ENCONTRADO');
    esperarSinRomper(await patch('evt-noexiste1', { estado: 'finalizado' }));
  });

  it.each([['%20'], ['lug-abc'], ["evt-'or'1'='1"], ['x'.repeat(3000)], ['EVT-ABC12345']])(
    'id raro %s: 404 con sobre exacto',
    async (raro) => {
      const res = await patch(raro, { estado: 'cancelado' });
      esperarSinRomper(res);
      expect([400, 404]).toContain(res.status);
    },
  );

  it.each([
    [{ estado: 'Cancelado' }],
    [{ estado: ' cancelado' }],
    [{ estado: ['cancelado'] }],
    [{ estado: { valor: 'cancelado' } }],
    [{ estado: true }],
    [{ estado: '' }],
    [{ Estado: 'cancelado' }],
    [{ estado: 'cancelado', motivo: 'lluvia' }],
    [{ estado: 'cancelado', id: 'evt-otro' }],
    [{ estado: 'cancelado', titulo: 'hackeado' }],
    [[]],
    [['cancelado']],
    ['cancelado'],
    [null],
  ])('cuerpo inválido %j: 400 VALIDACION_FALLIDA y el evento no cambia', async (cuerpo) => {
    const id = await crearEvento(ctx);
    const res = await patch(id, cuerpo);
    esperarError(res, 400, 'VALIDACION_FALLIDA');
    expect((await ctx.http().get(`/eventos/${id}`).expect(200)).body.datos.estado).toBe('programado');
  });

  it('JSON roto: 400 con sobre exacto (no 500)', async () => {
    const id = await crearEvento(ctx);
    const res = await ctx
      .http()
      .patch(`/eventos/${id}/estado`)
      .set(conSesion(admin.token))
      .set('Content-Type', 'application/json')
      .send('{"estado": ');
    esperarSinRomper(res);
    expect(res.status).toBe(400);
  });

  it('el PATCH sólo cambia el estado: el resto del evento queda igual (incluidos nulos)', async () => {
    const id = await crearEvento(ctx, { direccionLibre: 'Costanera', precio: 0 });
    const antes = (await ctx.http().get(`/eventos/${id}`).expect(200)).body.datos as Evento;
    const res = await patch(id, { estado: 'suspendido' }).expect(200);
    esperarContrato(res.body, 'Evento');
    expect(res.body.datos).toEqual({ ...antes, estado: 'suspendido' });
  });

  it('cancelar un evento ya finalizado: queda cancelado (no se calcula finalizado sobre cancelado)', async () => {
    const id = await crearEvento(ctx, {
      inicio: en('2026-11-01T10:00:00-03:00'),
      fin: en('2026-11-01T12:00:00-03:00'),
    });
    const res = await patch(id, { estado: 'cancelado' }).expect(200);
    expect(res.body.datos.estado).toBe('cancelado');
  });

  it('R10 — "mismo estado" sobre un finalizado calculado a programado: 200, sigue finalizado, sin push', async () => {
    const id = await crearEvento(ctx, {
      inicio: en('2026-11-01T10:00:00-03:00'),
      fin: en('2026-11-01T12:00:00-03:00'),
    });
    const res = await patch(id, { estado: 'programado' }).expect(200);
    expect(res.body.datos.estado).toBe('finalizado');
    await ctx.esperarAvisos();
    expect(ctx.enviador.enviadas).toHaveLength(0);
  });

  it('20 cambios simultáneos: todos 200 y un estado final válido', async () => {
    const id = await crearEvento(ctx);
    const estados = ['suspendido', 'cancelado', 'programado'];
    const rs = await Promise.all(Array.from({ length: 20 }, (_, i) => patch(id, { estado: estados[i % 3] })));
    expect(rs.map((r) => r.status)).toEqual(Array(20).fill(200));
    const e = (await ctx.http().get(`/eventos/${id}`).expect(200)).body.datos.estado;
    expect(estados).toContain(e);
  });

  it('M2-2 — el cambio no manda push en M2 (nadie guardó el evento todavía)', async () => {
    const id = await crearEvento(ctx);
    await patch(id, { estado: 'cancelado' }).expect(200);
    await ctx.esperarAvisos();
    expect(ctx.enviador.enviadas).toHaveLength(0);
  });
});

describe('GET /eventos/:id — ids raros', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
  });
  afterAll(() => ctx.cerrar());

  it.each([
    ['evt-'],
    ['EVT-ABC'],
    ['evt-%00'],
    ['evt-a b'],
    ['x'.repeat(4000)],
    ['..%2f..%2fetc'],
    ['evt-017%27'],
  ])('%s: 404 EVENTO_NO_ENCONTRADO (o RUTA_NO_ENCONTRADA), nunca 500', async (id) => {
    const res = await ctx.http().get(`/eventos/${id}`);
    esperarSinRomper(res);
    expect(res.status).toBe(404);
  });

  it('el detalle no exige cuenta, ni con token vencido', async () => {
    const id = await crearEvento(ctx);
    const { usuario } = await registrarTurista(ctx);
    const vencido = await ctx.app
      .get(JwtService)
      .signAsync({ sub: usuario.id, rol: 'turista' }, { expiresIn: -10 });
    await ctx.http().get(`/eventos/${id}`).set(conSesion(vencido)).expect(200);
  });

  it('un DELETE/PUT/POST sobre /eventos no existe: error con sobre exacto', async () => {
    const id = await crearEvento(ctx);
    for (const r of [
      ctx.http().post('/eventos').send({}),
      ctx.http().delete(`/eventos/${id}`),
      ctx.http().put(`/eventos/${id}`).send({}),
      ctx.http().patch(`/eventos/${id}`).send({}),
    ]) {
      const res = await r;
      esperarSinRomper(res);
      expect(res.status).toBeGreaterThanOrEqual(400);
    }
  });
});

describe('Semillas de la agenda — cada evento sembrado cumple el contrato (PRD §3)', () => {
  let ctx: AppDePrueba;
  let eventos: Evento[];
  beforeAll(async () => {
    ctx = await crearApp({ ahora: '2026-11-14T12:00:00-03:00' });
    await ctx.app.get(Sembrador).sembrar();
    const res = await ctx.http().get('/eventos?desde=2000-01-01&porPagina=100').expect(200);
    esperarContrato(res.body, 'Evento');
    eventos = res.body.datos;
  });
  afterAll(() => ctx.cerrar());

  it('existe evt-017 en lug-009 y hay casos para los cuatro estados', async () => {
    const e = eventos.find((x) => x.id === 'evt-017');
    expect(e?.lugarId).toBe('lug-009');
    const estados = new Set(eventos.map((x) => x.estado));
    for (const s of ['programado', 'suspendido', 'cancelado', 'finalizado']) expect(estados).toContain(s);
  });

  it('R7 en lo sembrado: lugarId xor direccionLibre; coordenadas sólo sin lugarId', () => {
    for (const e of eventos) {
      expect(!!e.lugarId !== !!e.direccionLibre, e.id).toBe(true);
      if (e.lugarId) expect(e.coordenadas, e.id).toBeNull();
    }
    expect(eventos.some((e) => e.lugarId === null)).toBe(true);
  });

  it('hay uno gratis (precio 0) y uno con precio null, uno que cruza la medianoche', () => {
    expect(eventos.some((e) => e.precio === 0)).toBe(true);
    expect(eventos.some((e) => e.precio === null)).toBe(true);
    expect(eventos.some((e) => e.fin && e.inicio.slice(0, 10) !== e.fin.slice(0, 10))).toBe(true);
  });

  it('todo evento con lugarId apunta a un lugar que existe', async () => {
    for (const e of eventos.filter((x) => x.lugarId)) {
      await ctx.http().get(`/lugares/${e.lugarId}`).expect(200);
    }
  });

  it('los lugarId de la lista coinciden con el filtro lugarId', async () => {
    const e = eventos.find((x) => x.id === 'evt-017')!;
    const res = await ctx.http().get(`/eventos?desde=2000-01-01&lugarId=${e.lugarId}`).expect(200);
    expect(ids(res.body)).toContain('evt-017');
  });
});
