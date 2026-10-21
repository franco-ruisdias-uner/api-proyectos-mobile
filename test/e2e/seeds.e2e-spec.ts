import type {
  Lectura,
  Novedad,
  Ruta,
  Suministro,
} from '../../contract/types.js';
import { ArchivosServicio } from '../../src/common/files/files.service.js';
import { MedidorEntidad } from '../../src/modules/supplies/meter.entity.js';
import { medidorAContrato } from '../../src/modules/supplies/supplies.mapper.js';
import { Sembrador } from '../../src/seeds/seed.js';
import { USUARIOS } from '../../src/seeds/data/users.js';
import { type AppDePrueba, crearApp } from '../utilities/create-app.js';
import { esperarContrato } from '../utilities/contract.js';
import { bearer, ingresar } from '../utilities/users.js';

/** Las `asignada` o `en_curso` de cada lector, por número (ESPECIFICACION §1). Las cerradas no cuentan. */
const RUTAS_ABIERTAS_POR_LECTOR: Record<string, string[]> = {
  'usr-011': ['rut-07-2026-05'],
  'usr-012': ['rut-01-2026-05'],
  'usr-013': ['rut-02-2026-05'],
  'usr-015': ['rut-04-2026-05'],
  'usr-016': ['rut-05-2026-05'],
  'usr-018': ['rut-08-2026-05'],
  'usr-019': ['rut-09-2026-05'],
  'usr-021': ['rut-11-2026-05'],
  'usr-022': ['rut-13-2026-05'],
  'usr-024': ['rut-15-2026-05'],
  'usr-025': ['rut-16-2026-05'],
  'usr-027': ['rut-18-2026-05'],
  'usr-028': ['rut-19-2026-05'],
};

describe('ESPECIFICACION §8 — Semillas: los usuarios de la app de clase', () => {
  let c: AppDePrueba;
  let token: string;
  beforeAll(async () => {
    c = await crearApp();
    const sembrador = c.app.get(Sembrador);
    expect(await sembrador.estaVacia()).toBe(true);
    await sembrador.sembrar();
    expect(await sembrador.estaVacia()).toBe(false);
    token = await ingresar(c, { legajo: 'L-030', contrasena: 'lectura' });
  });
  afterAll(() => c.cerrar());

  it('cada usuario sembrado cumple el contrato y tiene los datos del mock', async () => {
    const r = await c
      .http()
      .get('/usuarios?porPagina=100')
      .set(bearer(token))
      .expect(200);
    esperarContrato(r.body, 'Usuario');
    expect(r.body.meta.total).toBe(20);
    expect(r.body.datos).toEqual(
      USUARIOS.map((u) => ({
        id: u.id,
        legajo: u.legajo,
        nombre: u.nombre,
        rol: u.rol,
        biometriaActiva: u.biometriaActiva,
        rutasAsignadas: RUTAS_ABIERTAS_POR_LECTOR[u.id] ?? [],
      })),
    );
  });

  it('usr-011 Ramón Duarte (L-011) es lector y usr-030 Laura Vidal (L-030) es administración', async () => {
    const ramon = await c
      .http()
      .post('/auth/ingreso')
      .send({ legajo: 'L-011', contrasena: 'lectura' })
      .expect(200);
    expect(ramon.body.datos.usuario).toMatchObject({
      id: 'usr-011',
      nombre: 'Ramón Duarte',
      rol: 'lector',
      biometriaActiva: true,
    });
    const laura = await c.http().get('/yo').set(bearer(token)).expect(200);
    expect(laura.body.datos).toMatchObject({
      id: 'usr-030',
      nombre: 'Laura Vidal',
      rol: 'administracion',
    });
  });

  it('todos ingresan con la contraseña de demo "lectura"', async () => {
    for (const u of USUARIOS)
      await ingresar(c, { legajo: u.legajo, contrasena: 'lectura' });
  });
});

describe('ESPECIFICACION §8 — Semillas: suministros y medidores de la app de clase', () => {
  let c: AppDePrueba;
  let token: string;
  beforeAll(async () => {
    c = await crearApp();
    await c.app.get(Sembrador).sembrar();
    token = await ingresar(c, { legajo: 'L-030', contrasena: 'lectura' });
  });
  afterAll(() => c.cerrar());

  async function todos(): Promise<Suministro[]> {
    const lista: Suministro[] = [];
    for (let pagina = 1; ; pagina++) {
      const r = await c
        .http()
        .get(`/suministros?pagina=${pagina}&porPagina=100`)
        .set(bearer(token))
        .expect(200);
      esperarContrato(r.body, 'Suministro');
      lista.push(...r.body.datos);
      if (lista.length >= r.body.meta.total) return lista;
    }
  }

  it('los 580 suministros cumplen el contrato', async () => {
    const lista = await todos();
    expect(lista).toHaveLength(580);
  });

  it('cada medidor sembrado cumple el contrato y su video se baja con Range', async () => {
    const medidores = await c.dataSource
      .getRepository(MedidorEntidad)
      .find({ order: { id: 'ASC' } });
    expect(medidores).toHaveLength(580);
    const mapeados = medidores.map((m) =>
      medidorAContrato(m, (clave) => c.app.get(ArchivosServicio).url(clave)),
    );
    esperarContrato(
      {
        datos: mapeados,
        meta: { total: mapeados.length, pagina: 1, porPagina: mapeados.length },
      },
      'Medidor',
    );
    const conVideo = mapeados.filter((m) => m.videoInstructivoUrl !== null);
    expect(conVideo).toHaveLength(579);
    expect(new Set(conVideo.map((m) => m.videoInstructivoUrl)).size).toBe(3);
    const ruta = new URL(conVideo[0].videoInstructivoUrl!).pathname;
    const r = await c.http().get(ruta).set('Range', 'bytes=0-99').expect(206);
    expect(r.headers['content-type']).toBe('video/mp4');
    expect(r.headers['content-range']).toMatch(/^bytes 0-99\/\d+$/);
  });

  it('el medidor ×10 no tiene video; el del PRD, sí', async () => {
    const lista = await todos();
    const x10 = await c
      .http()
      .get(`/medidores/${lista[25].medidorId}`)
      .set(bearer(token))
      .expect(200);
    expect(x10.body.datos).toMatchObject({
      multiplicador: 10,
      videoInstructivoUrl: null,
    });
    const prd = await c
      .http()
      .get('/medidores/med-A88413')
      .set(bearer(token))
      .expect(200);
    expect(prd.body.datos.videoInstructivoUrl).toMatch(
      /\/archivos\/videos\/.+\.mp4$/,
    );
  });

  it('el suministro del PRD y el QR de su medidor', async () => {
    const s = await c
      .http()
      .get('/suministros/sum-004120')
      .set(bearer(token))
      .expect(200);
    expect(s.body.datos).toMatchObject({
      numero: '004120',
      titular: 'Coronel, Ramona',
      fechaLecturaAnterior: '2026-07-14T09:30:00-03:00',
      lecturaAnterior: 1284,
    });
    const m = await c
      .http()
      .get('/medidores/qr/COOP-CHJ:med-A88413')
      .set(bearer(token))
      .expect(200);
    expect(m.body.datos).toMatchObject({
      id: 'med-A88413',
      serie: 'A-88413',
      instaladoEn: '2019-03-11T00:00:00-03:00',
    });
  });

  it('los casos feos: conexión nueva y un suministro inactivo', async () => {
    const lista = await todos();
    expect(lista.filter((s) => s.lecturaAnterior === null)).toHaveLength(1);
    expect(lista.filter((s) => !s.activo).map((s) => s.numero)).toEqual([
      '020006',
    ]);
  });
});

describe('ESPECIFICACION §8 — Semillas: las rutas de la app de clase', () => {
  let c: AppDePrueba;
  let token: string;
  beforeAll(async () => {
    c = await crearApp();
    await c.app.get(Sembrador).sembrar();
    token = await ingresar(c, { legajo: 'L-030', contrasena: 'lectura' });
  });
  afterAll(() => c.cerrar());

  it('las 20 rutas cumplen el contrato, y la 07 y la 12 son las del lector usr-011', async () => {
    const r = await c
      .http()
      .get('/rutas?porPagina=100')
      .set(bearer(token))
      .expect(200);
    esperarContrato(r.body, 'Ruta');
    expect(r.body.meta.total).toBe(20);
    const rutas = r.body.datos as Ruta[];
    expect(rutas.find((x) => x.id === 'rut-07-2026-05')).toMatchObject({
      nombre: 'Barrio Brasil',
      lectorId: 'usr-011',
      estado: 'en_curso',
      descargadaEn: '2026-09-15T07:40:00-03:00',
      cerradaEn: null,
    });
    expect(rutas.find((x) => x.id === 'rut-12-2026-05')).toMatchObject({
      nombre: 'Quintas Norte',
      lectorId: 'usr-011',
      estado: 'cerrada',
      descargadaEn: '2026-09-14T07:10:00-03:00',
      cerradaEn: '2026-09-14T17:02:00-03:00',
    });
    expect(rutas.filter((x) => x.estado === 'cerrada')).toHaveLength(7);
  });

  it('Ramón Duarte baja la ruta 07 completa: 200 suministros en orden, con sus 200 medidores', async () => {
    const ramon = await ingresar(c, { legajo: 'L-011', contrasena: 'lectura' });
    const r = await c
      .http()
      .post('/rutas/rut-07-2026-05/descarga')
      .set(bearer(ramon))
      .expect(200);
    esperarContrato(r.body, 'PaqueteRuta');
    const p = r.body.datos;
    expect(p.ruta.suministroIds).toHaveLength(200);
    expect(p.ruta.suministroIds.slice(0, 4)).toEqual([
      'sum-004120',
      'sum-004136',
      'sum-004150',
      'sum-004162',
    ]);
    expect(p.suministros).toHaveLength(200);
    expect(p.medidores).toHaveLength(200);
    // Ya estaba en curso y descargada: la descarga no pisa descargadaEn.
    expect(p.ruta.descargadaEn).toBe('2026-09-15T07:40:00-03:00');
  });

  it('la ruta cerrada de Ramón no se descarga: "Esa ruta fue cerrada el 14/09."', async () => {
    const ramon = await ingresar(c, { legajo: 'L-011', contrasena: 'lectura' });
    const r = await c
      .http()
      .post('/rutas/rut-12-2026-05/descarga')
      .set(bearer(ramon))
      .expect(409);
    expect(r.body.error.mensaje).toBe('Esa ruta fue cerrada el 14/09.');
  });

  it('el suministro inactivo sigue en el recorrido de su ruta (R8)', async () => {
    const r = await c
      .http()
      .get('/rutas/rut-02-2026-05/suministros')
      .set(bearer(token))
      .expect(200);
    const inactivos = (r.body.datos as Suministro[]).filter((s) => !s.activo);
    expect(inactivos.map((s) => s.numero)).toEqual(['020006']);
  });

  it('las 20 lecturas de Brasil cumplen el contrato y la foto se baja', async () => {
    const ramon = await ingresar(c, { legajo: 'L-011', contrasena: 'lectura' });
    const r = await c
      .http()
      .get('/rutas/rut-07-2026-05/lecturas?porPagina=200')
      .set(bearer(ramon))
      .expect(200);
    esperarContrato(r.body, 'Lectura');
    const lista = r.body.datos as Lectura[];
    expect(lista).toHaveLength(20);
    // D19: lec-88201 es de sum-004120, la primera de la ruta.
    expect(lista[0]).toMatchObject({
      id: 'lec-88201',
      suministroId: 'sum-004120',
      consumo: 18,
    });
    expect(lista.find((l) => l.id === 'lec-88240')).toMatchObject({
      consumo: -4014,
      fueraDeRango: true,
      confirmadaPorLector: true,
    });
    const foto = new URL(lista[0].fotoUri);
    const bajada = await c.http().get(foto.pathname).expect(200);
    expect(bajada.headers['content-type']).toContain('image/jpeg');
    const av = await c
      .http()
      .get('/rutas/rut-07-2026-05/avance')
      .set(bearer(ramon))
      .expect(200);
    expect(av.body.datos).toMatchObject({
      suministros: 200,
      leidos: 20,
      conNovedad: 20,
      pendientes: 160,
      fueraDeRango: 2,
    });
  });

  it('las 20 novedades de Brasil cumplen el contrato, con nov-3312 del PRD y su nota de voz con Range', async () => {
    const ramon = await ingresar(c, { legajo: 'L-011', contrasena: 'lectura' });
    const r = await c
      .http()
      .get('/rutas/rut-07-2026-05/novedades?porPagina=200')
      .set(bearer(ramon))
      .expect(200);
    esperarContrato(r.body, 'Novedad');
    const lista = r.body.datos as Novedad[];
    expect(lista).toHaveLength(20);
    const prd = lista.find((n) => n.id === 'nov-3312');
    expect(prd).toMatchObject({
      suministroId: 'sum-004150',
      motivo: 'perro_suelto',
      comentario: null,
      fechaHora: '2026-09-15T08:31:00-03:00',
    });
    expect(new Set(lista.map((n) => n.motivo)).size).toBe(7);
    const audio = new URL(prd!.audioUri!);
    const bajada = await c
      .http()
      .get(audio.pathname)
      .set('Range', 'bytes=0-9')
      .expect(206);
    expect(bajada.headers['content-type']).toContain('audio/mp4');
    await c.http().get(new URL(prd!.fotoUri).pathname).expect(200);
  });

  it('el resumen de la administración tiene datos: los siete motivos en Barrio Brasil', async () => {
    const laura = await ingresar(c, { legajo: 'L-030', contrasena: 'lectura' });
    const r = await c
      .http()
      .get('/novedades/resumen?bimestre=2026-05&porPagina=100')
      .set(bearer(laura))
      .expect(200);
    esperarContrato(r.body, 'ResumenNovedades');
    const brasil = (
      r.body.datos as { motivo: string; zona: string; cantidad: number }[]
    ).filter((g) => g.zona === 'Barrio Brasil');
    expect(brasil).toHaveLength(7);
    expect(brasil.reduce((suma, g) => suma + g.cantidad, 0)).toBe(20);
  });

  it('un lector ve sus suministros pero no los de otro', async () => {
    const jorge = await ingresar(c, { legajo: 'L-013', contrasena: 'lectura' });
    await c
      .http()
      .get('/suministros/sum-020001')
      .set(bearer(jorge))
      .expect(200);
    await c
      .http()
      .get('/suministros/sum-004120')
      .set(bearer(jorge))
      .expect(403);
  });
});

describe('ESPECIFICACION §8 — Semillas completas: cada registro sembrado cumple el contrato', () => {
  let c: AppDePrueba;
  let laura: string;
  beforeAll(async () => {
    c = await crearApp();
    await c.app.get(Sembrador).sembrar();
    laura = await ingresar(c, { legajo: 'L-030', contrasena: 'lectura' });
  });
  afterAll(() => c.cerrar());

  it('las 20 rutas, con sus lecturas, novedades y avance, validan contra el contrato', async () => {
    const rutas = (
      await c.http().get('/rutas?porPagina=100').set(bearer(laura)).expect(200)
    ).body.datos as Ruta[];
    expect(rutas).toHaveLength(20);
    let lecturas = 0;
    let novedades = 0;
    for (const ruta of rutas) {
      const l = await c
        .http()
        .get(`/rutas/${ruta.id}/lecturas?porPagina=200`)
        .set(bearer(laura))
        .expect(200);
      esperarContrato(l.body, 'Lectura');
      lecturas += l.body.datos.length;
      const n = await c
        .http()
        .get(`/rutas/${ruta.id}/novedades?porPagina=200`)
        .set(bearer(laura))
        .expect(200);
      esperarContrato(n.body, 'Novedad');
      novedades += n.body.datos.length;
      const a = await c
        .http()
        .get(`/rutas/${ruta.id}/avance`)
        .set(bearer(laura))
        .expect(200);
      esperarContrato(a.body, 'AvanceRuta');
      expect(a.body.datos.suministros).toBe(ruta.suministroIds.length);
    }
    expect(lecturas).toBe(20);
    expect(novedades).toBe(20);
  });

  it('los 580 suministros y sus medidores salen sin huecos: cada medidor existe y su QR es el del PRD', async () => {
    const r = await c
      .http()
      .get('/suministros?porPagina=100&pagina=6')
      .set(bearer(laura))
      .expect(200);
    esperarContrato(r.body, 'Suministro');
    expect(r.body.meta.total).toBe(580);
    const ids = (r.body.datos as Suministro[]).map((s) => s.medidorId);
    for (const id of ids.slice(0, 5)) {
      const m = await c
        .http()
        .get(`/medidores/${id}`)
        .set(bearer(laura))
        .expect(200);
      esperarContrato(m.body, 'Medidor');
      expect(m.body.datos.codigoQr).toBe(`COOP-CHJ:${id}`);
    }
  });

  it('casos feos: dos lecturas fuera de rango confirmadas, una con consumo negativo, y siete rutas cerradas', async () => {
    const l = (
      await c
        .http()
        .get('/rutas/rut-07-2026-05/lecturas?fueraDeRango=true')
        .set(bearer(laura))
        .expect(200)
    ).body.datos as Lectura[];
    expect(l.map((x) => x.id).sort()).toEqual(['lec-88225', 'lec-88240']);
    expect(l.every((x) => x.confirmadaPorLector)).toBe(true);
    expect(l.some((x) => x.consumo < 0)).toBe(true);
    const cerradas = (
      await c.http().get('/rutas?estado=cerrada').set(bearer(laura)).expect(200)
    ).body.datos as Ruta[];
    expect(cerradas.every((x) => x.cerradaEn !== null)).toBe(true);
  });

  it('sembrar de nuevo no duplica nada: la base ya no está vacía', async () => {
    expect(await c.app.get(Sembrador).estaVacia()).toBe(false);
  });
});
