import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { type AppDePrueba, crearApp } from '../utilities/create-app.js';

/** Un mensaje tal como le llega a "Expo": uno por teléfono. */
export interface MensajeAExpo {
  to: string;
  title: string;
  body: string;
  data: Record<string, string>;
  [clave: string]: unknown;
}

/**
 * Servidor HTTP que hace de API de push de Expo: guarda lo que le mandan y responde como
 * responde Expo (`{ data: [ticket, …] }`, un ticket por mensaje y en el mismo orden).
 * Así la consigna no sale a internet.
 */
export class ExpoFalso {
  /** Una entrada por pedido HTTP: el arreglo de mensajes de esa tanda. */
  readonly pedidos: MensajeAExpo[][] = [];
  /** Cabeceras `Content-Type` de cada pedido. */
  readonly contentTypes: (string | undefined)[] = [];
  /** Tokens a los que Expo responde `DeviceNotRegistered`. */
  readonly noRegistrados = new Set<string>();
  /** Con `true`, responde 500. */
  caido = false;
  private servidor: Server | undefined;
  url = '';

  get mensajes(): MensajeAExpo[] {
    return this.pedidos.flat();
  }

  /** Los tokens a los que se mandó algo, ordenados. */
  destinatarios(): string[] {
    return this.mensajes.map((m) => m.to).sort();
  }

  vaciar(): void {
    this.pedidos.length = 0;
    this.contentTypes.length = 0;
  }

  async iniciar(): Promise<void> {
    this.servidor = createServer((req, res) => {
      const partes: Buffer[] = [];
      req.on('data', (p: Buffer) => partes.push(p));
      req.on('end', () => {
        if (this.caido) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ errors: [{ code: 'INTERNAL', message: 'caído' }] }));
          return;
        }
        const cuerpo: unknown = JSON.parse(Buffer.concat(partes).toString('utf8') || 'null');
        const mensajes = (Array.isArray(cuerpo) ? cuerpo : [cuerpo]) as MensajeAExpo[];
        this.pedidos.push(mensajes);
        this.contentTypes.push(req.headers['content-type']);
        const data = mensajes.map((m) =>
          this.noRegistrados.has(m.to)
            ? {
                status: 'error',
                message: `"${m.to}" is not a registered push notification recipient`,
                details: { error: 'DeviceNotRegistered' },
              }
            : { status: 'ok', id: 'ticket-de-prueba' },
        );
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ data }));
      });
    });
    await new Promise<void>((resolver) => this.servidor!.listen(0, '127.0.0.1', resolver));
    this.url = `http://127.0.0.1:${(this.servidor.address() as AddressInfo).port}/--/api/v2/push/send`;
  }

  async detener(): Promise<void> {
    await new Promise<void>((resolver) => {
      if (!this.servidor) return resolver();
      this.servidor.close(() => resolver());
      this.servidor.closeAllConnections();
    });
  }
}

export interface AppConExpoFalso extends AppDePrueba {
  expo: ExpoFalso;
}

/**
 * La app completa con las piezas de verdad (guardado de tokens y enviador) apuntando al Expo
 * falso. Es lo que prueba la consigna de los alumnos.
 */
export async function crearAppConExpoFalso(): Promise<AppConExpoFalso> {
  const expo = new ExpoFalso();
  await expo.iniciar();
  const ctx = await crearApp({
    puertosReales: true,
    entorno: { NOTIFICACIONES: 'expo', EXPO_PUSH_URL: expo.url },
  });
  return {
    ...ctx,
    expo,
    cerrar: async () => {
      await ctx.cerrar();
      await expo.detener();
    },
  };
}

let n = 0;
/** Un token de Expo con el formato correcto, distinto cada vez. */
export const tokenNuevo = (): string =>
  `ExponentPushToken[prueba-${++n}-${Math.random().toString(36).slice(2, 10)}]`;
