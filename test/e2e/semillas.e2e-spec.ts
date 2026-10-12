import type { Suministro } from '../../contrato/tipos.js';
import { ArchivosServicio } from '../../src/comun/archivos/archivos.servicio.js';
import { MedidorEntidad } from '../../src/modulos/suministros/medidor.entidad.js';
import { medidorAContrato } from '../../src/modulos/suministros/suministros.mapeador.js';
import { Sembrador } from '../../src/semillas/sembrar.js';
import { USUARIOS } from '../../src/semillas/datos/usuarios.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { esperarContrato } from '../utilidades/contrato.js';
import { bearer, ingresar } from '../utilidades/usuarios.js';

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
        rutasAsignadas: [],
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
