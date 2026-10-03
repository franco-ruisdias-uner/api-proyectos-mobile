import { Comercio } from '../../src/modulos/comercios/comercio.entidad.js';
import { Promocion } from '../../src/modulos/promociones/promocion.entidad.js';
import { jpeg, mp4 } from '../utilidades/archivos.js';
import { crearComercio, crearRubro } from '../utilidades/comercios.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { crearPromocion, enDias } from '../utilidades/promociones.js';
import { crearUsuario, type UsuarioDePrueba } from '../utilidades/usuarios.js';

describe('PRD §6 — Panel del comercio', () => {
  let t: AppDePrueba;
  let tornillo: UsuarioDePrueba;
  let otro: UsuarioDePrueba;
  let vecino: UsuarioDePrueba;

  beforeAll(async () => {
    t = await crearApp();
    await crearRubro(t, { id: 'rub-prueba' });
    await crearComercio(t, { id: 'com-118', nombre: 'Ferretería El Tornillo' });
    await crearComercio(t, { id: 'com-201', nombre: 'Panadería Otra' });
    tornillo = await crearUsuario(t, { rol: 'comercio', comercioId: 'com-118' });
    otro = await crearUsuario(t, { rol: 'comercio', comercioId: 'com-201' });
    vecino = await crearUsuario(t);
  });
  afterAll(() => t.cerrar());

  const subir = async (archivo: Buffer) => {
    const res = await t
      .http()
      .post('/archivos')
      .set(vecino.auth)
      .attach('archivo', archivo, { filename: 'a.bin' })
      .expect(201);
    return res.body.datos.url as string;
  };
  /** El origen sale del Host de cada pedido (supertest usa un puerto por pedido): se compara la ruta. */
  const ruta = (url: string) => new URL(url).pathname;
  const comercioEnBase = () =>
    t.dataSource.getRepository(Comercio).findOneByOrFail({ id: 'com-118' });
  const estadoOriginal = async () => {
    await t.dataSource.getRepository(Comercio).update(
      { id: 'com-118' },
      {
        nombre: 'Ferretería El Tornillo',
        horarios: [{ dia: 1, abre: '08:00', cierra: '12:00' }],
        imagenes: [],
        videoClave: null,
        cerradoHasta: null,
        activo: true,
        mediosDePago: ['efectivo'],
        telefono: null,
        whatsapp: null,
        instagram: null,
      },
    );
  };

  describe('acceso (todos los endpoints del panel)', () => {
    const rutas: [string, string][] = [
      ['get', '/mi-comercio'],
      ['patch', '/mi-comercio'],
      ['get', '/mi-comercio/promociones'],
      ['post', '/mi-comercio/promociones'],
      ['patch', '/mi-comercio/promociones/pro-abc'],
      ['delete', '/mi-comercio/promociones/pro-abc'],
    ];
    it.each(rutas)('%s %s sin token → 401 NO_AUTENTICADO', async (metodo, ruta) => {
      const res = await t.http()[metodo as 'get'](ruta).send({});
      expect(res.status).toBe(401);
      esperarError(res.body, 'NO_AUTENTICADO');
    });
    it.each(rutas)('%s %s con cuenta de vecino → 403 SIN_PERMISO', async (metodo, ruta) => {
      const res = await t.http()[metodo as 'get'](ruta).set(vecino.auth).send({});
      expect(res.status).toBe(403);
      esperarError(res.body, 'SIN_PERMISO');
    });
    it('una cuenta de comercio sin comercio asignado → 403 SIN_PERMISO', async () => {
      const huerfano = await crearUsuario(t, { rol: 'comercio', comercioId: null });
      const res = await t.http().get('/mi-comercio').set(huerfano.auth).expect(403);
      esperarError(res.body, 'SIN_PERMISO');
    });
  });

  describe('GET /mi-comercio', () => {
    it('200 con su Comercio, forma exacta del contrato', async () => {
      const res = await t.http().get('/mi-comercio').set(tornillo.auth).expect(200);
      esperarContrato(res.body, 'Comercio');
      expect(res.body.meta).toBeNull();
      expect(res.body.datos.id).toBe('com-118');
      expect(res.body.datos.codigoQr).toBe('CCU:com-118');
    });
    it('también si está dado de baja (activo: false)', async () => {
      const baja = await crearComercio(t, { id: 'com-baja', activo: false });
      const u = await crearUsuario(t, { rol: 'comercio', comercioId: baja.id });
      const res = await t.http().get('/mi-comercio').set(u.auth).expect(200);
      expect(res.body.datos.activo).toBe(false);
    });
  });

  describe('PATCH /mi-comercio', () => {
    beforeEach(estadoOriginal);
    const patch = (cuerpo: object, u = tornillo) =>
      t.http().patch('/mi-comercio').set(u.auth).send(cuerpo);

    it('200: cambia datos y devuelve el Comercio entero; también lo ve el público', async () => {
      const res = await patch({
        nombre: '  El Tornillo SRL ',
        descripcion: 'Todo para el hogar y la obra.',
        direccion: '9 de Julio 500',
        coordenadas: { latitud: -32.48, longitud: -58.23 },
        telefono: '3442 421000',
        whatsapp: '5493442421000',
        instagram: '@eltornillo',
      }).expect(200);
      esperarContrato(res.body, 'Comercio');
      expect(res.body.datos).toMatchObject({
        id: 'com-118',
        nombre: 'El Tornillo SRL',
        descripcion: 'Todo para el hogar y la obra.',
        direccion: '9 de Julio 500',
        coordenadas: { latitud: -32.48, longitud: -58.23 },
        telefono: '3442 421000',
        whatsapp: '5493442421000',
        instagram: '@eltornillo',
      });
      const publico = await t.http().get('/comercios/com-118').expect(200);
      expect(publico.body.datos).toEqual(res.body.datos);
    });

    it('la búsqueda sigue a los cambios de nombre y descripción (sin tildes)', async () => {
      await patch({ nombre: 'Cerrajería Ñandú', descripcion: 'Llaves y candados' }).expect(200);
      const res = await t.http().get('/comercios?q=nandu').expect(200);
      expect(res.body.datos.map((c: { id: string }) => c.id)).toContain('com-118');
      const desc = await t.http().get('/comercios?q=candados').expect(200);
      expect(desc.body.datos.map((c: { id: string }) => c.id)).toContain('com-118');
    });

    it('{} no cambia nada', async () => {
      const antes = await t.http().get('/mi-comercio').set(tornillo.auth);
      const res = await patch({}).expect(200);
      expect(res.body.datos).toEqual(antes.body.datos);
    });

    it('teléfono, WhatsApp e Instagram se pueden vaciar con null', async () => {
      await patch({ telefono: '123', whatsapp: '5493442421000', instagram: '@x' }).expect(200);
      const res = await patch({ telefono: null, whatsapp: null, instagram: null }).expect(200);
      expect(res.body.datos).toMatchObject({ telefono: null, whatsapp: null, instagram: null });
    });

    it('horarios: reemplaza la lista y sale ordenada, un elemento por tramo', async () => {
      const res = await patch({
        horarios: [
          { dia: 6, abre: '08:00', cierra: '13:00' },
          { dia: 1, abre: '16:30', cierra: '20:30' },
          { dia: 1, abre: '08:00', cierra: '12:00' },
        ],
      }).expect(200);
      expect(res.body.datos.horarios).toEqual([
        { dia: 1, abre: '08:00', cierra: '12:00' },
        { dia: 1, abre: '16:30', cierra: '20:30' },
        { dia: 6, abre: '08:00', cierra: '13:00' },
      ]);
    });

    it('horarios: [] vacía los horarios', async () => {
      const res = await patch({ horarios: [] }).expect(200);
      expect(res.body.datos.horarios).toEqual([]);
    });

    it('R2: tramos que se pisan el mismo día → 422 HORARIOS_SUPERPUESTOS y no guarda nada', async () => {
      const res = await patch({
        nombre: 'No tiene que quedar',
        horarios: [
          { dia: 2, abre: '08:00', cierra: '12:00' },
          { dia: 2, abre: '11:00', cierra: '13:00' },
        ],
      }).expect(422);
      esperarError(res.body, 'HORARIOS_SUPERPUESTOS');
      expect((await comercioEnBase()).nombre).toBe('Ferretería El Tornillo');
    });

    it.each([
      ['abre igual que cierra', { dia: 1, abre: '08:00', cierra: '08:00' }],
      ['abre después de cerrar', { dia: 1, abre: '20:00', cierra: '08:00' }],
      ['hora mal escrita', { dia: 1, abre: '8:00', cierra: '12:00' }],
      ['hora 24:00', { dia: 1, abre: '08:00', cierra: '24:00' }],
      ['día 7', { dia: 7, abre: '08:00', cierra: '12:00' }],
      ['día como texto', { dia: '1', abre: '08:00', cierra: '12:00' }],
      ['campo de más', { dia: 1, abre: '08:00', cierra: '12:00', nota: 'x' }],
      ['sin cierra', { dia: 1, abre: '08:00' }],
    ])('R2: tramo inválido (%s) → 400', async (_n, tramo) => {
      const res = await patch({ horarios: [tramo] }).expect(400);
      esperarError(res.body, 'VALIDACION_FALLIDA');
    });

    it('R14: medios de pago del catálogo; los repetidos se juntan', async () => {
      const res = await patch({
        mediosDePago: ['debito', 'efectivo', 'debito', 'billetera_virtual'],
      }).expect(200);
      expect(res.body.datos.mediosDePago).toEqual(['debito', 'efectivo', 'billetera_virtual']);
      const vacio = await patch({ mediosDePago: [] }).expect(200);
      expect(vacio.body.datos.mediosDePago).toEqual([]);
    });

    it('R14: un medio de pago que no está en el catálogo → 400', async () => {
      const res = await patch({ mediosDePago: ['efectivo', 'trueque'] }).expect(400);
      esperarError(res.body, 'VALIDACION_FALLIDA');
    });

    it.each([
      ['con signos', '+54 9 3442 421000'],
      ['con letras', '54934424abc'],
      ['demasiado corto', '12345'],
      ['vacío', ''],
    ])('R14: WhatsApp inválido (%s) → 400', async (_n, whatsapp) => {
      const res = await patch({ whatsapp }).expect(400);
      esperarError(res.body, 'VALIDACION_FALLIDA');
    });

    it.each([
      ['sin arroba', 'eltornillo'],
      ['sólo la arroba', '@'],
      ['con espacios', '@el tornillo'],
      ['vacío', ''],
    ])('R14: Instagram inválido (%s) → 400', async (_n, instagram) => {
      const res = await patch({ instagram }).expect(400);
      esperarError(res.body, 'VALIDACION_FALLIDA');
    });

    it('R14: fotos y video de /archivos; devuelve URLs absolutas del mismo origen', async () => {
      const f1 = await subir(jpeg());
      const f2 = await subir(jpeg(2000));
      const v = await subir(mp4());
      const res = await patch({ imagenes: [f1, f2], videoUrl: v }).expect(200);
      esperarContrato(res.body, 'Comercio');
      expect(res.body.datos.imagenes.map(ruta)).toEqual([ruta(f1), ruta(f2)]);
      expect(ruta(res.body.datos.videoUrl)).toBe(ruta(v));
      await t.http().get(new URL(f1).pathname).expect(200);
      const sinVideo = await patch({ videoUrl: null, imagenes: [] }).expect(200);
      expect(sinVideo.body.datos).toMatchObject({ videoUrl: null, imagenes: [] });
    });

    it('R14: una foto de otro sitio, un file:// o una que no se subió → 422 ARCHIVO_NO_SUBIDO', async () => {
      const buena = await subir(jpeg());
      const inexistente = buena.replace(/[a-z0-9]{16}\.jpg$/, 'zzzzzzzzzzzzzzzz.jpg');
      for (const url of [
        'https://ejemplo.com/foto.jpg',
        'file:///data/foto.jpg',
        inexistente,
        'no es una url',
      ]) {
        const res = await patch({ imagenes: [buena, url] }).expect(422);
        esperarError(res.body, 'ARCHIVO_NO_SUBIDO');
      }
      expect((await comercioEnBase()).imagenes).toEqual([]);
    });

    it('R14: un video en imagenes, o una foto en videoUrl → 422 ARCHIVO_NO_SUBIDO', async () => {
      const foto = await subir(jpeg());
      const video = await subir(mp4());
      esperarError((await patch({ imagenes: [video] }).expect(422)).body, 'ARCHIVO_NO_SUBIDO');
      esperarError((await patch({ videoUrl: foto }).expect(422)).body, 'ARCHIVO_NO_SUBIDO');
    });

    it('R14: hasta 8 imágenes; 9 → 400', async () => {
      const url = await subir(jpeg());
      await patch({ imagenes: Array(8).fill(url) }).expect(200);
      const res = await patch({ imagenes: Array(9).fill(url) }).expect(400);
      esperarError(res.body, 'VALIDACION_FALLIDA');
    });

    it('D2: cerradoHasta deja los horarios vacíos mientras dura y vuelven después', async () => {
      await patch({
        horarios: [{ dia: 1, abre: '08:00', cierra: '12:00' }],
        cerradoHasta: '2026-10-10',
      }).expect(200);
      const cerrado = await t.http().get('/comercios/com-118').expect(200);
      expect(cerrado.body.datos.horarios).toEqual([]);
      await patch({ cerradoHasta: null }).expect(200);
      const abierto = await t.http().get('/comercios/com-118').expect(200);
      expect(abierto.body.datos.horarios).toHaveLength(1);
      // El contrato no cambia: no aparece ningún campo nuevo.
      esperarContrato(abierto.body, 'Comercio');
    });

    it.each([['10/10/2026'], ['2026-02-30'], [12345]])(
      'D2: cerradoHasta inválido (%s) → 400',
      async (valor) => {
        const res = await patch({ cerradoHasta: valor }).expect(400);
        esperarError(res.body, 'VALIDACION_FALLIDA');
      },
    );

    it.each([
      ['activo', { activo: false }],
      ['puntaje', { puntaje: 5 }],
      ['cantidadResenas', { cantidadResenas: 99 }],
      ['id', { id: 'com-999' }],
      ['rubroId', { rubroId: 'rub-otro' }],
      ['codigoQr', { codigoQr: 'CCU:com-1' }],
    ])('no se puede tocar «%s» desde acá → 400 y no cambia', async (_n, cuerpo) => {
      const res = await patch(cuerpo).expect(400);
      esperarError(res.body, 'VALIDACION_FALLIDA');
      const c = await comercioEnBase();
      expect(c.activo).toBe(true);
      expect(c.puntaje).toBe(0);
      expect(c.rubroId).toBe('rub-prueba');
    });

    it.each([
      ['nombre vacío', { nombre: '   ' }],
      ['nombre null', { nombre: null }],
      ['nombre demasiado largo', { nombre: 'x'.repeat(121) }],
      ['descripción null', { descripcion: null }],
      ['latitud fuera de rango', { coordenadas: { latitud: 91, longitud: 0 } }],
      ['coordenadas incompletas', { coordenadas: { latitud: -32 } }],
      ['mediosDePago null', { mediosDePago: null }],
      ['horarios null', { horarios: null }],
    ])('400 por %s', async (_n, cuerpo) => {
      const res = await patch(cuerpo).expect(400);
      esperarError(res.body, 'VALIDACION_FALLIDA');
    });

    it('cada comercio edita sólo el suyo: no hay forma de apuntar a otro', async () => {
      await patch({ nombre: 'Nuevo nombre de 201' }, otro).expect(200);
      expect((await comercioEnBase()).nombre).toBe('Ferretería El Tornillo');
      const c201 = await t.dataSource.getRepository(Comercio).findOneByOrFail({ id: 'com-201' });
      expect(c201.nombre).toBe('Nuevo nombre de 201');
      await patch({ nombre: 'Panadería Otra' }, otro).expect(200);
    });
  });

  describe('GET /mi-comercio/promociones', () => {
    it('lista TODAS las suyas (vencidas, dadas de baja, próximas), con usos, y ninguna ajena', async () => {
      const c = await crearComercio(t, { id: 'com-lista' });
      const u = await crearUsuario(t, { rol: 'comercio', comercioId: c.id });
      await crearPromocion(t, { id: 'pro-vigente', comercioId: c.id, usos: 7 });
      await crearPromocion(t, {
        id: 'pro-vencida',
        comercioId: c.id,
        desde: enDias(t, -20),
        hasta: enDias(t, -10),
      });
      await crearPromocion(t, { id: 'pro-baja', comercioId: c.id, activa: false });
      await crearPromocion(t, {
        id: 'pro-proxima',
        comercioId: c.id,
        desde: enDias(t, 2),
        hasta: enDias(t, 9),
      });
      await crearPromocion(t, { id: 'pro-ajena', comercioId: 'com-201' });
      const res = await t.http().get('/mi-comercio/promociones').set(u.auth).expect(200);
      esperarContrato(res.body, 'Promocion');
      expect(res.body.meta).toEqual({ total: 4, pagina: 1, porPagina: 20 });
      // Más nueva primero (por `desde`, descendente; el empate, por id descendente).
      expect(res.body.datos.map((p: { id: string }) => p.id)).toEqual([
        'pro-proxima',
        'pro-vigente',
        'pro-baja',
        'pro-vencida',
      ]);
      const porId = Object.fromEntries(res.body.datos.map((p: { id: string }) => [p.id, p]));
      expect(porId['pro-vigente'].usos).toBe(7);
      expect(porId['pro-baja'].activa).toBe(false);
      expect(porId['pro-ajena']).toBeUndefined();
    });

    it('lista vacía y paginación', async () => {
      const c = await crearComercio(t, { id: 'com-pag' });
      const u = await crearUsuario(t, { rol: 'comercio', comercioId: c.id });
      const vacia = await t.http().get('/mi-comercio/promociones').set(u.auth).expect(200);
      expect(vacia.body).toEqual({ datos: [], meta: { total: 0, pagina: 1, porPagina: 20 } });
      for (let i = 1; i <= 3; i++) {
        await crearPromocion(t, { id: `pro-pag${i}`, comercioId: c.id, desde: enDias(t, -i) });
      }
      const p2 = await t
        .http()
        .get('/mi-comercio/promociones?pagina=2&porPagina=2')
        .set(u.auth)
        .expect(200);
      expect(p2.body.meta).toEqual({ total: 3, pagina: 2, porPagina: 2 });
      expect(p2.body.datos.map((p: { id: string }) => p.id)).toEqual(['pro-pag3']);
      const fuera = await t.http().get('/mi-comercio/promociones?pagina=9').set(u.auth).expect(200);
      expect(fuera.body.datos).toEqual([]);
      expect(fuera.body.meta.total).toBe(3);
      await t.http().get('/mi-comercio/promociones?porPagina=101').set(u.auth).expect(400);
    });
  });

  describe('POST /mi-comercio/promociones', () => {
    const crear = (cuerpo: object, u = tornillo) =>
      t.http().post('/mi-comercio/promociones').set(u.auth).send(cuerpo);
    const valida = () => ({
      titulo: '15% en pinturas',
      detalle: 'Válido en pinturas de todas las marcas.',
      descuento: 15,
      desde: '2026-10-01T00:00:00-03:00',
      hasta: '2026-10-31T23:59:59-03:00',
    });

    it('201: crea con id pro-, del comercio de la sesión, activa y con 0 usos', async () => {
      const res = await crear({ ...valida(), soloApp: true }).expect(201);
      esperarContrato(res.body, 'Promocion');
      expect(res.body.meta).toBeNull();
      expect(res.body.datos).toMatchObject({
        comercioId: 'com-118',
        titulo: '15% en pinturas',
        descuento: 15,
        desde: '2026-10-01T00:00:00-03:00',
        hasta: '2026-10-31T23:59:59-03:00',
        imagenUrl: null,
        soloApp: true,
        usos: 0,
        activa: true,
      });
      expect(res.body.datos.id).toMatch(/^pro-[a-z0-9]{12}$/);
      const publica = await t.http().get(`/promociones/${res.body.datos.id}`).expect(200);
      expect(publica.body.datos).toEqual(res.body.datos);
    });

    it('acepta fechas con Z u otro offset y las devuelve con -03:00', async () => {
      const res = await crear({
        ...valida(),
        desde: '2026-10-01T03:00:00Z',
        hasta: '2026-11-01T02:59:59Z',
      }).expect(201);
      expect(res.body.datos.desde).toBe('2026-10-01T00:00:00-03:00');
      expect(res.body.datos.hasta).toBe('2026-10-31T23:59:59-03:00');
    });

    it('sin descuento ni soloApp: descuento null y soloApp false; sin desde empieza ahora', async () => {
      const { descuento: _d, desde: _s, ...resto } = valida();
      const res = await crear(resto).expect(201);
      expect(res.body.datos).toMatchObject({
        descuento: null,
        soloApp: false,
        desde: '2026-10-03T12:00:00-03:00',
      });
      const explicito = await crear({ ...resto, descuento: null }).expect(201);
      expect(explicito.body.datos.descuento).toBeNull();
    });

    it('con imagen subida a /archivos', async () => {
      const url = await subir(jpeg());
      const res = await crear({ ...valida(), imagenUrl: url }).expect(201);
      expect(ruta(res.body.datos.imagenUrl)).toBe(ruta(url));
      const sin = await crear({ ...valida(), imagenUrl: null }).expect(201);
      expect(sin.body.datos.imagenUrl).toBeNull();
    });

    it('una promo que empieza en el futuro es válida (próxima)', async () => {
      const res = await crear({
        ...valida(),
        desde: '2026-10-05T00:00:00-03:00',
        hasta: '2026-10-12T00:00:00-03:00',
      }).expect(201);
      const lista = await t.http().get('/promociones?estado=proximas').expect(200);
      expect(lista.body.datos.map((p: { id: string }) => p.id)).toContain(res.body.datos.id);
    });

    it.each([[0], [101], [-5], [15.5], ['15'], [0.15]])(
      'R6: descuento %s → 400',
      async (descuento) => {
        const res = await crear({ ...valida(), descuento }).expect(400);
        esperarError(res.body, 'VALIDACION_FALLIDA');
      },
    );

    it.each([[1], [100]])('R6: descuento %s es válido', async (descuento) => {
      await crear({ ...valida(), descuento }).expect(201);
    });

    it('R6: hasta igual o anterior a desde → 400', async () => {
      const igual = await crear({ ...valida(), hasta: valida().desde }).expect(400);
      esperarError(igual.body, 'VALIDACION_FALLIDA');
      const antes = await crear({
        ...valida(),
        desde: '2026-10-20T00:00:00-03:00',
        hasta: '2026-10-10T00:00:00-03:00',
      }).expect(400);
      esperarError(antes.body, 'VALIDACION_FALLIDA');
    });

    it('R6: hasta en el pasado → 422 PROMO_VENCIDA', async () => {
      const res = await crear({
        ...valida(),
        desde: '2026-09-01T00:00:00-03:00',
        hasta: '2026-09-30T00:00:00-03:00',
      }).expect(422);
      esperarError(res.body, 'PROMO_VENCIDA');
    });

    it.each([
      ['sin título', { titulo: undefined }],
      ['título vacío', { titulo: '  ' }],
      ['título largo', { titulo: 'x'.repeat(121) }],
      ['sin detalle', { detalle: undefined }],
      ['sin hasta', { hasta: undefined }],
      ['hasta que no es fecha', { hasta: 'mañana' }],
      ['fecha sin zona', { hasta: '2026-10-31T23:59:59' }],
      ['fecha inexistente', { hasta: '2026-02-30T10:00:00-03:00' }],
      ['desde null', { desde: null }],
      ['soloApp como texto', { soloApp: 'si' }],
      ['campo activa', { activa: false }],
      ['campo usos', { usos: 50 }],
      ['campo id', { id: 'pro-mio' }],
      ['campo comercioId', { comercioId: 'com-201' }],
    ])('400 por %s', async (_n, cambio) => {
      const res = await crear({ ...valida(), ...cambio }).expect(400);
      esperarError(res.body, 'VALIDACION_FALLIDA');
    });

    it('imagen que no se subió → 422 ARCHIVO_NO_SUBIDO', async () => {
      for (const imagenUrl of ['https://ejemplo.com/a.jpg', 'file:///a.jpg']) {
        const res = await crear({ ...valida(), imagenUrl }).expect(422);
        esperarError(res.body, 'ARCHIVO_NO_SUBIDO');
      }
      const video = await subir(mp4());
      esperarError(
        (await crear({ ...valida(), imagenUrl: video }).expect(422)).body,
        'ARCHIVO_NO_SUBIDO',
      );
    });

    it('queda en la lista del panel y cuenta en el total', async () => {
      const c = await crearComercio(t, { id: 'com-alta' });
      const u = await crearUsuario(t, { rol: 'comercio', comercioId: c.id });
      await crear(valida(), u).expect(201);
      const res = await t.http().get('/mi-comercio/promociones').set(u.auth).expect(200);
      expect(res.body.meta.total).toBe(1);
    });
  });

  describe('PATCH /mi-comercio/promociones/:id', () => {
    const editar = (id: string, cuerpo: object, u = tornillo) =>
      t.http().patch(`/mi-comercio/promociones/${id}`).set(u.auth).send(cuerpo);

    it('200: edita sólo lo que se manda; el resto queda igual', async () => {
      const p = await crearPromocion(t, { comercioId: 'com-118', usos: 4, soloApp: true });
      const res = await editar(p.id, { titulo: 'Nuevo título', descuento: null }).expect(200);
      esperarContrato(res.body, 'Promocion');
      expect(res.body.datos).toMatchObject({
        id: p.id,
        titulo: 'Nuevo título',
        descuento: null,
        detalle: p.detalle,
        usos: 4,
        soloApp: true,
        activa: true,
      });
      const guardada = await t.dataSource.getRepository(Promocion).findOneByOrFail({ id: p.id });
      expect(guardada.titulo).toBe('Nuevo título');
    });

    it('{} → 200 sin cambios', async () => {
      const p = await crearPromocion(t, { comercioId: 'com-118' });
      const res = await editar(p.id, {}).expect(200);
      expect(res.body.datos.titulo).toBe(p.titulo);
    });

    it('puede cambiar fechas, imagen y soloApp', async () => {
      const p = await crearPromocion(t, { comercioId: 'com-118' });
      const url = await subir(jpeg());
      const res = await editar(p.id, {
        desde: '2026-10-02T00:00:00-03:00',
        hasta: '2026-12-31T00:00:00-03:00',
        imagenUrl: url,
        soloApp: true,
      }).expect(200);
      expect(res.body.datos).toMatchObject({
        desde: '2026-10-02T00:00:00-03:00',
        hasta: '2026-12-31T00:00:00-03:00',
        soloApp: true,
      });
      expect(ruta(res.body.datos.imagenUrl)).toBe(ruta(url));
      const sin = await editar(p.id, { imagenUrl: null }).expect(200);
      expect(sin.body.datos.imagenUrl).toBeNull();
    });

    it('R6: la ventana se valida con lo que ya había (hasta anterior al desde guardado → 400)', async () => {
      const p = await crearPromocion(t, { comercioId: 'com-118' });
      const res = await editar(p.id, { hasta: '2026-10-01T00:00:00-03:00' }).expect(400);
      esperarError(res.body, 'VALIDACION_FALLIDA');
      const desdeTarde = await editar(p.id, { desde: '2027-01-01T00:00:00-03:00' }).expect(400);
      esperarError(desdeTarde.body, 'VALIDACION_FALLIDA');
    });

    it('R6: ponerle un hasta pasado a una vigente → 422 PROMO_VENCIDA', async () => {
      const p = await crearPromocion(t, { comercioId: 'com-118', desde: enDias(t, -30) });
      const res = await editar(p.id, { hasta: '2026-10-01T00:00:00-03:00' }).expect(422);
      esperarError(res.body, 'PROMO_VENCIDA');
    });

    it('R6: editar una vencida → 422 PROMO_VENCIDA y no cambia', async () => {
      const p = await crearPromocion(t, {
        comercioId: 'com-118',
        desde: enDias(t, -20),
        hasta: enDias(t, -1),
      });
      const res = await editar(p.id, { titulo: 'Tarde' }).expect(422);
      esperarError(res.body, 'PROMO_VENCIDA');
      const g = await t.dataSource.getRepository(Promocion).findOneByOrFail({ id: p.id });
      expect(g.titulo).toBe(p.titulo);
    });

    it('R6: una promo de otro comercio → 403 SIN_PERMISO y no cambia', async () => {
      const ajena = await crearPromocion(t, { comercioId: 'com-201' });
      const res = await editar(ajena.id, { titulo: 'Hackeada' }).expect(403);
      esperarError(res.body, 'SIN_PERMISO');
      const g = await t.dataSource.getRepository(Promocion).findOneByOrFail({ id: ajena.id });
      expect(g.titulo).toBe(ajena.titulo);
    });

    it('404 PROMOCION_NO_ENCONTRADA: no existe o el id está mal formado', async () => {
      for (const id of ['pro-noexiste', 'x', '123']) {
        esperarError((await editar(id, {}).expect(404)).body, 'PROMOCION_NO_ENCONTRADA');
      }
    });

    it.each([
      ['descuento 0', { descuento: 0 }],
      ['titulo null', { titulo: null }],
      ['hasta null', { hasta: null }],
      ['activa', { activa: true }],
      ['usos', { usos: 1 }],
      ['comercioId', { comercioId: 'com-201' }],
    ])('400 por %s', async (_n, cuerpo) => {
      const p = await crearPromocion(t, { comercioId: 'com-118' });
      esperarError((await editar(p.id, cuerpo).expect(400)).body, 'VALIDACION_FALLIDA');
    });

    it('imagen que no se subió → 422 ARCHIVO_NO_SUBIDO', async () => {
      const p = await crearPromocion(t, { comercioId: 'com-118' });
      const res = await editar(p.id, { imagenUrl: 'https://ejemplo.com/a.jpg' }).expect(422);
      esperarError(res.body, 'ARCHIVO_NO_SUBIDO');
    });
  });

  describe('DELETE /mi-comercio/promociones/:id', () => {
    const borrar = (id: string, u = tornillo) =>
      t.http().delete(`/mi-comercio/promociones/${id}`).set(u.auth);

    it('204 sin cuerpo: la da de baja (activa: false), no la borra; sale del público', async () => {
      const p = await crearPromocion(t, { comercioId: 'com-118', usos: 3 });
      const res = await borrar(p.id).expect(204);
      expect(res.text).toBe('');
      const g = await t.dataSource.getRepository(Promocion).findOneByOrFail({ id: p.id });
      expect(g.activa).toBe(false);
      expect(g.usos).toBe(3);
      esperarError(
        (await t.http().get(`/promociones/${p.id}`).expect(404)).body,
        'PROMOCION_NO_ENCONTRADA',
      );
      const lista = await t.http().get('/promociones?comercioId=com-118').expect(200);
      expect(lista.body.datos.map((x: { id: string }) => x.id)).not.toContain(p.id);
      const panel = await t.http().get('/mi-comercio/promociones?porPagina=100').set(tornillo.auth);
      const suya = panel.body.datos.find((x: { id: string }) => x.id === p.id);
      expect(suya.activa).toBe(false);
    });

    it('es idempotente: dar de baja dos veces da 204 las dos', async () => {
      const p = await crearPromocion(t, { comercioId: 'com-118' });
      await borrar(p.id).expect(204);
      await borrar(p.id).expect(204);
    });

    it('también una vencida', async () => {
      const p = await crearPromocion(t, {
        comercioId: 'com-118',
        desde: enDias(t, -20),
        hasta: enDias(t, -1),
      });
      await borrar(p.id).expect(204);
    });

    it('una de otro comercio → 403 SIN_PERMISO y sigue activa', async () => {
      const ajena = await crearPromocion(t, { comercioId: 'com-201' });
      esperarError((await borrar(ajena.id).expect(403)).body, 'SIN_PERMISO');
      const g = await t.dataSource.getRepository(Promocion).findOneByOrFail({ id: ajena.id });
      expect(g.activa).toBe(true);
    });

    it('404 PROMOCION_NO_ENCONTRADA si no existe o el id está mal formado', async () => {
      for (const id of ['pro-noexiste', 'x']) {
        esperarError((await borrar(id).expect(404)).body, 'PROMOCION_NO_ENCONTRADA');
      }
    });
  });
});
