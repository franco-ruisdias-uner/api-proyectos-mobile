import type { Novedad } from '../../contrato/tipos.js';
import { jpeg, m4a, mp4 } from '../utilidades/archivos.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { crearRuta } from '../utilidades/rutas.js';
import { bearer, conSesion } from '../utilidades/usuarios.js';

const ids = (cuerpo: { datos: Novedad[] }) => cuerpo.datos.map((n) => n.id);

describe('M4 — Novedades', () => {
  let c: AppDePrueba;
  let lector: { id: string; token: string };
  let otro: { id: string; token: string };
  let admin: { token: string };
  let ruta: { id: string; suministroIds: string[] };
  let foto: string;
  let audio: string;
  let video: string;

  const subir = async (token: string, contenido: Buffer, nombre: string) => {
    const r = await c
      .http()
      .post('/archivos')
      .set(bearer(token))
      .attach('archivo', contenido, nombre)
      .expect(201);
    return r.body.datos.url as string;
  };

  beforeAll(async () => {
    c = await crearApp();
    lector = await conSesion(c, 'lector');
    otro = await conSesion(c, 'lector');
    admin = await conSesion(c, 'administracion');
    // Los suministros quedan en este orden de recorrido: el 0 es el último en número.
    ruta = await crearRuta(c, {
      lectorId: lector.id,
      estado: 'en_curso',
      nombre: 'Barrio Uno',
      cantidad: 4,
    });
    foto = await subir(lector.token, jpeg(), 'foto.jpg');
    audio = await subir(lector.token, m4a(), 'nota.m4a');
    video = await subir(lector.token, mp4(), 'video.mp4');
  });
  afterAll(() => c.cerrar());

  const cuerpo = (resto: Record<string, unknown> = {}) => ({
    rutaId: ruta.id,
    suministroId: ruta.suministroIds[0],
    motivo: 'perro_suelto',
    comentario: 'Dos perros grandes sueltos',
    audioUri: null,
    fotoUri: foto,
    fechaHora: '2026-09-15T07:30:00-03:00',
    ...resto,
  });
  const cargar = (token: string, resto: Record<string, unknown> = {}) =>
    c
      .http()
      .post('/novedades')
      .set(bearer(token))
      .set('Host', 'api.test:3000')
      .send(cuerpo(resto));

  describe('POST /novedades', () => {
    it('R18: crea la novedad con el lector del token y cumple el contrato', async () => {
      const r = await cargar(lector.token, { id: 'nov-feliz1' }).expect(201);
      esperarContrato(r.body, 'Novedad');
      expect(r.body.datos).toEqual({
        id: 'nov-feliz1',
        rutaId: ruta.id,
        suministroId: ruta.suministroIds[0],
        lectorId: lector.id,
        motivo: 'perro_suelto',
        comentario: 'Dos perros grandes sueltos',
        audioUri: null,
        fotoUri: `http://api.test:3000${new URL(foto).pathname}`,
        fechaHora: '2026-09-15T07:30:00-03:00',
        sincronizada: true,
      });
    });

    it('sin id lo genera el servidor, con prefijo nov-', async () => {
      const r = await cargar(lector.token, {
        suministroId: ruta.suministroIds[1],
        id: undefined,
      }).expect(201);
      expect(r.body.datos.id).toMatch(/^nov-[a-z0-9]{12}$/);
    });

    it('R18: acepta una nota de voz subida a esta API', async () => {
      const r = await cargar(lector.token, {
        id: 'nov-con-voz',
        audioUri: audio,
        suministroId: ruta.suministroIds[2],
      }).expect(201);
      esperarContrato(r.body, 'Novedad');
      expect(r.body.datos.audioUri).toBe(
        `http://api.test:3000${new URL(audio).pathname}`,
      );
    });

    it.each([
      ['""', ''],
      ['sólo espacios', '   '],
      ['null', null],
      ['ausente', undefined],
    ])('R18: comentario %s se guarda como null', async (_caso, comentario) => {
      const r = await cargar(lector.token, {
        id: undefined,
        comentario,
        suministroId: ruta.suministroIds[3],
      }).expect(201);
      expect(r.body.datos.comentario).toBeNull();
    });

    it('R18: acepta un comentario de exactamente 500 caracteres', async () => {
      const r = await cargar(lector.token, {
        id: undefined,
        comentario: 'a'.repeat(500),
        suministroId: ruta.suministroIds[3],
      }).expect(201);
      expect(r.body.datos.comentario).toHaveLength(500);
    });

    it('R18: ignora lectorId, sincronizada y los ids del cliente que no le tocan', async () => {
      const r = await cargar(lector.token, {
        id: 'nov-ignora',
        lectorId: otro.id,
        sincronizada: false,
        suministroId: ruta.suministroIds[3],
      }).expect(201);
      expect(r.body.datos.lectorId).toBe(lector.id);
      expect(r.body.datos.sincronizada).toBe(true);
    });

    it('acepta la fecha con Z y la devuelve con -03:00 sin milisegundos', async () => {
      const r = await cargar(lector.token, {
        id: 'nov-con-zeta',
        fechaHora: '2026-09-15T10:31:12.345Z',
        suministroId: ruta.suministroIds[3],
      }).expect(201);
      expect(r.body.datos.fechaHora).toBe('2026-09-15T07:31:12-03:00');
    });

    it('R12: una novedad en una ruta asignada la pasa a en_curso', async () => {
      const asignada = await crearRuta(c, {
        lectorId: lector.id,
        estado: 'asignada',
        cantidad: 1,
      });
      await cargar(lector.token, {
        rutaId: asignada.id,
        suministroId: asignada.suministroIds[0],
      }).expect(201);
      const r = await c
        .http()
        .get(`/rutas/${asignada.id}`)
        .set(bearer(lector.token))
        .expect(200);
      expect(r.body.datos.estado).toBe('en_curso');
    });

    describe('idempotencia (AGENTS §10.5, R15)', () => {
      it('el mismo cuerpo dos veces deja una sola novedad y las dos respuestas son iguales', async () => {
        const nueva = await crearRuta(c, { lectorId: lector.id, cantidad: 1 });
        const datos = {
          id: 'nov-reintento',
          rutaId: nueva.id,
          suministroId: nueva.suministroIds[0],
        };
        const a = await cargar(lector.token, datos).expect(201);
        const b = await cargar(lector.token, datos).expect(200);
        expect(b.body).toEqual(a.body);
        const lista = await c
          .http()
          .get(`/rutas/${nueva.id}/novedades`)
          .set(bearer(lector.token))
          .expect(200);
        expect(lista.body.meta.total).toBe(1);
      });

      it('un id de otro lector es ID_EN_USO (409)', async () => {
        const r = await cargar(otro.token, { id: 'nov-feliz1' }).expect(409);
        esperarError(r.body, 'ID_EN_USO');
      });

      it('dos pedidos iguales a la vez: uno crea y el otro devuelve lo creado', async () => {
        const nueva = await crearRuta(c, { lectorId: lector.id, cantidad: 1 });
        const datos = {
          id: 'nov-a-la-vez',
          rutaId: nueva.id,
          suministroId: nueva.suministroIds[0],
        };
        const [a, b] = await Promise.all([
          cargar(lector.token, datos),
          cargar(lector.token, datos),
        ]);
        expect([a.status, b.status].sort()).toEqual([200, 201]);
        expect(a.body).toEqual(b.body);
      });

      it('R15: reintentar lo que ya llegó en una ruta que se cerró da 200', async () => {
        const nueva = await crearRuta(c, { lectorId: lector.id, cantidad: 1 });
        const datos = {
          id: 'nov-antes-del-cierre',
          rutaId: nueva.id,
          suministroId: nueva.suministroIds[0],
        };
        await cargar(lector.token, datos).expect(201);
        const { RutaEntidad } =
          await import('../../src/modulos/rutas/ruta.entidad.js');
        await c.dataSource
          .getRepository(RutaEntidad)
          .update(
            { id: nueva.id },
            { estado: 'cerrada', cerradaEn: new Date('2026-09-15T10:00:00Z') },
          );
        await cargar(lector.token, datos).expect(200);
      });
    });

    describe('400 y 422', () => {
      it.each([
        ['falta la ruta', { rutaId: undefined }],
        ['falta el suministro', { suministroId: undefined }],
        ['falta el motivo', { motivo: undefined }],
        ['motivo que no existe', { motivo: 'se_fue_de_vacaciones' }],
        ['motivo en mayúsculas', { motivo: 'PERRO_SUELTO' }],
        ['comentario de 501 caracteres', { comentario: 'a'.repeat(501) }],
        ['comentario que no es texto', { comentario: 5 }],
        ['audioUri que no es texto', { audioUri: 5 }],
        ['falta la fecha', { fechaHora: undefined }],
        ['la fecha es cualquier cosa', { fechaHora: 'ayer' }],
        ['la fecha no dice la zona', { fechaHora: '2026-09-15T07:30:00' }],
        ['id con prefijo equivocado', { id: 'lec-1234' }],
        ['campo de más', { extra: 1 }],
        ['una fecha futura', { fechaHora: '2026-09-15T09:00:00-03:00' }],
      ])('400: %s', async (_caso, resto) => {
        const r = await cargar(lector.token, resto).expect(400);
        esperarError(r.body, 'VALIDACION_FALLIDA');
      });

      it('400: el mensaje nombra el problema en castellano', async () => {
        const r = await cargar(lector.token, { motivo: 'nada' }).expect(400);
        expect(r.body.error.mensaje).toMatch(/motivo/i);
      });

      it('una fecha apenas adelantada (relojes desfasados, 4 minutos) se acepta', async () => {
        await cargar(lector.token, {
          id: 'nov-desfasada',
          fechaHora: '2026-09-15T08:04:00-03:00',
          suministroId: ruta.suministroIds[3],
        }).expect(201);
      });

      it('FOTO_REQUERIDA (422) si falta la foto', async () => {
        for (const fotoUri of [undefined, null, '', '  ']) {
          const r = await cargar(lector.token, { fotoUri }).expect(422);
          esperarError(r.body, 'FOTO_REQUERIDA');
        }
      });

      it('FOTO_REQUERIDA si la "foto" es un audio o un video', async () => {
        for (const fotoUri of [audio, video]) {
          const r = await cargar(lector.token, { fotoUri }).expect(422);
          esperarError(r.body, 'FOTO_REQUERIDA');
        }
      });

      it.each([
        ['un file://', 'file:///novedades/nov-3312.jpg'],
        ['otra URL', 'https://example.com/foto.jpg'],
        [
          'una clave que no existe',
          'http://api.test:3000/archivos/imagenes/2026/09/aaaaaaaaaaaaaaaa.jpg',
        ],
      ])('ARCHIVO_NO_SUBIDO (422) si la foto es %s', async (_caso, fotoUri) => {
        const r = await cargar(lector.token, { fotoUri }).expect(422);
        esperarError(r.body, 'ARCHIVO_NO_SUBIDO');
      });

      it.each([
        ['un file://', 'file:///novedades/nov-3312.m4a'],
        ['otra URL', 'https://example.com/nota.m4a'],
      ])(
        'ARCHIVO_NO_SUBIDO (422) si el audio es %s',
        async (_caso, audioUri) => {
          const r = await cargar(lector.token, { audioUri }).expect(422);
          esperarError(r.body, 'ARCHIVO_NO_SUBIDO');
        },
      );

      it('si la nota de voz es una imagen, no es un audio (400)', async () => {
        const r = await cargar(lector.token, { audioUri: foto }).expect(400);
        esperarError(r.body, 'VALIDACION_FALLIDA');
      });

      it('SUMINISTRO_FUERA_DE_RUTA (422)', async () => {
        const ajeno = await crearRuta(c, { lectorId: otro.id, cantidad: 1 });
        const r = await cargar(lector.token, {
          suministroId: ajeno.suministroIds[0],
        }).expect(422);
        esperarError(r.body, 'SUMINISTRO_FUERA_DE_RUTA');
      });

      it('RUTA_NO_ENCONTRADA (404)', async () => {
        const r = await cargar(lector.token, {
          rutaId: 'rut-99-2026-05',
        }).expect(404);
        esperarError(r.body, 'RUTA_NO_ENCONTRADA');
      });

      it('R22: en una ruta cerrada, RUTA_YA_CERRADA con el mensaje del PRD', async () => {
        const cerrada = await crearRuta(c, {
          lectorId: lector.id,
          estado: 'cerrada',
          cantidad: 1,
        });
        const r = await cargar(lector.token, {
          rutaId: cerrada.id,
          suministroId: cerrada.suministroIds[0],
        }).expect(409);
        esperarError(r.body, 'RUTA_YA_CERRADA');
        expect(r.body.error.mensaje).toBe('Esa ruta fue cerrada el 14/09.');
      });
    });

    describe('401 y 403', () => {
      it('401 sin token', async () => {
        const r = await c.http().post('/novedades').send(cuerpo()).expect(401);
        esperarError(r.body, 'NO_AUTENTICADO');
      });

      it('403 si la ruta es de otro lector (y la validación de ruta va antes que la del cuerpo)', async () => {
        const r = await cargar(otro.token).expect(403);
        esperarError(r.body, 'SIN_PERMISO');
      });

      it('403 para administración: no carga novedades', async () => {
        const r = await cargar(admin.token).expect(403);
        esperarError(r.body, 'SIN_PERMISO');
      });
    });
  });

  describe('GET /novedades/:id', () => {
    it('devuelve la novedad al dueño y a administración', async () => {
      for (const token of [lector.token, admin.token]) {
        const r = await c
          .http()
          .get('/novedades/nov-feliz1')
          .set(bearer(token))
          .expect(200);
        esperarContrato(r.body, 'Novedad');
        expect(r.body.datos.id).toBe('nov-feliz1');
      }
    });

    it('403 para un lector que no es dueño de la ruta', async () => {
      const r = await c
        .http()
        .get('/novedades/nov-feliz1')
        .set(bearer(otro.token))
        .expect(403);
      esperarError(r.body, 'SIN_PERMISO');
    });

    it('404 NOVEDAD_NO_ENCONTRADA', async () => {
      const r = await c
        .http()
        .get('/novedades/nov-noexiste')
        .set(bearer(lector.token))
        .expect(404);
      esperarError(r.body, 'NOVEDAD_NO_ENCONTRADA');
    });

    it('400 con un id de otro tipo', async () => {
      const r = await c
        .http()
        .get('/novedades/lec-feliz1')
        .set(bearer(lector.token))
        .expect(400);
      esperarError(r.body, 'VALIDACION_FALLIDA');
    });

    it('401 sin token', async () => {
      const r = await c.http().get('/novedades/nov-feliz1').expect(401);
      esperarError(r.body, 'NO_AUTENTICADO');
    });
  });

  describe('GET /rutas/:id/novedades', () => {
    let r2: { id: string; suministroIds: string[] };

    beforeAll(async () => {
      r2 = await crearRuta(c, {
        lectorId: lector.id,
        estado: 'en_curso',
        nombre: 'Barrio Dos',
        cantidad: 4,
      });
      const [s0, s1, s2, s3] = r2.suministroIds;
      const nov = (resto: Record<string, unknown>) =>
        cargar(lector.token, { rutaId: r2.id, ...resto }).expect(201);
      // Llegan en un orden distinto del recorrido.
      await nov({ id: 'nov-l-s2', suministroId: s2, motivo: 'pasto_alto' });
      await nov({ id: 'nov-l-s0', suministroId: s0, motivo: 'perro_suelto' });
      await nov({ id: 'nov-l-s1', suministroId: s1, motivo: 'perro_suelto' });
      // s3: dos novedades; la más reciente (aunque llegó antes) es la vigente.
      await nov({
        id: 'nov-l-s3-nueva',
        suministroId: s3,
        motivo: 'deshabitada',
        fechaHora: '2026-09-15T07:50:00-03:00',
      });
      await nov({
        id: 'nov-l-s3-vieja',
        suministroId: s3,
        motivo: 'porton_cerrado',
        fechaHora: '2026-09-15T07:10:00-03:00',
      });
    });

    it('R13: devuelve las vigentes en el orden del recorrido, no el de llegada', async () => {
      const r = await c
        .http()
        .get(`/rutas/${r2.id}/novedades`)
        .set(bearer(lector.token))
        .expect(200);
      esperarContrato(r.body, 'Novedad');
      expect(ids(r.body)).toEqual([
        'nov-l-s0',
        'nov-l-s1',
        'nov-l-s2',
        'nov-l-s3-nueva',
      ]);
      expect(r.body.meta).toEqual({ total: 4, pagina: 1, porPagina: 50 });
    });

    it('filtra por motivo', async () => {
      const r = await c
        .http()
        .get(`/rutas/${r2.id}/novedades?motivo=perro_suelto`)
        .set(bearer(lector.token))
        .expect(200);
      expect(ids(r.body)).toEqual(['nov-l-s0', 'nov-l-s1']);
      expect(r.body.meta.total).toBe(2);
    });

    it('el filtro por motivo mira la vigente, no una que quedó atrás', async () => {
      const r = await c
        .http()
        .get(`/rutas/${r2.id}/novedades?motivo=porton_cerrado`)
        .set(bearer(lector.token))
        .expect(200);
      expect(r.body.datos).toEqual([]);
      expect(r.body.meta.total).toBe(0);
    });

    it('pagina: total del filtrado, página en rango y fuera de rango', async () => {
      const p = await c
        .http()
        .get(`/rutas/${r2.id}/novedades?pagina=2&porPagina=3`)
        .set(bearer(lector.token))
        .expect(200);
      expect(ids(p.body)).toEqual(['nov-l-s3-nueva']);
      expect(p.body.meta).toEqual({ total: 4, pagina: 2, porPagina: 3 });
      const f = await c
        .http()
        .get(`/rutas/${r2.id}/novedades?pagina=9`)
        .set(bearer(lector.token))
        .expect(200);
      expect(f.body.datos).toEqual([]);
      expect(f.body.meta.total).toBe(4);
    });

    it('una ruta sin novedades devuelve la lista vacía', async () => {
      const vacia = await crearRuta(c, { lectorId: lector.id, cantidad: 1 });
      const r = await c
        .http()
        .get(`/rutas/${vacia.id}/novedades`)
        .set(bearer(lector.token))
        .expect(200);
      expect(r.body).toEqual({
        datos: [],
        meta: { total: 0, pagina: 1, porPagina: 50 },
      });
    });

    it('R13: si el suministro tiene una lectura, la novedad ya no es vigente (aunque sea más nueva)', async () => {
      const mixta = await crearRuta(c, { lectorId: lector.id, cantidad: 2 });
      const [s0, s1] = mixta.suministroIds;
      await cargar(lector.token, {
        id: 'nov-mix-0',
        rutaId: mixta.id,
        suministroId: s0,
        fechaHora: '2026-09-15T07:55:00-03:00',
      }).expect(201);
      await cargar(lector.token, {
        id: 'nov-mix-1',
        rutaId: mixta.id,
        suministroId: s1,
      }).expect(201);
      await c
        .http()
        .post('/lecturas')
        .set(bearer(lector.token))
        .send({
          rutaId: mixta.id,
          suministroId: s0,
          valor: 100,
          fotoUri: foto,
          coordenadas: null,
          fechaHora: '2026-09-15T07:00:00-03:00',
        })
        .expect(201);
      const r = await c
        .http()
        .get(`/rutas/${mixta.id}/novedades`)
        .set(bearer(lector.token))
        .expect(200);
      expect(ids(r.body)).toEqual(['nov-mix-1']);
      // La novedad no se borró: se sigue pudiendo pedir por id.
      await c
        .http()
        .get('/novedades/nov-mix-0')
        .set(bearer(lector.token))
        .expect(200);
    });

    it('400 con un motivo que no existe o una página de más de 200', async () => {
      for (const q of ['motivo=nada', 'porPagina=201', 'pagina=0']) {
        const r = await c
          .http()
          .get(`/rutas/${r2.id}/novedades?${q}`)
          .set(bearer(lector.token))
          .expect(400);
        esperarError(r.body, 'VALIDACION_FALLIDA');
      }
    });

    it('admin ve la ruta; otro lector, 403; ruta que no existe, 404; sin token, 401', async () => {
      await c
        .http()
        .get(`/rutas/${r2.id}/novedades`)
        .set(bearer(admin.token))
        .expect(200);
      esperarError(
        (
          await c
            .http()
            .get(`/rutas/${r2.id}/novedades`)
            .set(bearer(otro.token))
            .expect(403)
        ).body,
        'SIN_PERMISO',
      );
      esperarError(
        (
          await c
            .http()
            .get('/rutas/rut-99-2026-05/novedades')
            .set(bearer(lector.token))
            .expect(404)
        ).body,
        'RUTA_NO_ENCONTRADA',
      );
      await c.http().get(`/rutas/${r2.id}/novedades`).expect(401);
    });
  });

  describe('avance y descarga de la ruta (R10, R7)', () => {
    it('el avance cuenta lecturas y novedades vigentes, y los pendientes', async () => {
      const m = await crearRuta(c, { lectorId: lector.id, cantidad: 4 });
      const [s0, s1, s2] = m.suministroIds;
      const nov = (suministroId: string, id: string, hora: string) =>
        cargar(lector.token, {
          id,
          rutaId: m.id,
          suministroId,
          fechaHora: `2026-09-15T${hora}-03:00`,
        }).expect(201);
      await nov(s0, 'nov-av-0', '07:00:00');
      await nov(s1, 'nov-av-1', '07:10:00');
      await nov(s1, 'nov-av-1b', '07:20:00'); // mismo suministro: cuenta una
      await nov(s2, 'nov-av-2', '07:30:00');
      await c
        .http()
        .post('/lecturas')
        .set(bearer(lector.token))
        .send({
          rutaId: m.id,
          suministroId: s2,
          valor: 50,
          fotoUri: foto,
          coordenadas: null,
          fechaHora: '2026-09-15T07:40:00-03:00',
        })
        .expect(201);
      const r = await c
        .http()
        .get(`/rutas/${m.id}/avance`)
        .set(bearer(lector.token))
        .expect(200);
      esperarContrato(r.body, 'AvanceRuta');
      expect(r.body.datos).toMatchObject({
        suministros: 4,
        leidos: 1,
        conNovedad: 2,
        pendientes: 1,
      });
      const d = await c
        .http()
        .post(`/rutas/${m.id}/descarga`)
        .set(bearer(lector.token))
        .expect(200);
      esperarContrato(d.body, 'PaqueteRuta');
      expect(ids({ datos: d.body.datos.novedades })).toEqual([
        'nov-av-0',
        'nov-av-1b',
      ]);
      expect(d.body.datos.lecturas).toHaveLength(1);
    });
  });

  describe('GET /novedades (administración)', () => {
    let a: { id: string; suministroIds: string[] };
    let b: { id: string; suministroIds: string[] };

    beforeAll(async () => {
      a = await crearRuta(c, {
        lectorId: lector.id,
        nombre: 'Zona Admin A',
        bimestre: '2026-03',
        cantidad: 3,
      });
      b = await crearRuta(c, {
        lectorId: otro.id,
        nombre: 'Zona Admin B',
        bimestre: '2026-04',
        cantidad: 2,
      });
      const poner = (
        token: string,
        ruta: { id: string; suministroIds: string[] },
        i: number,
        id: string,
        motivo: string,
        fechaHora: string,
      ) =>
        cargar(token, {
          id,
          rutaId: ruta.id,
          suministroId: ruta.suministroIds[i],
          motivo,
          fechaHora,
        }).expect(201);
      await poner(
        lector.token,
        a,
        0,
        'nov-ad-1',
        'perro_suelto',
        '2026-09-14T10:00:00-03:00',
      );
      await poner(
        lector.token,
        a,
        1,
        'nov-ad-2',
        'perro_suelto',
        '2026-09-14T23:30:00-03:00',
      );
      await poner(
        lector.token,
        a,
        2,
        'nov-ad-3',
        'pasto_alto',
        '2026-09-15T00:10:00-03:00',
      );
      await poner(
        otro.token,
        b,
        0,
        'nov-ad-4',
        'perro_suelto',
        '2026-09-15T07:00:00-03:00',
      );
      await poner(
        otro.token,
        b,
        1,
        'nov-ad-5',
        'medidor_roto',
        '2026-09-13T07:00:00-03:00',
      );
    });

    const listar = (q: string) =>
      c.http().get(`/novedades?${q}`).set(bearer(admin.token));

    it('ordena por fechaHora descendente y cumple el contrato', async () => {
      const r = await listar('zona=Zona Admin A&porPagina=100').expect(200);
      esperarContrato(r.body, 'Novedad');
      expect(ids(r.body)).toEqual(['nov-ad-3', 'nov-ad-2', 'nov-ad-1']);
    });

    it('filtra por motivo, zona (sin importar mayúsculas ni tildes) y bimestre', async () => {
      expect(
        ids(
          (await listar('motivo=perro_suelto&bimestre=2026-03').expect(200))
            .body,
        ),
      ).toEqual(['nov-ad-2', 'nov-ad-1']);
      expect(ids((await listar('zona=zona admin b').expect(200)).body)).toEqual(
        ['nov-ad-4', 'nov-ad-5'],
      );
      expect(ids((await listar('bimestre=2026-04').expect(200)).body)).toEqual([
        'nov-ad-4',
        'nov-ad-5',
      ]);
    });

    it('desde y hasta son días de Argentina, y los dos extremos entran', async () => {
      const r = await listar(
        'bimestre=2026-03&desde=2026-09-14&hasta=2026-09-14',
      ).expect(200);
      expect(ids(r.body)).toEqual(['nov-ad-2', 'nov-ad-1']);
      const s = await listar('zona=Zona Admin A&desde=2026-09-15').expect(200);
      expect(ids(s.body)).toEqual(['nov-ad-3']);
    });

    it('pagina con el total filtrado', async () => {
      const r = await listar('zona=Zona Admin A&porPagina=2&pagina=2').expect(
        200,
      );
      expect(ids(r.body)).toEqual(['nov-ad-1']);
      expect(r.body.meta).toEqual({ total: 3, pagina: 2, porPagina: 2 });
    });

    it('R19: sólo lista las vigentes', async () => {
      const r = await listar('porPagina=100').expect(200);
      expect(ids(r.body)).not.toContain('nov-mix-0');
      expect(ids(r.body)).toContain('nov-mix-1');
    });

    it('una zona sin novedades da una lista vacía', async () => {
      const r = await listar('zona=No existe').expect(200);
      expect(r.body).toEqual({
        datos: [],
        meta: { total: 0, pagina: 1, porPagina: 20 },
      });
    });

    it.each([
      'motivo=nada',
      'bimestre=2026-13',
      'desde=ayer',
      'hasta=2026-02-31',
      'porPagina=101',
    ])('400 con %s', async (q) => {
      esperarError((await listar(q).expect(400)).body, 'VALIDACION_FALLIDA');
    });

    it('403 para un lector y 401 sin token', async () => {
      const r = await c
        .http()
        .get('/novedades')
        .set(bearer(lector.token))
        .expect(403);
      esperarError(r.body, 'SIN_PERMISO');
      await c.http().get('/novedades').expect(401);
    });
  });

  describe('GET /novedades/resumen (administración)', () => {
    const resumen = (q = '') =>
      c.http().get(`/novedades/resumen${q}`).set(bearer(admin.token));

    it('R19: agrupa por motivo y zona, ordenado por cantidad desc, motivo y zona', async () => {
      const r = await resumen('?bimestre=2026-03').expect(200);
      esperarContrato(r.body, 'ResumenNovedades');
      expect(r.body.datos).toEqual([
        { motivo: 'perro_suelto', zona: 'Zona Admin A', cantidad: 2 },
        { motivo: 'pasto_alto', zona: 'Zona Admin A', cantidad: 1 },
      ]);
      expect(r.body.meta).toEqual({ total: 2, pagina: 1, porPagina: 20 });
    });

    it('sin bimestre usa el actual (septiembre = 2026-05) y cuenta sólo las vigentes', async () => {
      const r = await resumen('?porPagina=100').expect(200);
      const grupo = (motivo: string, zona: string) =>
        (
          r.body.datos as { motivo: string; zona: string; cantidad: number }[]
        ).find((g) => g.motivo === motivo && g.zona === zona)?.cantidad;
      expect(grupo('perro_suelto', 'Barrio Dos')).toBe(2);
      expect(grupo('pasto_alto', 'Barrio Dos')).toBe(1);
      expect(grupo('deshabitada', 'Barrio Dos')).toBe(1);
      // La vieja de ese suministro (portón cerrado) no cuenta.
      expect(grupo('porton_cerrado', 'Barrio Dos')).toBeUndefined();
      // Las del bimestre 2026-03 no entran.
      expect(grupo('perro_suelto', 'Zona Admin A')).toBeUndefined();
    });

    it('un bimestre sin novedades da una lista vacía', async () => {
      const r = await resumen('?bimestre=2025-01').expect(200);
      expect(r.body).toEqual({
        datos: [],
        meta: { total: 0, pagina: 1, porPagina: 20 },
      });
    });

    it('400 con un bimestre inválido; 403 a un lector; 401 sin token', async () => {
      esperarError(
        (await resumen('?bimestre=2026-07').expect(400)).body,
        'VALIDACION_FALLIDA',
      );
      esperarError(
        (
          await c
            .http()
            .get('/novedades/resumen')
            .set(bearer(lector.token))
            .expect(403)
        ).body,
        'SIN_PERMISO',
      );
      await c.http().get('/novedades/resumen').expect(401);
    });
  });
});
