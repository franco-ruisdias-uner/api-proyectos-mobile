import type { Dispositivo } from '../../../contract/api.js';

export function aDispositivo(d: Dispositivo): Dispositivo {
  return { tokenExpo: d.tokenExpo, plataforma: d.plataforma };
}
