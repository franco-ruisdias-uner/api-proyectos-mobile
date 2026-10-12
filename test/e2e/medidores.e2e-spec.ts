import { AccesoSuministros } from '../../src/modulos/suministros/acceso-suministros.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { mp4 } from '../utilidades/archivos.js';
import {
  AccesoFijo,
  crearMedidor,
  crearSuministro,
} from '../utilidades/suministros.js';
import { bearer, conSesion } from '../utilidades/usuarios.js';

describe('M1 — GET /medidores/:id y GET /medidores/qr/:codigoQr', () => {
  let c: AppDePrueba;
  const acceso = new AccesoFijo();
  beforeAll(async () => {
    c = await crearApp({ sustitutos: [[AccesoSuministros, acceso]] });
  });
  afterAll(() => c.cerrar());

  async function conVideo(): Promise<string> {
    const admin = await conSesion(c, 'administracion');
    const subido = await c
      .http()
      .post('/archivos')
      .set(bearer(admin.token))
      .attach('archivo', mp4(2000), {
        filename: 'v.mp4',
        contentType: 'video/mp4',
      })
      .expect(201);
    return new URL(subido.body.datos.url).pathname.replace('/archivos/', '');
  }

  it('el del PRD: serie, modelo, QR e instalación en hora argentina', async () => {
    const admin = await conSesion(c, 'administracion');
    await crearSuministro(c, {
      medidor: {
        id: 'med-A88413',
        serie: 'A-88413',
        modelo: 'agujas',
        instaladoEn: new Date('2019-03-11T03:00:00Z'),
      },
    });
    const r = await c
      .http()
      .get('/medidores/med-A88413')
      .set(bearer(admin.token))
      .expect(200);
    esperarContrato(r.body, 'Medidor');
    expect(r.body.datos).toEqual({
      id: 'med-A88413',
      serie: 'A-88413',
      modelo: 'agujas',
      multiplicador: 1,
      digitos: 5,
      videoInstructivoUrl: null,
      codigoQr: 'COOP-CHJ:med-A88413',
      instaladoEn: '2019-03-11T00:00:00-03:00',
    });
  });

  it('el medidor con multiplicador y sin video', async () => {
    const admin = await conSesion(c, 'administracion');
    await crearSuministro(c, {
      medidor: {
        id: 'med-004225',
        modelo: 'multiplicador',
        multiplicador: 10,
        videoClave: null,
      },
    });
    const r = await c
      .http()
      .get('/medidores/med-004225')
      .set(bearer(admin.token))
      .expect(200);
    esperarContrato(r.body, 'Medidor');
    expect(r.body.datos).toMatchObject({
      modelo: 'multiplicador',
      multiplicador: 10,
      videoInstructivoUrl: null,
    });
  });

  it('el video se sirve desde esta API, con el origen del pedido, y acepta Range', async () => {
    const admin = await conSesion(c, 'administracion');
    const clave = await conVideo();
    await crearSuministro(c, {
      medidor: { id: 'med-V0001', modelo: 'digital', videoClave: clave },
    });
    const r = await c
      .http()
      .get('/medidores/med-V0001')
      .set(bearer(admin.token))
      .set('Host', '10.0.0.5:3000')
      .expect(200);
    esperarContrato(r.body, 'Medidor');
    const url: string = r.body.datos.videoInstructivoUrl;
    expect(url).toBe(`http://10.0.0.5:3000/archivos/${clave}`);

    const rango = await c
      .http()
      .get(new URL(url).pathname)
      .set('Range', 'bytes=10-19')
      .expect(206);
    expect(rango.headers['content-range']).toBe('bytes 10-19/2000');
  });

  it('un lector lo ve si el suministro que lo tiene está en sus rutas', async () => {
    const lector = await conSesion(c, 'lector');
    const { suministro, medidor } = await crearSuministro(c);
    acceso.dar(lector.id, suministro.id);
    const r = await c
      .http()
      .get(`/medidores/${medidor.id}`)
      .set(bearer(lector.token))
      .expect(200);
    esperarContrato(r.body, 'Medidor');
    const q = await c
      .http()
      .get(`/medidores/qr/COOP-CHJ:${medidor.id}`)
      .set(bearer(lector.token))
      .expect(200);
    expect(q.body.datos.id).toBe(medidor.id);
  });

  it('un lector no ve el de un suministro ajeno ni uno sin suministro: 403 (R3)', async () => {
    const lector = await conSesion(c, 'lector');
    const { medidor } = await crearSuministro(c);
    const huerfano = await crearMedidor(c);
    for (const id of [medidor.id, huerfano.id]) {
      const r = await c
        .http()
        .get(`/medidores/${id}`)
        .set(bearer(lector.token))
        .expect(403);
      esperarError(r.body, 'SIN_PERMISO');
      const q = await c
        .http()
        .get(`/medidores/qr/COOP-CHJ:${id}`)
        .set(bearer(lector.token))
        .expect(403);
      esperarError(q.body, 'SIN_PERMISO');
    }
  });

  it('administración ve también un medidor sin suministro', async () => {
    const admin = await conSesion(c, 'administracion');
    const huerfano = await crearMedidor(c);
    await c
      .http()
      .get(`/medidores/${huerfano.id}`)
      .set(bearer(admin.token))
      .expect(200);
  });

  it('por QR: el código de un medidor sin QR no se encuentra', async () => {
    const admin = await conSesion(c, 'administracion');
    const m = await crearMedidor(c, { codigoQr: null });
    const r = await c
      .http()
      .get(`/medidores/qr/COOP-CHJ:${m.id}`)
      .set(bearer(admin.token))
      .expect(404);
    esperarError(r.body, 'MEDIDOR_NO_ENCONTRADO');
  });

  it('404 MEDIDOR_NO_ENCONTRADO si no existe, por id y por QR', async () => {
    const admin = await conSesion(c, 'administracion');
    const lector = await conSesion(c, 'lector');
    for (const t of [admin.token, lector.token]) {
      const a = await c
        .http()
        .get('/medidores/med-NOEXISTE')
        .set(bearer(t))
        .expect(404);
      esperarError(a.body, 'MEDIDOR_NO_ENCONTRADO');
      const b = await c
        .http()
        .get('/medidores/qr/COOP-CHJ:med-NOEXISTE')
        .set(bearer(t))
        .expect(404);
      esperarError(b.body, 'MEDIDOR_NO_ENCONTRADO');
      const otro = await c
        .http()
        .get('/medidores/qr/cualquier-cosa')
        .set(bearer(t))
        .expect(404);
      esperarError(otro.body, 'MEDIDOR_NO_ENCONTRADO');
    }
  });

  it('400 con un id que no tiene la forma de un medidor', async () => {
    const admin = await conSesion(c, 'administracion');
    const r = await c
      .http()
      .get('/medidores/sum-1')
      .set(bearer(admin.token))
      .expect(400);
    esperarError(r.body, 'VALIDACION_FALLIDA');
  });

  it('401 sin token', async () => {
    esperarError(
      (await c.http().get('/medidores/med-A88413').expect(401)).body,
      'NO_AUTENTICADO',
    );
    esperarError(
      (await c.http().get('/medidores/qr/COOP-CHJ:med-A88413').expect(401))
        .body,
      'NO_AUTENTICADO',
    );
  });
});
