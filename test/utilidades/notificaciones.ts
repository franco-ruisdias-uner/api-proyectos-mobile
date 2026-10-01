// Dobles de prueba de las notificaciones (AGENTS §19.2): dos en memoria para los tests de
// dominio (qué decidió Avisos) y un servidor HTTP que se hace pasar por Expo para los de la
// consigna de los alumnos (qué llegó a Expo).
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Plataforma } from '../../contrato/api.js';
import type {
  AlmacenTokensPush,
  EnviadorPush,
  MensajePush,
} from '../../src/comun/notificaciones/puertos.js';

/** Una push que "se mandó", de a un token (como las ve cada teléfono). */
export interface PushEnviada {
  tokenExpo: string;
  titulo: string;
  cuerpo: string;
  datos: Record<string, string>;
}

/** Lo que los tests de dominio miran: qué se mandó y a quién. */
export interface NotificadorDePrueba {
  readonly enviadas: PushEnviada[];
  /** Los próximos envíos a ese token vuelven como "dispositivo dado de baja". */
  marcarInvalido(tokenExpo: string): void;
  /** El próximo envío falla (el proveedor está caído). */
  fallarProximoEnvio(): void;
  limpiar(): void;
}

export class AlmacenTokensMemoria implements AlmacenTokensPush {
  private readonly tokens = new Map<string, string>();

  guardar(
    usuarioId: string,
    tokenExpo: string,
    _plataforma: Plataforma,
  ): Promise<void> {
    this.tokens.set(tokenExpo, usuarioId);
    return Promise.resolve();
  }
  borrar(tokenExpo: string): Promise<void> {
    this.tokens.delete(tokenExpo);
    return Promise.resolve();
  }
  tokensDe(usuarioIds: string[]): Promise<string[]> {
    return Promise.resolve(
      [...this.tokens]
        .filter(([, u]) => usuarioIds.includes(u))
        .map(([t]) => t),
    );
  }
  descartar(tokens: string[]): Promise<void> {
    for (const t of tokens) this.tokens.delete(t);
    return Promise.resolve();
  }
}

export class EnviadorMemoria implements EnviadorPush, NotificadorDePrueba {
  readonly enviadas: PushEnviada[] = [];
  private readonly invalidos = new Set<string>();
  private fallar = false;

  enviar(mensajes: MensajePush[]): Promise<{ tokensInvalidos: string[] }> {
    if (this.fallar) {
      this.fallar = false;
      return Promise.reject(new Error('Falla simulada del proveedor de push'));
    }
    const tokens = mensajes.flatMap((m) => {
      this.enviadas.push(
        ...m.tokens.map((tokenExpo) => ({
          tokenExpo,
          titulo: m.titulo,
          cuerpo: m.cuerpo,
          datos: m.datos,
        })),
      );
      return m.tokens;
    });
    return Promise.resolve({
      tokensInvalidos: tokens.filter((t) => this.invalidos.has(t)),
    });
  }
  marcarInvalido(tokenExpo: string): void {
    this.invalidos.add(tokenExpo);
  }
  fallarProximoEnvio(): void {
    this.fallar = true;
  }
  limpiar(): void {
    this.enviadas.length = 0;
    this.invalidos.clear();
    this.fallar = false;
  }
}

interface MensajeExpo {
  to: string;
  title: string;
  body: string;
  data: Record<string, string>;
}

/** Servidor que imita POST /--/api/v2/push/send de Expo: un ticket por mensaje, en orden. */
export class ExpoFalso implements NotificadorDePrueba {
  readonly enviadas: PushEnviada[] = [];
  /** Cada pedido que llegó, tal cual (para mirar la forma y las tandas). */
  readonly pedidos: MensajeExpo[][] = [];
  private readonly invalidos = new Set<string>();
  private fallar = false;
  private readonly servidor: Server;
  url = '';

  constructor() {
    this.servidor = createServer((req, res) => {
      const partes: Buffer[] = [];
      req.on('data', (p: Buffer) => partes.push(p));
      req.on('end', () => {
        if (this.fallar) {
          this.fallar = false;
          res.writeHead(500).end('error simulado');
          return;
        }
        const mensajes = JSON.parse(
          Buffer.concat(partes).toString('utf8'),
        ) as MensajeExpo[];
        this.pedidos.push(mensajes);
        for (const m of mensajes)
          this.enviadas.push({
            tokenExpo: m.to,
            titulo: m.title,
            cuerpo: m.body,
            datos: m.data,
          });
        const data = mensajes.map((m, i) =>
          this.invalidos.has(m.to)
            ? {
                status: 'error',
                message: `"${m.to}" is not a registered push notification recipient`,
                details: { error: 'DeviceNotRegistered' },
              }
            : { status: 'ok', id: `ticket-${this.pedidos.length}-${i}` },
        );
        res
          .writeHead(200, { 'content-type': 'application/json' })
          .end(JSON.stringify({ data }));
      });
    });
  }

  async iniciar(): Promise<void> {
    await new Promise<void>((ok) => this.servidor.listen(0, '127.0.0.1', ok));
    this.url = `http://127.0.0.1:${(this.servidor.address() as AddressInfo).port}/--/api/v2/push/send`;
  }
  async cerrar(): Promise<void> {
    await new Promise<void>((ok) => this.servidor.close(() => ok()));
  }
  marcarInvalido(tokenExpo: string): void {
    this.invalidos.add(tokenExpo);
  }
  fallarProximoEnvio(): void {
    this.fallar = true;
  }
  limpiar(): void {
    this.enviadas.length = 0;
    this.pedidos.length = 0;
    this.invalidos.clear();
    this.fallar = false;
  }
}
