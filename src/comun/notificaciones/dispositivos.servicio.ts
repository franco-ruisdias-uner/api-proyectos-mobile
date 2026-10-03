import { Inject, Injectable } from '@nestjs/common';
import type { Dispositivo, PruebaPush } from '../../../contrato/api.js';
import {
  ALMACEN_TOKENS_PUSH,
  type AlmacenTokensPush,
  ENVIADOR_PUSH,
  type EnviadorPush,
  type Plataforma,
} from './puertos.js';

@Injectable()
export class DispositivosServicio {
  constructor(
    @Inject(ALMACEN_TOKENS_PUSH) private readonly almacen: AlmacenTokensPush,
    @Inject(ENVIADOR_PUSH) private readonly enviador: EnviadorPush,
  ) {}

  async registrar(
    usuarioId: string,
    tokenExpo: string,
    plataforma: Plataforma,
  ): Promise<Dispositivo> {
    await this.almacen.guardar(usuarioId, tokenExpo, plataforma);
    return { tokenExpo, plataforma };
  }

  async darDeBaja(usuarioId: string, tokenExpo: string): Promise<void> {
    // Sólo si es del usuario: no se puede dar de baja el teléfono de otro.
    const suyos = await this.almacen.tokensDe([usuarioId]);
    if (suyos.includes(tokenExpo)) await this.almacen.borrar(tokenExpo);
  }

  /** Push de prueba a los teléfonos del usuario, aunque tenga los avisos apagados: es para depurar. */
  async probar(usuarioId: string): Promise<PruebaPush> {
    const tokens = await this.almacen.tokensDe([usuarioId]);
    if (tokens.length > 0) {
      const { tokensInvalidos } = await this.enviador.enviar([
        {
          tokens,
          titulo: 'Notificación de prueba',
          cuerpo: 'Si ves esto, las notificaciones andan.',
          datos: { tipo: 'prueba' },
        },
      ]);
      if (tokensInvalidos.length > 0) await this.almacen.descartar(tokensInvalidos);
    }
    return { dispositivos: tokens.length };
  }
}
