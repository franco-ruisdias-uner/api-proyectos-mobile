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

// El reloj de prueba marca 2026-11-14T12:00:00-03:00 (sábado).
const en = (s: string) => new Date(s);
const ids = (b: { datos: { id: string }[] }) => b.datos.map((e) => e.id);

describe('PRD §3 — GET /eventos y GET /eventos/:id', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
  });
  afterAll(() => ctx.cerrar());

  it('un evento con todo cargado sale con todos los campos y el instante con -03:00', async () => {
    const { token } = await registrarTurista(ctx);
    const clave = claveDe(await subirArchivo(ctx, token));
    const lugarId = await crearLugar(ctx);
    const id = await crearEvento(ctx, {
      lugarId,
      inicio: en('2026-12-01T21:00:00-03:00'),
      fin: en('2026-12-02T02:00:00-03:00'),
      imagenClave: clave,
      precio: 3500,
    });
    const res = await ctx.http().get(`/eventos/${id}`).expect(200);
    esperarContrato(res.body, 'Evento');
    expect(res.body.meta).toBeNull();
    expect(res.body.datos).toMatchObject({
      id,
      lugarId,
      direccionLibre: null,
      coordenadas: null,
      inicio: '2026-12-01T21:00:00-03:00',
      fin: '2026-12-02T02:00:00-03:00',
      precio: 3500,
      estado: 'programado',
    });
    expect(res.body.datos.imagenUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/archivos\/imagenes\//);
  });

  it('R7 — sin lugar: dirección libre y coordenadas; los opcionales, en null', async () => {
    const id = await crearEvento(ctx, {
      direccionLibre: 'Club de Pescadores, Colón',
      coordenadas: { latitud: -32.21, longitud: -58.14 },
    });
    const res = await ctx.http().get(`/eventos/${id}`).expect(200);
    esperarContrato(res.body, 'Evento');
    expect(res.body.datos).toMatchObject({
      lugarId: null,
      direccionLibre: 'Club de Pescadores, Colón',
      coordenadas: { latitud: -32.21, longitud: -58.14 },
      fin: null,
      imagenUrl: null,
      precio: null,
    });
  });

  it('R7 — no se puede cargar un evento con lugar y dirección libre, ni sin ninguno, ni lugar con coordenadas', async () => {
    const lugarId = await crearLugar(ctx);
    const base = {
      titulo: 'x',
      descripcion: 'x',
      lugarId: null,
      direccionLibre: null,
      coordenadas: null,
      inicio: en('2026-12-01T21:00:00-03:00'),
      fin: null,
      imagenClave: null,
      precio: null,
      estado: 'programado' as const,
    };
    const { EventosServicio } = await import('../../src/modules/events/events.service.js');
    const servicio = ctx.app.get(EventosServicio);
    await expect(servicio.cargar({ ...base, lugarId, direccionLibre: 'x' })).rejects.toThrow(/R7/);
    await expect(servicio.cargar(base)).rejects.toThrow(/R7/);
    await expect(
      servicio.cargar({ ...base, lugarId, coordenadas: { latitud: 1, longitud: 1 } }),
    ).rejects.toThrow(/R7/);
  });

  it('es público y un id que no existe (o mal formado) da 404 EVENTO_NO_ENCONTRADO', async () => {
    for (const id of ['evt-noexiste1', 'lug-abc', 'xx', 'evt-%20']) {
      const res = await ctx.http().get(`/eventos/${id}`).expect(404);
      esperarError(res, 404, 'EVENTO_NO_ENCONTRADO');
    }
  });

  describe('lista', () => {
    let a: string,
      b: string,
      c: string,
      cruza: string,
      terminado: string,
      suspendido: string,
      cancelado: string,
      lugarX: string;
    let ctx2: AppDePrueba;
    beforeAll(async () => {
      ctx2 = await crearApp();
      lugarX = await crearLugar(ctx2);
      terminado = await crearEvento(ctx2, {
        titulo: 'terminado',
        inicio: en('2026-11-13T18:00:00-03:00'),
        fin: en('2026-11-13T20:00:00-03:00'),
      });
      // Hoy, ya empezó y todavía no terminó.
      a = await crearEvento(ctx2, {
        inicio: en('2026-11-14T10:00:00-03:00'),
        fin: en('2026-11-14T13:00:00-03:00'),
        lugarId: lugarX,
      });
      // Hoy a la noche, sin fin.
      b = await crearEvento(ctx2, { inicio: en('2026-11-14T21:00:00-03:00') });
      // Cruza la medianoche.
      cruza = await crearEvento(ctx2, {
        inicio: en('2026-11-14T21:00:00-03:00'),
        fin: en('2026-11-15T02:00:00-03:00'),
      });
      c = await crearEvento(ctx2, { inicio: en('2026-11-24T21:00:00-03:00') });
      suspendido = await crearEvento(ctx2, { inicio: en('2026-11-16T10:00:00-03:00'), estado: 'suspendido' });
      cancelado = await crearEvento(ctx2, { inicio: en('2026-11-17T10:00:00-03:00'), estado: 'cancelado' });
    });
    afterAll(() => ctx2.cerrar());

    it('sin filtros: desde hoy (incluye lo de hoy que ya terminó), por inicio y con meta', async () => {
      const res = await ctx2.http().get('/eventos').expect(200);
      esperarContrato(res.body, 'Evento');
      expect(res.body.meta).toEqual({ total: 6, pagina: 1, porPagina: 20 });
      expect(ids(res.body)).not.toContain(terminado);
      const inicios = res.body.datos.map((e: { inicio: string }) => e.inicio);
      expect(inicios).toEqual([...inicios].sort());
      expect(ids(res.body).slice(0, 1)).toEqual([a]);
    });

    it('R8 — fecha: la peña que cruza la medianoche aparece en los dos días', async () => {
      const hoy = await ctx2.http().get('/eventos?fecha=2026-11-14').expect(200);
      expect(ids(hoy.body).sort()).toEqual([a, b, cruza].sort());
      const manana = await ctx2.http().get('/eventos?fecha=2026-11-15').expect(200);
      expect(ids(manana.body)).toEqual([cruza]);
      const pasado = await ctx2.http().get('/eventos?fecha=2026-11-13').expect(200);
      expect(ids(pasado.body)).toEqual([terminado]);
    });

    it('R8 — sin fin, cuenta hasta las 23:59 del día de inicio: no aparece al día siguiente', async () => {
      const res = await ctx2.http().get('/eventos?fecha=2026-11-15').expect(200);
      expect(ids(res.body)).not.toContain(b);
    });

    it('desde y hasta, inclusive', async () => {
      const res = await ctx2.http().get('/eventos?desde=2026-11-15&hasta=2026-11-17').expect(200);
      expect(ids(res.body)).toEqual([cruza, suspendido, cancelado]);
      const soloDesde = await ctx2.http().get('/eventos?desde=2026-11-13&hasta=2026-11-13').expect(200);
      expect(ids(soloDesde.body)).toEqual([terminado]);
      const desdeLejos = await ctx2.http().get('/eventos?desde=2026-11-20').expect(200);
      expect(ids(desdeLejos.body)).toEqual([c]);
    });

    it('R9 — finalizado se calcula; suspendido y cancelado no cambian solos', async () => {
      const antes = await ctx2.http().get(`/eventos/${terminado}`).expect(200);
      expect(antes.body.datos.estado).toBe('finalizado');
      ctx2.reloj.fijar('2026-12-31T12:00:00-03:00');
      try {
        const susp = await ctx2.http().get(`/eventos/${suspendido}`).expect(200);
        const canc = await ctx2.http().get(`/eventos/${cancelado}`).expect(200);
        const prog = await ctx2.http().get(`/eventos/${c}`).expect(200);
        expect(susp.body.datos.estado).toBe('suspendido');
        expect(canc.body.datos.estado).toBe('cancelado');
        expect(prog.body.datos.estado).toBe('finalizado');
      } finally {
        ctx2.reloj.fijar('2026-11-14T12:00:00-03:00');
      }
    });

    it('filtro estado, incluido finalizado calculado', async () => {
      const fin = await ctx2.http().get('/eventos?desde=2026-11-01&estado=finalizado').expect(200);
      expect(ids(fin.body)).toEqual([terminado]);
      const prog = await ctx2.http().get('/eventos?desde=2026-11-01&estado=programado').expect(200);
      expect(ids(prog.body)).not.toContain(terminado);
      expect(ids(prog.body)).toContain(a);
      const susp = await ctx2.http().get('/eventos?estado=suspendido').expect(200);
      expect(ids(susp.body)).toEqual([suspendido]);
      const canc = await ctx2.http().get('/eventos?estado=cancelado').expect(200);
      expect(ids(canc.body)).toEqual([cancelado]);
    });

    it('filtro lugarId; uno que no existe da lista vacía', async () => {
      const res = await ctx2.http().get(`/eventos?lugarId=${lugarX}`).expect(200);
      expect(ids(res.body)).toEqual([a]);
      for (const l of ['lug-noexiste', 'xx', 'lug-\u0000']) {
        const vacia = await ctx2.http().get('/eventos').query({ lugarId: l }).expect(200);
        expect(vacia.body).toEqual({ datos: [], meta: { total: 0, pagina: 1, porPagina: 20 } });
      }
    });

    it('paginación: meta correcta, orden estable y página fuera de rango vacía', async () => {
      const p1 = await ctx2.http().get('/eventos?porPagina=2&pagina=1').expect(200);
      const p2 = await ctx2.http().get('/eventos?porPagina=2&pagina=2').expect(200);
      expect(p1.body.meta).toEqual({ total: 6, pagina: 1, porPagina: 2 });
      expect(p1.body.datos).toHaveLength(2);
      expect(new Set([...ids(p1.body), ...ids(p2.body)]).size).toBe(4);
      const fuera = await ctx2.http().get('/eventos?pagina=9').expect(200);
      expect(fuera.body).toEqual({ datos: [], meta: { total: 6, pagina: 9, porPagina: 20 } });
      await ctx2.http().get('/eventos?porPagina=101').expect(400);
    });

    it('empates de inicio se desempatan por id', async () => {
      const res = await ctx2.http().get('/eventos?fecha=2026-11-14').expect(200);
      const iguales = res.body.datos.filter(
        (e: { inicio: string }) => e.inicio === '2026-11-14T21:00:00-03:00',
      );
      expect(ids({ datos: iguales })).toEqual([b, cruza].sort());
    });

    it.each([
      ['fecha=2026-02-30'],
      ['fecha=14-11-2026'],
      ['fecha='],
      ['desde=hoy'],
      ['hasta=2026-13-01'],
      ['desde=2026-11-14&fecha=2026-11-14'],
      ['fecha=2026-11-14&hasta=2026-11-15'],
      ['desde=2026-11-20&hasta=2026-11-19'],
      ['fecha=9999-12-31'],
      ['estado=finalizada'],
      ['estado=otro'],
    ])('400 VALIDACION_FALLIDA con %s', async (consulta) => {
      const res = await ctx2.http().get(`/eventos?${consulta}`).expect(400);
      esperarError(res, 400, 'VALIDACION_FALLIDA');
    });

    it('la fecha por defecto es hoy en Buenos Aires, no en UTC', async () => {
      // 22:30 en Buenos Aires ya es el día siguiente en UTC.
      ctx2.reloj.fijar('2026-11-14T22:30:00-03:00');
      try {
        const res = await ctx2.http().get('/eventos').expect(200);
        expect(ids(res.body)).toContain(a);
      } finally {
        ctx2.reloj.fijar('2026-11-14T12:00:00-03:00');
      }
    });
  });
});

describe('PRD §3 — PATCH /eventos/:id/estado', () => {
  let ctx: AppDePrueba;
  let admin: { id: string; token: string };
  beforeAll(async () => {
    ctx = await crearApp();
    admin = await crearAdmin(ctx);
  });
  afterAll(() => ctx.cerrar());

  const patch = (id: string, cuerpo: unknown, token = admin.token) =>
    ctx
      .http()
      .patch(`/eventos/${id}/estado`)
      .set(conSesion(token))
      .send(cuerpo as object);

  it('R2/D2 — el admin suspende, cancela y reprograma; devuelve el Evento', async () => {
    const id = await crearEvento(ctx);
    for (const estado of ['suspendido', 'cancelado', 'programado']) {
      const res = await patch(id, { estado }).expect(200);
      esperarContrato(res.body, 'Evento');
      expect(res.body.datos.estado).toBe(estado);
      const detalle = await ctx.http().get(`/eventos/${id}`).expect(200);
      expect(detalle.body.datos.estado).toBe(estado);
    }
  });

  it('R10 — el mismo estado es 200 y no cambia nada', async () => {
    const id = await crearEvento(ctx, { estado: 'suspendido' });
    const res = await patch(id, { estado: 'suspendido' }).expect(200);
    expect(res.body.datos.estado).toBe('suspendido');
    await ctx.esperarAvisos();
    expect(ctx.enviador.enviadas).toHaveLength(0);
  });

  it('R10 — «finalizado» y estados raros: VALIDACION_FALLIDA', async () => {
    const id = await crearEvento(ctx);
    for (const cuerpo of [
      { estado: 'finalizado' },
      { estado: 'otro' },
      {},
      { estado: null },
      { estado: 3 },
      { estado: 'cancelado', extra: 1 },
    ]) {
      const res = await patch(id, cuerpo).expect(400);
      esperarError(res, 400, 'VALIDACION_FALLIDA');
    }
    const detalle = await ctx.http().get(`/eventos/${id}`).expect(200);
    expect(detalle.body.datos.estado).toBe('programado');
  });

  it('un evento ya terminado que se reprograma a «programado» sigue saliendo finalizado', async () => {
    const id = await crearEvento(ctx, {
      inicio: en('2026-11-01T10:00:00-03:00'),
      fin: en('2026-11-01T12:00:00-03:00'),
    });
    const res = await patch(id, { estado: 'programado' }).expect(200);
    expect(res.body.datos.estado).toBe('finalizado');
  });

  it('401 sin token, 403 siendo turista, 404 si no existe', async () => {
    const id = await crearEvento(ctx);
    const sin = await ctx.http().patch(`/eventos/${id}/estado`).send({ estado: 'cancelado' }).expect(401);
    esperarError(sin, 401, 'NO_AUTENTICADO');
    const { token } = await registrarTurista(ctx);
    const turista = await patch(id, { estado: 'cancelado' }, token).expect(403);
    esperarError(turista, 403, 'SIN_PERMISO');
    const noExiste = await patch('evt-noexiste1', { estado: 'cancelado' }).expect(404);
    esperarError(noExiste, 404, 'EVENTO_NO_ENCONTRADO');
    const detalle = await ctx.http().get(`/eventos/${id}`).expect(200);
    expect(detalle.body.datos.estado).toBe('programado');
  });

  it('dos cambios simultáneos terminan en uno de los dos estados, sin error', async () => {
    const id = await crearEvento(ctx);
    const [x, y] = await Promise.all([
      patch(id, { estado: 'suspendido' }),
      patch(id, { estado: 'cancelado' }),
    ]);
    expect([x.status, y.status]).toEqual([200, 200]);
    const detalle = await ctx.http().get(`/eventos/${id}`).expect(200);
    expect(['suspendido', 'cancelado']).toContain(detalle.body.datos.estado);
  });
});
