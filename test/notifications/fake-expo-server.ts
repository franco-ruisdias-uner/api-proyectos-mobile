// Un servidor HTTP que se hace pasar por la API de push de Expo: la consigna no sale a
// internet. Guarda todo lo que recibe y contesta como Expo (un ticket por mensaje, en
// el mismo orden).
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface MensajeRecibido {
  to: string;
  title: string;
  body: string;
  data: Record<string, string>;
}

export class ServidorExpoFalso {
  /** Cada pedido que llegó, una tanda por pedido. */
  readonly tandas: MensajeRecibido[][] = [];
  /** Tokens a los que este servidor les contesta `DeviceNotRegistered`. */
  noRegistrados = new Set<string>();
  url = '';
  private servidor?: Server;

  /** Todos los mensajes recibidos, sin importar en qué tanda llegaron. */
  get mensajes(): MensajeRecibido[] {
    return this.tandas.flat();
  }

  vaciar(): void {
    this.tandas.length = 0;
  }

  async iniciar(): Promise<void> {
    this.servidor = createServer((req, res) => {
      let cuerpo = '';
      req.on('data', (c: Buffer) => (cuerpo += c.toString()));
      req.on('end', () => {
        const tanda = JSON.parse(cuerpo) as MensajeRecibido[];
        this.tandas.push(tanda);
        const data = tanda.map((m) =>
          this.noRegistrados.has(m.to)
            ? {
                status: 'error',
                message: 'The recipient device is not registered with FCM.',
                details: { error: 'DeviceNotRegistered' },
              }
            : { status: 'ok', id: `ticket-${m.to}` },
        );
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ data }));
      });
    });
    await new Promise<void>((r) => this.servidor!.listen(0, '127.0.0.1', r));
    this.url = `http://127.0.0.1:${(this.servidor.address() as AddressInfo).port}/--/api/v2/push/send`;
  }

  detener(): Promise<void> {
    return new Promise((r) =>
      this.servidor ? this.servidor.close(() => r()) : r(),
    );
  }
}
