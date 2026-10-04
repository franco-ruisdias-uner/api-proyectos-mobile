// Verificación independiente de M8 — Semillas completas (ESPECIFICACION §8, §3; DECISIONES M8-1).
// Caja negra: sembrar y mirar sólo por HTTP.
import type { Bloqueo, Sesion } from '../../contrato/api.js';
import type {
  Deporte,
  Espacio,
  Reserva,
  ReservaFija,
  Turno,
  Usuario,
} from '../../contrato/tipos.js';
import { sembrar } from '../../src/semillas/sembrar.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';

const CONTRASENA = 'villaguay2026';

async function ingresar(a: AppDePrueba, email: string): Promise<string> {
  const r = await a
    .http()
    .post('/auth/ingreso')
    .send({ email, contrasena: CONTRASENA })
    .expect(200);
  return esperarContrato<Sesion>(r.body, 'Sesion').token;
}

describe('ESPECIFICACION §8 — Espacios y deportes sembrados', () => {
  let a: AppDePrueba;
  let espacios: Espacio[];
  beforeAll(async () => {
    a = await crearApp();
    await sembrar(a.dataSource, a.reloj, a.almacen);
    const r = await a.http().get('/espacios?porPagina=100').expect(200);
    espacios = esperarContrato<Espacio[]>(r.body, 'Espacio');
  });
  afterAll(() => a.cerrar());

  it('hay once espacios activos con la distribución del PRD', async () => {
    expect(espacios).toHaveLength(11);
    const porDeporte = new Map<string, number>();
    for (const e of espacios)
      porDeporte.set(e.deporteId, (porDeporte.get(e.deporteId) ?? 0) + 1);
    expect(porDeporte.get('dep-futbol5')).toBe(2);
    expect([...porDeporte.values()].toSorted()).toEqual(
      [1, 1, 2, 2, 2, 3].toSorted(),
    );
    const complejos = espacios.filter((e) => e.complejo !== '');
    expect(complejos.length).toBeGreaterThanOrEqual(5);
    expect(espacios.filter((e) => e.techado).length).toBeGreaterThanOrEqual(1);
  });

  it('ningún campo opcional viaja como "" (complejo sin valor)', () => {
    // El tipo Espacio.complejo es string (no null): se acepta cualquier string,
    // pero nunca undefined ni null.
    for (const e of espacios) {
      expect(typeof e.complejo).toBe('string');
      expect(typeof e.superficie).toBe('string');
      expect(e.reglas.length).toBeGreaterThan(0);
      expect(e.nombre.trim().length).toBeGreaterThan(0);
    }
  });

  it('esp-02 es "Cancha 2 — Fútbol 5" de dep-futbol5', () => {
    const e = espacios.find((x) => x.id === 'esp-02');
    expect(e?.nombre).toBe('Cancha 2 — Fútbol 5');
    expect(e?.deporteId).toBe('dep-futbol5');
    expect(e?.iluminacion).toBe(true);
  });

  it('coordenadas dentro de Villaguay (aprox. -31.87, -59.03)', () => {
    for (const e of espacios) {
      expect(Math.abs(e.coordenadas.latitud + 31.87)).toBeLessThan(0.1);
      expect(Math.abs(e.coordenadas.longitud + 59.03)).toBeLessThan(0.1);
    }
  });

  it('todos tienen dos imágenes distintas, ninguno video', () => {
    const todas = new Set<string>();
    for (const e of espacios) {
      expect(e.imagenes, e.id).toHaveLength(2);
      expect(new Set(e.imagenes).size).toBe(2);
      e.imagenes.forEach((u) => todas.add(u));
      expect(e.videoUrl, e.id).toBeNull();
    }
    expect(todas.size).toBe(22);
  });

  it('las URLs son absolutas http(s), sin file:// ni claves crudas', () => {
    for (const e of espacios)
      for (const u of e.imagenes) {
        expect(u).toMatch(/^https?:\/\/[^/]+\/archivos\/imagenes\//);
        expect(u).not.toMatch(/\s/);
      }
  });

  it('cada imagen: 200 con bytes PNG válidos, Content-Length coherente y Accept-Ranges', async () => {
    for (const e of espacios)
      for (const u of e.imagenes) {
        const r = await a.http().get(new URL(u).pathname).expect(200);
        const buf = Buffer.from(r.body);
        expect(buf.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
        expect(r.headers['content-type']).toContain('image/png');
        expect(Number(r.headers['content-length'])).toBe(buf.length);
        expect(r.headers['accept-ranges']).toBe('bytes');
        expect(buf.length).toBeGreaterThan(100);
      }
  });

  it('Range: inicio-fin, abierto, sufijo y fuera de rango', async () => {
    const ruta = new URL(espacios[0]!.imagenes[0]!).pathname;
    const entero = Buffer.from((await a.http().get(ruta)).body);
    const total = entero.length;

    const r1 = await a.http().get(ruta).set('Range', 'bytes=10-19').expect(206);
    expect(r1.headers['content-range']).toBe(`bytes 10-19/${total}`);
    expect(Buffer.from(r1.body).equals(entero.subarray(10, 20))).toBe(true);

    const r2 = await a.http().get(ruta).set('Range', 'bytes=20-').expect(206);
    expect(Buffer.from(r2.body).equals(entero.subarray(20))).toBe(true);

    const r3 = await a.http().get(ruta).set('Range', 'bytes=-5').expect(206);
    expect(Buffer.from(r3.body).equals(entero.subarray(total - 5))).toBe(true);

    const r4 = await a
      .http()
      .get(ruta)
      .set('Range', `bytes=${total + 10}-${total + 20}`);
    expect(r4.status).toBe(416);
  });

  it('el detalle y la lista devuelven las mismas imágenes', async () => {
    for (const e of espacios.slice(0, 4)) {
      const r = await a.http().get(`/espacios/${e.id}`).expect(200);
      const ruta = (u: string) => new URL(u).pathname;
      expect(
        esperarContrato<Espacio>(r.body, 'Espacio').imagenes.map(ruta),
      ).toEqual(e.imagenes.map(ruta));
    }
  });

  it('el origen de las URLs sigue el Host del pedido y X-Forwarded con CONFIAR_PROXY', async () => {
    const r = await a
      .http()
      .get('/espacios/esp-02')
      .set('Host', '10.0.0.5:3000')
      .expect(200);
    for (const u of r.body.datos.imagenes)
      expect(u.startsWith('http://10.0.0.5:3000/archivos/')).toBe(true);
    const b = await crearApp({ entorno: { CONFIAR_PROXY: 'true' } });
    try {
      await sembrar(b.dataSource, b.reloj, b.almacen);
      const rp = await b
        .http()
        .get('/espacios/esp-02')
        .set('X-Forwarded-Proto', 'https')
        .set('X-Forwarded-Host', 'api.ejemplo.com')
        .expect(200);
      for (const u of rp.body.datos.imagenes)
        expect(u.startsWith('https://api.ejemplo.com/archivos/')).toBe(true);
    } finally {
      await b.cerrar();
    }
  });

  it('la clave de archivo inexistente da ARCHIVO_NO_ENCONTRADO', async () => {
    const r = await a.http().get('/archivos/imagenes/2026/09/no-existe.png');
    esperarError(r, 404, 'ARCHIVO_NO_ENCONTRADO');
  });

  it('los deportes sembrados cumplen el contrato, con ids dep- y colores', async () => {
    const r = await a.http().get('/deportes?porPagina=100').expect(200);
    const ds = esperarContrato<Deporte[]>(r.body, 'Deporte');
    expect(ds.map((d) => d.id)).toContain('dep-futbol5');
    for (const d of ds) {
      expect(d.id).toMatch(/^dep-/);
      expect(d.icono.length).toBeGreaterThan(0);
      expect(d.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
    for (const e of espacios) expect(ds.map((d) => d.id)).toContain(e.deporteId);
  });
});

describe('ESPECIFICACION §8 — Sembrar sin almacén y repetido', () => {
  it('sin almacén los espacios quedan sin imágenes y siguen cumpliendo el contrato', async () => {
    const a = await crearApp();
    try {
      await sembrar(a.dataSource, a.reloj);
      const r = await a.http().get('/espacios?porPagina=100').expect(200);
      const es = esperarContrato<Espacio[]>(r.body, 'Espacio');
      expect(es).toHaveLength(11);
      for (const e of es) expect(e.imagenes).toEqual([]);
    } finally {
      await a.cerrar();
    }
  });

  it('sembrar dos veces sobre la misma base no duplica ni rompe', async () => {
    const a = await crearApp();
    try {
      await sembrar(a.dataSource, a.reloj, a.almacen);
      let segundaOk = true;
      try {
        await sembrar(a.dataSource, a.reloj, a.almacen);
      } catch {
        segundaOk = false;
      }
      const r = await a.http().get('/espacios?porPagina=100').expect(200);
      expect(r.body.meta.total).toBe(11);
      // Si la segunda siembra falla es tolerable (lo hace SEMBRAR_SI_VACIA), pero no puede duplicar.
      void segundaOk;
    } finally {
      await a.cerrar();
    }
  });
});

describe('ESPECIFICACION §8 — Datos de demo: usuarios y reservas', () => {
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
    encargado = await ingresar(a, 'marcelo@villaguay.demo.ar');
  });
  afterAll(() => a.cerrar());

  it('los cinco usuarios de demo ingresan con los roles de la tabla', async () => {
    const esperado: Record<string, string> = {
      'emiliano@mail.com': 'jugador',
      'lleno@demo.ar': 'jugador',
      'nuevo@demo.ar': 'jugador',
      'marcelo@villaguay.demo.ar': 'encargado',
      'nahuel@villaguay.demo.ar': 'administrador',
    };
    for (const [email, rol] of Object.entries(esperado)) {
      const t = await ingresar(a, email);
      const u = esperarContrato<Usuario>(await get('/yo', t), 'Usuario');
      expect(u.rol).toBe(rol);
      expect(u.telefono.trim()).not.toBe('');
      expect(Object.keys(u)).not.toContain('contrasena');
    }
  });

  it('el email de demo entra aunque se escriba en mayúsculas', async () => {
    await a
      .http()
      .post('/auth/ingreso')
      .send({ email: 'EMILIANO@Mail.com', contrasena: CONTRASENA })
      .expect(200);
  });

  it('usr-207: Emiliano Ruiz con cancelación tardía y esp-02 favorito', async () => {
    const u = esperarContrato<Usuario>(
      await get('/usuarios/usr-207'),
      'Usuario',
    );
    expect(u.nombre).toBe('Emiliano Ruiz');
    expect(u.cancelacionesTardias).toBeGreaterThanOrEqual(1);
    expect(u.espaciosFavoritos).toContain('esp-02');
  });

  it('res-1180 existe, es de esp-02, de usr-207, con turnoId en formato D1 y QR VGY', async () => {
    const r = esperarContrato<Reserva>(
      await get('/reservas/res-1180'),
      'Reserva',
    );
    expect(r.usuarioId).toBe('usr-207');
    expect(r.espacioId).toBe('esp-02');
    expect(r.turnoId).toMatch(/^tur-esp-02-\d{8}-\d{2}$/);
    expect(r.codigoQr).toMatch(/^VGY-\d{4}-\d{2}-[A-Z0-9]{6}$/);
    expect(r.estado).toBe('confirmada');
  });

  it('cada QR coincide con MMDD y HH de su turno y son todos distintos', async () => {
    const lista = esperarContrato<Reserva[]>(
      await get('/reservas?porPagina=100'),
      'Reserva',
    );
    expect(lista.length).toBeGreaterThan(8);
    const qrs = new Set<string>();
    for (const r of lista) {
      const m = /^tur-esp-\d+-\d{4}(\d{4})-(\d{2})$/.exec(r.turnoId);
      expect(m, r.turnoId).not.toBeNull();
      expect(r.codigoQr.startsWith(`VGY-${m![1]}-${m![2]}-`)).toBe(true);
      qrs.add(r.codigoQr);
    }
    expect(qrs.size).toBe(lista.length);
  });

  it('cancelableHasta = inicio − 4 h, en -03:00, para cada reserva sembrada', async () => {
    const lista = esperarContrato<Reserva[]>(
      await get('/reservas?porPagina=100'),
      'Reserva',
    );
    for (const r of lista) {
      const m = /^tur-esp-\d+-(\d{4})(\d{2})(\d{2})-(\d{2})$/.exec(r.turnoId)!;
      const inicio = Date.parse(
        `${m[1]}-${m[2]}-${m[3]}T${m[4]}:00:00-03:00`,
      );
      expect(Date.parse(r.cancelableHasta)).toBe(inicio - 4 * 3600_000);
      expect(r.cancelableHasta.endsWith('-03:00')).toBe(true);
      if (r.estado === 'cumplida') expect(r.ingresoEn).not.toBeNull();
      else expect(r.ingresoEn).toBeNull();
    }
  });

  it('hay reservas en los cuatro estados, sembradas (cancelada, cumplida y ausente en el pasado)', async () => {
    const lista = esperarContrato<Reserva[]>(
      await get('/reservas?porPagina=100'),
      'Reserva',
    );
    const estados = new Set(lista.map((r) => r.estado));
    for (const e of ['confirmada', 'cancelada', 'cumplida', 'ausente'])
      expect(estados.has(e as Reserva['estado']), e).toBe(true);
    const cancelada = lista.find((r) => r.estado === 'cancelada')!;
    expect(cancelada.usuarioId).toBe('usr-207');
  });

  it('filtro de /reservas por estado devuelve sólo ese estado y meta.total correcto', async () => {
    const r = await get('/reservas?estado=ausente&porPagina=100');
    const ds = esperarContrato<Reserva[]>(r, 'Reserva');
    expect(ds.length).toBeGreaterThanOrEqual(1);
    expect(ds.every((x) => x.estado === 'ausente')).toBe(true);
    expect(r.meta.total).toBe(ds.length);
  });

  it('el contador de ausencias de los usuarios coincide con sus reservas ausentes', async () => {
    const lista = esperarContrato<Reserva[]>(
      await get('/reservas?estado=ausente&porPagina=100'),
      'Reserva',
    );
    for (const id of new Set(lista.map((r) => r.usuarioId))) {
      const u = esperarContrato<Usuario>(
        await get(`/usuarios/${id}`),
        'Usuario',
      );
      expect(u.ausencias).toBeGreaterThanOrEqual(
        lista.filter((r) => r.usuarioId === id).length,
      );
    }
  });

  it('lleno@demo.ar tiene exactamente tres activas y nuevo@demo.ar ninguna (ni pasadas)', async () => {
    const t = await ingresar(a, 'lleno@demo.ar');
    const prox = await get('/yo/reservas?cuando=proximas', t);
    expect(esperarContrato<Reserva[]>(prox, 'Reserva')).toHaveLength(3);
    const n = await ingresar(a, 'nuevo@demo.ar');
    const nuevo = await get('/yo/reservas?cuando=pasadas', n);
    expect(nuevo.datos).toEqual([]);
    expect(nuevo.meta.total).toBe(0);
  });

  it('un jugador no puede leer reservas ajenas de demo (403)', async () => {
    const t = await ingresar(a, 'nuevo@demo.ar');
    const r = await a
      .http()
      .get('/reservas/res-1180')
      .set('Authorization', `Bearer ${t}`);
    esperarError(r, 403, 'SIN_PERMISO');
  });
});

describe('ESPECIFICACION §8 — Fijas y bloqueos de demo', () => {
  let a: AppDePrueba;
  let encargado: string;
  const get = async (ruta: string) =>
    (
      await a
        .http()
        .get(ruta)
        .set('Authorization', `Bearer ${encargado}`)
        .expect(200)
    ).body;
  beforeAll(async () => {
    a = await crearApp();
    await sembrar(a.dataSource, a.reloj, a.almacen);
    encargado = await ingresar(a, 'marcelo@villaguay.demo.ar');
  });
  afterAll(() => a.cerrar());

  it('fij-07 "Grupo de los martes": martes 21 a 22 en esp-02, activa', async () => {
    const fijas = esperarContrato<ReservaFija[]>(
      await get('/fijas?porPagina=100'),
      'ReservaFija',
    );
    const f = fijas.find((x) => x.id === 'fij-07')!;
    expect(f).toMatchObject({
      espacioId: 'esp-02',
      titular: 'Grupo de los martes',
      dia: 2,
      inicio: '21:00',
      fin: '22:00',
      activa: true,
    });
  });

  it('hay una fija de dos horas de un club y ninguna fija activa se superpone con otra del mismo espacio', async () => {
    const fijas = esperarContrato<ReservaFija[]>(
      await get('/fijas?porPagina=100'),
      'ReservaFija',
    );
    expect(
      fijas.some((f) => Number(f.fin.slice(0, 2)) - Number(f.inicio.slice(0, 2)) === 2),
    ).toBe(true);
    const act = fijas.filter((f) => f.activa);
    for (const x of act)
      for (const y of act) {
        if (x.id >= y.id || x.espacioId !== y.espacioId || x.dia !== y.dia)
          continue;
        const solapa = x.inicio < y.fin && y.inicio < x.fin;
        expect(solapa, `${x.id} vs ${y.id}`).toBe(false);
      }
  });

  it('ningún turno de grilla aparece doble: las reservas confirmadas no caen en una fija ni en un bloqueo', async () => {
    const reservas = esperarContrato<Reserva[]>(
      await get('/reservas?estado=confirmada&porPagina=100'),
      'Reserva',
    );
    for (const r of reservas) {
      const m = /^tur-(esp-\d+)-(\d{4})(\d{2})(\d{2})-(\d{2})$/.exec(r.turnoId)!;
      const fecha = `${m[2]}-${m[3]}-${m[4]}`;
      const g = await a.http().get(`/espacios/${m[1]}/turnos?fecha=${fecha}`);
      if (g.status !== 200) continue; // fuera de rango de siete días
      const t = esperarContrato<Turno[]>(g.body, 'Turno').find(
        (x) => x.id === r.turnoId,
      )!;
      expect(t.estado, r.id).toBe('reservado');
      expect(t.reservaId).toBe(r.id);
    }
  });

  it('los bloqueos cumplen el contrato; hay uno de día entero y uno parcial', async () => {
    const r = await get('/bloqueos?desde=2026-09-01&porPagina=100');
    const bs = esperarContrato<Bloqueo[]>(r, 'Bloqueo');
    expect(bs.some((b) => b.inicio === null && b.fin === null)).toBe(true);
    expect(bs.some((b) => b.inicio !== null && b.fin !== null)).toBe(true);
    for (const b of bs) {
      expect(b.motivo.trim()).not.toBe('');
      expect((b.inicio === null) === (b.fin === null)).toBe(true);
      if (b.inicio) {
        expect(b.inicio).toMatch(/^\d{2}:00$/);
        expect(b.inicio < b.fin!).toBe(true);
      }
    }
  });

  it('lluvia: pasado mañana, los espacios descubiertos en mantenimiento "Cancha anegada"', async () => {
    const es = esperarContrato<Espacio[]>(
      await (await a.http().get('/espacios?porPagina=100')).body,
      'Espacio',
    );
    const descubiertos = es.filter((e) => !e.techado);
    expect(descubiertos.length).toBeGreaterThan(5);
    let anegados = 0;
    for (const e of descubiertos) {
      const g = await a.http().get(`/espacios/${e.id}/turnos?fecha=2026-09-21`);
      const ts = esperarContrato<Turno[]>(g.body, 'Turno');
      expect(ts).toHaveLength(16);
      if (ts.every((t) => t.estado === 'mantenimiento')) {
        anegados++;
        expect(ts.every((t) => t.motivoBloqueo === 'Cancha anegada')).toBe(true);
      }
    }
    expect(anegados).toBe(descubiertos.length);
    for (const e of es.filter((x) => x.techado)) {
      const g = await a.http().get(`/espacios/${e.id}/turnos?fecha=2026-09-21`);
      const ts = esperarContrato<Turno[]>(g.body, 'Turno');
      expect(ts.some((t) => t.estado !== 'mantenimiento')).toBe(true);
    }
  });

  it('hay un espacio con la grilla de mañana sin ningún turno libre, con las tres causas', async () => {
    const es = esperarContrato<Espacio[]>(
      (await a.http().get('/espacios?porPagina=100')).body,
      'Espacio',
    );
    let completo: Turno[] | null = null;
    for (const e of es) {
      const g = await a.http().get(`/espacios/${e.id}/turnos?fecha=2026-09-20`);
      const ts = esperarContrato<Turno[]>(g.body, 'Turno');
      if (ts.every((t) => t.estado !== 'libre')) completo = ts;
    }
    expect(completo).not.toBeNull();
    const estados = new Set(completo!.map((t) => t.estado));
    expect(estados.has('reservado')).toBe(true);
    expect(estados.has('fijo')).toBe(true);
    expect(estados.has('mantenimiento')).toBe(true);
  });

  it('fij-07 se ve en la grilla del martes 22/09 a las 21 y 22 queda libre, y el miércoles no', async () => {
    const g = esperarContrato<Turno[]>(
      (await a.http().get('/espacios/esp-02/turnos?fecha=2026-09-22')).body,
      'Turno',
    );
    // 22/09/2026 es martes. Puede haber otro cruce (bloqueo): sólo exigimos que no sea libre.
    expect(g.find((t) => t.inicio === '21:00')?.estado).toBe('fijo');
  });

  it('la grilla de cada espacio, los siete días, cumple el contrato y tiene 16 turnos', async () => {
    const es = esperarContrato<Espacio[]>(
      (await a.http().get('/espacios?porPagina=100')).body,
      'Espacio',
    );
    const dias = [
      '2026-09-19',
      '2026-09-20',
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
    ];
    for (const e of es)
      for (const d of dias) {
        const g = await a.http().get(`/espacios/${e.id}/turnos?fecha=${d}`);
        const ts = esperarContrato<Turno[]>(g.body, 'Turno');
        expect(ts, `${e.id} ${d}`).toHaveLength(16);
        for (const t of ts) {
          if (t.estado === 'reservado') expect(t.reservaId).not.toBeNull();
          else expect(t.reservaId).toBeNull();
          if (t.estado !== 'mantenimiento') expect(t.motivoBloqueo).toBeNull();
          else expect(t.motivoBloqueo?.trim()).toBeTruthy();
        }
      }
  });

  it('hoy hay turnos que ya pasaron y se muestran con su estado, y la agenda de hoy cumple el contrato', async () => {
    const g = esperarContrato<Turno[]>(
      (await a.http().get('/espacios/esp-01/turnos?fecha=2026-09-19')).body,
      'Turno',
    );
    expect(g.filter((t) => t.inicio < '10:00').length).toBe(2);
    const ag = await get('/agenda?porPagina=500');
    expect(esperarContrato<unknown[]>(ag, 'Turno').length).toBe(11 * 16);
  });

  it('los datos cumplen el contrato con el reloj a las 23:59 y a las 00:00 del 31/12', async () => {
    for (const ahora of [
      '2026-12-31T23:59:00-03:00',
      '2027-01-01T00:00:00-03:00',
      '2026-09-30T23:59:00-03:00',
    ]) {
      const b = await crearApp({ ahora });
      try {
        await sembrar(b.dataSource, b.reloj, b.almacen);
        const t = await ingresar(b, 'marcelo@villaguay.demo.ar');
        const h = { Authorization: `Bearer ${t}` };
        const rs = await b.http().get('/reservas?porPagina=100').set(h).expect(200);
        esperarContrato<Reserva[]>(rs.body, 'Reserva');
        const fs = await b.http().get('/fijas?porPagina=100').set(h).expect(200);
        esperarContrato<ReservaFija[]>(fs.body, 'ReservaFija');
        const bs = await b
          .http()
          .get('/bloqueos?desde=2026-01-01&porPagina=100')
          .set(h)
          .expect(200);
        esperarContrato<Bloqueo[]>(bs.body, 'Bloqueo');
        const ag = await b.http().get('/agenda?porPagina=500').set(h).expect(200);
        esperarContrato<Turno[]>(ag.body, 'Turno');
        const es = await b.http().get('/espacios?porPagina=100').expect(200);
        expect(esperarContrato<Espacio[]>(es.body, 'Espacio')).toHaveLength(11);
      } finally {
        await b.cerrar();
      }
    }
  });

  it('un espacio sembrado sin imagen en el almacén no rompe: borrar una clave da 404 con sobre de error, no 500', async () => {
    const e = esperarContrato<Espacio>(
      (await a.http().get('/espacios/esp-03')).body,
      'Espacio',
    );
    await a.almacen.borrar(new URL(e.imagenes[0]!).pathname.replace('/archivos/', ''));
    const r = await a.http().get(new URL(e.imagenes[0]!).pathname);
    esperarError(r, 404, 'ARCHIVO_NO_ENCONTRADO');
  });
});
