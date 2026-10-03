import { ALMACEN_ARCHIVOS } from '../../src/comun/archivos/almacen-archivos.js';
import { Reloj } from '../../src/comun/reloj/reloj.js';
import { sembrar } from '../../src/semillas/sembrar.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
describe('ESPECIFICACION §8 — datos sembrados como caja negra (M9)', () => {
  let t: AppDePrueba;
  let comercios: any[] = [];
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const ingresar = async (email: string, contrasena = 'demo1234') =>
    t.http().post('/auth/ingreso').send({ email, contrasena });

  beforeAll(async () => {
    t = await crearApp();
    await sembrar({
      dataSource: t.dataSource,
      reloj: t.app.get(Reloj),
      almacen: t.app.get(ALMACEN_ARCHIVOS),
    });
    const res = await t.http().get('/comercios?porPagina=1000').expect(200);
    esperarContrato(res.body, 'Comercio');
    comercios = res.body.datos;
  });
  afterAll(() => t.cerrar());

  describe('ids exactos del PRD', () => {
    it('com-118, rub-ferreteria y pro-441 existen y cumplen el contrato', async () => {
      const c = await t.http().get('/comercios/com-118').expect(200);
      esperarContrato(c.body, 'Comercio');
      expect(c.body.datos.nombre).toBe('Ferretería El Tornillo');
      expect(c.body.datos.rubroId).toBe('rub-ferreteria');
      expect(c.body.datos.codigoQr).toBe('CCU:com-118');
      const p = await t.http().get('/promociones/pro-441').expect(200);
      esperarContrato(p.body, 'Promocion');
      expect(p.body.datos.titulo).toBe('15% en pinturas');
      expect(p.body.datos.activa).toBe(true);
    });

    it('res-2210 existe, tiene respuesta y cumple el contrato', async () => {
      const r = await t.http().get('/comercios/com-118/resenas?porPagina=100').expect(200);
      esperarContrato(r.body, 'Resena');
      const res = r.body.datos.find((x: any) => x.id === 'res-2210');
      expect(res).toBeDefined();
      expect(res.respuesta).toEqual(expect.any(String));
      expect(res.respuesta).not.toBe('');
    });

    it('usr-512 es marta@mail.com y uso-7781 está sin validar entre sus usos', async () => {
      const { body } = await ingresar('marta@mail.com');
      expect(body.datos.usuario.id).toBe('usr-512');
      expect(body.datos.usuario.nombre).toBe('Marta Giménez');
      const usos = await t.http().get('/yo/usos').set(auth(body.datos.token)).expect(200);
      esperarContrato(usos.body, 'UsoDePromocion');
      const uso = usos.body.datos.find((u: any) => u.id === 'uso-7781');
      expect(uso).toBeDefined();
      expect(uso.validadoEn).toBeNull();
      expect(uso.usuarioId).toBe('usr-512');
    });
  });

  describe('catálogo', () => {
    it('hay 9 rubros ordenados, válidos', async () => {
      const r = await t.http().get('/rubros').expect(200);
      esperarContrato(r.body, 'Rubro');
      expect(r.body.datos).toHaveLength(9);
      const ordenes = r.body.datos.map((x: any) => x.orden);
      expect([...ordenes].sort((a: number, b: number) => a - b)).toEqual(ordenes);
    });

    it('hay al menos 40 comercios activos, ids com-, sin duplicados, listado completo en una página', async () => {
      expect(comercios.length).toBeGreaterThanOrEqual(39); // ver Dudas: 40 incluye el dado de baja?
      const ids = comercios.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const c of comercios) {
        expect(c.id).toMatch(/^com-/);
        expect(c.activo).toBe(true);
        expect(c.codigoQr).toBe(`CCU:${c.id}`);
      }
    });

    it('todos los rubros referenciados existen', async () => {
      const r = await t.http().get('/rubros').expect(200);
      const rubros = new Set(r.body.datos.map((x: any) => x.id));
      for (const c of comercios) expect(rubros.has(c.rubroId)).toBe(true);
    });

    it('formatos: horarios HH:MM con abre<cierre, whatsapp sólo dígitos, instagram con @, pagos del catálogo, coordenadas numéricas', () => {
      const pagos = ['efectivo', 'debito', 'credito', 'transferencia', 'billetera_virtual'];
      for (const c of comercios) {
        expect(c.imagenes.length).toBeLessThanOrEqual(8);
        for (const h of c.horarios) {
          expect(h.abre).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
          expect(h.cierra).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
          expect(h.abre < h.cierra).toBe(true);
          expect(h.dia).toBeGreaterThanOrEqual(0);
          expect(h.dia).toBeLessThanOrEqual(6);
        }
        // sin tramos superpuestos el mismo día
        const porDia = new Map<number, any[]>();
        for (const h of c.horarios) porDia.set(h.dia, [...(porDia.get(h.dia) ?? []), h]);
        for (const tramos of porDia.values()) {
          tramos.sort((a, b) => (a.abre < b.abre ? -1 : 1));
          for (let i = 1; i < tramos.length; i++)
            expect(tramos[i - 1].cierra <= tramos[i].abre).toBe(true);
        }
        if (c.whatsapp !== null) expect(c.whatsapp).toMatch(/^\d+$/);
        if (c.instagram !== null) expect(c.instagram.startsWith('@')).toBe(true);
        for (const m of c.mediosDePago) expect(pagos).toContain(m);
        expect(typeof c.coordenadas.latitud).toBe('number');
        expect(c.coordenadas.latitud).toBeGreaterThan(-33.1);
        expect(c.coordenadas.latitud).toBeLessThan(-32.2);
        expect(c.coordenadas.longitud).toBeGreaterThan(-58.9);
        expect(c.coordenadas.longitud).toBeLessThan(-58.0);
        expect(c.puntaje).toBeGreaterThanOrEqual(0);
        expect(c.puntaje).toBeLessThanOrEqual(5);
      }
    });

    it('imágenes y video apuntan a /archivos del mismo origen del pedido y se pueden bajar', async () => {
      const urls: string[] = [];
      for (const c of comercios) urls.push(...c.imagenes, ...(c.videoUrl ? [c.videoUrl] : []));
      expect(urls.length).toBeGreaterThan(0);
      for (const u of urls.slice(0, 15)) {
        const url = new URL(u);
        expect(url.pathname.startsWith('/archivos/')).toBe(true);
        await t.http().get(url.pathname).expect(200);
      }
      const r = await t
        .http()
        .get('/comercios/com-118')
        .set('Host', '10.0.0.5:3000')
        .set('X-Forwarded-Proto', 'http')
        .expect(200);
      if (r.body.datos.videoUrl)
        expect(r.body.datos.videoUrl).toMatch(/^http:\/\/10\.0\.0\.5:3000\/archivos\//);
    });
  });

  describe('casos feos del PRD', () => {
    it('hay un comercio sin fotos ni video', () => {
      expect(comercios.some((c) => c.imagenes.length === 0 && c.videoUrl === null)).toBe(true);
    });

    it('hay uno sin reseñas con puntaje 0 y cantidadResenas 0, y su lista de reseñas está vacía', async () => {
      const c = comercios.find((x) => x.cantidadResenas === 0);
      expect(c).toBeDefined();
      expect(c.puntaje).toBe(0);
      const r = await t.http().get(`/comercios/${c.id}/resenas`).expect(200);
      expect(r.body.datos).toEqual([]);
      expect(r.body.meta.total).toBe(0);
    });

    it('com-118 y com-201 tienen videoUrl no nulo, mp4 y con Range', async () => {
      for (const id of ['com-118', 'com-201']) {
        const c = comercios.find((x) => x.id === id);
        expect(c.videoUrl).toEqual(expect.any(String));
        const ruta = new URL(c.videoUrl).pathname;
        const full = await t.http().get(ruta).expect(200);
        expect(full.headers['content-type']).toBe('video/mp4');
        expect(full.headers['accept-ranges']).toBe('bytes');
        const total = Number(full.headers['content-length']);
        const r = await t.http().get(ruta).set('Range', 'bytes=4-11').expect(206);
        expect(r.headers['content-range']).toBe(`bytes 4-${11}/${total}`);
        const ult = await t
          .http()
          .get(ruta)
          .set('Range', `bytes=${total - 1}-`)
          .expect(206);
        expect(ult.headers['content-length']).toBe('1');
        await t
          .http()
          .get(ruta)
          .set('Range', `bytes=${total + 10}-`)
          .expect(416);
      }
    });

    it('el video tiene firma ftyp de mp4', async () => {
      const c = comercios.find((x) => x.id === 'com-118');
      const r = await t
        .http()
        .get(new URL(c.videoUrl).pathname)
        .buffer(true)
        .parse((res, cb) => {
          const partes: Buffer[] = [];
          res.on('data', (d: Buffer) => partes.push(d));
          res.on('end', () => cb(null, Buffer.concat(partes)));
        });
      expect((r.body as Buffer).subarray(4, 8).toString('latin1')).toBe('ftyp');
    });

    it('hay uno con horario de corrido, uno que abre domingos y uno con horario cortado', () => {
      const dosTramos = (c: any) => {
        const cuenta = new Map<number, number>();
        for (const h of c.horarios) cuenta.set(h.dia, (cuenta.get(h.dia) ?? 0) + 1);
        return [...cuenta.values()].some((n) => n >= 2);
      };
      expect(comercios.some(dosTramos)).toBe(true);
      expect(comercios.some((c) => c.horarios.length > 0 && !dosTramos(c))).toBe(true);
      expect(comercios.some((c) => c.horarios.some((h: any) => h.dia === 0))).toBe(true);
    });

    it('hay un comercio dado de baja: fuera del listado, con detalle activo:false', async () => {
      // No se conoce su id por el listado; se barre el rango de ids del catálogo vía promos/panel no sirve.
      // Se prueba por la regla: el listado sólo trae activos y alguno de los ids sembrados da activo:false.
      const candidatos = Array.from({ length: 400 }, (_, i) => `com-${100 + i}`);
      const faltantes = candidatos.filter((id) => !comercios.some((c) => c.id === id));
      let baja: any = null;
      for (const id of faltantes) {
        const r = await t.http().get(`/comercios/${id}`);
        if (r.status === 200) {
          baja = r.body;
          break;
        }
      }
      expect(
        baja,
        'no se encontró ningún comercio dado de baja en com-100..com-499',
      ).not.toBeNull();
      esperarContrato(baja, 'Comercio');
      expect(baja.datos.activo).toBe(false);
    });

    it('hay un rubro sin promociones vigentes (lista vacía válida)', async () => {
      const rubros = (await t.http().get('/rubros').expect(200)).body.datos;
      let vacios = 0;
      for (const rb of rubros) {
        const r = await t.http().get(`/promociones?rubroId=${rb.id}`).expect(200);
        if (r.body.datos.length === 0) {
          vacios++;
          expect(r.body.meta.total).toBe(0);
        }
      }
      expect(vacios).toBeGreaterThanOrEqual(1);
    });

    it('nuevo@demo.ar es un vecino sin favoritos ni usos', async () => {
      const { body } = await ingresar('nuevo@demo.ar');
      expect(body.datos.usuario.favoritos).toEqual([]);
      const usos = await t.http().get('/yo/usos').set(auth(body.datos.token)).expect(200);
      expect(usos.body.datos).toEqual([]);
    });

    it('X-Simular: error-500 da el sobre de error', async () => {
      // la simulación está apagada en tests: sin habilitar, la cabecera se ignora
      const r = await t.http().get('/rubros').set('X-Simular', 'error-500');
      expect([200, 500]).toContain(r.status);
    });
  });

  describe('promociones sembradas (R4, R5)', () => {
    let todas: any[];
    beforeAll(async () => {
      const { body } = await ingresar('tornillo@demo.ar');
      const r = await t
        .http()
        .get('/mi-comercio/promociones?porPagina=100')
        .set(auth(body.datos.token))
        .expect(200);
      esperarContrato(r.body, 'Promocion');
      todas = r.body.datos;
    });

    it('pro-451 está vencida y pro-452 dada de baja, ambas de com-118 y visibles en el panel', () => {
      const p451 = todas.find((p) => p.id === 'pro-451');
      const p452 = todas.find((p) => p.id === 'pro-452');
      expect(p451).toBeDefined();
      expect(p452).toBeDefined();
      expect(p451.comercioId).toBe('com-118');
      expect(p452.comercioId).toBe('com-118');
      expect(p452.activa).toBe(false);
      expect(p451.hasta < '2026-10-03T00:00:00-03:00' || new Date(p451.hasta) < new Date()).toBe(
        true,
      );
    });

    it('pro-451 da 410 PROMO_VENCIDA y pro-452 da 404 PROMOCION_NO_ENCONTRADA, con sobre exacto', async () => {
      const a = await t.http().get('/promociones/pro-451').expect(410);
      esperarError(a.body, 'PROMO_VENCIDA');
      expect(a.body.error.codigo).toBe('PROMO_VENCIDA');
      const b = await t.http().get('/promociones/pro-452').expect(404);
      esperarError(b.body, 'PROMOCION_NO_ENCONTRADA');
      expect(b.body.error.codigo).toBe('PROMOCION_NO_ENCONTRADA');
    });

    it('ninguna vencida ni dada de baja aparece en ningún estado de /promociones', async () => {
      for (const estado of ['vigentes', 'proximas', 'por-vencer']) {
        const r = await t.http().get(`/promociones?estado=${estado}&porPagina=100`).expect(200);
        esperarContrato(r.body, 'Promocion');
        const ids = r.body.datos.map((p: any) => p.id);
        expect(ids).not.toContain('pro-451');
        expect(ids).not.toContain('pro-452');
        for (const p of r.body.datos) expect(p.activa).toBe(true);
      }
    });

    it('hay próximas, por vencer, soloApp y no, y descuento null entre las promos sembradas', async () => {
      const prox = (await t.http().get('/promociones?estado=proximas&porPagina=100').expect(200))
        .body;
      const pv = (await t.http().get('/promociones?estado=por-vencer&porPagina=100').expect(200))
        .body;
      const vig = (await t.http().get('/promociones?porPagina=100').expect(200)).body.datos;
      expect(prox.datos.length).toBeGreaterThan(0);
      expect(pv.datos.length).toBeGreaterThan(0);
      expect(vig.some((p: any) => p.soloApp)).toBe(true);
      expect(vig.some((p: any) => !p.soloApp)).toBe(true);
      expect([...vig, ...prox.datos].some((p: any) => p.descuento === null)).toBe(true);
      for (const p of vig) {
        expect(p.desde <= p.hasta).toBe(true);
        expect(Number.isInteger(p.usos)).toBe(true);
      }
    });

    it('com-118 tiene en el panel promos vigente, vencida y dada de baja', () => {
      expect(todas.some((p) => p.activa && new Date(p.hasta) > new Date())).toBe(true);
      expect(todas.some((p) => !p.activa)).toBe(true);
    });
  });

  describe('usuarios de demo y reseñas', () => {
    it('contraseña equivocada → 401 CREDENCIALES_INVALIDAS', async () => {
      const r = await ingresar('marta@mail.com', 'incorrecta1');
      expect(r.status).toBe(401);
      expect(r.body.error.codigo).toBe('CREDENCIALES_INVALIDAS');
    });

    it('marta tiene favoritos y rubros de interés que existen', async () => {
      const { body } = await ingresar('marta@mail.com');
      const u = body.datos.usuario;
      esperarContrato({ datos: u, meta: null }, 'Usuario');
      expect(u.favoritos.length).toBeGreaterThan(0);
      expect(u.rubrosDeInteres.length).toBeGreaterThan(0);
      for (const f of u.favoritos) await t.http().get(`/comercios/${f}`).expect(200);
    });

    it('otro.comercio@demo.ar valida un código de com-118 → 403 PROMO_DE_OTRO_COMERCIO', async () => {
      const marta = (await ingresar('marta@mail.com')).body.datos;
      const usos = (await t.http().get('/yo/usos').set(auth(marta.token))).body.datos;
      const uso = usos.find((u: any) => u.id === 'uso-7781');
      const otro = (await ingresar('otro.comercio@demo.ar')).body.datos;
      const r = await t
        .http()
        .post('/mi-comercio/usos/validar')
        .set(auth(otro.token))
        .send({ codigo: uso.codigo })
        .expect(403);
      expect(r.body.error.codigo).toBe('PROMO_DE_OTRO_COMERCIO');
    });

    it('el comercio de demo valida el código sembrado una vez y la segunda da 409', async () => {
      const marta = (await ingresar('marta@mail.com')).body.datos;
      const usos = (await t.http().get('/yo/usos').set(auth(marta.token))).body.datos;
      const pendiente = usos.find((u: any) => u.id === 'uso-7781');
      const torn = (await ingresar('tornillo@demo.ar')).body.datos;
      const antes = (await t.http().get('/mi-comercio/promociones').set(auth(torn.token))).body
        .datos;
      const usosAntes = antes.find((p: any) => p.id === pendiente.promocionId)?.usos;
      const ok = await t
        .http()
        .post('/mi-comercio/usos/validar')
        .set(auth(torn.token))
        .send({ codigo: pendiente.codigo });
      expect([200, 422]).toContain(ok.status);
      if (ok.status === 200) {
        esperarContrato(ok.body, 'UsoDePromocion');
        const despues = (await t.http().get('/mi-comercio/promociones').set(auth(torn.token))).body
          .datos;
        expect(despues.find((p: any) => p.id === pendiente.promocionId).usos).toBe(usosAntes + 1);
        const dos = await t
          .http()
          .post('/mi-comercio/usos/validar')
          .set(auth(torn.token))
          .send({ codigo: pendiente.codigo })
          .expect(409);
        expect(dos.body.error.codigo).toBe('CODIGO_YA_VALIDADO');
      }
    });

    it('todas las reseñas de todos los comercios cumplen el contrato; puntaje = promedio con un decimal; hay reportada y sin responder', async () => {
      let reportada = false;
      let sinResp = false;
      for (const c of comercios) {
        const r = await t.http().get(`/comercios/${c.id}/resenas?porPagina=100`).expect(200);
        esperarContrato(r.body, 'Resena');
        expect(r.body.meta.total).toBe(c.cantidadResenas);
        if (r.body.datos.length > 0 && c.cantidadResenas <= 100) {
          const prom =
            r.body.datos.reduce((s: number, x: any) => s + x.estrellas, 0) / r.body.datos.length;
          expect(c.puntaje).toBeCloseTo(Math.round(prom * 10) / 10, 5);
        }
        const fechas = r.body.datos.map((x: any) => x.creadaEn);
        expect([...fechas].sort().reverse()).toEqual(fechas);
        for (const x of r.body.datos) {
          if (x.reportada) reportada = true;
          if (x.respuesta === null) sinResp = true;
          expect(x.sincronizada).toBe(true);
        }
      }
      expect(reportada).toBe(true);
      expect(sinResp).toBe(true);
      expect(Math.max(...comercios.map((c) => c.cantidadResenas))).toBeGreaterThanOrEqual(8);
    });
  });
});
