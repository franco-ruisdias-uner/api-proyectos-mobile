import type { Lectura } from '../../contract/types.js';
import { jpeg } from '../utilities/files.js';
import { type AppDePrueba, crearApp } from '../utilities/create-app.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import { crearRuta } from '../utilities/routes.js';
import { bearer, conSesion } from '../utilities/users.js';

const ids = (cuerpo: { datos: Lectura[] }) => cuerpo.datos.map((l) => l.id);

describe('M3 — Lecturas', () => {
  let c: AppDePrueba;
  let lector: { id: string; token: string };
  let otro: { id: string; token: string };
  let admin: { token: string };
  let ruta: { id: string; suministroIds: string[] };
  let foto: string;

  beforeAll(async () => {
    c = await crearApp();
    lector = await conSesion(c, 'lector');
    otro = await conSesion(c, 'lector');
    admin = await conSesion(c, 'administracion');
    ruta = await crearRuta(c, {
      lectorId: lector.id,
      estado: 'en_curso',
      suministros: [
        { lecturaAnterior: 1284, consumoPromedio: 18 },
        { lecturaAnterior: null, consumoPromedio: null },
        {
          lecturaAnterior: 1000,
          consumoPromedio: 18,
          medidor: { multiplicador: 10 },
        },
        { lecturaAnterior: 1000, consumoPromedio: 18 },
      ],
    });
    const r = await c
      .http()
      .post('/archivos')
      .set(bearer(lector.token))
      .attach('archivo', jpeg(), 'foto.jpg')
      .expect(201);
    foto = r.body.datos.url as string;
  });
  afterAll(() => c.cerrar());

  const cuerpo = (resto: Record<string, unknown> = {}) => ({
    rutaId: ruta.id,
    suministroId: ruta.suministroIds[0],
    valor: 1302,
    fotoUri: foto,
    coordenadas: { latitud: -30.75, longitud: -57.98 },
    confirmadaPorLector: false,
    fechaHora: '2026-09-15T07:30:00-03:00',
    ...resto,
  });
  const cargar = (token: string, resto: Record<string, unknown> = {}) =>
    c
      .http()
      .post('/lecturas')
      .set(bearer(token))
      .set('Host', 'api.test:3000')
      .send(cuerpo(resto));

  describe('POST /lecturas', () => {
    it('R11/R14: crea la lectura, calcula consumo y lector, y cumple el contrato', async () => {
      const r = await cargar(lector.token, { id: 'lec-feliz1' }).expect(201);
      esperarContrato(r.body, 'Lectura');
      expect(r.body.datos).toMatchObject({
        id: 'lec-feliz1',
        lectorId: lector.id,
        valor: 1302,
        consumo: 18,
        fueraDeRango: false,
        sincronizada: true,
        fotoUri: `http://api.test:3000${new URL(foto).pathname}`,
        fechaHora: '2026-09-15T07:30:00-03:00',
        coordenadas: { latitud: -30.75, longitud: -57.98 },
      });
    });

    it('R11: sin id lo genera el servidor, con prefijo lec-', async () => {
      const r = await cargar(lector.token, {
        suministroId: ruta.suministroIds[3],
      }).expect(201);
      expect(r.body.datos.id).toMatch(/^lec-[a-z0-9]{12}$/);
    });

    it('R11: ignora lectorId, consumo, fueraDeRango y sincronizada que mande el cliente', async () => {
      const r = await cargar(lector.token, {
        id: 'lec-ignora1',
        suministroId: ruta.suministroIds[3],
        valor: 1010,
        lectorId: 'usr-otro',
        consumo: 99999,
        fueraDeRango: true,
        sincronizada: false,
      }).expect(201);
      expect(r.body.datos).toMatchObject({
        lectorId: lector.id,
        consumo: 10,
        fueraDeRango: false,
        sincronizada: true,
      });
    });

    it('R14: conexión nueva → consumo = valor × multiplicador (D5)', async () => {
      const r = await cargar(lector.token, {
        id: 'lec-nueva1',
        suministroId: ruta.suministroIds[1],
        valor: 12,
      }).expect(201);
      expect(r.body.datos.consumo).toBe(12);
    });

    it('R14: con multiplicador ×10', async () => {
      const r = await cargar(lector.token, {
        id: 'lec-mult1',
        suministroId: ruta.suministroIds[2],
        valor: 1005,
      }).expect(201);
      expect(r.body.datos.consumo).toBe(50);
    });

    it('R14/R16: consumo negativo se guarda tal cual y queda fuera de rango (D6)', async () => {
      const r = await cargar(lector.token, {
        id: 'lec-neg1',
        valor: 100,
      }).expect(201);
      expect(r.body.datos).toMatchObject({
        consumo: -1184,
        fueraDeRango: true,
      });
    });

    it('R16: el ejemplo del PRD (4520 contra 1284) se guarda, queda fuera de rango y confirmada se respeta', async () => {
      const r = await cargar(lector.token, {
        id: 'lec-fuera1',
        valor: 4520,
        confirmadaPorLector: true,
      }).expect(201);
      expect(r.body.datos).toMatchObject({
        consumo: 3236,
        fueraDeRango: true,
        confirmadaPorLector: true,
      });
    });

    it('R17: coordenadas null se guardan como null', async () => {
      const r = await cargar(lector.token, {
        id: 'lec-sin-gps',
        coordenadas: null,
      }).expect(201);
      expect(r.body.datos.coordenadas).toBeNull();
    });

    it('R14: no modifica la lectura anterior del suministro', async () => {
      const r = await c
        .http()
        .get(`/suministros/${ruta.suministroIds[0]}`)
        .set(bearer(lector.token))
        .expect(200);
      expect(r.body.datos.lecturaAnterior).toBe(1284);
    });

    it('R12: una lectura en una ruta asignada la pasa a en_curso', async () => {
      const asignada = await crearRuta(c, {
        lectorId: lector.id,
        estado: 'asignada',
        cantidad: 1,
      });
      await cargar(lector.token, {
        rutaId: asignada.id,
        suministroId: asignada.suministroIds[0],
        valor: 1010,
      }).expect(201);
      const r = await c
        .http()
        .get(`/rutas/${asignada.id}`)
        .set(bearer(lector.token))
        .expect(200);
      expect(r.body.datos.estado).toBe('en_curso');
    });

    describe('400 y 422', () => {
      it.each([
        ['falta la ruta', { rutaId: undefined }],
        ['falta el suministro', { suministroId: undefined }],
        ['falta el valor', { valor: undefined }],
        ['el valor es texto', { valor: '1302' }],
        ['falta la fecha', { fechaHora: undefined }],
        ['la fecha es cualquier cosa', { fechaHora: 'ayer' }],
        ['la fecha no dice la zona', { fechaHora: '2026-09-15T07:30:00' }],
        ['id con prefijo equivocado', { id: 'nov-1234' }],
        ['campo de más', { extra: 1 }],
        ['coordenadas incompletas', { coordenadas: { latitud: 1 } }],
        ['una fecha futura', { fechaHora: '2026-09-15T09:00:00-03:00' }],
      ])('400: %s', async (_caso, resto) => {
        const r = await cargar(lector.token, resto).expect(400);
        esperarError(r.body, 'VALIDACION_FALLIDA');
      });

      it('tolera 5 minutos de reloj desfasado', async () => {
        await cargar(lector.token, {
          id: 'lec-tolera1',
          suministroId: ruta.suministroIds[3],
          fechaHora: '2026-09-15T08:04:00-03:00',
        }).expect(201);
      });

      it.each([
        ['negativo', -1],
        ['con decimales', 10.5],
        ['más dígitos de los que tiene el medidor', 100000],
      ])('R12: valor %s → LECTURA_INVALIDA', async (_caso, valor) => {
        const r = await cargar(lector.token, { valor }).expect(422);
        esperarError(r.body, 'LECTURA_INVALIDA');
      });

      it.each([
        ['sin foto', { fotoUri: undefined }],
        ['foto null', { fotoUri: null }],
        ['foto vacía', { fotoUri: '' }],
      ])('R12: %s → FOTO_REQUERIDA', async (_caso, resto) => {
        const r = await cargar(lector.token, resto).expect(422);
        esperarError(r.body, 'FOTO_REQUERIDA');
      });

      it.each([
        ['file://', 'file:///data/user/0/foto.jpg'],
        ['otra URL', 'https://ejemplo.com/foto.jpg'],
        [
          'un archivo que no existe',
          'http://localhost/archivos/imagenes/2026/09/noexiste.jpg',
        ],
      ])('R12: foto %s → ARCHIVO_NO_SUBIDO', async (_caso, fotoUri) => {
        const r = await cargar(lector.token, { fotoUri }).expect(422);
        esperarError(r.body, 'ARCHIVO_NO_SUBIDO');
      });

      it('R12: un suministro que no es de la ruta → SUMINISTRO_FUERA_DE_RUTA', async () => {
        const ajena = await crearRuta(c, { lectorId: otro.id, cantidad: 1 });
        const r = await cargar(lector.token, {
          suministroId: ajena.suministroIds[0],
        }).expect(422);
        esperarError(r.body, 'SUMINISTRO_FUERA_DE_RUTA');
      });
    });

    describe('401, 403 y 404', () => {
      it('401 sin token', async () => {
        const r = await c.http().post('/lecturas').send(cuerpo()).expect(401);
        esperarError(r.body, 'NO_AUTENTICADO');
      });

      it('R3: la ruta de otro lector → 403', async () => {
        const r = await cargar(otro.token).expect(403);
        esperarError(r.body, 'SIN_PERMISO');
      });

      it('R12: administración tampoco carga lecturas → 403', async () => {
        const r = await cargar(admin.token).expect(403);
        esperarError(r.body, 'SIN_PERMISO');
      });

      it('R12: una ruta que no existe → RUTA_NO_ENCONTRADA', async () => {
        const r = await cargar(lector.token, {
          rutaId: 'rut-99-2026-05',
        }).expect(404);
        esperarError(r.body, 'RUTA_NO_ENCONTRADA');
      });
    });

    it('R22: cargar en una ruta cerrada → RUTA_YA_CERRADA con el mensaje del PRD', async () => {
      const cerrada = await crearRuta(c, {
        lectorId: lector.id,
        estado: 'cerrada',
        cantidad: 1,
      });
      const r = await cargar(lector.token, {
        rutaId: cerrada.id,
        suministroId: cerrada.suministroIds[0],
        valor: 1010,
      }).expect(409);
      esperarError(r.body, 'RUTA_YA_CERRADA');
      expect(r.body.error.mensaje).toBe('Esa ruta fue cerrada el 14/09.');
    });

    describe('R15 — idempotencia', () => {
      it('el mismo cuerpo dos veces deja una lectura y las dos respuestas son iguales', async () => {
        const datos = {
          id: 'lec-idem1',
          suministroId: ruta.suministroIds[3],
          valor: 1020,
        };
        const a = await cargar(lector.token, datos).expect(201);
        const b = await cargar(lector.token, datos).expect(200);
        expect(b.body).toEqual(a.body);
        const n = await c.dataSource
          .getRepository('LecturaEntidad')
          .countBy({ id: 'lec-idem1' });
        expect(n).toBe(1);
      });

      it('un id de otro lector → ID_EN_USO', async () => {
        const otraRuta = await crearRuta(c, {
          lectorId: otro.id,
          cantidad: 1,
        });
        const r = await c
          .http()
          .post('/lecturas')
          .set(bearer(otro.token))
          .send(
            cuerpo({
              id: 'lec-feliz1',
              rutaId: otraRuta.id,
              suministroId: otraRuta.suministroIds[0],
            }),
          )
          .expect(409);
        esperarError(r.body, 'ID_EN_USO');
      });

      it('el reintento de una lectura ya recibida responde 200 aunque la ruta se haya cerrado', async () => {
        const r2 = await crearRuta(c, {
          lectorId: lector.id,
          estado: 'en_curso',
          cantidad: 1,
        });
        const datos = {
          id: 'lec-cierre1',
          rutaId: r2.id,
          suministroId: r2.suministroIds[0],
          valor: 1010,
        };
        await cargar(lector.token, datos).expect(201);
        await c.dataSource
          .getRepository('RutaEntidad')
          .update(
            { id: r2.id },
            { estado: 'cerrada', cerradaEn: c.reloj.ahora() },
          );
        await cargar(lector.token, datos).expect(200);
      });

      it('dos pedidos simultáneos con el mismo id: uno crea y el otro devuelve la existente', async () => {
        const datos = {
          id: 'lec-simul1',
          suministroId: ruta.suministroIds[3],
          valor: 1030,
        };
        const [a, b] = await Promise.all([
          cargar(lector.token, datos),
          cargar(lector.token, datos),
        ]);
        expect([a.status, b.status].sort()).toEqual([200, 201]);
        expect(a.body).toEqual(b.body);
      });
    });
  });

  describe('R13 — un solo resultado vigente por suministro', () => {
    it('gana la de fechaHora más reciente aunque llegue antes; la otra no se borra', async () => {
      const r = await crearRuta(c, {
        lectorId: lector.id,
        estado: 'en_curso',
        cantidad: 2,
      });
      const s = r.suministroIds[0];
      await cargar(lector.token, {
        id: 'lec-vig-b',
        rutaId: r.id,
        suministroId: s,
        valor: 1050,
        fechaHora: '2026-09-15T07:10:00-03:00',
      }).expect(201);
      await cargar(lector.token, {
        id: 'lec-vig-a',
        rutaId: r.id,
        suministroId: s,
        valor: 1040,
        fechaHora: '2026-09-15T07:00:00-03:00',
      }).expect(201);
      const lista = await c
        .http()
        .get(`/rutas/${r.id}/lecturas`)
        .set(bearer(lector.token))
        .expect(200);
      expect(ids(lista.body)).toEqual(['lec-vig-b']);
      await c
        .http()
        .get('/lecturas/lec-vig-a')
        .set(bearer(lector.token))
        .expect(200);
    });
  });

  describe('GET /lecturas/:id', () => {
    it('el dueño de la ruta la ve y cumple el contrato', async () => {
      const r = await c
        .http()
        .get('/lecturas/lec-feliz1')
        .set(bearer(lector.token))
        .expect(200);
      esperarContrato(r.body, 'Lectura');
    });
    it('administración la ve', async () => {
      await c
        .http()
        .get('/lecturas/lec-feliz1')
        .set(bearer(admin.token))
        .expect(200);
    });
    it('otro lector → 403', async () => {
      const r = await c
        .http()
        .get('/lecturas/lec-feliz1')
        .set(bearer(otro.token))
        .expect(403);
      esperarError(r.body, 'SIN_PERMISO');
    });
    it('que no existe → 404', async () => {
      const r = await c
        .http()
        .get('/lecturas/lec-nadaaqui')
        .set(bearer(lector.token))
        .expect(404);
      esperarError(r.body, 'LECTURA_NO_ENCONTRADA');
    });
    it('id con otro prefijo → 400', async () => {
      await c
        .http()
        .get('/lecturas/nov-123')
        .set(bearer(lector.token))
        .expect(400);
    });
    it('sin token → 401', async () => {
      await c.http().get('/lecturas/lec-feliz1').expect(401);
    });
  });

  describe('GET /rutas/:id/lecturas', () => {
    let r: { id: string; suministroIds: string[] };
    beforeAll(async () => {
      r = await crearRuta(c, {
        lectorId: lector.id,
        estado: 'en_curso',
        cantidad: 4,
      });
      const [s0, s1, , s3] = r.suministroIds;
      // Se cargan fuera de orden: la lista sale en orden de recorrido (R4).
      for (const [id, s, valor] of [
        ['lec-lis-3', s3, 1010],
        ['lec-lis-1', s1, 1500],
        ['lec-lis-0', s0, 1010],
      ] as const) {
        await cargar(lector.token, {
          id,
          rutaId: r.id,
          suministroId: s,
          valor,
        }).expect(201);
      }
    });
    const pedir = (token: string, consulta = '') =>
      c.http().get(`/rutas/${r.id}/lecturas${consulta}`).set(bearer(token));

    it('lista las vigentes en el orden del recorrido, con meta y contrato', async () => {
      const res = await pedir(lector.token).expect(200);
      esperarContrato(res.body, 'Lectura');
      expect(ids(res.body)).toEqual(['lec-lis-0', 'lec-lis-1', 'lec-lis-3']);
      expect(res.body.meta).toEqual({ total: 3, pagina: 1, porPagina: 50 });
    });
    it('pagina', async () => {
      const res = await pedir(lector.token, '?pagina=2&porPagina=2').expect(
        200,
      );
      expect(ids(res.body)).toEqual(['lec-lis-3']);
      expect(res.body.meta).toEqual({ total: 3, pagina: 2, porPagina: 2 });
    });
    it('una página fuera de rango da datos vacíos con el total', async () => {
      const res = await pedir(lector.token, '?pagina=9').expect(200);
      expect(res.body).toEqual({
        datos: [],
        meta: { total: 3, pagina: 9, porPagina: 50 },
      });
    });
    it('filtra por fueraDeRango', async () => {
      const si = await pedir(lector.token, '?fueraDeRango=true').expect(200);
      expect(ids(si.body)).toEqual(['lec-lis-1']);
      const no = await pedir(lector.token, '?fueraDeRango=false').expect(200);
      expect(ids(no.body)).toEqual(['lec-lis-0', 'lec-lis-3']);
    });
    it('porPagina máximo 200; fueraDeRango inválido → 400', async () => {
      await pedir(lector.token, '?porPagina=200').expect(200);
      const res = await pedir(lector.token, '?porPagina=201').expect(400);
      esperarError(res.body, 'VALIDACION_FALLIDA');
      await pedir(lector.token, '?fueraDeRango=quizas').expect(400);
    });
    it('lista vacía', async () => {
      const vacia = await crearRuta(c, { lectorId: lector.id, cantidad: 1 });
      const res = await c
        .http()
        .get(`/rutas/${vacia.id}/lecturas`)
        .set(bearer(lector.token))
        .expect(200);
      expect(res.body).toEqual({
        datos: [],
        meta: { total: 0, pagina: 1, porPagina: 50 },
      });
    });
    it('administración la ve; otro lector → 403; sin token → 401; ruta inexistente → 404', async () => {
      await pedir(admin.token).expect(200);
      const prohibido = await pedir(otro.token).expect(403);
      esperarError(prohibido.body, 'SIN_PERMISO');
      await c.http().get(`/rutas/${r.id}/lecturas`).expect(401);
      const no = await c
        .http()
        .get('/rutas/rut-99-2026-05/lecturas')
        .set(bearer(lector.token))
        .expect(404);
      esperarError(no.body, 'RUTA_NO_ENCONTRADA');
    });
  });

  describe('R7 y R10 — descarga y avance cuentan las lecturas vigentes', () => {
    it('el paquete trae las lecturas vigentes en orden y el avance las cuenta', async () => {
      const r = await crearRuta(c, {
        lectorId: lector.id,
        estado: 'en_curso',
        cantidad: 3,
      });
      await cargar(lector.token, {
        id: 'lec-av-1',
        rutaId: r.id,
        suministroId: r.suministroIds[1],
        valor: 1010,
      }).expect(201);
      await cargar(lector.token, {
        id: 'lec-av-0',
        rutaId: r.id,
        suministroId: r.suministroIds[0],
        valor: 5000,
      }).expect(201);
      const pq = await c
        .http()
        .post(`/rutas/${r.id}/descarga`)
        .set(bearer(lector.token))
        .expect(200);
      esperarContrato(pq.body, 'PaqueteRuta');
      expect(pq.body.datos.lecturas.map((l: Lectura) => l.id)).toEqual([
        'lec-av-0',
        'lec-av-1',
      ]);
      const av = await c
        .http()
        .get(`/rutas/${r.id}/avance`)
        .set(bearer(lector.token))
        .expect(200);
      expect(av.body.datos).toEqual({
        rutaId: r.id,
        suministros: 3,
        leidos: 2,
        conNovedad: 0,
        pendientes: 1,
        fueraDeRango: 1,
      });
    });
  });
});
