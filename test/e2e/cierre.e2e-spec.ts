import { aIsoConZona } from '../../src/comun/fechas/fechas.js';
import { jpeg } from '../utilidades/archivos.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { crearRuta } from '../utilidades/rutas.js';
import { bearer, conSesion } from '../utilidades/usuarios.js';

interface RutaCreada {
  id: string;
  suministroIds: string[];
}

describe('M5 — POST /rutas/:id/cierre (R20 a R23)', () => {
  let c: AppDePrueba;
  let lector: { id: string; token: string };
  let otro: { id: string; token: string };
  let admin: { token: string };
  let foto: string;

  beforeAll(async () => {
    c = await crearApp();
    lector = await conSesion(c, 'lector');
    otro = await conSesion(c, 'lector');
    admin = await conSesion(c, 'administracion');
    const r = await c
      .http()
      .post('/archivos')
      .set(bearer(lector.token))
      .attach('archivo', jpeg(), 'foto.jpg')
      .expect(201);
    foto = r.body.datos.url as string;
  });
  afterAll(() => c.cerrar());

  const nuevaRuta = (estado: 'asignada' | 'en_curso' = 'en_curso') =>
    crearRuta(c, { lectorId: lector.id, estado, cantidad: 3 });
  const cargarLectura = (
    ruta: RutaCreada,
    i: number,
    id: string,
    resto: Record<string, unknown> = {},
  ) =>
    c
      .http()
      .post('/lecturas')
      .set(bearer(lector.token))
      .send({
        id,
        rutaId: ruta.id,
        suministroId: ruta.suministroIds[i],
        valor: 100,
        fotoUri: foto,
        coordenadas: null,
        confirmadaPorLector: false,
        fechaHora: '2026-09-15T07:10:00-03:00',
        ...resto,
      });
  const cargarNovedad = (ruta: RutaCreada, i: number, id: string) =>
    c.http().post('/novedades').set(bearer(lector.token)).send({
      id,
      rutaId: ruta.id,
      suministroId: ruta.suministroIds[i],
      motivo: 'perro_suelto',
      comentario: null,
      audioUri: null,
      fotoUri: foto,
      fechaHora: '2026-09-15T07:00:00-03:00',
    });
  const cerrar = (
    token: string,
    rutaId: string,
    cuerpo: object = { lecturaIds: [], novedadIds: [] },
  ) => c.http().post(`/rutas/${rutaId}/cierre`).set(bearer(token)).send(cuerpo);
  const estadoDe = async (rutaId: string) =>
    (
      await c
        .http()
        .get(`/rutas/${rutaId}`)
        .set(bearer(lector.token))
        .expect(200)
    ).body.datos;

  it('R21: con todo recibido, cierra y devuelve la Ruta cerrada', async () => {
    const ruta = await nuevaRuta();
    await cargarLectura(ruta, 0, 'lec-cie001').expect(201);
    await cargarNovedad(ruta, 1, 'nov-cie001').expect(201);
    const r = await cerrar(lector.token, ruta.id, {
      lecturaIds: ['lec-cie001'],
      novedadIds: ['nov-cie001'],
    }).expect(200);
    esperarContrato(r.body, 'Ruta');
    expect(r.body.datos).toMatchObject({
      id: ruta.id,
      estado: 'cerrada',
      suministroIds: ruta.suministroIds,
      cerradaEn: aIsoConZona(c.reloj.ahora()),
    });
  });

  it('R21: cierra aunque queden suministros sin leer ni novedad; el avance dice cuántos', async () => {
    const ruta = await nuevaRuta();
    await cargarLectura(ruta, 0, 'lec-cie002').expect(201);
    await cerrar(lector.token, ruta.id, {
      lecturaIds: ['lec-cie002'],
      novedadIds: [],
    }).expect(200);
    const a = await c
      .http()
      .get(`/rutas/${ruta.id}/avance`)
      .set(bearer(lector.token))
      .expect(200);
    expect(a.body.datos).toMatchObject({ leidos: 1, pendientes: 2 });
  });

  it('cierra una ruta asignada que nunca se descargó y sin nada cargado', async () => {
    const ruta = await nuevaRuta('asignada');
    const r = await cerrar(lector.token, ruta.id).expect(200);
    expect(r.body.datos.estado).toBe('cerrada');
  });

  it('R20: si falta algo en el servidor, 409 HAY_DATOS_SIN_SUBIR con la cuenta y la ruta sigue abierta', async () => {
    const ruta = await nuevaRuta();
    await cargarLectura(ruta, 0, 'lec-cie003').expect(201);
    const r = await cerrar(lector.token, ruta.id, {
      lecturaIds: ['lec-cie003', 'lec-falta1', 'lec-falta2', 'lec-falta3'],
      novedadIds: ['nov-falta1'],
    }).expect(409);
    esperarError(r.body, 'HAY_DATOS_SIN_SUBIR');
    expect(r.body.error.mensaje).toBe(
      'Faltan subir 3 lecturas y 1 novedad. Esperá a tener señal y probá de nuevo.',
    );
    expect(await estadoDe(ruta.id)).toMatchObject({
      estado: 'en_curso',
      cerradaEn: null,
    });
    // Después de subir lo que faltaba, cierra.
    await cargarLectura(ruta, 1, 'lec-falta1').expect(201);
    await cargarLectura(ruta, 2, 'lec-falta2').expect(201);
    await cargarLectura(ruta, 2, 'lec-falta3', {
      fechaHora: '2026-09-15T07:20:00-03:00',
    }).expect(201);
    await cargarNovedad(ruta, 2, 'nov-falta1').expect(201);
    await cerrar(lector.token, ruta.id, {
      lecturaIds: ['lec-cie003', 'lec-falta1', 'lec-falta2', 'lec-falta3'],
      novedadIds: ['nov-falta1'],
    }).expect(200);
  });

  it('R20: sólo lecturas o sólo novedades faltantes, en singular y plural', async () => {
    const ruta = await nuevaRuta();
    const a = await cerrar(lector.token, ruta.id, {
      lecturaIds: ['lec-nada01'],
      novedadIds: [],
    }).expect(409);
    expect(a.body.error.mensaje).toBe(
      'Falta subir 1 lectura. Esperá a tener señal y probá de nuevo.',
    );
    const b = await cerrar(lector.token, ruta.id, {
      lecturaIds: [],
      novedadIds: ['nov-nada01', 'nov-nada02'],
    }).expect(409);
    expect(b.body.error.mensaje).toBe(
      'Faltan subir 2 novedades. Esperá a tener señal y probá de nuevo.',
    );
  });

  it('R20: un id que existe pero es de otra ruta cuenta como faltante', async () => {
    const ruta = await nuevaRuta();
    const ajena = await nuevaRuta();
    await cargarLectura(ajena, 0, 'lec-ajena1').expect(201);
    await cargarNovedad(ajena, 0, 'nov-ajena1').expect(201);
    const r = await cerrar(lector.token, ruta.id, {
      lecturaIds: ['lec-ajena1'],
      novedadIds: [],
    }).expect(409);
    esperarError(r.body, 'HAY_DATOS_SIN_SUBIR');
    const n = await cerrar(lector.token, ruta.id, {
      lecturaIds: [],
      novedadIds: ['nov-ajena1'],
    }).expect(409);
    esperarError(n.body, 'HAY_DATOS_SIN_SUBIR');
  });

  it('R20: los ids repetidos cuentan una vez y una lectura que dejó de ser vigente igual está recibida', async () => {
    const ruta = await nuevaRuta();
    await cargarLectura(ruta, 0, 'lec-vieja1').expect(201);
    await cargarLectura(ruta, 0, 'lec-nueva1', {
      valor: 120,
      fechaHora: '2026-09-15T07:20:00-03:00',
    }).expect(201);
    const f = await cerrar(lector.token, ruta.id, {
      lecturaIds: ['lec-vieja1', 'lec-vieja1', 'lec-sinsubir', 'lec-sinsubir'],
      novedadIds: [],
    }).expect(409);
    expect(f.body.error.mensaje).toMatch(/^Falta subir 1 lectura\./);
    await cerrar(lector.token, ruta.id, {
      lecturaIds: ['lec-vieja1', 'lec-nueva1', 'lec-vieja1'],
      novedadIds: [],
    }).expect(200);
  });

  describe('R22 — ruta ya cerrada', () => {
    it('cerrar de nuevo: 409 RUTA_YA_CERRADA con el mensaje exacto del PRD', async () => {
      const ruta = await crearRuta(c, {
        lectorId: lector.id,
        estado: 'cerrada',
        cantidad: 1,
      });
      const r = await cerrar(lector.token, ruta.id).expect(409);
      esperarError(r.body, 'RUTA_YA_CERRADA');
      expect(r.body.error.mensaje).toBe('Esa ruta fue cerrada el 14/09.');
    });

    it('dos cierres simultáneos: uno cierra y el otro recibe RUTA_YA_CERRADA', async () => {
      const ruta = await nuevaRuta();
      const rs = await Promise.all([
        cerrar(lector.token, ruta.id),
        cerrar(lector.token, ruta.id),
      ]);
      expect(rs.map((r) => r.status).sort()).toEqual([200, 409]);
      esperarError(rs.find((r) => r.status === 409)?.body, 'RUTA_YA_CERRADA');
    });

    it('si la ruta ya está cerrada, eso gana sobre los datos faltantes', async () => {
      const ruta = await crearRuta(c, {
        lectorId: lector.id,
        estado: 'cerrada',
        cantidad: 1,
      });
      const r = await cerrar(lector.token, ruta.id, {
        lecturaIds: ['lec-nunca1'],
        novedadIds: [],
      }).expect(409);
      esperarError(r.body, 'RUTA_YA_CERRADA');
    });

    it('R15: el reintento de una lectura ya recibida sigue dando 200 con la ruta cerrada', async () => {
      const ruta = await nuevaRuta();
      await cargarLectura(ruta, 0, 'lec-reint01').expect(201);
      await cerrar(lector.token, ruta.id, {
        lecturaIds: ['lec-reint01'],
        novedadIds: [],
      }).expect(200);
      await cargarLectura(ruta, 0, 'lec-reint01').expect(200);
      // Una lectura nueva en la ruta cerrada sí se rechaza.
      const r = await cargarLectura(ruta, 1, 'lec-tarde01').expect(409);
      esperarError(r.body, 'RUTA_YA_CERRADA');
    });
  });

  describe('R23 — quién puede cerrar', () => {
    it('administración cierra la ruta de un lector con las listas vacías', async () => {
      const ruta = await nuevaRuta();
      const r = await cerrar(admin.token, ruta.id).expect(200);
      esperarContrato(r.body, 'Ruta');
      expect(r.body.datos.estado).toBe('cerrada');
    });

    it('otro lector recibe 403 SIN_PERMISO y la ruta sigue abierta', async () => {
      const ruta = await nuevaRuta();
      const r = await cerrar(otro.token, ruta.id).expect(403);
      esperarError(r.body, 'SIN_PERMISO');
      expect((await estadoDe(ruta.id)).estado).toBe('en_curso');
    });
  });

  describe('errores comunes', () => {
    it('sin token es 401', async () => {
      const ruta = await nuevaRuta();
      const r = await c
        .http()
        .post(`/rutas/${ruta.id}/cierre`)
        .send({ lecturaIds: [], novedadIds: [] })
        .expect(401);
      esperarError(r.body, 'NO_AUTENTICADO');
    });

    it('una ruta que no existe es 404 RUTA_NO_ENCONTRADA', async () => {
      const r = await cerrar(lector.token, 'rut-99-2026-05').expect(404);
      esperarError(r.body, 'RUTA_NO_ENCONTRADA');
    });

    it('un id de ruta con forma inválida es 400', async () => {
      const r = await cerrar(lector.token, 'xyz').expect(400);
      esperarError(r.body, 'VALIDACION_FALLIDA');
    });

    it.each([
      ['sin listas', {}],
      ['lecturaIds no es lista', { lecturaIds: 'lec-1', novedadIds: [] }],
      ['falta novedadIds', { lecturaIds: [] }],
      [
        'un id de lectura con otro prefijo',
        { lecturaIds: ['nov-abc'], novedadIds: [] },
      ],
      ['un id que no es texto', { lecturaIds: [], novedadIds: [5] }],
      ['un campo de más', { lecturaIds: [], novedadIds: [], otro: 1 }],
    ])('400 VALIDACION_FALLIDA: %s', async (_nombre, cuerpo) => {
      const ruta = await nuevaRuta();
      const r = await cerrar(lector.token, ruta.id, cuerpo).expect(400);
      esperarError(r.body, 'VALIDACION_FALLIDA');
      expect((await estadoDe(ruta.id)).estado).toBe('en_curso');
    });
  });
});
