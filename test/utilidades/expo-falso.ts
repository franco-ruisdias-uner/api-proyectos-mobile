import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface MensajeExpo {
  to: string;
  title: string;
  body: string;
  data: Record<string, string>;
  [otro: string]: unknown;
}

export interface ExpoFalso {
  /** Poné acá `EXPO_PUSH_URL`. */
  url: string;
  /** Un elemento por pedido HTTP que recibió, con los mensajes que traía. */
  pedidos: MensajeExpo[][];
  /** Tokens a los que responde `DeviceNotRegistered`. */
  invalidos: Set<string>;
  /** Tokens a los que responde un error de ticket que no es `DeviceNotRegistered`. */
  conError: Set<string>;
  /** Todos los mensajes recibidos, de todos los pedidos. */
  mensajes: () => MensajeExpo[];
  limpiar: () => void;
  cerrar: () => Promise<void>;
}

/**
 * Servidor HTTP que hace de API de push de Expo (POST de un arreglo de mensajes, respuesta
 * `{ data: [ticket, …] }` con un ticket por mensaje). Así la consigna no sale a internet.
 */
export async function levantarExpoFalso(): Promise<ExpoFalso> {
  const pedidos: MensajeExpo[][] = [];
  const invalidos = new Set<string>();
  const conError = new Set<string>();
  const servidor: Server = createServer((req, res) => {
    const trozos: Buffer[] = [];
    req.on('data', (t: Buffer) => trozos.push(t));
    req.on('end', () => {
      const mensajes = JSON.parse(Buffer.concat(trozos).toString('utf8')) as MensajeExpo[];
      pedidos.push(mensajes);
      const data = mensajes.map((m) =>
        invalidos.has(m.to)
          ? {
              status: 'error',
              message: `"${m.to}" is not a registered push notification recipient`,
              details: { error: 'DeviceNotRegistered' },
            }
          : conError.has(m.to)
            ? { status: 'error', message: 'Demasiados mensajes.', details: { error: 'MessageRateExceeded' } }
            : { status: 'ok', id: `ticket-${pedidos.length}` },
      );
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data }));
    });
  });
  await new Promise<void>((ok) => servidor.listen(0, '127.0.0.1', ok));
  return {
    url: `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/--/api/v2/push/send`,
    pedidos,
    invalidos,
    conError,
    mensajes: () => pedidos.flat(),
    limpiar: () => {
      pedidos.length = 0;
      invalidos.clear();
      conError.clear();
    },
    cerrar: () => new Promise((ok) => servidor.close(() => ok())),
  };
}
