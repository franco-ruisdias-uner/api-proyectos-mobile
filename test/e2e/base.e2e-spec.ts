import { Controller, Get, Post, Body } from '@nestjs/common';
import { IsInt, Min, IsDefined } from 'class-validator';
import { Publico, Roles } from '../../src/comun/auth/decoradores.js';
import { ErrorDeApi } from '../../src/comun/errores/error-de-api.js';
import { respuestaUno } from '../../src/comun/respuesta/respuesta.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { crearUsuario } from '../utilidades/usuarios.js';

class CuerpoDePrueba {
  @IsDefined({ message: 'Falta la cantidad.' })
  @IsInt({ message: 'La cantidad tiene que ser un número entero.' })
  @Min(1, { message: 'La cantidad tiene que ser al menos 1.' })
  cantidad: number;
}

/** Controlador sólo para los tests de lo transversal. */
@Controller('prueba-base')
class ControladorDePrueba {
  @Get('direccion')
  @Roles('direccion')
  soloDireccion() {
    return respuestaUno({ ok: true });
  }

  @Get('con-sesion')
  conSesion() {
    return respuestaUno({ ok: true });
  }

  @Post('validacion')
  @Publico()
  validar(@Body() cuerpo: CuerpoDePrueba) {
    return respuestaUno(cuerpo);
  }

  @Get('explota')
  @Publico()
  explotar() {
    throw new Error('detalle interno que no tiene que salir');
  }

  @Get('negocio')
  @Publico()
  negocio() {
    throw new ErrorDeApi('EMAIL_YA_REGISTRADO');
  }
}

describe('M0 — lo transversal', () => {
  let ctx: AppDePrueba;

  beforeAll(async () => {
    ctx = await crearApp({ controladores: [ControladorDePrueba] });
  });
  afterAll(() => ctx.cerrar());

  describe('AGENTS §11.4 — GET /salud', () => {
    it('responde el estado, el motor, el almacén y la versión', async () => {
      const r = await ctx.http.get('/salud').expect(200);
      esperarContrato(r.body, 'Salud');
      expect(r.body.datos).toMatchObject({
        estado: 'ok',
        motor: process.env.DB_MOTOR ?? 'better-sqlite3',
        almacen: 'local',
      });
      expect(r.body.datos.version).toMatch(/^\d+\.\d+\.\d+/);
    });

    it('es público: no pide sesión', async () => {
      await ctx.http.get('/salud').expect(200);
    });

    it('espec. R17 — toda respuesta lleva la cabecera Date', async () => {
      const r = await ctx.http.get('/salud');
      expect(r.headers.date).toBeDefined();
      expect(Number.isNaN(Date.parse(r.headers.date))).toBe(false);
    });

    it('AGENTS §11.4 — CORS abierto', async () => {
      const r = await ctx.http.get('/salud').set('Origin', 'http://localhost:8081');
      expect(r.headers['access-control-allow-origin']).toBe('*');
    });
  });

  describe('AGENTS §4.6 — errores con el sobre { error: { codigo, mensaje } }', () => {
    it('una ruta que no existe → 404 RUTA_NO_ENCONTRADA, aun sin sesión', async () => {
      esperarError(await ctx.http.get('/no-existe'), 404, 'RUTA_NO_ENCONTRADA');
      esperarError(await ctx.http.post('/salud'), 404, 'RUTA_NO_ENCONTRADA');
    });

    it('una excepción inesperada → 500 ERROR_INTERNO sin detalles', async () => {
      const r = await ctx.http.get('/prueba-base/explota');
      esperarError(r, 500, 'ERROR_INTERNO');
      expect(JSON.stringify(r.body)).not.toContain('detalle interno');
    });

    it('un error de negocio sale con su código y estado del catálogo', async () => {
      esperarError(await ctx.http.get('/prueba-base/negocio'), 409, 'EMAIL_YA_REGISTRADO');
    });

    it('un JSON mal formado → 400 VALIDACION_FALLIDA', async () => {
      const r = await ctx.http
        .post('/prueba-base/validacion')
        .set('Content-Type', 'application/json')
        .send('{"cantidad": ');
      esperarError(r, 400, 'VALIDACION_FALLIDA');
      expect(r.body.error.mensaje).toBe('Lo que mandaste no es un JSON válido.');
    });
  });

  describe('AGENTS §7.3 — validación en castellano, nombrando el campo', () => {
    it('camino feliz', async () => {
      const r = await ctx.http.post('/prueba-base/validacion').send({ cantidad: 3 }).expect(201);
      expect(r.body).toEqual({ datos: { cantidad: 3 }, meta: null });
    });

    it.each([
      [{}, 'Falta la cantidad.'],
      [{ cantidad: 'tres' }, 'La cantidad tiene que ser un número entero.'],
      [{ cantidad: 0 }, 'La cantidad tiene que ser al menos 1.'],
      [{ cantidad: 1, sobra: true }, 'No se esperaba el dato «sobra».'],
    ])('%j → %s', async (cuerpo, mensaje) => {
      const r = await ctx.http.post('/prueba-base/validacion').send(cuerpo);
      esperarError(r, 400, 'VALIDACION_FALLIDA');
      expect(r.body.error.mensaje).toBe(mensaje);
    });
  });

  describe('AGENTS §7.3 — seguro por defecto', () => {
    it('sin token → 401 NO_AUTENTICADO', async () => {
      esperarError(await ctx.http.get('/prueba-base/con-sesion'), 401, 'NO_AUTENTICADO');
    });

    it('con un rol que no corresponde → 403 SIN_PERMISO', async () => {
      const pasajero = await crearUsuario(ctx);
      esperarError(
        await ctx.http.get('/prueba-base/direccion').set(pasajero.auth),
        403,
        'SIN_PERMISO',
      );
    });

    it('con el rol correcto pasa', async () => {
      const direccion = await crearUsuario(ctx, { rol: 'direccion' });
      await ctx.http.get('/prueba-base/direccion').set(direccion.auth).expect(200);
    });

    it('sin rol pedido, cualquier sesión pasa', async () => {
      const pasajero = await crearUsuario(ctx);
      await ctx.http.get('/prueba-base/con-sesion').set(pasajero.auth).expect(200);
    });
  });

  describe('AGENTS §11.5 — Swagger', () => {
    it('/docs-json documenta los endpoints de M0 con sus errores', async () => {
      const r = await ctx.http.get('/docs-json').expect(200);
      const rutas = Object.keys(r.body.paths as object);
      for (const ruta of [
        '/salud',
        '/auth/registro',
        '/auth/ingreso',
        '/yo',
        '/archivos',
        '/archivos/{clave}',
        '/dispositivos',
        '/dispositivos/prueba',
        '/dispositivos/{tokenExpo}',
      ]) {
        expect(rutas).toContain(ruta);
      }
      expect(JSON.stringify(r.body.paths['/auth/registro'])).toContain('EMAIL_YA_REGISTRADO');
    });

    it('/docs sirve la página', async () => {
      const r = await ctx.http.get('/docs/');
      expect(r.status).toBe(200);
      expect(r.text).toContain('swagger');
    });
  });
});

describe('AGENTS §11.4 — simulación de fallas', () => {
  it('apagada (default en tests): X-Simular se ignora', async () => {
    const ctx = await crearApp();
    try {
      await ctx.http.get('/salud').set('X-Simular', 'error-500').expect(200);
    } finally {
      await ctx.cerrar();
    }
  });

  describe('prendida', () => {
    let ctx: AppDePrueba;
    beforeAll(async () => {
      ctx = await crearApp({ entorno: { SIMULACION_HABILITADA: 'true' } });
    });
    afterAll(() => ctx.cerrar());

    it('X-Simular: error-500 → 500 ERROR_INTERNO', async () => {
      esperarError(
        await ctx.http.get('/salud').set('X-Simular', 'error-500'),
        500,
        'ERROR_INTERNO',
      );
    });

    it('X-Simular: demora-300 → responde bien, pero tarde', async () => {
      const inicio = performance.now();
      const r = await ctx.http.get('/salud').set('X-Simular', 'demora-300');
      expect(r.status).toBe(200);
      expect(performance.now() - inicio).toBeGreaterThanOrEqual(290);
    });

    it('un valor que no reconoce se ignora', async () => {
      await ctx.http.get('/salud').set('X-Simular', 'cualquier-cosa').expect(200);
    });
  });
});
