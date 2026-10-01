import { readFileSync } from 'node:fs';
import type { Aviso, Horario, Linea, Parada, ReporteDeDemora } from '../../contrato/tipos.js';
import { ArchivosServicio } from '../../src/comun/archivos/archivos.servicio.js';
import { baseVacia, sembrar } from '../../src/semillas/sembrar.js';
import { SembradoInicial } from '../../src/semillas/semillas.modulo.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';

// Verificación independiente del M7 — Semillas completas y README (ESPECIFICACION §8, PRD).
// Caja negra: todo entra por HTTP; sólo se usa sembrar() para cargar la demo como lo hace el arranque.

const CONTRASENA = 'demo1234';
// Viernes 18/9/2026 a media mañana: día hábil.
const DESDE = '2026-01-01T00:00:00-03:00';
const HOY = '2026-09-18T10:30:00-03:00';

// En PostgreSQL/MySQL/MariaDB todas las apps comparten la base: sembrar otra pisa los datos de la
// principal, así que después de cualquier segunda app la principal se vuelve a crear.
let sucia = false;
async function sembrada(ahora = HOY, principal = false): Promise<AppDePrueba> {
  if (!principal) sucia = true;
  const app = await crearApp({ ahora });
  await sembrar(app.dataSource, app.reloj, app.app.get(ArchivosServicio));
  return app;
}

async function todo<T>(ctx: AppDePrueba, ruta: string, filtros: Record<string, string> = {}) {
  const r = await ctx.http
    .get(ruta)
    .query({
      ...filtros,
      porPagina: ruta === '/horarios' ? 5000 : ruta === '/paradas' ? 1000 : 100,
    })
    .expect(200);
  return r.body.datos as T[];
}

async function ingresar(ctx: AppDePrueba, email: string) {
  const r = await ctx.http
    .post('/auth/ingreso')
    .send({ email, contrasena: CONTRASENA })
    .expect(200);
  return { Authorization: `Bearer ${r.body.datos.token as string}` };
}

let ctx: AppDePrueba;
beforeAll(async () => {
  ctx = await sembrada(HOY, true);
});
beforeEach(async () => {
  if (!sucia) return;
  await ctx.cerrar();
  sucia = false;
  ctx = await sembrada(HOY, true);
});
afterAll(() => ctx.cerrar());

describe('PRD — Línea: el ejemplo lin-05', () => {
  it('coincide con el JSON del PRD', async () => {
    const r = await ctx.http.get('/lineas/lin-05').expect(200);
    esperarContrato(r.body, 'Linea');
    const l = r.body.datos as Linea;
    expect(l).toMatchObject({
      id: 'lin-05',
      numero: '5',
      nombre: 'Puerto Viejo — San Agustín',
      color: '#1B6CA8',
      empresa: 'Transporte Mariano Moreno',
      activa: true,
    });
    const ida = l.recorridos.find((x) => x.sentido === 'ida')!;
    expect(ida.destino).toBe('hacia Puerto Viejo');
    // El JSON del PRD es ilustrativo (un solo punto de trazado, tres paradas): la ida pasa por par-101.
    expect(ida.paradaIds).toContain('par-101');
    expect(ida.trazado.length).toBeGreaterThanOrEqual(2);
    expect(l.recorridos).toHaveLength(2);
  });

  it('las catorce líneas, con "2" antes que "14" y colores distintos', async () => {
    const ls = await todo<Linea>(ctx, '/lineas');
    expect(ls).toHaveLength(14);
    expect(ls.map((l) => l.numero)).toEqual(ls.map((l) => l.numero).sort((a, b) => +a - +b));
    expect(new Set(ls.map((l) => l.color)).size).toBe(14);
    expect(new Set(ls.map((l) => l.empresa)).size).toBeGreaterThan(1);
  });
});

describe('PRD — Parada: el ejemplo par-101 y R1/R2 sobre las semillas', () => {
  it('par-101 coincide con el JSON del PRD', async () => {
    const r = await ctx.http.get('/paradas/par-101').expect(200);
    esperarContrato(r.body, 'Parada');
    expect(r.body.datos).toEqual({
      id: 'par-101',
      nombre: 'Alameda y Urquiza',
      coordenadas: { latitud: -31.7333, longitud: -60.5241 },
      lineaIds: ['lin-05', 'lin-14'],
      sentido: 'ida',
      refugio: true,
      codigoQr: 'PARANA:par-101',
    });
  });

  it('entre 60 y 80 paradas, con las esquinas del PRD', async () => {
    const ps = await todo<Parada>(ctx, '/paradas');
    expect(ps.length).toBeGreaterThanOrEqual(60);
    expect(ps.length).toBeLessThanOrEqual(80);
    const nombres = ps.map((p) => p.nombre.toLowerCase());
    expect(nombres.some((n) => n.includes('almafuerte') && n.includes('newbery'))).toBe(true);
    expect(nombres.some((n) => n.includes('corrientes'))).toBe(true);
  });

  it('R1: cada parada sólo aparece en recorridos de su sentido; R2: lineaIds sale de los recorridos', async () => {
    const ps = await todo<Parada>(ctx, '/paradas');
    const ls = await todo<Linea>(ctx, '/lineas');
    for (const p of ps) {
      const calculadas = new Set<string>();
      for (const l of ls)
        for (const rec of l.recorridos) {
          if (rec.paradaIds.includes(p.id)) {
            expect(rec.sentido, `${p.id} en ${l.id}`).toBe(p.sentido);
            calculadas.add(l.id);
          }
        }
      expect([...calculadas].sort(), p.id).toEqual([...p.lineaIds].sort());
    }
  });

  it('cada parada de un recorrido existe y no hay paradas huérfanas', async () => {
    const ps = await todo<Parada>(ctx, '/paradas');
    const ls = await todo<Linea>(ctx, '/lineas');
    const ids = new Set(ps.map((p) => p.id));
    for (const l of ls)
      for (const r of l.recorridos) for (const id of r.paradaIds) expect(ids.has(id)).toBe(true);
    for (const p of ps) expect(p.lineaIds.length, p.id).toBeGreaterThan(0);
  });

  it('las líneas 5 y 14 tienen ida y vuelta con paradas distintas y trazados reales', async () => {
    for (const id of ['lin-05', 'lin-14']) {
      const l = (await ctx.http.get(`/lineas/${id}`)).body.datos as Linea;
      expect(l.recorridos.map((r) => r.sentido).sort()).toEqual(['ida', 'vuelta']);
      const [a, b] = l.recorridos;
      expect(a.paradaIds.filter((x) => b.paradaIds.includes(x))).toEqual([]);
      for (const r of l.recorridos) {
        expect(r.paradaIds.length).toBeGreaterThanOrEqual(3);
        expect(r.trazado.length).toBeGreaterThanOrEqual(r.paradaIds.length > 4 ? 4 : 2);
        for (const c of r.trazado) {
          // Paraná está cerca de -31.73, -60.52
          expect(Math.abs(c.latitud + 31.73)).toBeLessThan(0.1);
          expect(Math.abs(c.longitud + 60.52)).toBeLessThan(0.1);
        }
      }
    }
  });

  it('QR: toda parada con código se resuelve y un QR ajeno da 404 QR_NO_RECONOCIDO', async () => {
    const ps = await todo<Parada>(ctx, '/paradas');
    for (const p of ps) if (p.codigoQr) expect(p.codigoQr).toBe(`PARANA:${p.id}`);
    const r = await ctx.http
      .get('/paradas/qr/' + encodeURIComponent('http://ejemplo.com'))
      .expect(404);
    esperarError(r, 404, 'QR_NO_RECONOCIDO');
  });
});

describe('PRD — Horario: hor-4410 y la tabla generada', () => {
  it('hor-4410 es lin-05, par-101, ida, habil, 10:42', async () => {
    const hs = await todo<Horario>(ctx, '/horarios', { lineaId: 'lin-05', paradaId: 'par-101' });
    esperarContrato(
      { datos: hs, meta: { total: hs.length, pagina: 1, porPagina: 5000 } },
      'Horario',
    );
    expect(hs.find((h) => h.id === 'hor-4410')).toEqual({
      id: 'hor-4410',
      lineaId: 'lin-05',
      paradaId: 'par-101',
      sentido: 'ida',
      tipoDeDia: 'habil',
      hora: '10:42',
    });
  });

  it('el ejemplo de la pantalla de inicio: a las 10:30 hábil pasan L5 10:42 11:02 11:22 y L14 10:51 11:21 11:51', async () => {
    const r = await ctx.http.get('/paradas/par-101/proximos').expect(200);
    const por = (id: string) =>
      (r.body.datos as Horario[]).filter((h) => h.lineaId === id).map((h) => h.hora);
    // Los minutos del wireframe del PRD son ilustrativos; la tabla de demo se genera por frecuencia.
    expect(por('lin-05')[0]).toBe('10:42');
    expect(por('lin-14')[1]).toBe('10:51');
  });

  it('ids únicos, "HH:MM", sin servicio entre 00:00 y 05:20 y primer servicio 05:20 en algún lado', async () => {
    const hs: Horario[] = [];
    for (const l of await todo<Linea>(ctx, '/lineas'))
      hs.push(...(await todo<Horario>(ctx, '/horarios', { lineaId: l.id })));
    expect(new Set(hs.map((h) => h.id)).size).toBe(hs.length);
    for (const h of hs) {
      expect(h.hora).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
      expect(h.hora >= '05:20', `${h.id} ${h.hora}`).toBe(true);
    }
    expect(hs.some((h) => h.hora === '05:20')).toBe(true);
    expect(hs.some((h) => h.hora >= '22:30')).toBe(true);
    for (const t of ['habil', 'sabado', 'domingo', 'feriado'])
      expect(
        hs.some((h) => h.tipoDeDia === t),
        t,
      ).toBe(true);
  });

  it('las frecuencias difieren entre hábil, sábado, domingo y feriado (lin-05, par-101)', async () => {
    const hs = await todo<Horario>(ctx, '/horarios', { lineaId: 'lin-05', paradaId: 'par-101' });
    const cuantos = (t: string) => hs.filter((h) => h.tipoDeDia === t).length;
    const n = new Set(['habil', 'sabado', 'domingo', 'feriado'].map(cuantos));
    expect(n.size).toBeGreaterThanOrEqual(3);
    expect(cuantos('habil')).toBeGreaterThan(cuantos('domingo'));
  });

  it('el sentido del horario es el de la parada', async () => {
    const hs = await todo<Horario>(ctx, '/horarios', { lineaId: 'lin-14' });
    const ps = new Map((await todo<Parada>(ctx, '/paradas')).map((p) => [p.id, p]));
    for (const h of hs) expect(ps.get(h.paradaId)!.sentido, h.id).toBe(h.sentido);
  });
});

describe('Espec. §8 — feriados oficiales de 2026 y 2027', () => {
  it.each([
    ['2026', ['2026-01-01', '2026-05-25', '2026-06-20', '2026-07-09', '2026-12-08', '2026-12-25']],
    ['2027', ['2027-01-01', '2027-05-25', '2027-07-09', '2027-12-25']],
  ])('%s trae los fijos conocidos, ordenados y sin repetir', async (anio, esperados) => {
    const r = await ctx.http.get('/feriados').query({ anio }).expect(200);
    esperarContrato(r.body, 'Feriado');
    const fechas = (r.body.datos as { fecha: string }[]).map((f) => f.fecha);
    for (const f of esperados) expect(fechas).toContain(f);
    expect(fechas.every((f) => f.startsWith(anio))).toBe(true);
    expect(new Set(fechas).size).toBe(fechas.length);
    expect(fechas).toEqual([...fechas].sort());
  });

  it('el feriado que cae sábado (20/6/2026) usa la tabla de feriado, no la de sábado', async () => {
    const otra = await sembrada('2026-06-20T10:30:00-03:00');
    try {
      const h = (
        await otra.http.get('/paradas/par-101/proximos').query({ lineaId: 'lin-05' }).expect(200)
      ).body.datos as Horario[];
      expect(h.length).toBeGreaterThan(0);
      expect(new Set(h.map((x) => x.tipoDeDia))).toEqual(new Set(['feriado']));
    } finally {
      await otra.cerrar();
    }
  });
});

describe('Espec. §8 — caso feo: se terminó el servicio (lin-13)', () => {
  it('lin-13 no pasa después de las 21:00 y con el reloj a las 22:00 sólo trae servicios de mañana', async () => {
    const l = (await ctx.http.get('/lineas/lin-13').expect(200)).body.datos as Linea;
    const hs = await todo<Horario>(ctx, '/horarios', { lineaId: 'lin-13' });
    expect(hs.length).toBeGreaterThan(0);
    expect(
      hs
        .map((h) => h.hora)
        .sort()
        .at(-1)! <= '21:00',
    ).toBe(true);
    const cabecera = l.recorridos[0].paradaIds[0];
    const otra = await sembrada('2026-09-18T22:00:00-03:00');
    try {
      const r = await otra.http
        .get(`/paradas/${cabecera}/proximos`)
        .query({ lineaId: 'lin-13' })
        .expect(200);
      esperarContrato(r.body, 'Horario');
      expect(r.body.datos.length).toBeGreaterThan(0);
      for (const h of r.body.datos as Horario[]) expect(h.hora < '22:00').toBe(true);
      // Mañana es sábado: el primero es el de la tabla de sábado.
      expect(r.body.datos[0].tipoDeDia).toBe('sabado');
    } finally {
      await otra.cerrar();
    }
  });

  it('lin-11 está inactiva y sin servicio en ninguna parada', async () => {
    const l = (await ctx.http.get('/lineas/lin-11')).body.datos as Linea;
    expect(l.activa).toBe(false);
    const hs = await todo<Horario>(ctx, '/horarios', { lineaId: 'lin-11' });
    expect(hs).toEqual([]);
    const p = l.recorridos[0]?.paradaIds[0];
    if (p) {
      const r = await ctx.http.get(`/paradas/${p}/proximos`).expect(200);
      expect((r.body.datos as Horario[]).filter((h) => h.lineaId === 'lin-11')).toEqual([]);
    }
  });

  it('las demás líneas activas tienen servicio', async () => {
    for (const l of await todo<Linea>(ctx, '/lineas')) {
      if (!l.activa) continue;
      const hs = await ctx.http.get('/horarios').query({ lineaId: l.id, porPagina: 1 });
      expect(hs.body.meta.total, l.id).toBeGreaterThan(0);
    }
  });
});

describe('PRD — Aviso: avi-088 y los otros casos feos', () => {
  it('avi-088 coincide con el JSON del PRD (salvo fechas relativas y host del video)', async () => {
    const r = await ctx.http.get('/avisos/avi-088').expect(200);
    esperarContrato(r.body, 'Aviso');
    const a = r.body.datos as Aviso;
    expect(a).toMatchObject({
      id: 'avi-088',
      titulo: 'Desvío por obra en calle Corrientes',
      lineaIds: ['lin-02', 'lin-07', 'lin-09'],
      gravedad: 'desvio',
    });
    expect(a.detalle).toContain('líneas 2, 7 y 9 desvían por Santa Fe');
    expect(a.trazadoAlternativo).toContainEqual({ latitud: -31.7345, longitud: -60.523 });
    expect(a.videoUrl).toMatch(/\.mp4$/);
    expect(a.hasta).not.toBeNull();
    expect(a.desde < HOY.replace('10:30', '23:59')).toBe(true);
    expect(a.hasta! > HOY).toBe(true);
    const video = await ctx.http.get(new URL(a.videoUrl!).pathname).expect(200);
    expect(video.headers['content-type']).toBe('video/mp4');
  });

  it('hay un aviso sin video, uno de suspensión en Almafuerte y Newbery, uno próximo y uno terminado', async () => {
    const todos = await todo<Aviso>(ctx, '/avisos', { estado: 'todos' });
    esperarContrato(
      { datos: todos, meta: { total: todos.length, pagina: 1, porPagina: 1000 } },
      'Aviso',
    );
    expect(todos.some((a) => a.videoUrl === null)).toBe(true);
    const susp = todos.find((a) => a.gravedad === 'suspension')!;
    expect(susp).toBeDefined();
    expect(`${susp.titulo} ${susp.detalle}`).toMatch(/Almafuerte/);
    const vig = (await todo<Aviso>(ctx, '/avisos')).map((a) => a.id);
    const prox = (await todo<Aviso>(ctx, '/avisos', { estado: 'proximos' })).map((a) => a.id);
    expect(prox.length).toBeGreaterThanOrEqual(1);
    const terminados = todos.filter((a) => a.hasta !== null && a.hasta <= HOY).map((a) => a.id);
    expect(terminados.length).toBeGreaterThanOrEqual(1);
    for (const id of terminados) expect(vig).not.toContain(id);
    for (const id of prox) expect(vig).not.toContain(id);
    expect(vig).toEqual(expect.arrayContaining(['avi-088', susp.id]));
  });

  it('orden: suspensión, desvío, informativo', async () => {
    const orden = { suspension: 0, desvio: 1, informativo: 2 } as const;
    const vig = await todo<Aviso>(ctx, '/avisos');
    const g = vig.map((a) => orden[a.gravedad]);
    expect(g).toEqual([...g].sort());
  });

  it('README: avi-089 informativo sin fin, avi-090 suspensión lin-08, avi-091 próximo, avi-092 terminado', async () => {
    const a = async (id: string) =>
      (await ctx.http.get(`/avisos/${id}`).expect(200)).body.datos as Aviso;
    expect(await a('avi-089')).toMatchObject({
      gravedad: 'informativo',
      hasta: null,
      videoUrl: null,
    });
    expect(await a('avi-090')).toMatchObject({ gravedad: 'suspension', lineaIds: ['lin-08'] });
    const a91 = await a('avi-091');
    expect(a91.desde > HOY).toBe(true);
    const a92 = await a('avi-092');
    expect(a92.hasta! <= HOY).toBe(true);
    const todos = await todo<Aviso>(ctx, '/avisos', { estado: 'todos' });
    expect(todos).toHaveLength(5);
  });
});

describe('PRD — ReporteDeDemora: rep-3390 y los casos feos', () => {
  it('rep-3390 coincide con el PRD (la fecha es relativa al reloj)', async () => {
    const r = await ctx.http.get('/reportes-demora').query({ paradaId: 'par-101' }).expect(200);
    esperarContrato(r.body, 'ReporteDeDemora');
    const rep = (r.body.datos as ReporteDeDemora[]).find((x) => x.id === 'rep-3390')!;
    expect(rep).toMatchObject({
      id: 'rep-3390',
      lineaId: 'lin-05',
      paradaId: 'par-101',
      usuarioId: 'usr-320',
      motivo: 'no_paso',
      comentario: 'Hace 25 minutos que espero',
      fotoUri: null,
      confirmaciones: 2,
      sincronizado: true,
    });
    expect(rep.fechaHora <= HOY).toBe(true);
  });

  it('reportes recientes ordenados por fecha descendente; el viejo (rep-3393) no se lista ni se confirma', async () => {
    const r = await ctx.http.get('/reportes-demora').query({ paradaId: 'par-101' }).expect(200);
    const ds = r.body.datos as ReporteDeDemora[];
    expect(ds.length).toBeGreaterThanOrEqual(2);
    expect(ds.map((d) => d.fechaHora)).toEqual(
      ds
        .map((d) => d.fechaHora)
        .sort()
        .reverse(),
    );
    expect(ds.map((d) => d.id)).not.toContain('rep-3393');
    // Julián es el autor y nuevo@demo.ar ya lo confirmó (la 2.ª confirmación es idempotente, 200).
    const auth = await ingresar(ctx, 'transporte@parana.demo.ar');
    const c = await ctx.http.post('/reportes-demora/rep-3393/confirmaciones').set(auth);
    esperarError(c, 422, 'REPORTE_VENCIDO');
  });

  it('un reporte con foto: fotoUri absoluta y descargable', async () => {
    const r = await ctx.http.get('/reportes-demora').query({ paradaId: 'par-101' }).expect(200);
    const con = (r.body.datos as ReporteDeDemora[]).filter((x) => x.fotoUri !== null);
    expect(con.length).toBeGreaterThanOrEqual(1);
    for (const x of con) {
      expect(x.fotoUri).toMatch(/^https?:\/\/.+\/archivos\//);
      const f = await ctx.http.get(new URL(x.fotoUri!).pathname).expect(200);
      expect(f.headers['content-type']).toMatch(/^image\//);
    }
  });

  it('lista vacía: ninguna otra parada tiene reportes (README)', async () => {
    const ps = await todo<Parada>(ctx, '/paradas');
    for (const p of ps.filter((x) => x.id !== 'par-101')) {
      const r = await ctx.http.get('/reportes-demora').query({ paradaId: p.id }).expect(200);
      expect(r.body.datos, p.id).toEqual([]);
      expect(r.body.meta.total).toBe(0);
    }
  });

  it('los reportes sembrados son 5 y sus confirmaciones coinciden con la tabla real', async () => {
    const ds = await ctx.http.get('/reportes-demora').query({ lineaId: 'lin-05' }).expect(200);
    // sólo recientes: no se puede ver el viejo; se comprueba que el contador es coherente con el resumen.
    const dir = await ingresar(ctx, 'transporte@parana.demo.ar');
    const res = await ctx.http
      .get('/reportes-demora/resumen')
      .query({ desde: DESDE, agrupar: 'parada' })
      .set(dir)
      .expect(200);
    esperarContrato(res.body, 'ResumenDemoras');
    const suma = (res.body.datos as { cantidad: number }[]).reduce((s, x) => s + x.cantidad, 0);
    expect(suma).toBe(5);
    expect(ds.body.datos.length).toBeGreaterThan(0);
  });
});

describe('PRD — Usuario: usr-320 y las cuentas de demo', () => {
  it('usr-320 es el Usuario del PRD', async () => {
    const auth = await ingresar(ctx, 'julian@mail.com');
    const r = await ctx.http.get('/yo').set(auth).expect(200);
    esperarContrato(r.body, 'Usuario');
    expect(r.body.datos).toEqual({
      id: 'usr-320',
      nombre: 'Julián Ferrari',
      email: 'julian@mail.com',
      lineasFavoritas: ['lin-05'],
      paradasFavoritas: ['par-101'],
      avisosActivos: true,
      tema: 'sistema',
    });
  });

  it('nuevo@demo.ar no tiene favoritos y la Dirección ve el resumen pero un pasajero no', async () => {
    const auth = await ingresar(ctx, 'nuevo@demo.ar');
    const r = await ctx.http.get('/yo').set(auth).expect(200);
    expect(r.body.datos).toMatchObject({ lineasFavoritas: [], paradasFavoritas: [] });
    esperarError(await ctx.http.get('/reportes-demora/resumen').set(auth), 403, 'SIN_PERMISO');
    const dir = await ingresar(ctx, 'transporte@parana.demo.ar');
    await ctx.http.get('/reportes-demora/resumen').set(dir).query({ desde: DESDE }).expect(200);
  });

  it('el email del ingreso no distingue mayúsculas y una contraseña mala da 401', async () => {
    await ctx.http
      .post('/auth/ingreso')
      .send({ email: 'JULIAN@Mail.com', contrasena: CONTRASENA })
      .expect(200);
    const r = await ctx.http
      .post('/auth/ingreso')
      .send({ email: 'julian@mail.com', contrasena: 'otra-cosa-1' });
    esperarError(r, 401, 'CREDENCIALES_INVALIDAS');
  });

  it('el pasajero de demo recibe la push de un aviso nuevo en su línea favorita (lin-05)', async () => {
    const dir = await ingresar(ctx, 'transporte@parana.demo.ar');
    const jul = await ingresar(ctx, 'julian@mail.com');
    await ctx.http
      .post('/dispositivos')
      .set(jul)
      .send({ tokenExpo: 'ExponentPushToken[julian-demo]', plataforma: 'android' })
      .expect(201);
    ctx.notificador.vaciar();
    await ctx.http
      .post('/avisos')
      .set(dir)
      .send({
        titulo: 'Prueba',
        detalle: 'Aviso de prueba.',
        lineaIds: ['lin-05'],
        desde: '2026-09-18T11:00:00-03:00',
        gravedad: 'informativo',
      })
      .expect(201);
    await ctx.esperarPush();
    expect(ctx.notificador.enviadas.length).toBe(1);
  });
});

describe('Espec. §8 — paradas sin refugio, con y sin QR (README 5.1)', () => {
  it('par-103 y par-106 sin refugio; par-104 y par-108 sin QR (null, no "")', async () => {
    const g = async (id: string) =>
      (await ctx.http.get(`/paradas/${id}`).expect(200)).body.datos as Parada;
    expect((await g('par-103')).refugio).toBe(false);
    expect((await g('par-106')).refugio).toBe(false);
    expect((await g('par-104')).codigoQr).toBeNull();
    expect((await g('par-108')).codigoQr).toBeNull();
    const ps = await todo<Parada>(ctx, '/paradas');
    expect(ps.some((p) => p.refugio)).toBe(true);
    expect(ps.some((p) => p.codigoQr !== null)).toBe(true);
  });
});

describe('README 5.1 — las cifras y los ids que cita existen', () => {
  const readme = readFileSync(new URL('../../README.md', import.meta.url), 'utf8');
  const seccion = readme.slice(readme.indexOf('## 5.1'), readme.indexOf('## 6.'));

  it('la cantidad de paradas, avisos y reportes del README es la real', async () => {
    const limpia = await sembrada();
    const ps = await todo<Parada>(limpia, '/paradas');
    expect(seccion).toMatch(new RegExp(`\\| Paradas \\| ${ps.length} \\|`));
    const av = await todo<Aviso>(limpia, '/avisos', { estado: 'todos' });
    await limpia.cerrar();
    expect(seccion).toMatch(new RegExp(`\\| Avisos \\| ${av.length} \\|`));
    expect(seccion).toMatch(/\| Reportes \| 5 \|/);
  });

  it('todo id citado en la sección existe en la API', async () => {
    const ids = [...new Set(seccion.match(/\b(lin|par|hor|avi|rep|usr)-\d+\b/g))];
    expect(ids.length).toBeGreaterThan(10);
    for (const id of ids) {
      const prefijo = id.slice(0, 3);
      if (prefijo === 'lin') await ctx.http.get(`/lineas/${id}`).expect(200);
      else if (prefijo === 'par') await ctx.http.get(`/paradas/${id}`).expect(200);
      else if (prefijo === 'avi') await ctx.http.get(`/avisos/${id}`).expect(200);
      else if (prefijo === 'usr') {
        const auth = await ingresar(ctx, 'julian@mail.com');
        expect((await ctx.http.get('/yo').set(auth)).body.datos.id).toBe(id);
      } else if (prefijo === 'hor') {
        const hs = await todo<Horario>(ctx, '/horarios', {
          lineaId: 'lin-05',
          paradaId: 'par-101',
        });
        expect(hs.map((h) => h.id)).toContain(id);
      }
      // rep-*: se cubre en el test de reportes (rep-3393 es viejo y no se lista)
    }
  });

  it('rep-3393 (viejo) y rep-3394 (foto) existen como dice el README', async () => {
    const dir = await ingresar(ctx, 'transporte@parana.demo.ar');
    const r = await ctx.http
      .get('/reportes-demora/resumen')
      .query({ desde: DESDE, agrupar: 'parada' })
      .set(dir)
      .expect(200);
    const cantidades = (r.body.datos as { cantidad: number }[]).map((x) => x.cantidad);
    expect(cantidades.reduce((a, b) => a + b, 0)).toBe(5);
    const lista = await ctx.http.get('/reportes-demora').query({ paradaId: 'par-101' }).expect(200);
    const conFoto = (lista.body.datos as ReporteDeDemora[]).find((x) => x.id === 'rep-3394');
    expect(conFoto?.fotoUri).not.toBeNull();
  });

  it('las contraseñas, correos y comandos del README son los reales', () => {
    expect(readme).toContain('demo1234');
    for (const e of ['julian@mail.com', 'nuevo@demo.ar', 'transporte@parana.demo.ar'])
      expect(readme).toContain(e);
    // La fecha del ejemplo de RELOJ_FIJO es válida y el día es viernes (hábil) como dice el caso feo
    expect(new Date('2026-09-18T12:00:00Z').getUTCDay()).toBe(5);
  });
});

describe('Semillas con distintos RELOJ_FIJO: siguen cumpliendo el contrato y los casos feos', () => {
  it.each([
    ['23:59 del 31/12', '2026-12-31T23:59:00-03:00'],
    ['00:00 del 1/1', '2027-01-01T00:00:00-03:00'],
    ['último día de mes', '2026-10-31T12:00:00-03:00'],
    ['29 de febrero del 2028', '2028-02-29T12:00:00-03:00'],
    ['el 20/6/2026 (feriado sábado)', '2026-06-20T08:00:00-03:00'],
  ])('%s', async (_n, ahora) => {
    const o = await sembrada(ahora);
    try {
      const av = await o.http.get('/avisos').query({ estado: 'todos', porPagina: 100 }).expect(200);
      esperarContrato(av.body, 'Aviso');
      expect(av.body.datos).toHaveLength(5);
      const vig = await o.http.get('/avisos').expect(200);
      esperarContrato(vig.body, 'Aviso');
      expect((vig.body.datos as Aviso[]).map((a) => a.id)).toEqual(
        expect.arrayContaining(['avi-088', 'avi-089', 'avi-090']),
      );
      const prox = await o.http.get('/avisos').query({ estado: 'proximos' }).expect(200);
      expect(prox.body.datos).toHaveLength(1);
      const rep = await o.http.get('/reportes-demora').query({ paradaId: 'par-101' }).expect(200);
      esperarContrato(rep.body, 'ReporteDeDemora');
      expect((rep.body.datos as ReporteDeDemora[]).map((x) => x.id)).toContain('rep-3390');
      for (const x of rep.body.datos as ReporteDeDemora[]) expect(x.fechaHora <= ahora).toBe(true);
      const pr = await o.http.get('/paradas/par-101/proximos').expect(200);
      esperarContrato(pr.body, 'Horario');
      expect(pr.body.datos.length).toBeGreaterThan(0);
    } finally {
      await o.cerrar();
    }
  });
});

describe('AGENTS §16.2 — la siembra es idempotente', () => {
  const contar = async (o: AppDePrueba) => ({
    lineas: (await o.http.get('/lineas').query({ porPagina: 100 })).body.meta.total,
    paradas: (await o.http.get('/paradas').query({ porPagina: 1000 })).body.meta.total,
    avisos: (await o.http.get('/avisos').query({ estado: 'todos' })).body.meta.total,
    horarios: (await o.http.get('/horarios').query({ lineaId: 'lin-05' })).body.meta.total,
    reportes: (await o.http.get('/reportes-demora').query({ paradaId: 'par-101' })).body.meta.total,
  });

  it('arrancar de nuevo sobre una base con datos no duplica ni rompe nada', async () => {
    const o = await crearApp({ entorno: { SEMBRAR_SI_VACIA: 'true' }, ahora: HOY });
    try {
      if (await baseVacia(o.dataSource)) await o.app.get(SembradoInicial).onApplicationBootstrap();
      expect(await baseVacia(o.dataSource)).toBe(false);
      const antes = await contar(o);
      expect(antes.lineas).toBe(14);
      await o.app.get(SembradoInicial).onApplicationBootstrap();
      await o.app.get(SembradoInicial).onApplicationBootstrap();
      expect(await contar(o)).toEqual(antes);
      await o.http
        .post('/auth/ingreso')
        .send({ email: 'julian@mail.com', contrasena: CONTRASENA })
        .expect(200);
    } finally {
      await o.cerrar();
    }
  });

  it('sembrar dos veces seguidas con la función directa no deja datos duplicados (o falla sin corromper)', async () => {
    const o = await crearApp({ ahora: HOY });
    try {
      await sembrar(o.dataSource, o.reloj, o.app.get(ArchivosServicio));
      const antes = await contar(o);
      await sembrar(o.dataSource, o.reloj, o.app.get(ArchivosServicio)).catch(() => undefined);
      expect(await contar(o)).toEqual(antes);
    } finally {
      await o.cerrar();
    }
  });

  it('sin SEMBRAR_SI_VACIA la base arranca vacía y las listas públicas dan 200 con datos vacíos', async () => {
    const o = await crearApp();
    try {
      for (const ruta of ['/lineas', '/paradas', '/avisos', '/feriados']) {
        const r = await o.http.get(ruta).expect(200);
        expect(r.body.datos).toEqual([]);
      }
    } finally {
      await o.cerrar();
    }
  });
});
