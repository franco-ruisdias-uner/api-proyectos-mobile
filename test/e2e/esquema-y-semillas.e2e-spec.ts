// AGENTS §5.2 y §10.4: el esquema queda estable después de sincronizar, y cada
// registro sembrado cumple el contrato. Corre en los cuatro motores.
import type { Bloqueo, Sesion } from '../../contrato/api.js';
import type {
  Deporte,
  Espacio,
  Reserva,
  ReservaFija,
  Turno,
  Usuario,
} from '../../contrato/tipos.js';
import {
  CONTRASENA_DEMO,
  USUARIOS,
} from '../../src/semillas/datos/usuarios.js';
import { DEPORTES, ESPACIOS } from '../../src/semillas/datos/espacios.js';
import { sembrar } from '../../src/semillas/sembrar.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';

describe('AGENTS §5.2 — Estabilidad del esquema', () => {
  let a: AppDePrueba;
  beforeAll(async () => {
    a = await crearApp();
  });
  afterAll(() => a.cerrar());

  it('después de sincronizar no queda ninguna consulta pendiente', async () => {
    const pendientes = await a.dataSource.driver.createSchemaBuilder().log();
    expect(pendientes.upQueries.map((q) => q.query)).toEqual([]);
  });
});

describe('ESPECIFICACION §8 — Usuarios de demo', () => {
  let a: AppDePrueba;
  beforeAll(async () => {
    a = await crearApp();
    await sembrar(a.dataSource, a.reloj);
  });
  afterAll(() => a.cerrar());

  it.each(USUARIOS.map((u) => [u.email, u] as const))(
    '%s ingresa y su /yo cumple el contrato',
    async (email, semilla) => {
      const ingreso = await a
        .http()
        .post('/auth/ingreso')
        .send({ email, contrasena: CONTRASENA_DEMO })
        .expect(200);
      const { token } = esperarContrato<Sesion>(ingreso.body, 'Sesion');
      const res = await a
        .http()
        .get('/yo')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const usuario = esperarContrato<Usuario>(res.body, 'Usuario');
      expect(usuario).toMatchObject({
        id: semilla.id,
        rol: semilla.rol,
        nombre: semilla.nombre,
      });
    },
  );

  it('usr-207 es el Emiliano Ruiz del PRD, con una cancelación tardía', async () => {
    const ingreso = await a
      .http()
      .post('/auth/ingreso')
      .send({ email: 'emiliano@mail.com', contrasena: CONTRASENA_DEMO });
    expect(ingreso.body.datos.usuario).toMatchObject({
      id: 'usr-207',
      nombre: 'Emiliano Ruiz',
      email: 'emiliano@mail.com',
      telefono: '3455-401122',
      rol: 'jugador',
      cancelacionesTardias: 1,
      ausencias: 1,
      espaciosFavoritos: ['esp-02'],
    });
  });

  it('hay un jugador, un encargado y un administrador al menos', () => {
    expect(new Set(USUARIOS.map((u) => u.rol))).toEqual(
      new Set(['jugador', 'encargado', 'administrador']),
    );
  });
});

describe('ESPECIFICACION §8 — Espacios de demo', () => {
  let a: AppDePrueba;
  beforeAll(async () => {
    a = await crearApp();
    await sembrar(a.dataSource, a.reloj);
  });
  afterAll(() => a.cerrar());

  it('los deportes sembrados cumplen el contrato', async () => {
    const res = await a.http().get('/deportes').expect(200);
    const datos = esperarContrato<Deporte[]>(res.body, 'Deporte');
    expect(datos.map((d) => d.id)).toEqual(DEPORTES.map((d) => d.id).sort());
  });

  it('los once espacios sembrados cumplen el contrato, cada uno por su detalle', async () => {
    expect(ESPACIOS).toHaveLength(11);
    for (const semilla of ESPACIOS) {
      const res = await a.http().get(`/espacios/${semilla.id}`).expect(200);
      esperarContrato<Espacio>(res.body, 'Espacio');
    }
  });

  it('esp-02 es la «Cancha 2 — Fútbol 5» del PRD y dep-futbol5 existe', async () => {
    const res = await a.http().get('/espacios/esp-02').expect(200);
    expect(res.body.datos).toMatchObject({
      id: 'esp-02',
      nombre: 'Cancha 2 — Fútbol 5',
      deporteId: 'dep-futbol5',
      iluminacion: true,
    });
  });

  it('la distribución del PRD: 2 fútbol 5, 1 fútbol 11, 3 básquet, 2 vóley, 2 tenis y 1 gimnasio', async () => {
    const res = await a.http().get('/espacios?porPagina=100').expect(200);
    const porDeporte = new Map<string, number>();
    for (const e of res.body.datos as Espacio[])
      porDeporte.set(e.deporteId, (porDeporte.get(e.deporteId) ?? 0) + 1);
    expect(Object.fromEntries(porDeporte)).toEqual({
      'dep-futbol5': 2,
      'dep-futbol11': 1,
      'dep-basquet': 3,
      'dep-voley': 2,
      'dep-tenis': 2,
      'dep-gimnasio': 1,
    });
  });

  it('los de Parque Berduc son tenis y el gimnasio es techado', async () => {
    const res = await a
      .http()
      .get('/espacios?complejo=parque berduc')
      .expect(200);
    expect(res.body.datos.map((e: Espacio) => e.deporteId)).toEqual([
      'dep-tenis',
      'dep-tenis',
    ]);
    const techados = await a
      .http()
      .get('/espacios?techado=true&deporteId=dep-gimnasio')
      .expect(200);
    expect(techados.body.meta.total).toBe(1);
  });

  it('hay un espacio sin video (videoUrl: null)', async () => {
    const res = await a.http().get('/espacios/esp-01').expect(200);
    expect(res.body.datos.videoUrl).toBeNull();
  });
});

describe('AGENTS §16.2 — SEMBRAR_SI_VACIA', () => {
  it('con la base vacía, siembra al arrancar', async () => {
    const a = await crearApp({ entorno: { SEMBRAR_SI_VACIA: 'true' } });
    try {
      await a
        .http()
        .post('/auth/ingreso')
        .send({
          email: 'nahuel@villaguay.demo.ar',
          contrasena: CONTRASENA_DEMO,
        })
        .expect(200);
    } finally {
      await a.cerrar();
    }
  });

  it('sin la variable, la base queda vacía', async () => {
    const a = await crearApp();
    try {
      await a
        .http()
        .post('/auth/ingreso')
        .send({
          email: 'nahuel@villaguay.demo.ar',
          contrasena: CONTRASENA_DEMO,
        })
        .expect(401);
    } finally {
      await a.cerrar();
    }
  });
});

describe('ESPECIFICACION §8 — Grilla de demo (casos feos de M2)', () => {
  let a: AppDePrueba;
  const grilla = async (espacio: string, fecha: string): Promise<Turno[]> => {
    const res = await a
      .http()
      .get(`/espacios/${espacio}/turnos?fecha=${fecha}`)
      .expect(200);
    return esperarContrato<Turno[]>(res.body, 'Turno');
  };
  beforeAll(async () => {
    a = await crearApp();
    await sembrar(a.dataSource, a.reloj);
  });
  afterAll(() => a.cerrar());

  it('la grilla de cada espacio, de hoy a hoy + 6, cumple el contrato', async () => {
    for (const e of ESPACIOS)
      for (let d = 19; d <= 25; d++) await grilla(e.id, `2026-09-${d}`);
  });

  it('pasado mañana está bloqueado por lluvia en todas las canchas descubiertas', async () => {
    for (const e of ESPACIOS.filter((x) => !x.techado)) {
      const t = await grilla(e.id, '2026-09-21');
      expect(t.every((x) => x.motivoBloqueo === 'Cancha anegada')).toBe(true);
    }
    const gim = await grilla('esp-11', '2026-09-21');
    expect(gim.some((x) => x.estado === 'mantenimiento')).toBe(false);
  });

  it('esp-04 mañana no tiene ningún turno libre y mezcla los cuatro estados menos libre', async () => {
    const t = await grilla('esp-04', '2026-09-20');
    expect(t.filter((x) => x.estado === 'libre')).toEqual([]);
    expect(new Set(t.map((x) => x.estado))).toEqual(
      new Set(['mantenimiento', 'fijo', 'reservado']),
    );
  });

  it('fij-07 ocupa los martes de 21 a 22 en esp-02', async () => {
    const t = await grilla('esp-02', '2026-09-22'); // martes
    expect(t.find((x) => x.inicio === '21:00')?.estado).toBe('fijo');
    expect(t.find((x) => x.inicio === '22:00')?.estado).toBe('libre');
    const miercoles = await grilla('esp-02', '2026-09-23');
    expect(miercoles.some((x) => x.estado === 'fijo')).toBe(false);
  });

  it('res-1180 aparece como reservado en su turno', async () => {
    const t = await grilla('esp-02', '2026-09-20');
    expect(t.find((x) => x.inicio === '19:00')).toMatchObject({
      estado: 'reservado',
      reservaId: 'res-1180',
    });
  });

  it('una reserva cancelada deja el turno libre; la fija de dos horas cubre dos turnos; hay un bloqueo parcial', async () => {
    expect(
      (await grilla('esp-01', '2026-09-22')).find((x) => x.inicio === '20:00')
        ?.estado,
    ).toBe('libre');
    const sabado = await grilla('esp-03', '2026-09-19');
    expect(
      sabado.filter((x) => x.estado === 'fijo').map((x) => x.inicio),
    ).toEqual(['16:00', '17:00']);
    const parcial = await grilla('esp-09', '2026-09-22');
    expect(
      parcial.filter((x) => x.estado === 'mantenimiento').map((x) => x.inicio),
    ).toEqual(['10:00', '11:00']);
  });

  it('ninguna reserva sembrada confirmada, cumplida o ausente queda tapada por una fija o un bloqueo', async () => {
    const r = await a.dataSource.query(
      'SELECT espacioId, fecha, inicio, id, estado FROM reservas',
    );
    for (const x of r as {
      espacioId: string;
      fecha: string;
      inicio: string;
      id: string;
      estado: string;
    }[]) {
      // Las de días pasados quedan fuera del rango de la grilla (R6).
      if (x.estado === 'cancelada' || x.fecha < '2026-09-19') continue;
      const t = (await grilla(x.espacioId, x.fecha)).find(
        (y) => y.inicio === x.inicio,
      );
      expect(t, x.id).toMatchObject({ estado: 'reservado', reservaId: x.id });
    }
  });
});

describe('ESPECIFICACION §8 — Reservas de demo (M3)', () => {
  let a: AppDePrueba;
  const ingresar = async (email: string): Promise<string> => {
    const res = await a
      .http()
      .post('/auth/ingreso')
      .send({ email, contrasena: CONTRASENA_DEMO })
      .expect(200);
    return esperarContrato<Sesion>(res.body, 'Sesion').token;
  };
  const mias = async (token: string, q: string): Promise<Reserva[]> => {
    const res = await a
      .http()
      .get(`/yo/reservas?${q}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return esperarContrato<Reserva[]>(res.body, 'Reserva');
  };
  beforeAll(async () => {
    a = await crearApp();
    await sembrar(a.dataSource, a.reloj);
  });
  afterAll(() => a.cerrar());

  it('cada reserva sembrada cumple el contrato y se puede leer como encargado', async () => {
    const encargado = await ingresar('marcelo@villaguay.demo.ar');
    const filas = (await a.dataSource.query('SELECT id FROM reservas')) as {
      id: string;
    }[];
    expect(filas.length).toBeGreaterThan(8);
    for (const { id } of filas) {
      const res = await a
        .http()
        .get(`/reservas/${id}`)
        .set('Authorization', `Bearer ${encargado}`)
        .expect(200);
      esperarContrato<Reserva>(res.body, 'Reserva');
    }
  });

  it('emiliano: res-1180 y res-1196 próximas; la cancelada, la cumplida y la ausente, pasadas', async () => {
    const token = await ingresar('emiliano@mail.com');
    expect((await mias(token, 'cuando=proximas')).map((r) => r.id)).toEqual([
      'res-1180',
      'res-1196',
    ]);
    const pasadas = await mias(token, 'cuando=pasadas');
    expect(pasadas.map((r) => r.estado).toSorted()).toEqual([
      'ausente',
      'cancelada',
      'confirmada',
      'cumplida',
    ]);
  });

  it('lleno@demo.ar tiene tres reservas activas y la cuarta da LIMITE_DE_RESERVAS', async () => {
    const token = await ingresar('lleno@demo.ar');
    expect(await mias(token, 'cuando=proximas')).toHaveLength(3);
    const res = await a
      .http()
      .post('/reservas')
      .set('Authorization', `Bearer ${token}`)
      .send({ turnoId: 'tur-esp-01-20260922-10', cantidadPersonas: 4 });
    esperarError(res, 422, 'LIMITE_DE_RESERVAS');
  });

  it('nuevo@demo.ar no tiene nada y puede reservar', async () => {
    const token = await ingresar('nuevo@demo.ar');
    expect(await mias(token, 'cuando=proximas')).toEqual([]);
    await a
      .http()
      .post('/reservas')
      .set('Authorization', `Bearer ${token}`)
      .send({ turnoId: 'tur-esp-01-20260920-10', cantidadPersonas: 4 })
      .expect(201);
  });
});

describe('ESPECIFICACION §8 — Medios de demo (M8)', () => {
  let a: AppDePrueba;
  beforeAll(async () => {
    a = await crearApp();
    await sembrar(a.dataSource, a.reloj, a.almacen);
  });
  afterAll(() => a.cerrar());

  it('cada espacio tiene dos imágenes que se bajan con la URL del contrato y son PNG', async () => {
    for (const semilla of ESPACIOS) {
      const res = await a.http().get(`/espacios/${semilla.id}`).expect(200);
      const e = esperarContrato<Espacio>(res.body, 'Espacio');
      expect(e.imagenes, semilla.id).toHaveLength(2);
      for (const url of e.imagenes) {
        const ruta = new URL(url).pathname;
        const img = await a.http().get(ruta).expect(200);
        expect(img.headers['content-type']).toContain('image/png');
        expect(Buffer.from(img.body).subarray(1, 4).toString('ascii')).toBe(
          'PNG',
        );
      }
    }
  });

  it('las imágenes admiten Range (206), como pide AGENTS §8', async () => {
    const res = await a.http().get('/espacios/esp-02').expect(200);
    const ruta = new URL(res.body.datos.imagenes[0]).pathname;
    await a.http().get(ruta).set('Range', 'bytes=0-9').expect(206);
  });

  it('sembrar dos veces en bases distintas no rompe y esp-01 sigue sin video', async () => {
    const b = await crearApp();
    try {
      await sembrar(b.dataSource, b.reloj, b.almacen);
      const res = await b.http().get('/espacios/esp-01').expect(200);
      expect(res.body.datos.videoUrl).toBeNull();
    } finally {
      await b.cerrar();
    }
  });
});

describe('AGENTS §10.4 — Todo lo sembrado cumple el contrato', () => {
  let a: AppDePrueba;
  let encargado: string;
  const get = async (ruta: string, token = encargado) =>
    (
      await a
        .http()
        .get(ruta)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
    ).body;
  beforeAll(async () => {
    a = await crearApp();
    await sembrar(a.dataSource, a.reloj, a.almacen);
    const res = await a
      .http()
      .post('/auth/ingreso')
      .send({
        email: 'marcelo@villaguay.demo.ar',
        contrasena: CONTRASENA_DEMO,
      });
    encargado = res.body.datos.token;
  });
  afterAll(() => a.cerrar());

  it('cada usuario sembrado, por /usuarios/:id', async () => {
    for (const u of USUARIOS)
      esperarContrato<Usuario>(await get(`/usuarios/${u.id}`), 'Usuario');
  });

  it('cada reserva fija y cada bloqueo', async () => {
    const fijas = await get('/fijas?porPagina=100');
    expect(
      esperarContrato<ReservaFija[]>(fijas, 'ReservaFija').length,
    ).toBeGreaterThan(2);
    const bloqueos = await get('/bloqueos?desde=2026-09-01&porPagina=100');
    expect(
      esperarContrato<Bloqueo[]>(bloqueos, 'Bloqueo').length,
    ).toBeGreaterThan(2);
  });

  it('la agenda de cada uno de los siete días', async () => {
    for (let d = 19; d <= 25; d++)
      esperarContrato<Turno[]>(
        await get(`/agenda?fecha=2026-09-${d}&porPagina=500`),
        'Turno',
      );
  });
});

// AGENTS §18.3: con PostgreSQL, las tablas van en DB_ESQUEMA y reiniciar no toca otros.
// Sólo corre en la matriz con PostgreSQL (no hay otro motor con esquemas).
describe.runIf(process.env.DB_MOTOR === 'postgres')(
  'AGENTS §18.3 — DB_ESQUEMA en PostgreSQL',
  () => {
    it('las tablas quedan en el esquema pedido y una tabla ajena en public sobrevive', async () => {
      const ajena = await crearApp();
      await ajena.dataSource.query(
        'CREATE TABLE IF NOT EXISTS public.ajena (id int)',
      );
      await ajena.cerrar();
      const a = await crearApp({ entorno: { DB_ESQUEMA: 'api_prueba' } });
      const filas: { table_schema: string }[] = await a.dataSource.query(
        "SELECT table_schema FROM information_schema.tables WHERE table_name = 'usuarios'",
      );
      expect(filas.map((f) => f.table_schema)).toContain('api_prueba');
      const ajenas = await a.dataSource.query(
        "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ajena'",
      );
      expect(ajenas).toHaveLength(1);
      await a.dataSource.query('DROP TABLE public.ajena');
      await a.cerrar();
    });
  },
);
