import type { Dispositivo as DispositivoContrato } from '../../../contrato/api.js';
import type { Dispositivo } from './dispositivo.entidad.js';

export function aDispositivo(d: Dispositivo): DispositivoContrato {
  return { tokenExpo: d.tokenExpo, plataforma: d.plataforma };
}
