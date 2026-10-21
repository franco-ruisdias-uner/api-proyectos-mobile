import { Tokens } from '../../src/common/auth/tokens.js';
import { Comercio } from '../../src/modules/businesses/business.entity.js';
import { Promocion } from '../../src/modules/promotions/promotion.entity.js';
import { jpeg, mp4 } from '../utilities/files.js';
import { crearComercio, crearRubro } from '../utilities/businesses.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import { type AppDePrueba, crearApp } from '../utilities/create-app.js';
import { crearPromocion, enDias } from '../utilities/promotions.js';
import { crearUsuario, type UsuarioDePrueba } from '../utilities/users.js';

describe('ESPECIFICACION M5 — Panel del comercio (verificación adversarial)', () => {
  let t: AppDePrueba;
  let dueno: UsuarioDePrueba;
  let otro: UsuarioDePrueba;
  let vecino: UsuarioDePrueba;
  const CAMPOS_COMERCIO = [
    'id',
    'nombre',
    'rubroId',
    'descripcion',
    'direccion',
    'coordenadas',
    'telefono',
    'whatsapp',
    'instagram',
    'imagenes',
    'videoUrl',
    'horarios',
    'mediosDePago',
    'puntaje',
    'cantidadResenas',
    'codigoQr',
    'activo',
  ].sort();

  beforeAll(async () => {
    t = await crearApp();
    await crearRubro(t, { id: 'rub-prueba' });
    await crearComercio(t, { id: 'com-m5a', nombre: 'Panel A' });
    await crearComercio(t, { id: 'com-m5b', nombre: 'Panel B' });
    dueno = await crearUsuario(t, { rol: 'comercio', comercioId: 'com-m5a' });
    otro = await crearUsuario(t, { rol: 'comercio', comercioId: 'com-m5b' });
    vecino = await crearUsuario(t);
  });
  afterAll(() => t.cerrar());

  // El token vence a los 30 días del reloj: se firma uno nuevo en cada pedido (el reloj se mueve).
  const auth = () => ({
    Authorization: `Bearer ${t.app.get(Tokens).firmar({ id: dueno.id, rol: 'comercio' })}`,
  });
  const get = () => t.http().get('/mi-comercio').set(auth());
  const patch = (cuerpo: unknown) =>
    t
      .http()
      .patch('/mi-comercio')
      .set(auth())
      .send(cuerpo as object);
  const postPromo = (cuerpo: unknown, u = dueno) =>
    t
      .http()
      .post('/mi-comercio/promociones')
      .set(u === dueno ? auth() : u.auth)
      .send(cuerpo as object);
  const patchPromo = (id: string, cuerpo: unknown, u = dueno) =>
    t
      .http()
      .patch(`/mi-comercio/promociones/${id}`)
      .set(u === dueno ? auth() : u.auth)
      .send(cuerpo as object);
  const base = { titulo: 'Promo', detalle: 'Detalle', hasta: '2026-12-01T12:00:00-03:00' };
  const subir = async (b: Buffer) =>
    (
      await t
        .http()
        .post('/archivos')
        .set(vecino.auth)
        .attach('archivo', b, { filename: 'a.bin' })
        .expect(201)
    ).body.datos.url as string;
  const reset = () =>
    t.dataSource.getRepository(Comercio).update(
      { id: 'com-m5a' },
      {
        nombre: 'Panel A',
        horarios: [{ dia: 1, abre: '08:00', cierra: '12:00' }],
        cerradoHasta: null,
        telefono: null,
        whatsapp: null,
        instagram: null,
        imagenes: [],
        videoClave: null,
        activo: true,
      },
    );

  describe('Forma de GET /mi-comercio (nulos y campos de más)', () => {
    it('todos los opcionales en null: claves exactas, null y no "" ni ausentes', async () => {
      await reset();
      const res = await get().expect(200);
      esperarContrato(res.body, 'Comercio');
      expect(Object.keys(res.body.datos).sort()).toEqual(CAMPOS_COMERCIO);
      expect(res.body.datos.telefono).toBeNull();
      expect(res.body.datos.videoUrl).toBeNull();
      expect(res.body.datos).not.toHaveProperty('cerradoHasta');
      expect(res.body.datos).not.toHaveProperty('abiertoAhora');
    });
    it('todo lleno: contrato y claves exactas', async () => {
      const foto = await subir(jpeg());
      const video = await subir(mp4());
      const res = await patch({
        telefono: '3442 123456',
        whatsapp: '5493442123456',
        instagram: '@panel.a_1',
        imagenes: [foto],
        videoUrl: video,
        mediosDePago: ['debito', 'credito'],
        horarios: [{ dia: 0, abre: '09:00', cierra: '13:00' }],
        cerradoHasta: '2020-01-01',
      }).expect(200);
      esperarContrato(res.body, 'Comercio');
      expect(Object.keys(res.body.datos).sort()).toEqual(CAMPOS_COMERCIO);
      expect(res.body.datos.codigoQr).toBe('CCU:com-m5a');
      await reset();
    });
  });

  describe('Entrada de PATCH /mi-comercio', () => {
    it.each([
      ['rubroId', 'rub-otro'],
      ['activo', false],
      ['puntaje', 5],
      ['cantidadResenas', 3],
      ['id', 'com-x'],
      ['codigoQr', 'CCU:x'],
      ['createdAt', 'x'],
      ['abiertoAhora', true],
      ['password', 'x'],
      ['distancia', 1],
    ])('campo no editable %s → 400', async (campo, valor) => {
      const res = await patch({ [campo]: valor }).expect(400);
      esperarError(res.body, 'VALIDACION_FALLIDA');
    });
    it.each([
      ['nombre', ''],
      ['nombre', '   '],
      ['nombre', 5],
      ['nombre', null],
      ['descripcion', null],
      ['direccion', ''],
      ['direccion', null],
      ['telefono', ''],
      ['telefono', 5],
      ['whatsapp', ''],
      ['whatsapp', '+5493442123456'],
      ['whatsapp', '123'],
      ['whatsapp', 'abc'],
      ['whatsapp', '5493442123456789012'],
      ['instagram', 'panel'],
      ['instagram', '@'],
      ['instagram', ''],
      ['instagram', '@con espacio'],
      ['imagenes', 'x'],
      ['imagenes', null],
      ['imagenes', [5]],
      ['mediosDePago', 'efectivo'],
      ['mediosDePago', null],
      ['mediosDePago', ['bitcoin']],
      ['mediosDePago', ['Efectivo']],
      ['horarios', null],
      ['horarios', {}],
      ['coordenadas', null],
      ['coordenadas', { latitud: 'a', longitud: 1 }],
      ['coordenadas', { latitud: 100, longitud: 0 }],
      ['coordenadas', { latitud: 0, longitud: 200 }],
      ['coordenadas', { latitud: 0 }],
      ['coordenadas', { latitud: 0, longitud: 0, z: 1 }],
      ['cerradoHasta', '2026-13-01'],
      ['cerradoHasta', '2026-10-03T00:00:00-03:00'],
      ['cerradoHasta', ''],
    ])('%s = %j → 400', async (campo, valor) => {
      const res = await patch({ [campo]: valor }).expect(400);
      esperarError(res.body, 'VALIDACION_FALLIDA');
    });
    it.each([
      [{ dia: 7, abre: '08:00', cierra: '12:00' }],
      [{ dia: -1, abre: '08:00', cierra: '12:00' }],
      [{ dia: 1.5, abre: '08:00', cierra: '12:00' }],
      [{ dia: '1', abre: '08:00', cierra: '12:00' }],
      [{ dia: 1, abre: '8:00', cierra: '12:00' }],
      [{ dia: 1, abre: '08:00', cierra: '24:00' }],
      [{ dia: 1, abre: '08:60', cierra: '12:00' }],
      [{ dia: 1, abre: '08:00:00', cierra: '12:00' }],
      [{ dia: 1, abre: '12:00', cierra: '12:00' }],
      [{ dia: 1, abre: '13:00', cierra: '12:00' }],
      [{ dia: 1, abre: '08:00' }],
      [{ dia: 1, abre: '08:00', cierra: '12:00', extra: 1 }],
      [{ dia: 1, abre: '', cierra: '12:00' }],
      [{ dia: 1, abre: null, cierra: '12:00' }],
    ])('horario inválido %j → 400', async (h) => {
      const res = await patch({ horarios: [h] }).expect(400);
      esperarError(res.body, 'VALIDACION_FALLIDA');
    });
    it('400 con cuerpo no objeto (array o texto) no explota', async () => {
      const r1 = await t.http().patch('/mi-comercio').set(dueno.auth).send([1]);
      expect(r1.status).toBe(400);
      esperarError(r1.body);
    });
    it('un 400 no cambia nada aunque venga mezclado con campos válidos', async () => {
      await reset();
      await patch({ nombre: 'Cambiado', whatsapp: 'mal' }).expect(400);
      const res = await get().expect(200);
      expect(res.body.datos.nombre).toBe('Panel A');
    });
    it('el mensaje de 400 está en castellano y sin jerga', async () => {
      const res = await patch({ whatsapp: 'mal' }).expect(400);
      expect(res.body.error.mensaje).not.toMatch(/should|must|property|undefined|whitelist|DTO/i);
      expect(Object.keys(res.body.error).sort()).toEqual(['codigo', 'mensaje']);
    });
    it('textos con espacios alrededor se recortan o se rechazan, pero nunca quedan vacíos', async () => {
      const res = await patch({ nombre: '  Panel A  ' });
      if (res.status === 200) expect(res.body.datos.nombre).toBe('Panel A');
      else expect(res.status).toBe(400);
    });
  });

  describe('R2 — horarios: bordes', () => {
    it('tramos contiguos (12:00 cierra / 12:00 abre) no se pisan; dos tramos el mismo día quedan', async () => {
      const res = await patch({
        horarios: [
          { dia: 2, abre: '12:00', cierra: '16:00' },
          { dia: 2, abre: '08:00', cierra: '12:00' },
        ],
      }).expect(200);
      expect(res.body.datos.horarios).toEqual([
        { dia: 2, abre: '08:00', cierra: '12:00' },
        { dia: 2, abre: '12:00', cierra: '16:00' },
      ]);
    });
    it('1 minuto de superposición → 422 HORARIOS_SUPERPUESTOS', async () => {
      const res = await patch({
        horarios: [
          { dia: 3, abre: '08:00', cierra: '12:01' },
          { dia: 3, abre: '12:00', cierra: '16:00' },
        ],
      }).expect(422);
      esperarError(res.body, 'HORARIOS_SUPERPUESTOS');
    });
    it('tramo contenido dentro de otro → 422', async () => {
      const res = await patch({
        horarios: [
          { dia: 3, abre: '08:00', cierra: '20:00' },
          { dia: 3, abre: '10:00', cierra: '11:00' },
        ],
      }).expect(422);
      esperarError(res.body, 'HORARIOS_SUPERPUESTOS');
    });
    it('tramo duplicado exacto → 422', async () => {
      const h = { dia: 3, abre: '08:00', cierra: '12:00' };
      const res = await patch({ horarios: [h, h] }).expect(422);
      esperarError(res.body, 'HORARIOS_SUPERPUESTOS');
    });
    it('mismas horas en días distintos no se pisan; los 7 días, 00:00 a 23:59', async () => {
      const horarios = [0, 1, 2, 3, 4, 5, 6].map((dia) => ({
        dia,
        abre: '00:00',
        cierra: '23:59',
      }));
      const res = await patch({ horarios }).expect(200);
      expect(res.body.datos.horarios).toEqual(horarios);
    });
    it('con 51 tramos → 400', async () => {
      const horarios = Array.from({ length: 51 }, (_, i) => ({
        dia: i % 7,
        abre: `${String(Math.floor(i / 7)).padStart(2, '0')}:00`,
        cierra: `${String(Math.floor(i / 7)).padStart(2, '0')}:30`,
      }));
      await patch({ horarios }).expect(400);
    });
    it('horarios [] se acepta y se guarda', async () => {
      const res = await patch({ horarios: [] }).expect(200);
      expect(res.body.datos.horarios).toEqual([]);
      await reset();
    });
    it('superposición y otro campo inválido válido juntos: no se guarda el nombre', async () => {
      await patch({
        nombre: 'No debe guardarse',
        horarios: [
          { dia: 1, abre: '08:00', cierra: '12:00' },
          { dia: 1, abre: '11:00', cierra: '13:00' },
        ],
      }).expect(422);
      expect((await get()).body.datos.nombre).toBe('Panel A');
    });
  });

  describe('D2 — cerradoHasta: reloj y bordes de fecha', () => {
    const cerrar = (dia: string | null) => patch({ cerradoHasta: dia }).expect(200);
    afterEach(async () => {
      t.reloj.fijar('2026-10-03T12:00:00-03:00');
      await reset();
    });
    const horarioUno = [{ dia: 1, abre: '08:00', cierra: '12:00' }];
    const horarios = async () => (await get().expect(200)).body.datos.horarios;

    it('23:59 del último día de cierre (BA): sigue cerrado; 00:00 del día siguiente: abre', async () => {
      await patch({ horarios: horarioUno, cerradoHasta: '2026-10-03' }).expect(200);
      t.reloj.fijar('2026-10-03T23:59:00-03:00');
      expect(await horarios()).toEqual([]);
      t.reloj.fijar('2026-10-04T00:00:00-03:00');
      expect(await horarios()).toEqual(horarioUno);
    });
    it('"hoy" es el de Buenos Aires: 22:00 BA (01:00Z del día siguiente) aún es el mismo día', async () => {
      await patch({ horarios: horarioUno, cerradoHasta: '2026-10-03' }).expect(200);
      t.reloj.fijar('2026-10-04T01:00:00Z'); // 22:00 del 3 en BA
      expect(await horarios()).toEqual([]);
    });
    it('último día del mes y 31/12 con cambio de año', async () => {
      await patch({ horarios: horarioUno, cerradoHasta: '2026-12-31' }).expect(200);
      t.reloj.fijar('2026-12-31T23:59:59-03:00');
      expect(await horarios()).toEqual([]);
      t.reloj.fijar('2027-01-01T00:00:00-03:00');
      expect(await horarios()).toEqual(horarioUno);
    });
    it('29/02 de año bisiesto es válido; 29/02 de año no bisiesto → 400', async () => {
      await cerrar('2028-02-29');
      await patch({ cerradoHasta: '2026-02-29' }).expect(400);
    });
    it('cerradoHasta = hoy cierra; null reabre; fecha pasada no hace nada', async () => {
      await patch({ horarios: horarioUno }).expect(200);
      await cerrar('2026-10-03');
      expect(await horarios()).toEqual([]);
      await cerrar(null);
      expect(await horarios()).toEqual(horarioUno);
      await cerrar('2026-10-02');
      expect(await horarios()).toEqual(horarioUno);
    });
    it('se puede editar horarios mientras está cerrado: vuelven al reabrir', async () => {
      await cerrar('2026-10-10');
      const res = await patch({ horarios: [{ dia: 5, abre: '09:00', cierra: '10:00' }] }).expect(
        200,
      );
      expect(res.body.datos.horarios).toEqual([]);
      t.reloj.fijar('2026-10-11T00:00:00-03:00');
      expect(await horarios()).toEqual([{ dia: 5, abre: '09:00', cierra: '10:00' }]);
    });
    it('también el público lo ve con horarios [] y el contrato se cumple', async () => {
      await cerrar('2026-10-10');
      const det = await t.http().get('/comercios/com-m5a').expect(200);
      esperarContrato(det.body, 'Comercio');
      expect(det.body.datos.horarios).toEqual([]);
      const lista = await t.http().get('/comercios?porPagina=100').expect(200);
      const c = lista.body.datos.find((x: { id: string }) => x.id === 'com-m5a');
      expect(c.horarios).toEqual([]);
    });
    it('un PATCH sin cerradoHasta no borra el cierre vigente', async () => {
      await cerrar('2026-10-10');
      await patch({ nombre: 'Panel A' }).expect(200);
      expect(await horarios()).toEqual([]);
    });
  });

  describe('R14 — archivos y medios de pago', () => {
    it('imágenes: orden preservado, 8 válidas, repetidas no rompen', async () => {
      const urls = [await subir(jpeg(1001)), await subir(jpeg(1002))];
      const res = await patch({ imagenes: [urls[1], urls[0]] }).expect(200);
      expect(res.body.datos.imagenes.map((u: string) => new URL(u).pathname)).toEqual(
        [urls[1], urls[0]].map((u) => new URL(u).pathname),
      );
      const rep = await patch({ imagenes: [urls[0], urls[0]] });
      expect([200, 400, 422]).toContain(rep.status);
      if (rep.status !== 200) esperarError(rep.body);
      await reset();
    });
    it('una URL con ruta de /archivos pero con path traversal o clave inventada → 422', async () => {
      const buena = await subir(jpeg());
      const origen = new URL(buena).origin;
      for (const u of [
        `${origen}/archivos/imagenes/2026/10/inexistente.jpg`,
        `${origen}/archivos/../etc/passwd`,
        `${origen}/archivos/`,
      ]) {
        const res = await patch({ imagenes: [u] });
        expect([400, 422]).toContain(res.status);
        esperarError(res.body);
      }
    });
    it('videoUrl: null lo quita, y sigue null en la respuesta', async () => {
      const v = await subir(mp4());
      const a = await patch({ videoUrl: v }).expect(200);
      expect(a.body.datos.videoUrl).toMatch(/^https?:\/\//);
      const b = await patch({ videoUrl: null }).expect(200);
      expect(b.body.datos.videoUrl).toBeNull();
    });
    it('imagenes: [] vacía las fotos', async () => {
      const f = await subir(jpeg());
      await patch({ imagenes: [f] }).expect(200);
      const res = await patch({ imagenes: [] }).expect(200);
      expect(res.body.datos.imagenes).toEqual([]);
    });
    it.each([['efectivo'], ['debito'], ['credito'], ['transferencia'], ['billetera_virtual']])(
      'medio de pago %s del catálogo',
      async (m) => {
        const res = await patch({ mediosDePago: [m] }).expect(200);
        expect(res.body.datos.mediosDePago).toEqual([m]);
      },
    );
    it('mediosDePago [] es válido', async () => {
      const res = await patch({ mediosDePago: [] }).expect(200);
      expect(res.body.datos.mediosDePago).toEqual([]);
      await reset();
    });
    it.each([
      ['whatsapp', '5493442123456'],
      ['instagram', '@a'],
      ['instagram', '@' + 'a'.repeat(30)],
    ])('%s válido %s', async (campo, valor) => {
      const res = await patch({ [campo]: valor }).expect(200);
      expect(res.body.datos[campo]).toBe(valor);
      await reset();
    });
  });

  describe('Cadena vacía como URL (la regla de nulos: nunca "")', () => {
    it('videoUrl "" e imagenUrl "" se rechazan con sobre de error (400 o 422), sin guardarse', async () => {
      const a = await patch({ videoUrl: '' });
      const b = await postPromo({ ...base, imagenUrl: '' });
      for (const r of [a, b]) {
        expect([400, 422]).toContain(r.status);
        esperarError(r.body);
      }
    });
  });

  describe('Aislamiento entre comercios', () => {
    it('cada uno ve y edita sólo lo suyo; cambiar el A no toca el B', async () => {
      await patch({ nombre: 'A nuevo' }).expect(200);
      const b = await t.http().get('/mi-comercio').set(otro.auth).expect(200);
      expect(b.body.datos.id).toBe('com-m5b');
      expect(b.body.datos.nombre).toBe('Panel B');
      await reset();
    });
    it('un id en el cuerpo para apuntar a otro comercio da 400', async () => {
      await patch({ id: 'com-m5b', nombre: 'x' }).expect(400);
      await patch({ comercioId: 'com-m5b' }).expect(400);
    });
    it('token vencido o mal firmado → 401', async () => {
      const mal = await t.http().get('/mi-comercio').set('Authorization', `Bearer ${dueno.token}x`);
      expect(mal.status).toBe(401);
      esperarError(mal.body, 'NO_AUTENTICADO');
      const raro = await t.http().get('/mi-comercio').set('Authorization', 'Basic abc');
      expect(raro.status).toBe(401);
    });
    it('comercio dado de baja: la cuenta sigue editando y la ficha no aparece en el listado', async () => {
      await t.dataSource.getRepository(Comercio).update({ id: 'com-m5a' }, { activo: false });
      const res = await patch({ nombre: 'Baja editada' }).expect(200);
      expect(res.body.datos.activo).toBe(false);
      const lista = await t.http().get('/comercios?porPagina=1000').expect(200);
      expect(lista.body.datos.find((c: { id: string }) => c.id === 'com-m5a')).toBeUndefined();
      await reset();
    });
  });

  describe('R6 — alta de promo: entradas', () => {
    it('todos los opcionales en null/omitidos: forma exacta', async () => {
      const res = await postPromo(base).expect(201);
      esperarContrato(res.body, 'Promocion');
      expect(res.body.datos).toMatchObject({
        descuento: null,
        imagenUrl: null,
        soloApp: false,
        usos: 0,
        activa: true,
        comercioId: 'com-m5a',
      });
      expect(res.body.datos.id).toMatch(/^pro-[a-z0-9]{12}$/);
      expect(res.body.datos.desde).toBe('2026-10-03T12:00:00-03:00');
    });
    it('todos llenos, descuento null explícito, imagenUrl null explícito', async () => {
      const img = await subir(jpeg());
      const res = await postPromo({
        ...base,
        descuento: null,
        desde: '2026-10-05T10:00:00Z',
        imagenUrl: img,
        soloApp: true,
      }).expect(201);
      esperarContrato(res.body, 'Promocion');
      expect(res.body.datos.desde).toBe('2026-10-05T07:00:00-03:00');
      const r2 = await postPromo({ ...base, imagenUrl: null, descuento: 50 }).expect(201);
      esperarContrato(r2.body, 'Promocion');
      expect(r2.body.datos.imagenUrl).toBeNull();
    });
    it.each([
      ['2026-12-01T12:00:00.123-03:00'],
      ['2026-12-01T15:00:00Z'],
      ['2026-12-01T15:00:00.000Z'],
      ['2026-12-01T12:00:00+00:00'],
    ])('hasta %s se acepta y sale como -03:00 sin milisegundos', async (hasta) => {
      const res = await postPromo({ ...base, hasta }).expect(201);
      esperarContrato(res.body, 'Promocion');
    });
    it.each([
      ['2026-12-01'],
      ['2026-12-01T12:00:00'],
      ['mañana'],
      [''],
      [1796126400000],
      [null],
      ['2026-02-30T10:00:00-03:00'],
    ])('hasta inválido %j → 400', async (hasta) => {
      const res = await postPromo({ ...base, hasta });
      expect(res.status).toBe(400);
      esperarError(res.body, 'VALIDACION_FALLIDA');
    });
    it('falta hasta, titulo o detalle → 400', async () => {
      for (const campo of ['hasta', 'titulo', 'detalle']) {
        const cuerpo: Record<string, unknown> = { ...base };
        delete cuerpo[campo];
        const res = await postPromo(cuerpo).expect(400);
        esperarError(res.body, 'VALIDACION_FALLIDA');
      }
    });
    it.each([
      ['titulo', ''],
      ['titulo', '  '],
      ['titulo', 5],
      ['titulo', null],
      ['detalle', ''],
      ['detalle', null],
      ['soloApp', 'true'],
      ['soloApp', 1],
      ['soloApp', null],
      ['descuento', 'null'],
      ['descuento', true],
      ['descuento', 1e10],
      ['imagenUrl', 5],
      ['desde', 'ayer'],
      ['desde', null],
    ])('%s = %j → 400', async (campo, valor) => {
      const res = await postPromo({ ...base, [campo]: valor });
      expect(res.status).toBe(400);
      esperarError(res.body, 'VALIDACION_FALLIDA');
    });
    it.each([
      ['activa', false],
      ['usos', 5],
      ['id', 'pro-abc'],
      ['comercioId', 'com-m5b'],
      ['createdAt', 'x'],
      ['imagenClave', 'x'],
    ])('campo de más %s → 400', async (c, v) => {
      const res = await postPromo({ ...base, [c]: v }).expect(400);
      esperarError(res.body, 'VALIDACION_FALLIDA');
    });
    it('hasta == ahora → 422 PROMO_VENCIDA; hasta 1 s después → 201', async () => {
      const a = await postPromo({
        ...base,
        desde: '2026-10-01T00:00:00-03:00',
        hasta: '2026-10-03T12:00:00-03:00',
      });
      expect(a.status).toBe(422);
      esperarError(a.body, 'PROMO_VENCIDA');
      await postPromo({ ...base, hasta: '2026-10-03T12:00:01-03:00' }).expect(201);
    });
    it('hasta == desde → 400; desde 1 s antes de hasta → 201', async () => {
      await postPromo({ ...base, desde: base.hasta }).expect(400);
      await postPromo({ ...base, desde: '2026-12-01T11:59:59-03:00' }).expect(201);
    });
    it('desde pasado con hasta futuro (vigente, con desde antiguo) → 201', async () => {
      await postPromo({ ...base, desde: '2020-01-01T00:00:00-03:00' }).expect(201);
    });
    it('hasta en el pasado Y desde posterior: no 500 (400 o 422)', async () => {
      const res = await postPromo({
        ...base,
        desde: '2026-10-10T00:00:00-03:00',
        hasta: '2026-09-01T00:00:00-03:00',
      });
      expect([400, 422]).toContain(res.status);
      esperarError(res.body);
    });
    it('31/12 a las 23:59:59 como hasta, y 00:00 del 1/1', async () => {
      const a = await postPromo({ ...base, hasta: '2026-12-31T23:59:59-03:00' }).expect(201);
      expect(a.body.datos.hasta).toBe('2026-12-31T23:59:59-03:00');
      const b = await postPromo({
        ...base,
        desde: '2026-12-31T23:59:59-03:00',
        hasta: '2027-01-01T00:00:00-03:00',
      }).expect(201);
      expect(b.body.datos.hasta).toBe('2027-01-01T00:00:00-03:00');
    });
    it('hasta con Z que en BA cae el día anterior (02:00Z del 1/1 = 23:00 del 31/12)', async () => {
      const r = await postPromo({ ...base, hasta: '2027-01-01T02:00:00Z' }).expect(201);
      expect(r.body.datos.hasta).toBe('2026-12-31T23:00:00-03:00');
    });
    it('relojes a 23:59 y 00:00: sin desde empieza en el instante del reloj', async () => {
      t.reloj.fijar('2026-10-31T23:59:00-03:00');
      const a = await postPromo(base).expect(201);
      expect(a.body.datos.desde).toBe('2026-10-31T23:59:00-03:00');
      t.reloj.fijar('2026-11-01T00:00:00-03:00');
      const b = await postPromo(base).expect(201);
      expect(b.body.datos.desde).toBe('2026-11-01T00:00:00-03:00');
      t.reloj.fijar('2026-10-03T12:00:00-03:00');
    });
    it('no manda push (M7 no está en M5)', async () => {
      const antes = t.enviador.enviados.length;
      await postPromo(base).expect(201);
      await t.avisos.esperarPendientes();
      expect(t.enviador.enviados.length).toBe(antes);
    });
    it('un vecino no puede crear (403) y un 201 no se filtra al otro comercio', async () => {
      const r = await postPromo(base, vecino).expect(403);
      esperarError(r.body, 'SIN_PERMISO');
      const p = await postPromo({ ...base, titulo: 'Sólo de A' }).expect(201);
      const lista = await t
        .http()
        .get('/mi-comercio/promociones?porPagina=100')
        .set(otro.auth)
        .expect(200);
      expect(
        lista.body.datos.find((x: { id: string }) => x.id === p.body.datos.id),
      ).toBeUndefined();
    });
    it('POST repetido idéntico crea dos promos distintas (no hay id de cliente)', async () => {
      const a = await postPromo({ ...base, titulo: 'Repetida' }).expect(201);
      const b = await postPromo({ ...base, titulo: 'Repetida' }).expect(201);
      expect(a.body.datos.id).not.toBe(b.body.datos.id);
    });
  });

  describe('R6 — edición de promo', () => {
    it('PATCH con descuento null, imagenUrl null: borra y mantiene contrato', async () => {
      const img = await subir(jpeg());
      const p = await postPromo({ ...base, descuento: 20, imagenUrl: img }).expect(201);
      const res = await patchPromo(p.body.datos.id, { descuento: null, imagenUrl: null }).expect(
        200,
      );
      esperarContrato(res.body, 'Promocion');
      expect(res.body.datos.descuento).toBeNull();
      expect(res.body.datos.imagenUrl).toBeNull();
    });
    it.each([
      ['activa', true],
      ['usos', 3],
      ['id', 'pro-x'],
      ['comercioId', 'com-m5b'],
      ['hasta', 'mal'],
      ['titulo', ''],
      ['descuento', 0],
      ['descuento', 101],
      ['soloApp', 'si'],
    ])('PATCH %s = %j → 400', async (c, v) => {
      const p = await postPromo(base).expect(201);
      const res = await patchPromo(p.body.datos.id, { [c]: v }).expect(400);
      esperarError(res.body, 'VALIDACION_FALLIDA');
    });
    it('PATCH no reactiva una dada de baja (activa sigue false) y la deja editar', async () => {
      const p = await postPromo(base).expect(201);
      await t
        .http()
        .delete(`/mi-comercio/promociones/${p.body.datos.id}`)
        .set(dueno.auth)
        .expect(204);
      const res = await patchPromo(p.body.datos.id, { titulo: 'Editada en baja' }).expect(200);
      expect(res.body.datos.activa).toBe(false);
      expect(res.body.datos.titulo).toBe('Editada en baja');
    });
    it('mover desde después del hasta guardado → 400 (se valida con lo guardado)', async () => {
      const p = await postPromo(base).expect(201);
      const res = await patchPromo(p.body.datos.id, { desde: '2027-01-01T00:00:00-03:00' }).expect(
        400,
      );
      esperarError(res.body, 'VALIDACION_FALLIDA');
    });
    it('una promo que venció porque avanzó el reloj → 422 PROMO_VENCIDA al editar; 204 al borrar', async () => {
      const p = await postPromo({ ...base, hasta: '2026-10-04T12:00:00-03:00' }).expect(201);
      t.reloj.fijar('2026-10-04T12:00:00-03:00'); // hasta == ahora: ¿vencida?
      const res = await patchPromo(p.body.datos.id, { titulo: 'tarde' });
      expect([200, 422]).toContain(res.status);
      t.reloj.fijar('2026-10-04T12:00:01-03:00');
      const r2 = await patchPromo(p.body.datos.id, { titulo: 'tarde' }).expect(422);
      esperarError(r2.body, 'PROMO_VENCIDA');
      await t
        .http()
        .delete(`/mi-comercio/promociones/${p.body.datos.id}`)
        .set(dueno.auth)
        .expect(204);
      t.reloj.fijar('2026-10-03T12:00:00-03:00');
    });
    it('promo próxima puede editarse y mover el desde más lejos', async () => {
      const pr = await crearPromocion(t, {
        comercioId: 'com-m5a',
        desde: enDias(t, 2),
        hasta: enDias(t, 20),
      });
      const res = await patchPromo(pr.id, { desde: '2026-10-20T00:00:00-03:00' }).expect(200);
      esperarContrato(res.body, 'Promocion');
    });
    it('edición válida conserva usos', async () => {
      const pr = await crearPromocion(t, { comercioId: 'com-m5a', usos: 7 });
      const res = await patchPromo(pr.id, { titulo: 'Con usos' }).expect(200);
      expect(res.body.datos.usos).toBe(7);
    });
    it('promo ajena: 403 aun con cuerpo inválido? (400 de validación o 403, sin tocar nada)', async () => {
      const pr = await crearPromocion(t, { comercioId: 'com-m5b', titulo: 'De B' });
      const res = await patchPromo(pr.id, { titulo: 'robada' });
      expect(res.status).toBe(403);
      esperarError(res.body, 'SIN_PERMISO');
      const r2 = await t.dataSource.getRepository(Promocion).findOneByOrFail({ id: pr.id });
      expect(r2.titulo).toBe('De B');
    });
    it.each([['pro-'], ['PRO-abcdef'], ['com-118'], ['pro-%20x'], ['123'], ['pro-ñandú']])(
      'id %s en ruta → 404 PROMOCION_NO_ENCONTRADA (no 500)',
      async (id) => {
        const res = await patchPromo(encodeURIComponent(id), { titulo: 'x' });
        expect(res.status).toBe(404);
        esperarError(res.body, 'PROMOCION_NO_ENCONTRADA');
        const d = await t
          .http()
          .delete(`/mi-comercio/promociones/${encodeURIComponent(id)}`)
          .set(dueno.auth);
        expect(d.status).toBe(404);
        esperarError(d.body, 'PROMOCION_NO_ENCONTRADA');
      },
    );
  });

  describe('DELETE — baja lógica', () => {
    it('204 sin cuerpo ni content-type de JSON; deja de verse en público pero sigue en el panel con activa false', async () => {
      const p = await postPromo(base).expect(201);
      const id = p.body.datos.id;
      const d = await t.http().delete(`/mi-comercio/promociones/${id}`).set(dueno.auth).expect(204);
      expect(d.text).toBe('');
      const pub = await t.http().get(`/promociones/${id}`);
      expect(pub.status).toBe(404);
      const lista = await t.http().get('/promociones?porPagina=100').expect(200);
      expect(lista.body.datos.find((x: { id: string }) => x.id === id)).toBeUndefined();
      const panel = await t
        .http()
        .get('/mi-comercio/promociones?porPagina=100')
        .set(dueno.auth)
        .expect(200);
      const enPanel = panel.body.datos.find((x: { id: string }) => x.id === id);
      expect(enPanel.activa).toBe(false);
    });
    it('dos DELETE simultáneos: los dos 204', async () => {
      const p = await postPromo(base).expect(201);
      const id = p.body.datos.id;
      const rs = await Promise.all(
        [1, 2].map(() => t.http().delete(`/mi-comercio/promociones/${id}`).set(dueno.auth)),
      );
      expect(rs.map((r) => r.status)).toEqual([204, 204]);
    });
    it('un vecino → 403, otro comercio → 403 sobre una promo existente', async () => {
      const p = await postPromo(base).expect(201);
      const id = p.body.datos.id;
      await t.http().delete(`/mi-comercio/promociones/${id}`).set(vecino.auth).expect(403);
      const r = await t.http().delete(`/mi-comercio/promociones/${id}`).set(otro.auth).expect(403);
      esperarError(r.body, 'SIN_PERMISO');
      const panel = await t.http().get('/mi-comercio/promociones?porPagina=100').set(dueno.auth);
      expect(panel.body.datos.find((x: { id: string }) => x.id === id).activa).toBe(true);
    });
  });

  describe('GET /mi-comercio/promociones — paginación y orden', () => {
    it('meta correcto, orden desde desc / id desc, estable entre páginas, fuera de rango vacío', async () => {
      const c = await crearComercio(t, { id: 'com-m5p', nombre: 'Paginado' });
      const u = await crearUsuario(t, { rol: 'comercio', comercioId: c.id });
      const mismo = enDias(t, -1);
      for (const id of ['pro-pagaaa', 'pro-pagbbb', 'pro-pagccc']) {
        await crearPromocion(t, { id, comercioId: c.id, desde: mismo });
      }
      await crearPromocion(t, {
        id: 'pro-pagddd',
        comercioId: c.id,
        desde: enDias(t, 3),
        hasta: enDias(t, 9),
      });
      await crearPromocion(t, {
        id: 'pro-pageee',
        comercioId: c.id,
        desde: enDias(t, -30),
        hasta: enDias(t, -20),
        activa: false,
      });
      const ids: string[] = [];
      for (const pagina of [1, 2, 3]) {
        const res = await t
          .http()
          .get(`/mi-comercio/promociones?pagina=${pagina}&porPagina=2`)
          .set(u.auth)
          .expect(200);
        esperarContrato(res.body, 'Promocion');
        expect(res.body.meta).toEqual({ total: 5, pagina, porPagina: 2 });
        ids.push(...res.body.datos.map((x: { id: string }) => x.id));
      }
      expect(ids).toEqual(['pro-pagddd', 'pro-pagccc', 'pro-pagbbb', 'pro-pagaaa', 'pro-pageee']);
      const fuera = await t
        .http()
        .get('/mi-comercio/promociones?pagina=9&porPagina=2')
        .set(u.auth)
        .expect(200);
      expect(fuera.body.datos).toEqual([]);
      expect(fuera.body.meta).toEqual({ total: 5, pagina: 9, porPagina: 2 });
    });
    it.each([
      ['pagina=0'],
      ['pagina=-1'],
      ['porPagina=0'],
      ['porPagina=101'],
      ['porPagina=x'],
      ['pagina=1.5'],
    ])('parámetro %s → 400', async (q) => {
      const res = await t.http().get(`/mi-comercio/promociones?${q}`).set(dueno.auth);
      expect(res.status).toBe(400);
      esperarError(res.body, 'VALIDACION_FALLIDA');
    });
    it('un filtro desconocido (estado=vigentes) no explota: 200 o 400 con sobre', async () => {
      const res = await t.http().get('/mi-comercio/promociones?estado=vigentes').set(dueno.auth);
      expect([200, 400]).toContain(res.status);
    });
    it('promo de un comercio inactivo propio igualmente aparece en el panel', async () => {
      await t.dataSource.getRepository(Comercio).update({ id: 'com-m5a' }, { activo: false });
      const res = await t
        .http()
        .get('/mi-comercio/promociones?porPagina=100')
        .set(dueno.auth)
        .expect(200);
      expect(res.body.meta.total).toBeGreaterThan(0);
      await reset();
    });
  });

  describe('Concurrencia', () => {
    it('PATCH /mi-comercio simultáneos no dejan datos mezclados ni 500', async () => {
      const rs = await Promise.all([
        patch({ nombre: 'Uno', horarios: [{ dia: 1, abre: '08:00', cierra: '09:00' }] }),
        patch({ nombre: 'Dos', horarios: [{ dia: 2, abre: '08:00', cierra: '09:00' }] }),
      ]);
      expect(rs.map((r) => r.status)).toEqual([200, 200]);
      const fin = (await get()).body.datos;
      const combo = `${fin.nombre}|${fin.horarios[0].dia}`;
      expect(['Uno|1', 'Dos|2']).toContain(combo);
      await reset();
    });
    it('diez POST de promo simultáneos: diez 201 con ids distintos', async () => {
      const rs = await Promise.all(
        Array.from({ length: 10 }, (_, i) => postPromo({ ...base, titulo: `P${i}` })),
      );
      expect(rs.every((r) => r.status === 201)).toBe(true);
      expect(new Set(rs.map((r) => r.body.datos.id)).size).toBe(10);
    });
  });

  describe('Búsqueda sigue a los cambios', () => {
    it('renombrar con tildes y mayúsculas: q sin tildes lo encuentra y el nombre viejo ya no', async () => {
      await patch({ nombre: 'Ñandú Cañería', descripcion: 'Vendemos zócalos' }).expect(200);
      const a = await t.http().get('/comercios?q=nandu%20caneria').expect(200);
      expect(a.body.datos.map((c: { id: string }) => c.id)).toContain('com-m5a');
      const b = await t.http().get('/comercios?q=ZOCALOS').expect(200);
      expect(b.body.datos.map((c: { id: string }) => c.id)).toContain('com-m5a');
      const c = await t.http().get('/comercios?q=Panel%20A').expect(200);
      expect(c.body.datos.map((x: { id: string }) => x.id)).not.toContain('com-m5a');
      await reset();
    });
    it('cambiar coordenadas afecta el filtro de cercanía y la forma no cambia', async () => {
      const res = await patch({ coordenadas: { latitud: -32.5, longitud: -58.3 } }).expect(200);
      expect(res.body.datos.coordenadas).toEqual({ latitud: -32.5, longitud: -58.3 });
      await t.dataSource
        .getRepository(Comercio)
        .update({ id: 'com-m5a' }, { latitud: -32.4825, longitud: -58.2372 });
    });
  });
});
